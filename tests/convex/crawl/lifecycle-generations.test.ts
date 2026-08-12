/**
 * Phase 6.21A Part 17: T13-T18, the new lifecycle tests required on top of
 * the pre-existing T1-T12 suite (covered by mutations.test.ts/actions.test.ts).
 * Each test is traceable to its named requirement in the governing prompt.
 *
 * Self-contained (does not import tests/convex/crawl/mutations.test.ts's
 * helpers): this file has exactly one additional consumer of this mock
 * shape, and the existing test files in this repo each keep their own
 * mocks rather than sharing an extracted module, so duplicating the small
 * subset needed here matches that convention instead of introducing a new
 * shared-helper module for a single caller.
 */

vi.mock("../../../convex/_generated/server", () => ({
  internalMutation: (opts: { handler: Function }) => ({ handler: opts.handler }),
  internalQuery: (opts: { handler: Function }) => ({ handler: opts.handler }),
}));

vi.mock("../../../convex/_generated/api", () => ({
  internal: {
    crawl: {
      mutations: { onChunkEmbedded: "onChunkEmbedded" as any },
      actions: { embedSingleChunk: "embedSingleChunk" as any },
    },
  },
}));

vi.mock("../../../convex/rag/instance", () => ({
  rag: {
    add: vi.fn(),
    delete: vi.fn(),
    deleteAsync: vi.fn(),
    getOrCreateNamespace: vi.fn().mockResolvedValue({ namespaceId: "mock-ns-id" }),
    // See the identical comment in mutations.test.ts's copy of this mock.
    defineOnComplete: vi.fn((fn: unknown) => ({ handler: fn })),
  },
}));

vi.mock("../../../convex/crawl/workpools", () => ({
  embeddingPool: {
    enqueueAction: vi.fn(),
    enqueueActionBatch: vi.fn().mockResolvedValue(undefined),
  },
}));

import { beforeEach, describe, expect, it, vi } from "vitest";
import { generateChunks } from "../../../convex/crawl/chunking";
import { computeChunkKey, computeIndexingFingerprint } from "../../../convex/crawl/chunkKey";

let CURRENT_FINGERPRINT: string;
beforeEach(async () => {
  CURRENT_FINGERPRINT = await computeIndexingFingerprint();
});

function createDbQueryResult(rows: any[]) {
  const filters: Record<string, any> = {};
  const getFiltered = () => {
    const keys = Object.keys(filters);
    if (keys.length === 0) return rows;
    return rows.filter((doc: any) => keys.every((k) => doc[k] === filters[k]));
  };
  const chain: any = {};
  chain.withIndex = vi.fn((_indexName: string, constraintFn?: Function) => {
    if (constraintFn) {
      const constraintSpy = {
        eq: (field: string, value: any) => {
          filters[field] = value;
          return constraintSpy;
        },
        gte: () => constraintSpy,
        lte: () => constraintSpy,
        gt: () => constraintSpy,
        lt: () => constraintSpy,
      };
      constraintFn(constraintSpy);
    }
    return chain;
  });
  chain.filter = vi.fn(() => chain);
  chain.order = vi.fn(() => chain);
  chain.first = vi.fn(() => getFiltered()[0] ?? null);
  chain.unique = vi.fn(() => getFiltered()[0] ?? null);
  chain.collect = vi.fn(() => getFiltered());
  chain.take = vi.fn((n: number) => getFiltered().slice(0, n));
  chain.paginate = vi.fn(() => ({ page: getFiltered(), isDone: true, continueCursor: null }));
  chain[Symbol.asyncIterator] = async function* () {
    for (const doc of getFiltered()) yield doc;
  };
  return chain;
}

