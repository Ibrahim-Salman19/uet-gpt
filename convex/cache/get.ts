import { v } from "convex/values";
import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import { type ActionCtx, internalAction } from "../_generated/server";
import { CACHE_SIMILARITY_THRESHOLD } from "../constants";
import { truncateQuery } from "../observability/metrics";

export function cosineSimilarity(a: number[], b: number[]) {
  if (a.length === 0 || b.length === 0) return 0;
  if (a.length !== b.length) return 0;

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    const ai = a[i];
    const bi = b[i];
    if (ai === undefined || bi === undefined) continue;
    dotProduct += ai * bi;
    normA += ai * ai;
    normB += bi * bi;
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  if (denominator === 0) return 0;
  return dotProduct / denominator;
}

async function getCachedEntry(
  ctx: ActionCtx,
  queryEmbedding: number[],
): Promise<{
  entry: Doc<"semanticCache">;
  entryId: Id<"semanticCache">;
} | null> {
  if (queryEmbedding.length === 0) return null;

  const results = await ctx.vectorSearch("semanticCache", "by_queryEmbedding", {
    vector: queryEmbedding,
    limit: 5,
  });

  for (const res of results) {
    if (!res) continue;

    // The vector index already ranks by cosine; trust `_score` for the primary
    // embedding instead of re-fetching the doc and recomputing cosineSimilarity
    // over the (768-dim) query vector for every candidate.
    if (res._score >= CACHE_SIMILARITY_THRESHOLD) {
      const entry = await ctx.runQuery(internal.cache.internal_queries.getCacheEntry, {
        id: res._id,
      });
      if (!entry || entry.expiresAt < Date.now()) continue;
      return { entry, entryId: res._id };
    }

    // Primary embedding missed the threshold. Only the alternate embeddings can
    // still produce a hit, so fetch just those (not the whole row incl. response,
    // sources and the full queryEmbedding) before deciding.
    const altCandidate = await ctx.runQuery(
      internal.cache.internal_queries.getCacheEntryAlternates,
      { id: res._id },
    );
    if (!altCandidate || altCandidate.expiresAt < Date.now()) continue;
    if (!altCandidate.alternateEmbeddings || altCandidate.alternateEmbeddings.length === 0) {
      continue;
    }

    const altHit = altCandidate.alternateEmbeddings.some(
      (altEmbedding: number[]) =>
        cosineSimilarity(queryEmbedding, altEmbedding) >= CACHE_SIMILARITY_THRESHOLD,
    );
    if (altHit) {
      const entry = await ctx.runQuery(internal.cache.internal_queries.getCacheEntry, {
        id: res._id,
      });
      if (!entry || entry.expiresAt < Date.now()) continue;
      return { entry, entryId: res._id };
    }
  }

  return null;
}

type SourceDocVersion = { documentId: Id<"documents">; contentHash?: string };
type CurrentSourceDocState = {
  contentHash?: string;
  isStale?: boolean;
  lifecycleStatus?: string;
} | null;

/**
 * Source-version validity for a cache hit. Returns the invalidation reason, or
 * null when every source document is unchanged and still servable.
 * `current[i]` is the present state of `snapshot[i].documentId` (null = deleted).
 * Entries with cited sources but no snapshot (written before snapshots existed)
 * cannot be verified and are treated as invalid.
 */
export function findSourceInvalidation(
  entry: { sourceEntryIds?: string[]; sourceDocVersions?: SourceDocVersion[] },
  current: CurrentSourceDocState[],
): string | null {
  if (!entry.sourceEntryIds || entry.sourceEntryIds.length === 0) return null;
  const snapshot = entry.sourceDocVersions;
  if (!snapshot) return "SOURCE_VERSIONS_UNKNOWN";
  for (let i = 0; i < snapshot.length; i++) {
    const doc = current[i];
    if (!doc) return "SOURCE_DOCUMENT_MISSING";
    if (doc.contentHash !== snapshot[i]!.contentHash) return "SOURCE_DOCUMENT_CHANGED";
    if (doc.isStale === true) return "SOURCE_DOCUMENT_STALE";
    if (doc.lifecycleStatus !== undefined && doc.lifecycleStatus !== "active") {
      return "SOURCE_DOCUMENT_RETIRED";
    }
  }
  return null;
}

