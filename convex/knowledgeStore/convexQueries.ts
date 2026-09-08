import { v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import { type QueryCtx, internalQuery } from "../_generated/server";

// Internal read primitives the Convex KnowledgeStore adapter needs that don't
// already exist as reusable exports elsewhere. Existing hydration queries
// (convex/embeddings/doc_queries.ts) return freshness/status/citation fields
// that deliberately stay outside the KnowledgeStore boundary (see
// convex/knowledgeStore/types.ts) and don't return chunkKey/documentId, which
// this boundary needs instead — hence separate, narrower queries here rather
// than reusing those.

const chunkHitValidator = v.object({
  chunkKey: v.string(),
  documentId: v.string(),
  ordinalWithinHeading: v.number(),
  headingPath: v.array(v.string()),
  text: v.string(),
  parentText: v.union(v.string(), v.null()),
  contextualizedText: v.union(v.string(), v.null()),
  ingestionGeneration: v.number(),
});

async function resolveParentText(
  ctx: QueryCtx,
  chunk: Doc<"crawledChunks">,
): Promise<string | null> {
  if (chunk.parentId) {
    const parent = await ctx.db.get(chunk.parentId);
    return parent?.text ?? null;
  }
  return chunk.parentText ?? null;
}

// chunkKey is a structural field added after ordinalWithinHeading existed on
// some legacy rows only implicitly (via array position) — chunkKey.ts derives
// ordinalWithinHeading as an input, but crawledChunks doesn't persist it as
// its own column (only the resulting chunkKey). Legacy/pre-chunkKey rows
// (schema.ts:314-320) are excluded here (chunkKey required) exactly as the
// production by_documentId_and_chunkKey lookup path already excludes them.
function toChunkHit(chunk: Doc<"crawledChunks">, parentText: string | null) {
  if (!chunk.chunkKey) return null;
  return {
    chunkKey: chunk.chunkKey,
    documentId: chunk.documentId,
    ordinalWithinHeading: 0, // not separately stored; callers key off chunkKey, not this field, for anything load-bearing
    headingPath: chunk.headingPath ?? [],
    text: chunk.text,
    parentText,
    contextualizedText: chunk.contextualizedText ?? null,
    ingestionGeneration: chunk.ingestionGeneration ?? 0,
  };
}

/**
 * Batched entryId (ragId) -> chunk-shaped hit lookup, for translating
 * rag.search()'s opaque entryId results into KnowledgeStore SearchResults.
 * Mirrors the parallel-lookup + dedup pattern in
 * convex/embeddings/doc_queries.ts getDocumentsByEntryIds.
 */
export const getChunkHitsByRagIds = internalQuery({
  args: { ragIds: v.array(v.string()) },
  returns: v.array(v.union(chunkHitValidator, v.null())),
  handler: async (ctx, args) => {
    const chunks = await Promise.all(
      args.ragIds.map((ragId) =>
        ctx.db
          .query("crawledChunks")
          .withIndex("by_ragId", (q) => q.eq("ragId", ragId))
          .unique(),
      ),
    );
    return Promise.all(
      chunks.map(async (chunk) => {
        if (!chunk) return null;
        const parentText = await resolveParentText(ctx, chunk);
        return toChunkHit(chunk, parentText);
      }),
    );
  },
});

/**
 * Batched (documentId, chunkKey) -> chunk-shaped hit lookup, for
 * KnowledgeStore.getChunks hydration. Per-pair equivalent of
 * convex/crawl/queries.ts getChunkByKey, batched via by_documentId_and_chunkKey.
 */
export const getChunkHitsByKeys = internalQuery({
  args: {
    refs: v.array(v.object({ documentId: v.string(), chunkKey: v.string() })),
  },
  returns: v.array(v.union(chunkHitValidator, v.null())),
  handler: async (ctx, args) => {
    const chunks = await Promise.all(
      args.refs.map((ref) =>
        ctx.db
          .query("crawledChunks")
          .withIndex("by_documentId_and_chunkKey", (q) =>
            q.eq("documentId", ref.documentId as Id<"documents">).eq("chunkKey", ref.chunkKey),
          )
          .unique(),
      ),
    );
    return Promise.all(
      chunks.map(async (chunk) => {
        if (!chunk) return null;
        const parentText = await resolveParentText(ctx, chunk);
        return toChunkHit(chunk, parentText);
      }),
    );
  },
});

/**
 * Batched (documentId, chunkKey) -> (ragId, text) lookup, same index as
 * getChunkHitsByKeys above.
 *
 * Why this exists: a Pinecone denseSearch hit is identified by
 * (documentId, chunkKey) - the vendor-neutral KnowledgeStore identity - but
 * embeddings/search.ts's 3-way RRF fusion (hybridRank) and everything
 * downstream of it (batchFetchDocMeta, pickBestContent) are keyed by ragId,
 * the @convex-dev/rag component's internal entry id, because the OTHER two
 * channels (fullTextSearch, chunkTextSearch) already return ragId and
 * always have. Rather than rekeying those two established call sites (used
 * elsewhere for citations) to a different id space, this resolves each
 * Pinecone hit's ragId once so all three channels fuse in one shared id
 * space unchanged.
 *
 * `text` is returned alongside ragId (not just via getChunkHitsByKeys
 * separately) because pickBestContent's fallback chain needs a content
 * source for a dense-only hit: pineconeAdapter.denseSearch always returns
 * text: "" (Pinecone metadata carries identity fields only), and
 * getDocumentsByEntryIds's parentText is null for chunks with no distinct
 * parent - discovered via a real empty-content result in end-to-end testing
 * (2026-09-05), not assumed. Both null when a hit has no matching
 * crawledChunks row (should not happen for a chunk Pinecone just returned,
 * but a stale Pinecone vector pointing at a since-deleted chunk is exactly
 * the kind of divergence that must surface as "no match" rather than a
 * thrown error).
 */
export const getRagIdAndTextByChunkRefs = internalQuery({
  args: {
    refs: v.array(v.object({ documentId: v.string(), chunkKey: v.string() })),
  },
  returns: v.array(v.object({ ragId: v.union(v.string(), v.null()), text: v.union(v.string(), v.null()) })),
  handler: async (ctx, args) => {
    const chunks = await Promise.all(
      args.refs.map((ref) =>
        ctx.db
          .query("crawledChunks")
          .withIndex("by_documentId_and_chunkKey", (q) =>
            q.eq("documentId", ref.documentId as Id<"documents">).eq("chunkKey", ref.chunkKey),
          )
          .unique(),
      ),
    );
    return chunks.map((chunk) => ({ ragId: chunk?.ragId ?? null, text: chunk?.text ?? null }));
  },
});

/**
 * Direct BM25 lexical search over crawledChunks.search_text, returning
 * KnowledgeStore-shaped hits directly (no ragId round-trip needed — unlike
 * dense search, every field this boundary needs is already on the
 * crawledChunks row itself, so this doesn't reuse
 * convex/crawl/queries.ts's fullTextSearch, which returns a
 * citation-oriented {ragId, text, url} shape for a different caller).
 * Convex search indexes don't expose a numeric BM25 score (see
 * convex/embeddings/chunkTextSearch.ts) — results already come back in
 * relevance order, so score is a constant here too; downstream RRF re-ranks
 * by position, same as today.
 */
export const lexicalSearchChunks = internalQuery({
  args: { query: v.string(), limit: v.number() },
  returns: v.array(chunkHitValidator),
  handler: async (ctx, args) => {
    const chunks = await ctx.db
      .query("crawledChunks")
      .withSearchIndex("search_text", (q) => q.search("text", args.query))
      .take(args.limit);
    const hits = await Promise.all(
      chunks.map(async (chunk) => {
        const parentText = await resolveParentText(ctx, chunk);
        return toChunkHit(chunk, parentText);
      }),
    );
    return hits.filter((h): h is NonNullable<typeof h> => h !== null);
  },
});

/**
 * O(n) paginated exact count of crawledChunks. There is no maintained
 * aggregate for chunk count (crawlStats only tracks document counts) — this
 * is for KnowledgeStore.stats()/capacity benchmarking, not a hot path.
 */
export const countChunks = internalQuery({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    let total = 0;
    let cursor: string | null = null;
    while (true) {
      const page = await ctx.db.query("crawledChunks").paginate({
        numItems: 1000,
        cursor,
      });
      total += page.page.length;
      if (page.isDone) break;
      cursor = page.continueCursor;
    }
    return total;
  },
});

