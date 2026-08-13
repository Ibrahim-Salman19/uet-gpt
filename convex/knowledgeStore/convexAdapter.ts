import { computeRagVersionKey } from "../crawl/chunkKey";
import { internal } from "../_generated/api";
import type { ActionCtx } from "../_generated/server";
import { rag } from "../rag/instance";
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

const NAMESPACE = "uet-global";

type ChunkRowRef = { _id: string; ragId: string };

type ChunkHit = {
  chunkKey: string;
  documentId: string;
  ordinalWithinHeading: number;
  headingPath: string[];
  text: string;
  parentText: string | null;
  contextualizedText: string | null;
  ingestionGeneration: number;
};

function toKnowledgeChunk(hit: ChunkHit): KnowledgeChunk {
  return {
    chunkKey: hit.chunkKey,
    documentId: hit.documentId,
    ordinalWithinHeading: hit.ordinalWithinHeading,
    headingPath: hit.headingPath,
    text: hit.text,
    parentText: hit.parentText,
    contextualizedText: hit.contextualizedText,
    ingestionGeneration: hit.ingestionGeneration,
  };
}

export const convexKnowledgeStore: KnowledgeStore = {
  async upsertDocument(
    ctx: ActionCtx,
    doc: KnowledgeDocumentInput,
  ): Promise<UpsertDocumentResult> {
    return await ctx.runMutation(internal.knowledgeStore.convexMutations.upsertDocumentRow, doc);
  },

  async upsertChunks(
    ctx: ActionCtx,
    documentId: string,
    generation: number,
    category: string,
    chunks: KnowledgeChunkInput[],
  ): Promise<void> {
    // rag/instance.ts configures filterNames: ["category", "source"] - RAG's
    // own validateAddFilterValues requires BOTH on every add() call, not
    // just whichever ones a caller actually filters by later (see
    // getDocumentSource's doc comment in convexQueries.ts).
    const source = await ctx.runQuery(
      internal.knowledgeStore.convexQueries.getDocumentSource,
      { documentId },
    );
    if (source === null) {
      throw new Error(
        `upsertChunks: no document found for documentId ${documentId} - upsertDocument must be called first.`,
      );
    }
    for (const chunk of chunks) {
      const ragVersionKey = await computeRagVersionKey(chunk.chunkKey, documentId, generation);
      const added = await rag.add(ctx, {
        namespace: NAMESPACE,
        key: ragVersionKey,
        filterValues: [
          { name: "category", value: category },
          { name: "source", value: source },
        ],
        chunks: [{ text: chunk.text, embedding: Array.from(chunk.embedding) }],
      });
      // ragVersionKey is generation-scoped, so a replacedEntry here can only
      // ever be a prior attempt at THIS SAME (documentId, chunkKey,
      // generation) - e.g. a retried upsertChunks call after a partial
      // failure - never a different generation's entry. Deleting it is
      // always safe (mirrors onRagEntryComplete's identical, source-verified
      // reasoning in convex/crawl/mutations.ts). Synchronous rag.delete, not
      // rag.deleteAsync, is available and preferred here for the same reason
      // documented on KnowledgeStore.commitGeneration in types.ts - we're
      // already in action context with the entryId in hand.
      if (added.replacedEntry) {
        await rag.delete(ctx, { entryId: added.replacedEntry.entryId });
      }
      await ctx.runMutation(internal.knowledgeStore.convexMutations.upsertChunkRow, {
        documentId,
        chunkKey: chunk.chunkKey,
        ragId: added.entryId,
        headingPath: chunk.headingPath,
        text: chunk.text,
        ingestionGeneration: generation,
        parentText: chunk.parentText,
        contextualizedText: chunk.contextualizedText,
      });
    }
  },

  async commitGeneration(
    ctx: ActionCtx,
    documentId: string,
    generation: number,
  ): Promise<CommitGenerationResult> {
    const stale: ChunkRowRef[] = await ctx.runQuery(
      internal.knowledgeStore.convexMutations.listChunksBelowGeneration,
      { documentId, beforeGeneration: generation },
    );
    // Synchronous (action-context) rag.delete, not rag.deleteAsync — see the
    // ordering rationale on KnowledgeStore.commitGeneration in types.ts.
    for (const chunk of stale) {
      await rag.delete(ctx, {
        entryId: chunk.ragId as unknown as import("@convex-dev/rag").EntryId,
      });
    }
    const deletedStaleChunks = await ctx.runMutation(
      internal.knowledgeStore.convexMutations.deleteChunkRowsAndAdvanceGeneration,
      {
        documentId,
        chunkRowIds: stale.map((c) => c._id),
        newGeneration: generation,
      },
    );
    return { deletedStaleChunks };
  },

  async deleteDocument(ctx: ActionCtx, documentId: string): Promise<DeleteDocumentResult> {
    const all: ChunkRowRef[] = await ctx.runQuery(
      internal.knowledgeStore.convexMutations.listAllChunksForDocument,
      { documentId },
    );
    for (const chunk of all) {
      await rag.delete(ctx, {
        entryId: chunk.ragId as unknown as import("@convex-dev/rag").EntryId,
      });
    }
    const deletedChunks = await ctx.runMutation(
      internal.knowledgeStore.convexMutations.deleteDocumentRowAndChunks,
      { documentId, chunkRowIds: all.map((c) => c._id) },
    );
    return { deletedChunks };
  },

  async denseSearch(
    ctx: ActionCtx,
    queryEmbedding: Float32Array,
    opts: DenseSearchOptions,
  ): Promise<SearchResult[]> {
    const res = await rag.search(ctx, {
      namespace: NAMESPACE,
      query: Array.from(queryEmbedding),
      limit: opts.topK,
      chunkContext: { before: 0, after: 0 },
      ...(opts.filter?.category
        ? { filters: [{ name: "category" as const, value: opts.filter.category }] }
        : {}),
    });
    const entryIds = res.results.map((r) => r.entryId);
    const hits: (ChunkHit | null)[] = await ctx.runQuery(
      internal.knowledgeStore.convexQueries.getChunkHitsByRagIds,
      { ragIds: entryIds },
    );
    const out: SearchResult[] = [];
    for (let i = 0; i < hits.length; i++) {
      const hit = hits[i];
      if (!hit) continue;
      out.push({
        chunkKey: hit.chunkKey,
        documentId: hit.documentId,
        score: res.results[i]?.score ?? 0,
        headingPath: hit.headingPath,
        text: hit.text,
        parentText: hit.parentText,
        contextualizedText: hit.contextualizedText,
      });
    }
    return out;
  },

  async lexicalSearch(
    ctx: ActionCtx,
    queryText: string,
    opts: LexicalSearchOptions,
  ): Promise<SearchResult[]> {
    const hits: ChunkHit[] = await ctx.runQuery(
      internal.knowledgeStore.convexQueries.lexicalSearchChunks,
      { query: queryText, limit: opts.topK },
    );
    return hits.map((hit) => ({
      chunkKey: hit.chunkKey,
      documentId: hit.documentId,
      score: 1.0, // Convex search indexes expose no numeric BM25 score; see lexicalSearchChunks.
      headingPath: hit.headingPath,
      text: hit.text,
      parentText: hit.parentText,
      contextualizedText: hit.contextualizedText,
    }));
  },

  async getChunks(
    ctx: ActionCtx,
    refs: Array<{ documentId: string; chunkKey: string }>,
  ): Promise<KnowledgeChunk[]> {
    const hits: (ChunkHit | null)[] = await ctx.runQuery(
      internal.knowledgeStore.convexQueries.getChunkHitsByKeys,
      { refs },
    );
    return hits.filter((h): h is ChunkHit => h !== null).map(toKnowledgeChunk);
  },

  async health(ctx: ActionCtx): Promise<HealthResult> {
    const start = Date.now();
    try {
      await ctx.runQuery(internal.knowledgeStore.convexQueries.pingHealth, {});
      return { ok: true, latencyMs: Date.now() - start };
    } catch (err) {
      return {
        ok: false,
        latencyMs: Date.now() - start,
        detail: err instanceof Error ? err.message : String(err),
      };
    }
  },

  async stats(ctx: ActionCtx): Promise<KnowledgeStoreStats> {
    const [documentCount, chunkCount] = await Promise.all([
      ctx.runQuery(internal.knowledgeStore.convexQueries.countDocuments, {}),
      ctx.runQuery(internal.knowledgeStore.convexQueries.countChunks, {}),
    ]);
    return { documentCount, chunkCount };
  },

  async verifyIntegrity(ctx: ActionCtx): Promise<IntegrityReport> {
    // duplicateChunkKeys / crossDocumentChunkKeyCollisions are computed
    // exactly (full pagination over crawledChunks). orphanChunks here only
    // catches chunk rows with no valid ragId pointer — it does NOT
    // cross-reference the RAG component's own namespace listing for
    // untracked entries the way convex/crawl/reconciliation.ts's
    // auditRagReconciliation does, because that path requires an admin
    // Clerk session this adapter doesn't assume. A full RAG-side orphan
    // audit is a real gap, not silently treated as zero — see stats/report.
    return await ctx.runQuery(internal.knowledgeStore.convexQueries.verifyChunkKeyIntegrity, {});
  },
};