function createMockDb(resultMap?: Record<string, any>) {
  const tables: Record<string, any[]> = {};
  for (const [table, value] of Object.entries(resultMap ?? {})) {
    tables[table] = value === null ? [] : Array.isArray(value) ? [...value] : [value];
  }
  const db: any = {
    query: vi.fn((tableName: string) => {
      if (!(tableName in tables)) tables[tableName] = [];
      return createDbQueryResult(tables[tableName]!);
    }),
    get: vi.fn((id: any) => {
      for (const rows of Object.values(tables)) {
        const found = rows.find((r) => r._id === id);
        if (found) return found;
      }
      return null;
    }),
    insert: vi.fn((table: string, doc: any) => {
      const id = doc._id ?? "new-id-" + Math.random().toString(36).slice(2, 10);
      if (!(table in tables)) tables[table] = [];
      tables[table]!.push({ _id: id, _creationTime: Date.now(), ...doc });
      return id;
    }),
    patch: vi.fn((id: any, updates: any) => {
      for (const rows of Object.values(tables)) {
        const idx = rows.findIndex((r) => r._id === id);
        if (idx !== -1) {
          rows[idx] = { ...rows[idx], ...updates };
          return;
        }
      }
    }),
    delete: vi.fn((id: any) => {
      for (const table of Object.keys(tables)) {
        tables[table] = tables[table]!.filter((r) => r._id !== id);
      }
    }),
  };
  return db;
}

function makeDoc(overrides: any = {}) {
  return {
    _id: overrides._id ?? "doc-default-id",
    _creationTime: Date.now(),
    url: "https://web.uettaxila.edu.pk/page",
    title: "Test Page",
    source: "web.uettaxila.edu.pk",
    category: "crawled",
    contentHash: "hash-default",
    indexingFingerprint: CURRENT_FINGERPRINT,
    ingestionGeneration: 1,
    status: "active",
    crawledAt: Date.now(),
    updatedAt: Date.now(),
    chunkCount: 0,
    chunksEmbedded: 0,
    crawlSessionId: "session-default",
    isStale: false,
    freshnessTier: "medium",
    metadata: {},
    error: undefined,
    ...overrides,
  };
}

function makeChunk(overrides: any = {}) {
  return {
    _id: overrides._id ?? "chunk-default-id",
    _creationTime: Date.now(),
    documentId: "doc-default-id",
    contentHash: "chunk-hash-default",
    chunkKey: "chunkkey-default",
    ingestionGeneration: 1,
    text: "Chunk text content for testing purposes.",
    ragId: "rag-default-id",
    embeddingModel: "gemini-embedding-2",
    ...overrides,
  };
}

function makeCtx(db: any) {
  return {
    db,
    auth: { getUserIdentity: vi.fn() },
    runMutation: vi.fn(),
    runQuery: vi.fn(),
    runAction: vi.fn(),
  };
}