/** Prefers the maintained crawlStats singleton (see schema.ts) over a full
 * pagination count; falls back to paginated counting if the aggregate row
 * doesn't exist yet (e.g. a fresh test database). */
export const countDocuments = internalQuery({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    const stats = await ctx.db
      .query("crawlStats")
      .withIndex("by_statsId", (q) => q.eq("statsId", "global"))
      .first();
    if (stats) return stats.totalDocuments;
    let total = 0;
    let cursor: string | null = null;
    while (true) {
      const page = await ctx.db.query("documents").paginate({ numItems: 1000, cursor });
      total += page.page.length;
      if (page.isDone) break;
      cursor = page.continueCursor;
    }
    return total;
  },
});

/**
 * Looks up a document's stored `source` (host, set by upsertDocumentRow from
 * canonicalUrl - see convexMutations.ts). Needed because @convex-dev/rag's
 * validateAddFilterValues requires EVERY configured filterName (rag/instance.ts:
 * ["category", "source"]) to be present on every rag.add() call, not just
 * ones a caller actually filters by later - source-verified by executing
 * upsertChunks against the real dev deployment, which threw "Filter name
 * source is not valid" until this was added. upsertChunks only receives
 * documentId/generation/category/chunks (see types.ts), not canonicalUrl, so
 * this is the cheapest way to recover it without changing the vendor-neutral
 * KnowledgeStore signature just to satisfy one backend's internal component
 * requirement - the Turso adapter has no equivalent constraint.
 */
