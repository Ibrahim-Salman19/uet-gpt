import { describe, expect, it } from "vitest";
import { CompositeKnowledgeStore } from "../../convex/knowledgeStore/compositeStore";
import type {
  CommitGenerationResult,
  DeleteDocumentResult,
  DenseSearchOptions,
  HealthResult,
  IntegrityReport,
  KnowledgeChunk,
  KnowledgeChunkInput,
  KnowledgeDocumentInput,
  KnowledgeStore,
  KnowledgeStoreStats,
  LexicalSearchOptions,
  SearchResult,
  UpsertDocumentResult,
} from "../../convex/knowledgeStore/types";
import { InMemoryKnowledgeStore } from "./inMemoryKnowledgeStore";
import { runKnowledgeStoreContractTests } from "./knowledgeStoreContract";

// None of RecordingStore/stubStore/InMemoryKnowledgeStore use ctx (matching
// the contract file's own "ctx as never" convention for backends where it's
// unused) - one typed constant instead of a bare `undefined` at every call
// site, which `tsc` accepts as ActionCtx but a literal undefined does not.
const ctx = undefined as unknown as import("../../convex/_generated/server").ActionCtx;

// 1) The shared, backend-agnostic contract suite (already exercises Turso and
// Zilliz adapters elsewhere) run against a CompositeKnowledgeStore built from
// two INDEPENDENT in-memory stores - genuinely separate dense/lexical
// backends, mirroring the real Pinecone+Convex split, not one store playing
// both roles. If composing two working backends broke any of the ordinary
// ingest/search/delete/generation behaviour the contract checks, this is
// where it would show up.
runKnowledgeStoreContractTests("composite (independent dense + lexical in-memory stores)", async () => {
  const store = new CompositeKnowledgeStore(new InMemoryKnowledgeStore(), new InMemoryKnowledgeStore());
  return { store, ctx: undefined, cleanup: async () => {} };
});

// 2) Ordering and failure-propagation tests specific to CompositeKnowledgeStore
// itself - properties the contract suite above cannot see, because it only
// observes end-to-end behaviour, not which backend was called first or what
// happens when one of them fails. These prove the invariants documented as
// load-bearing in compositeStore.ts and docs/SHIP.md.

/** Records every call, across BOTH stores, into one SHARED array in true
 * invocation order - the only way to actually prove "X ran before Y" across
 * two separate objects. Two independent `.calls` arrays (one per store)
 * cannot establish cross-store ordering: concatenating them after the fact
 * (`[...dense.calls, ...lexical.calls]`) just reproduces whichever array was
 * listed first in the expression, regardless of which store was actually
 * invoked first - that mistake is exactly what let the first version of this
 * test pass with a `.toEqual([])` assertion that was checked AFTER the call
 * it meant to guard, and it went unnoticed until this was rewritten.
 * failOnce lets a test assert what happens when one side fails, on the same
 * shared log. */
class RecordingStore implements KnowledgeStore {
  private failNext = new Set<string>();

  constructor(
    private readonly name: string,
    private readonly log: string[],
  ) {}

  failOnce(method: string) {
    this.failNext.add(method);
  }

  private record(method: string) {
    this.log.push(`${this.name}.${method}`);
    if (this.failNext.has(method)) {
      this.failNext.delete(method);
      throw new Error(`${this.name}.${method} deliberately failed`);
    }
  }

