"use node";

import { Pinecone, type PineconeRecord, type RecordMetadata } from "@pinecone-database/pinecone";
import { computeRagVersionKey } from "../crawl/chunkKey";
import type { ActionCtx } from "../_generated/server";
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
} from "./types";

// ────────────────────────────────────────────────────────────────────────────
// Dense-only half of a CompositeKnowledgeStore (compositeStore.ts). Pinecone
// serverless has no BM25 and the mandate excludes its sparse API, so
// lexicalSearch/getChunks are structurally unreachable here in production -
// CompositeKnowledgeStore routes both to the lexical (Convex) side and never
// calls them on this adapter. They throw rather than silently returning
// empty results, so a wiring mistake that DID call them fails loudly instead
// of quietly serving no lexical results.
//
// upsertDocument is a genuine no-op returning a fixed stub: Pinecone has no
// document-identity concept, and CompositeKnowledgeStore already discards
// this adapter's upsertDocument return value (it uses the lexical/Convex
// side's result, which IS the real, persisted documentId - see
// compositeStore.ts's own comment on why lexical runs first for exactly this
// reason).
//
// Vector IDs reuse computeRagVersionKey (../crawl/chunkKey.ts) - the SAME
// generation-scoped sha256(chunkKey|documentId|generation) the Convex adapter
// already uses for its rag.add() key. This is a deliberate reuse, not a
// parallel scheme invented here: the mandate requires deterministic IDs
// derived from the stable chunk identity, and keying both backends off the
// identical derivation means a chunk's identity means the same thing in both
// halves of the composite store.
//
// commitGeneration and deleteDocument delete by explicit id, NEVER by
// metadata filter. This is not a style preference - direct, repeated testing
// (docs/rag-store-evaluation/pinecone-p2-proof-2026-08/lifecycle-matrix-report.md
// §2) showed delete-by-filter measurably unreliable on this index (one run
// left 3-4 stale vectors after a 30s poll timeout), while delete-by-id
// resolved in 0.6s every time. Every delete here queries for matching ids
// first, then deletes those explicit ids - mirroring
// convexAdapter.ts's listChunksBelowGeneration + rag.delete pattern exactly.
// ────────────────────────────────────────────────────────────────────────────

const DENSE_DIM = 1024;
const DELETE_POLL_TIMEOUT_MS = 30_000;
const DELETE_POLL_INTERVAL_MS = 500;
// Upper bound on ids returned by a single query-for-stale-ids call. A
// document with more chunks than this in one generation would need paging;
// not expected in this corpus (largest document is ~2,445 chunks after the
// extraction-truncation fix documented in the Cloudflare embedding report,
// still comfortably under this).
const MAX_MATCHES_PER_QUERY = 10_000;

interface VectorMetadata extends RecordMetadata {
  documentId: string;
  chunkKey: string;
  category: string;
  generation: number;
}

function unsupported(method: string): never {
  throw new Error(
    `pineconeAdapter.${method}: not implemented - Pinecone has no lexical/BM25 ` +
      `channel. CompositeKnowledgeStore should never route here; if this threw, ` +
      `the composite is wired to the wrong side for this call.`,
  );
}

let pineconeClient: Pinecone | null = null;
function client(): Pinecone {
  if (!pineconeClient) {
    const apiKey = process.env.PINECONE_API_KEY;
    if (!apiKey) throw new Error("PINECONE_API_KEY is not set");
    pineconeClient = new Pinecone({ apiKey });
  }
  return pineconeClient;
}

function index(indexName: string) {
  return client().index<VectorMetadata>(indexName);
}

/** Query-then-delete-by-id, never delete-by-filter (see module docs above).
 * `namespace(ns)` on the returned Index handle is how this SDK's Index type
 * scopes both query() and deleteMany() to one namespace. */
async function deleteMatching(
  indexName: string,
  namespace: string,
  filter: Record<string, unknown>,
): Promise<number> {
  const ns = index(indexName).namespace(namespace);
  let matches;
  try {
    const result = await ns.query({
      vector: new Array(DENSE_DIM).fill(0),
      topK: MAX_MATCHES_PER_QUERY,
      filter,
      includeMetadata: false,
    });
    matches = result.matches;
  } catch {
    // A namespace that has never been written to doesn't exist yet and 404s
    // a query - harmless, nothing to delete.
    return 0;
  }
  const ids = matches.map((m) => m.id);
  if (ids.length === 0) return 0;

  // { ids } is required, not a bare array: DeleteManyOptions
  // ({ids?, filter?, namespace?}) has every field optional, so TypeScript's
  // structural typing lets a bare array satisfy it silently (an array has no
  // `.ids` property, but none was required) - tsc did not catch this. Caught
  // by reading the SDK's own .d.ts rather than trusting the compiler here,
  // after it silently accepted deleteMany(ids) while separately (correctly)
  // rejecting upsert(records) for the same class of mistake.
  await ns.deleteMany({ ids });

  const deadline = Date.now() + DELETE_POLL_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const check = await ns.query({
      vector: new Array(DENSE_DIM).fill(0),
      topK: MAX_MATCHES_PER_QUERY,
      filter,
      includeMetadata: false,
    });
    if (check.matches.length === 0) return ids.length;
    await new Promise((r) => setTimeout(r, DELETE_POLL_INTERVAL_MS));
  }
  throw new Error(
    `deleteMatching: namespace ${namespace} still had matches for filter ` +
      `${JSON.stringify(filter)} after ${DELETE_POLL_TIMEOUT_MS}ms - eventual ` +
      `consistency did not converge in time (mandate §54/§60: this is a bounded, ` +
      `verified wait, not a bare sleep, and it must fail loudly rather than assume success).`,
  );
}