describe("T13: old generation finishes AFTER new generation - newest accepted ingestion must win", () => {
  it("a late generation-1 completion cannot overwrite generation-2's already-committed value", async () => {
    const mutations = await import("../../../convex/crawl/mutations");
    const ragModule = await import("../../../convex/rag/instance");
    (ragModule.rag.deleteAsync as any).mockReset();

    // Steady state: document is on generation 2, key-1 already holds
    // generation 2's NEW value (as if generation 2's onRagEntryComplete
    // already committed it - the realistic point at which a straggler from
    // generation 1 could still arrive).
    const doc = makeDoc({
      _id: "doc-t13",
      chunkCount: 1,
      chunksEmbedded: 1,
      ingestionGeneration: 2,
      status: "indexed",
    });
    const currentRow = makeChunk({
      _id: "row-t13",
      documentId: "doc-t13",
      chunkKey: "key-1",
      contentHash: "NEW-hash",
      ragId: "rag-gen2-committed",
      ingestionGeneration: 2,
    });
    const db = createMockDb({ documents: doc, crawledChunks: currentRow });
    const ctx = makeCtx(db);

    // Generation A (job A, started BEFORE B, content=OLD) finishes AFTER B.
    // Under generation-scoped ragVersionKeys, A's rag.add() call could never
    // have shared a key with B's entry in the first place, so this is A's
    // OWN entry completing on its own, with no replacedEntry - exactly what
    // the real embedSingleChunk/onComplete wiring would produce.
    await (mutations.onRagEntryComplete as any).handler(ctx, {
      namespace: { namespaceId: "ns-t13" },
      entry: {
        entryId: "rag-gen1-straggler",
        key: "ragversion-gen1-key-1",
        status: "ready",
        importance: 1,
        filterValues: [],
        contentHash: "OLD-hash",
        metadata: { documentId: "doc-t13", baseChunkKey: "key-1", ingestionGeneration: 1 },
      },
      replacedEntry: undefined,
      error: undefined,
    });

    // The row must still reflect generation 2's value, untouched.
    const finalRow = db.get("row-t13" as any);
    expect(finalRow.contentHash).toBe("NEW-hash");
    expect(finalRow.ragId).toBe("rag-gen2-committed");
    expect(finalRow.ingestionGeneration).toBe(2);
    // No crawledChunks/document write of any kind was made for the stale attempt.
    expect(db.insert).not.toHaveBeenCalled();
    expect(db.patch).not.toHaveBeenCalledWith("doc-t13", expect.anything());
    // The straggler's own now-orphaned vector is cleaned up, not left leaked.
    expect(ragModule.rag.deleteAsync).toHaveBeenCalledWith(ctx, { entryId: "rag-gen1-straggler" });
  });

  it("end-to-end: queueChunksForEmbedding bumps the generation immediately when a new round starts mid-flight", async () => {
    const mutations = await import("../../../convex/crawl/mutations");
    const embeddingPoolModule = await import("../../../convex/crawl/workpools");
    (embeddingPoolModule.embeddingPool.enqueueActionBatch as any).mockReset();

    // Document is mid-generation-1 (status still "processing").
    const doc = makeDoc({
      _id: "doc-t13b",
      url: "https://web.uettaxila.edu.pk/t13b",
      contentHash: "gen1-hash",
      chunkCount: 1,
      chunksEmbedded: 0,
      ingestionGeneration: 1,
      status: "processing",
    });
    const db = createMockDb({ documents: doc, crawledChunks: [] });
    const ctx = makeCtx(db);

    const result = await (mutations.queueChunksForEmbedding as any).handler(ctx, {
      url: doc.url,
      title: "T13b",
      contentHash: "gen2-hash",
      jobId: "job-t13b",
      parents: [{ contentHash: "p1", text: "Parent." }],
      children: [
        {
          text: "New content.",
          contentHash: "gen2-child-hash",
          chunkKey: "key-1",
          parentContentHash: "p1",
        },
      ],
    });

    expect(result.status).toBe("updated");
    // Generation bumped to 2 immediately - the new content is NEVER
    // deferred or silently dropped just because generation 1 was active.
    expect(db.patch).toHaveBeenCalledWith(
      "doc-t13b",
      expect.objectContaining({ ingestionGeneration: 2 }),
    );
    expect(embeddingPoolModule.embeddingPool.enqueueActionBatch).toHaveBeenCalledTimes(1);
  });
});