  async upsertDocument(_ctx: unknown, _doc: KnowledgeDocumentInput): Promise<UpsertDocumentResult> {
    this.record("upsertDocument");
    return { documentId: `${this.name}-doc`, generation: 1, fastPathEligible: false };
  }
  async upsertChunks(
    _ctx: unknown,
    _documentId: string,
    _generation: number,
    _category: string,
    _chunks: KnowledgeChunkInput[],
  ): Promise<void> {
    this.record("upsertChunks");
  }
  async commitGeneration(
    _ctx: unknown,
    _documentId: string,
    _generation: number,
  ): Promise<CommitGenerationResult> {
    this.record("commitGeneration");
    return { deletedStaleChunks: 0 };
  }
  async deleteDocument(_ctx: unknown, _documentId: string): Promise<DeleteDocumentResult> {
    this.record("deleteDocument");
    return { deletedChunks: 0 };
  }
  async denseSearch(
    _ctx: unknown,
    _q: Float32Array,
    _opts: DenseSearchOptions,
  ): Promise<SearchResult[]> {
    this.record("denseSearch");
    return [];
  }
  async lexicalSearch(_ctx: unknown, _q: string, _opts: LexicalSearchOptions): Promise<SearchResult[]> {
    this.record("lexicalSearch");
    return [];
  }
  async getChunks(
    _ctx: unknown,
    _refs: Array<{ documentId: string; chunkKey: string }>,
  ): Promise<KnowledgeChunk[]> {
    this.record("getChunks");
    return [];
  }
  async health(): Promise<HealthResult> {
    this.record("health");
    return { ok: true, latencyMs: 1 };
  }
  async stats(): Promise<KnowledgeStoreStats> {
    this.record("stats");
    return { documentCount: 0, chunkCount: 0 };
  }
  async verifyIntegrity(): Promise<IntegrityReport> {
    this.record("verifyIntegrity");
    return { duplicateChunkKeys: 0, crossDocumentChunkKeyCollisions: 0, orphanChunks: 0 };
  }
}

/** A minimal KnowledgeStore where every method not explicitly given throws
 * loudly if called - so a test that only cares about one method (e.g.
 * commitGeneration's return-value aggregation) cannot accidentally pass
 * because an untested method silently no-op'd instead of failing. */
function stubStore(overrides: Partial<KnowledgeStore>): KnowledgeStore {
  const unimplemented = (method: string) => async () => {
    throw new Error(`stubStore: ${method} was not expected to be called in this test`);
  };
  return {
    upsertDocument: overrides.upsertDocument ?? unimplemented("upsertDocument"),
    upsertChunks: overrides.upsertChunks ?? unimplemented("upsertChunks"),
    commitGeneration: overrides.commitGeneration ?? unimplemented("commitGeneration"),
    deleteDocument: overrides.deleteDocument ?? unimplemented("deleteDocument"),
    denseSearch: overrides.denseSearch ?? unimplemented("denseSearch"),
    lexicalSearch: overrides.lexicalSearch ?? unimplemented("lexicalSearch"),
    getChunks: overrides.getChunks ?? unimplemented("getChunks"),
    health: overrides.health ?? unimplemented("health"),
    stats: overrides.stats ?? unimplemented("stats"),
    verifyIntegrity: overrides.verifyIntegrity ?? unimplemented("verifyIntegrity"),
  } as KnowledgeStore;
}

const anyDoc: KnowledgeDocumentInput = {
  canonicalUrl: "https://web.uettaxila.edu.pk/x",
  title: "X",
  contentHash: "h",
  indexingFingerprint: "f",
  category: "crawled",
};
const anyChunks: KnowledgeChunkInput[] = [
  {
    chunkKey: "k",
    ordinalWithinHeading: 0,
    headingPath: ["X"],
    text: "text",
    embedding: new Float32Array(4),
  },
];