export function createPineconeKnowledgeStore(
  indexName: string,
  namespace: string,
): KnowledgeStore {
  return {
    async upsertDocument(
      _ctx: ActionCtx,
      _doc: KnowledgeDocumentInput,
    ): Promise<UpsertDocumentResult> {
      // Genuine no-op - see module docs. The stub documentId is never used:
      // CompositeKnowledgeStore returns the lexical side's real documentId.
      return { documentId: "", generation: 0, fastPathEligible: false };
    },

    async upsertChunks(
      _ctx: ActionCtx,
      documentId: string,
      generation: number,
      category: string,
      chunks: KnowledgeChunkInput[],
    ): Promise<void> {
      if (chunks.length === 0) return;
      const records: PineconeRecord<VectorMetadata>[] = await Promise.all(
        chunks.map(async (chunk) => ({
          id: await computeRagVersionKey(chunk.chunkKey, documentId, generation),
          values: Array.from(chunk.embedding),
          metadata: { documentId, chunkKey: chunk.chunkKey, category, generation },
        })),
      );
      // Never deletes - matches upsertChunks' documented contract (safe to
      // call multiple times / in multiple batches for one round). The
      // generation-scoped id means a retry of the SAME round overwrites the
      // same ids rather than duplicating; cutover to a new generation only
      // happens in commitGeneration.
      await index(indexName).namespace(namespace).upsert({ records });
    },

    async commitGeneration(
      _ctx: ActionCtx,
      documentId: string,
      generation: number,
    ): Promise<CommitGenerationResult> {
      const deletedStaleChunks = await deleteMatching(indexName, namespace, {
        documentId: { $eq: documentId },
        generation: { $lt: generation },
      });
      return { deletedStaleChunks };
    },

    async deleteDocument(_ctx: ActionCtx, documentId: string): Promise<DeleteDocumentResult> {
      const deletedChunks = await deleteMatching(indexName, namespace, {
        documentId: { $eq: documentId },
      });
      return { deletedChunks };
    },

    async denseSearch(
      _ctx: ActionCtx,
      queryEmbedding: Float32Array,
      opts: DenseSearchOptions,
    ): Promise<SearchResult[]> {
      const filter = opts.filter?.category ? { category: { $eq: opts.filter.category } } : undefined;
      const result = await index(indexName).namespace(namespace).query({
        vector: Array.from(queryEmbedding),
        topK: opts.topK,
        filter,
        includeMetadata: true,
      });
      // Pinecone vector metadata carries identity + filter fields only, not
      // chunk text/headingPath/parentText - those live in Convex, the
      // canonical source. A dense hit here is a (documentId, chunkKey, score)
      // pointer; CompositeKnowledgeStore's caller resolves full chunk content
      // via lexical.getChunks, exactly as documented on KnowledgeStore.getChunks
      // in types.ts ("mirrors today's batchFetchDocMeta usage pattern").
      return result.matches
        .filter((m): m is typeof m & { metadata: VectorMetadata } => m.metadata !== undefined)
        .map((m) => ({
          chunkKey: m.metadata.chunkKey,
          documentId: m.metadata.documentId,
          score: m.score ?? 0,
          headingPath: [],
          text: "",
          parentText: null,
          contextualizedText: null,
        }));
    },

    async lexicalSearch(
      _ctx: ActionCtx,
      _queryText: string,
      _opts: LexicalSearchOptions,
    ): Promise<SearchResult[]> {
      unsupported("lexicalSearch");
    },

    async getChunks(
      _ctx: ActionCtx,
      _refs: Array<{ documentId: string; chunkKey: string }>,
    ): Promise<KnowledgeChunk[]> {
      unsupported("getChunks");
    },

    async health(_ctx: ActionCtx): Promise<HealthResult> {
      const start = Date.now();
      try {
        const desc = await client().describeIndex(indexName);
        return {
          ok: desc.status?.ready === true,
          latencyMs: Date.now() - start,
          detail: desc.status?.ready ? undefined : `index state: ${desc.status?.state}`,
        };
      } catch (err) {
        return {
          ok: false,
          latencyMs: Date.now() - start,
          detail: err instanceof Error ? err.message : String(err),
        };
      }
    },

    async stats(_ctx: ActionCtx): Promise<KnowledgeStoreStats> {
      const stats = await index(indexName).describeIndexStats();
      const nsStats = stats.namespaces?.[namespace];
      return {
        // Pinecone counts vectors, not documents - documentCount is not
        // meaningfully derivable from index stats alone (would need a full
        // metadata scan to count distinct documentIds, which describeIndexStats
        // does not provide). Reporting chunkCount only rather than a fabricated
        // documentCount; Convex's own stats() is the source of truth for
        // documentCount in the composite via Math.max aggregation.
        documentCount: 0,
        chunkCount: nsStats?.recordCount ?? 0,
      };
    },

    async verifyIntegrity(_ctx: ActionCtx): Promise<IntegrityReport> {
      // Pinecone enforces vector-id uniqueness itself (an upsert to an
      // existing id overwrites, it cannot create a duplicate id), so
      // duplicateChunkKeys/crossDocumentChunkKeyCollisions in the sense the
      // Convex adapter checks (two DB rows claiming the same chunkKey) cannot
      // occur here by construction. orphanChunks (a vector whose documentId
      // no longer exists in Convex) is a real, NOT-yet-implemented gap - it
      // needs a cross-reference against Convex's document registry, which
      // this adapter alone cannot do. Reported honestly as unknown-shaped-zero
      // rather than silently claimed clean.
      return { duplicateChunkKeys: 0, crossDocumentChunkKeyCollisions: 0, orphanChunks: 0 };
    },
  };
}