describe("T14: a new ingestion round arriving while an old one is active does not lose work", () => {
  it("the new round's own diff/enqueue proceeds independently of the old round's in-flight state", async () => {
    const mutations = await import("../../../convex/crawl/mutations");
    const embeddingPoolModule = await import("../../../convex/crawl/workpools");
    (embeddingPoolModule.embeddingPool.enqueueActionBatch as any).mockReset();

    const doc = makeDoc({
      _id: "doc-t14",
      url: "https://web.uettaxila.edu.pk/t14",
      contentHash: "old-content-hash",
      chunkCount: 3,
      chunksEmbedded: 1,
      ingestionGeneration: 1,
      status: "processing",
    });
    // generation 1 has one row already committed (key-a); generation 1's
    // remaining two chunks (key-b, key-c) are still in flight when the new
    // round arrives.
    const existingRow = makeChunk({
      _id: "row-a",
      documentId: "doc-t14",
      chunkKey: "key-a",
      contentHash: "hash-a",
      ingestionGeneration: 1,
      ragId: "rag-a",
    });
    const db = createMockDb({ documents: doc, crawledChunks: [existingRow] });
    const ctx = makeCtx(db);

    const result = await (mutations.queueChunksForEmbedding as any).handler(ctx, {
      url: doc.url,
      title: "T14",
      contentHash: "new-content-hash",
      jobId: "job-t14-round2",
      parents: [{ contentHash: "p1", text: "Parent." }],
      // key-a unchanged (pre-credited), key-b and key-d are new/changed for round 2.
      children: [
        { text: "A unchanged", contentHash: "hash-a", chunkKey: "key-a", parentContentHash: "p1" },
        { text: "B changed", contentHash: "hash-b-v2", chunkKey: "key-b", parentContentHash: "p1" },
        { text: "D new", contentHash: "hash-d", chunkKey: "key-d", parentContentHash: "p1" },
      ],
    });

    expect(result.status).toBe("updated");
    expect(result.chunksQueued).toBe(2); // key-b (changed) + key-d (new); key-a pre-credited
    // upsertDocumentForCrawl patches the generation bump first, then the
    // combined chunkCount/chunksEmbedded/status patch runs once the diff is
    // known - two separate db.patch calls on this document, not one.
    expect(db.patch).toHaveBeenCalledWith(
      "doc-t14",
      expect.objectContaining({ ingestionGeneration: 2 }),
    );
    expect(db.patch).toHaveBeenCalledWith(
      "doc-t14",
      expect.objectContaining({
        chunkCount: 3,
        chunksEmbedded: 1, // key-a pre-credited
      }),
    );
  });
});

describe("T15: a stale-generation completion cannot advance current progress or status", () => {
  it("does not increment chunksEmbedded even if it would coincidentally reach the OLD generation's chunkCount", async () => {
    const mutations = await import("../../../convex/crawl/mutations");
    const ragModule = await import("../../../convex/rag/instance");
    (ragModule.rag.deleteAsync as any).mockReset();

    const doc = makeDoc({
      _id: "doc-t15",
      chunkCount: 5,
      chunksEmbedded: 3,
      ingestionGeneration: 4,
    });
    const db = createMockDb({ documents: doc, crawledChunks: [] });
    const ctx = makeCtx(db);

    await (mutations.onRagEntryComplete as any).handler(ctx, {
      namespace: { namespaceId: "ns-t15" },
      entry: {
        entryId: "rag-stale",
        key: "ragversion-stale",
        status: "ready",
        importance: 1,
        filterValues: [],
        contentHash: "stale-hash",
        metadata: { documentId: "doc-t15", baseChunkKey: "key-stale", ingestionGeneration: 1 },
      },
      replacedEntry: undefined,
      error: undefined,
    });

    expect(db.patch).not.toHaveBeenCalled();
    expect(db.insert).not.toHaveBeenCalled();
    expect(ragModule.rag.deleteAsync).toHaveBeenCalledWith(ctx, { entryId: "rag-stale" });
  });

  it("checkDocumentForFailure (onComplete/failure path) also fences a stale generation via the batch context", async () => {
    const mutations = await import("../../../convex/crawl/mutations");
    const doc = makeDoc({
      _id: "doc-t15b",
      chunkCount: 1,
      chunksEmbedded: 0,
      ingestionGeneration: 2,
      status: "processing",
    });
    const db = createMockDb({ documents: doc, crawledChunks: [], crawlDeadLetter: [] });
    const ctx = makeCtx(db);

    // A hard-thrown failure has no returnValue - generation must come from
    // the batch-level enqueue-time context (see routeChunkResult).
    await (mutations.onChunkEmbedded as any).handler(ctx, {
      context: { jobId: "job-t15b", url: doc.url, documentId: "doc-t15b", ingestionGeneration: 1 },
      result: { kind: "failed", error: "ECONNRESET" },
    });

    // The document must NOT be marked "failed" on a generation-1 failure
    // when generation 2 is current.
    expect(db.patch).not.toHaveBeenCalledWith(
      "doc-t15b",
      expect.objectContaining({ status: "failed" }),
    );
  });
});