export const getDocumentSource = internalQuery({
  args: { documentId: v.string() },
  returns: v.union(v.string(), v.null()),
  handler: async (ctx, args) => {
    const doc = await ctx.db.get(args.documentId as Id<"documents">);
    return doc?.source ?? null;
  },
});

/** Trivial read used only to measure round-trip latency for health(). */
export const pingHealth = internalQuery({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    await ctx.db.query("documents").take(1);
    return null;
  },
});

/**
 * Full pagination over crawledChunks checking: (1) duplicateChunkKeys - more
 * than one row sharing the same (documentId, chunkKey) pair, which the
 * upsert-by-compound-key pattern in upsertChunkRow should make impossible in
 * steady state, so a nonzero count here is a real bug signal; (2)
 * crossDocumentChunkKeyCollisions - the same chunkKey string appearing under
 * two different documentIds, which computeChunkKey's inclusion of
 * documentUrl in the hash (convex/crawl/chunkKey.ts) should make impossible
 * by construction; (3) orphanChunks - rows with an empty/missing ragId
 * pointer. Does NOT cross-reference the RAG component's own namespace
 * listing for untracked entries (see verifyIntegrity's doc comment in
 * convexAdapter.ts) - that is a real, separate gap, not folded into this
 * number.
 */
export const verifyChunkKeyIntegrity = internalQuery({
  args: {},
  returns: v.object({
    duplicateChunkKeys: v.number(),
    crossDocumentChunkKeyCollisions: v.number(),
    orphanChunks: v.number(),
  }),
  handler: async (ctx) => {
    const seenPerDocument = new Map<string, Set<string>>();
    const documentsByChunkKey = new Map<string, Set<string>>();
    let duplicateChunkKeys = 0;
    let orphanChunks = 0;

    let cursor: string | null = null;
    while (true) {
      const page = await ctx.db.query("crawledChunks").paginate({ numItems: 1000, cursor });
      for (const chunk of page.page) {
        if (!chunk.ragId) orphanChunks++;
        if (!chunk.chunkKey) continue; // legacy pre-chunkKey rows - excluded, same convention as elsewhere in this file

        const docKey = chunk.documentId;
        const perDoc = seenPerDocument.get(docKey) ?? new Set<string>();
        if (perDoc.has(chunk.chunkKey)) duplicateChunkKeys++;
        perDoc.add(chunk.chunkKey);
        seenPerDocument.set(docKey, perDoc);

        const docsForKey = documentsByChunkKey.get(chunk.chunkKey) ?? new Set<string>();
        docsForKey.add(docKey);
        documentsByChunkKey.set(chunk.chunkKey, docsForKey);
      }
      if (page.isDone) break;
      cursor = page.continueCursor;
    }

    let crossDocumentChunkKeyCollisions = 0;
    for (const docs of documentsByChunkKey.values()) {
      if (docs.size > 1) crossDocumentChunkKeyCollisions++;
    }

    return { duplicateChunkKeys, crossDocumentChunkKeyCollisions, orphanChunks };
  },
});