async function checkSourceInvalidation(
  ctx: ActionCtx,
  entry: Doc<"semanticCache">,
): Promise<string | null> {
  const snapshot = entry.sourceDocVersions;
  if (!snapshot || snapshot.length === 0) return findSourceInvalidation(entry, []);
  const current = await ctx.runQuery(internal.cache.internal_queries.getSourceDocStates, {
    documentIds: snapshot.map((s) => s.documentId),
  });
  return findSourceInvalidation(entry, current);
}

async function findMatchingCacheEntry(
  ctx: ActionCtx,
  queryEmbedding: number[],
): Promise<{
  response: string;
  sources: Array<{
    entryId: string;
    url: string;
    title: string;
    relevanceScore: number;
    excerpt: string;
    headingPath?: string[];
  }>;
  model: string;
} | null> {
  const cached = await getCachedEntry(ctx, queryEmbedding);
  if (!cached) return null;

  const [invalidation, sourceExistsResult] = await Promise.all([
    checkSourceInvalidation(ctx, cached.entry).catch((err) => {
      // Fail closed (miss without deleting): an unverifiable hit is not served.
      console.error("checkSourceInvalidation query failed:", err);
      return "SOURCE_CHECK_FAILED";
    }),
    cached.entry.sourceEntryIds && cached.entry.sourceEntryIds.length > 0
      ? ctx.runQuery(internal.cache.internal_queries.chunksExistByRagIds, {
          ragIds: cached.entry.sourceEntryIds,
        })
      : Promise.resolve(null),
  ]);

  if (invalidation === "SOURCE_CHECK_FAILED") return null;

  if (invalidation || (sourceExistsResult && !sourceExistsResult.every(Boolean))) {
    console.log("[CACHE] Invalidated", { reason: invalidation ?? "SOURCE_CHUNK_MISSING" });
    await ctx.runMutation(internal.cache.internal_queries.deleteCacheEntry, {
      id: cached.entryId,
    });
    return null;
  }

  await ctx.runMutation(internal.cache.internal_queries.incrementHits, { id: cached.entryId });

  return {
    response: cached.entry.response,
    sources: cached.entry.sources,
    model: cached.entry.model,
  };
}

// internalAction: only callable server-side via internal.cache.get.get from the
// already-authenticated RAG retrieval pipeline. The write path is already gated via
// setFromServer; this makes the read path symmetric so unauthenticated clients cannot
// probe the cache or trigger vector search + metrics-counter spam.
export const get = internalAction({
  args: {
    queryText: v.string(),
    queryEmbedding: v.array(v.float64()),
  },
  returns: v.union(
    v.null(),
    v.object({
      response: v.string(),
      sources: v.array(
        v.object({
          entryId: v.string(),
          url: v.string(),
          title: v.string(),
          relevanceScore: v.number(),
          excerpt: v.string(),
          headingPath: v.optional(v.array(v.string())),
        }),
      ),
      model: v.string(),
    }),
  ),
  handler: async (ctx, args) => {
    const start = Date.now();
    const result = await findMatchingCacheEntry(ctx, args.queryEmbedding);
    const latency = Date.now() - start;

    if (result) {
      console.log("[CACHE] Hit", {
        query: truncateQuery(args.queryText),
        latencyMs: latency,
      });
      await ctx.runMutation(internal.observability.metrics.incrementCounter, {
        key: "observability_cache_hits_total",
        incrementBy: 1,
      });
    } else {
      console.log("[CACHE] Miss", {
        query: truncateQuery(args.queryText),
        latencyMs: latency,
      });
      await ctx.runMutation(internal.observability.metrics.incrementCounter, {
        key: "observability_cache_misses_total",
        incrementBy: 1,
      });
    }

    return result;
  },
});