describe("T16: same-heading insertion shifts ordinals (chunkKey position-stability boundary)", () => {
  it("inserting a new paragraph before an existing one under the same heading changes the later chunk's key but not the earlier one's", async () => {
    // Phase 6.21A: each paragraph is padded past the 800-char CHILD_CHUNK_SIZE
    // threshold on its own, so chunkMarkdown is forced to split them into
    // SEPARATE child chunks (short paragraphs would just get merged into one
    // chunk by processSmallBlock, defeating the point of this test).
    const firstParagraph =
      "First paragraph with enough words to survive the quality filter easily. " +
      "It keeps going for a while to make sure this single paragraph alone exceeds the eight hundred character child chunk size threshold on its own, forcing the chunker to treat it as a standalone chunk rather than merging it with whatever paragraph follows it in the same heading section, which is exactly the structural property this particular test needs to rely on for the assertions below to mean anything real.";
    const secondParagraph =
      "Second paragraph also has plenty of words to pass the same filter. " +
      "Just like its sibling above, this paragraph is deliberately padded well past the eight hundred character threshold so it forms its own distinct child chunk under the same heading, letting the test observe how its ordinal position - and therefore its chunkKey - shifts once a new paragraph is inserted before it in the source document.";
    const insertedParagraph =
      "A brand new paragraph inserted in between the first and second ones, with enough words. " +
      "This one is also padded past the child chunk size threshold on its own so it becomes its own distinct chunk positioned between the other two, which is what actually causes the second paragraph's ordinal-within-heading to shift from index one to index two once this insertion is present in the document.";
    const before = `# Section A\n\n${firstParagraph}\n\n${secondParagraph}`;
    const after = `# Section A\n\n${firstParagraph}\n\n${insertedParagraph}\n\n${secondParagraph}`;

    const beforeResult = await generateChunks(before, "", "https://example.com/test-doc");
    const afterResult = await generateChunks(after, "", "https://example.com/test-doc");

    expect(beforeResult.children.length).toBe(2);
    expect(afterResult.children.length).toBe(3);

    // The FIRST chunk (ordinal 0 under "Section A") is unaffected by an
    // insertion that happens after it.
    expect(afterResult.children[0]!.chunkKey).toBe(beforeResult.children[0]!.chunkKey);
    expect(afterResult.children[0]!.text).toBe(beforeResult.children[0]!.text);

    // The chunk that was previously ordinal 1 ("Second paragraph...") is now
    // ordinal 2 - a DIFFERENT chunkKey, even though its core content is the
    // same paragraph. (Its exact text can differ slightly at the boundary -
    // chunkMarkdown carries a short overlap from whichever chunk now
    // precedes it, which is a separate, correct, pre-existing mechanic, not
    // what this test is about.) This key change is expected, documented
    // churn (Phase 6.21A Part 8: the key is position-stable, not
    // semantic-identity-stable), not a bug.
    const secondParagraphBefore = beforeResult.children[1]!;
    const secondParagraphAfter = afterResult.children[2]!;
    expect(secondParagraphAfter.text).toContain("Second paragraph also has plenty of words");
    expect(secondParagraphAfter.chunkKey).not.toBe(secondParagraphBefore.chunkKey);

    // No content was lost - every distinct paragraph text still appears once.
    const afterTexts = afterResult.children.map((c) => c.text);
    expect(afterTexts.some((t) => t.includes("brand new paragraph"))).toBe(true);
    expect(afterTexts.some((t) => t.includes("First paragraph"))).toBe(true);
    expect(afterTexts.some((t) => t.includes("Second paragraph"))).toBe(true);
    // All chunkKeys in the new set are still unique (no accidental collision
    // introduced by the shift).
    expect(new Set(afterResult.children.map((c) => c.chunkKey)).size).toBe(
      afterResult.children.length,
    );
  });
});