describe("CompositeKnowledgeStore: ordering and failure propagation", () => {
  it("upsertDocument calls lexical (identity authority) before dense, and returns lexical's result", async () => {
    const log: string[] = [];
    const dense = new RecordingStore("dense", log);
    const lexical = new RecordingStore("lexical", log);
    const store = new CompositeKnowledgeStore(dense, lexical);

    const result = await store.upsertDocument(ctx, anyDoc);

    expect(log).toEqual(["lexical.upsertDocument", "dense.upsertDocument"]);
    expect(result.documentId).toBe("lexical-doc"); // the returned identity IS Convex's
  });

  it("upsertDocument: dense never runs if lexical (the identity authority) fails", async () => {
    const log: string[] = [];
    const dense = new RecordingStore("dense", log);
    const lexical = new RecordingStore("lexical", log);
    lexical.failOnce("upsertDocument");
    const store = new CompositeKnowledgeStore(dense, lexical);

    await expect(store.upsertDocument(ctx, anyDoc)).rejects.toThrow(
      "lexical.upsertDocument deliberately failed",
    );
    expect(log).toEqual(["lexical.upsertDocument"]); // never invented an identity Convex hadn't assigned
  });

  it("upsertChunks calls dense before lexical", async () => {
    const log: string[] = [];
    const dense = new RecordingStore("dense", log);
    const lexical = new RecordingStore("lexical", log);
    const store = new CompositeKnowledgeStore(dense, lexical);

    await store.upsertChunks(ctx, "doc-1", 1, "crawled", anyChunks);

    expect(log).toEqual(["dense.upsertChunks", "lexical.upsertChunks"]);
  });

  it("upsertChunks: lexical never advertises text whose vector write failed", async () => {
    const log: string[] = [];
    const dense = new RecordingStore("dense", log);
    const lexical = new RecordingStore("lexical", log);
    dense.failOnce("upsertChunks");
    const store = new CompositeKnowledgeStore(dense, lexical);

    await expect(store.upsertChunks(ctx, "doc-1", 1, "crawled", anyChunks)).rejects.toThrow(
      "dense.upsertChunks deliberately failed",
    );
    expect(log).toEqual(["dense.upsertChunks"]); // no orphaned lexical entry pointing at a missing vector
  });

  it("commitGeneration calls dense before lexical, and re-throws (never swallows) a lexical failure", async () => {
    const log: string[] = [];
    const dense = new RecordingStore("dense", log);
    const lexical = new RecordingStore("lexical", log);
    lexical.failOnce("commitGeneration");
    const store = new CompositeKnowledgeStore(dense, lexical);

    await expect(store.commitGeneration(ctx, "doc-1", 2)).rejects.toThrow(
      "lexical.commitGeneration deliberately failed",
    );
    // Dense DID commit (stale vectors are already gone - the documented,
    // detectable-and-self-healing partial state) even though the overall
    // call surfaces as a failure to the caller.
    expect(log).toEqual(["dense.commitGeneration", "lexical.commitGeneration"]);
  });

  it("commitGeneration reports the LARGER of the two deletedStaleChunks counts, not an average", async () => {
    const dense = stubStore({ commitGeneration: async () => ({ deletedStaleChunks: 3 }) });
    const lexical = stubStore({ commitGeneration: async () => ({ deletedStaleChunks: 7 }) });
    const store = new CompositeKnowledgeStore(dense, lexical);

    const result = await store.commitGeneration(ctx, "doc-1", 2);
    expect(result.deletedStaleChunks).toBe(7);
  });

  it("health() is false if EITHER side is unhealthy, and says which", async () => {
    const dense = stubStore({ health: async () => ({ ok: true, latencyMs: 1 }) });
    const lexical = stubStore({
      health: async () => ({ ok: false, latencyMs: 5, detail: "connection refused" }),
    });
    const store = new CompositeKnowledgeStore(dense, lexical);

    const result = await store.health(ctx);
    expect(result.ok).toBe(false);
    expect(result.detail).toContain("FAIL");
  });

  it("denseSearch delegates only to dense; lexicalSearch delegates only to lexical", async () => {
    const log: string[] = [];
    const dense = new RecordingStore("dense", log);
    const lexical = new RecordingStore("lexical", log);
    const store = new CompositeKnowledgeStore(dense, lexical);

    await store.denseSearch(ctx, new Float32Array(4), { topK: 5 });
    expect(log).toEqual(["dense.denseSearch"]);

    await store.lexicalSearch(ctx, "query", { topK: 5 });
    expect(log).toEqual(["dense.denseSearch", "lexical.lexicalSearch"]);
  });

  it("getChunks is served from lexical (Convex holds canonical text), never dense", async () => {
    const log: string[] = [];
    const dense = new RecordingStore("dense", log);
    const lexical = new RecordingStore("lexical", log);
    const store = new CompositeKnowledgeStore(dense, lexical);

    await store.getChunks(ctx, [{ documentId: "d", chunkKey: "k" }]);
    expect(log).toEqual(["lexical.getChunks"]);
  });

  it("verifyIntegrity sums both backends' reports rather than picking one", async () => {
    const dense = stubStore({
      verifyIntegrity: async () => ({
        duplicateChunkKeys: 1,
        crossDocumentChunkKeyCollisions: 0,
        orphanChunks: 2,
      }),
    });
    const lexical = stubStore({
      verifyIntegrity: async () => ({
        duplicateChunkKeys: 0,
        crossDocumentChunkKeyCollisions: 1,
        orphanChunks: 3,
      }),
    });
    const store = new CompositeKnowledgeStore(dense, lexical);

    const report = await store.verifyIntegrity(ctx);
    expect(report).toEqual({
      duplicateChunkKeys: 1,
      crossDocumentChunkKeyCollisions: 1,
      orphanChunks: 5,
    });
  });
});