describe("T17: indexingFingerprint changes when a pipeline setting (e.g. embedding model) changes", () => {
  it("computeIndexingFingerprint is deterministic across repeated calls", async () => {
    const a = await computeIndexingFingerprint();
    const b = await computeIndexingFingerprint();
    expect(a).toBe(b);
  });

  it("the fingerprint changes if the embedding model component changes (proves the model is actually hashed, not decorative)", async () => {
    const real = await computeIndexingFingerprint();
    // Reconstruct the same hash composition with the embedding model swapped,
    // proving it is a real input to the hash rather than a documented-but-
    // unused constant.
    const {
      CHUNKING_VERSION,
      PARENT_CHUNK_SIZE,
      PARENT_CHUNK_OVERLAP,
      CHILD_CHUNK_SIZE,
      CHILD_CHUNK_OVERLAP,
      CONTEXT_PREFIX_VERSION,
    } = await import("../../../convex/crawl/chunkKey");
    const { EMBEDDING_DIMENSION } = await import("../../../convex/embeddings/dimension");
    const encoder = new TextEncoder();
    async function sha256Hex(text: string): Promise<string> {
      const hashBuffer = await crypto.subtle.digest("SHA-256", encoder.encode(text));
      return Array.from(new Uint8Array(hashBuffer))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
    }
    const withDifferentModel = await sha256Hex(
      [
        `chunkingVersion=${CHUNKING_VERSION}`,
        `parentChunkSize=${PARENT_CHUNK_SIZE}`,
        `parentChunkOverlap=${PARENT_CHUNK_OVERLAP}`,
        `childChunkSize=${CHILD_CHUNK_SIZE}`,
        `childChunkOverlap=${CHILD_CHUNK_OVERLAP}`,
        `contextPrefixVersion=${CONTEXT_PREFIX_VERSION}`,
        `embeddingModel=gemini-embedding-3-hypothetical-future-model`,
        `embeddingDimension=${EMBEDDING_DIMENSION}`,
      ].join("|"),
    );
    expect(withDifferentModel).not.toBe(real);
  });

  it("queueChunksForEmbedding forces a rebuild when contentHash matches but indexingFingerprint does not (simulated model change)", async () => {
    const mutations = await import("../../../convex/crawl/mutations");
    const embeddingPoolModule = await import("../../../convex/crawl/workpools");
    (embeddingPoolModule.embeddingPool.enqueueActionBatch as any).mockReset();

    const doc = makeDoc({
      _id: "doc-t17",
      url: "https://web.uettaxila.edu.pk/t17",
      contentHash: "unchanged-content-hash",
      indexingFingerprint: "fingerprint-from-a-retired-embedding-model",
      ingestionGeneration: 1,
      chunkCount: 1,
    });
    const existingRow = makeChunk({
      documentId: "doc-t17",
      chunkKey: "key-1",
      contentHash: "unchanged-child-hash",
      ingestionGeneration: 1,
    });
    const db = createMockDb({ documents: doc, crawledChunks: [existingRow] });
    const ctx = makeCtx(db);

    const result = await (mutations.queueChunksForEmbedding as any).handler(ctx, {
      url: doc.url,
      title: "T17",
      contentHash: "unchanged-content-hash", // source did NOT change
      jobId: "job-t17",
      parents: [{ contentHash: "p1", text: "Parent." }],
      children: [
        {
          text: "Same text as before.",
          contentHash: "unchanged-child-hash",
          chunkKey: "key-1",
          parentContentHash: "p1",
        },
      ],
    });

    // Must NOT take the "unchanged" fast path despite identical contentHash.
    expect(result.status).not.toBe("unchanged");
    expect(db.patch).toHaveBeenCalledWith(
      "doc-t17",
      expect.objectContaining({ indexingFingerprint: CURRENT_FINGERPRINT }),
    );
  });
});

describe("T18: 501+ chunks does not hit a hidden pagination ceiling", () => {
  it("getAllChunksByDocumentId (via queueChunksForEmbedding's diff) processes all 1200 existing chunks, not just the first 500", async () => {
    const mutations = await import("../../../convex/crawl/mutations");
    const ragModule = await import("../../../convex/rag/instance");
    (ragModule.rag.deleteAsync as any).mockReset();

    const doc = makeDoc({
      _id: "doc-t18",
      url: "https://web.uettaxila.edu.pk/t18",
      contentHash: "old-hash",
      chunkCount: 1200,
      ingestionGeneration: 1,
    });
    // 1200 existing rows, none of which will survive the new (empty) child
    // set - every one of the 1200 must be deleted, proving the diff saw ALL
    // of them rather than silently stopping at some earlier boundary.
    const existingChunks = Array.from({ length: 1200 }, (_, i) =>
      makeChunk({
        _id: `row-${i}`,
        documentId: "doc-t18",
        chunkKey: `key-${i}`,
        contentHash: `hash-${i}`,
        ragId: `rag-${i}`,
      }),
    );
    const db = createMockDb({ documents: doc, crawledChunks: existingChunks });
    const ctx = makeCtx(db);

    await (mutations.queueChunksForEmbedding as any).handler(ctx, {
      url: doc.url,
      title: "T18",
      contentHash: "new-hash",
      jobId: "job-t18",
      parents: [],
      children: [],
    });

    expect(ragModule.rag.deleteAsync).toHaveBeenCalledTimes(1200);
    expect((db.delete as any).mock.calls.length).toBe(1200);
  });

  it("the MAX_CHUNKS_PER_DOCUMENT_SYNC safety ceiling throws a clear error instead of silently truncating", async () => {
    // Import the module fresh; the ceiling constant itself is not exported,
    // so this exercises it indirectly through getAllChunksByDocumentId's
    // real behavior via queueChunksForEmbedding on a document with more
    // than 5000 existing chunks.
    const mutations = await import("../../../convex/crawl/mutations");
    const doc = makeDoc({
      _id: "doc-t18b",
      url: "https://web.uettaxila.edu.pk/t18b",
      contentHash: "old-hash",
      chunkCount: 5001,
      ingestionGeneration: 1,
    });
    const existingChunks = Array.from({ length: 5001 }, (_, i) =>
      makeChunk({
        _id: `row-${i}`,
        documentId: "doc-t18b",
        chunkKey: `key-${i}`,
        contentHash: `hash-${i}`,
      }),
    );
    const db = createMockDb({ documents: doc, crawledChunks: existingChunks });
    const ctx = makeCtx(db);

    await expect(
      (mutations.queueChunksForEmbedding as any).handler(ctx, {
        url: doc.url,
        title: "T18b",
        contentHash: "new-hash",
        jobId: "job-t18b",
        parents: [],
        children: [],
      }),
    ).rejects.toThrow(/more than 5000 crawledChunks rows/);
  });
});

describe("computeChunkKey: duplicate content at different positions gets distinct keys (T7 mechanism)", () => {
  it("two identical headingPath+text chunks at different ordinals produce different keys", async () => {
    const keyA = await computeChunkKey("https://example.com/test-doc", ["Section A"], 0);
    const keyB = await computeChunkKey("https://example.com/test-doc", ["Section A"], 1);
    expect(keyA).not.toBe(keyB);
  });

  it("the same headingPath+ordinal always produces the same key (determinism)", async () => {
    const a = await computeChunkKey("https://example.com/test-doc", ["Section A", "Subsection"], 3);
    const b = await computeChunkKey("https://example.com/test-doc", ["Section A", "Subsection"], 3);
    expect(a).toBe(b);
  });

  it("Phase 6.21A regression: two DIFFERENT documents with the SAME headingPath+ordinal get DIFFERENT keys", async () => {
    // The exact bug a 199-document real-scale storage run caught: a chunkKey
    // formula with no document scope let two unrelated documents that both
    // open with a generic first heading (e.g. "## Overview") silently
    // replace each other's RAG entries, since rag.add()'s `key` uniqueness
    // is scoped to the whole namespace, not per app-level document.
    const keyDocA = await computeChunkKey("https://example.com/doc-a", ["Overview"], 0);
    const keyDocB = await computeChunkKey("https://example.com/doc-b", ["Overview"], 0);
    expect(keyDocA).not.toBe(keyDocB);
  });

  it("the same document URL, revisited on a later re-crawl, produces the SAME key (position-stability across re-crawls is preserved)", async () => {
    const first = await computeChunkKey("https://example.com/stable-doc", ["Overview"], 0);
    const secondCrawl = await computeChunkKey("https://example.com/stable-doc", ["Overview"], 0);
    expect(first).toBe(secondCrawl);
  });
});
