import { v } from "convex/values";
import { internal } from "../_generated/api";
import { internalAction } from "../_generated/server";
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

const _internal: any = internal;

async function getCachedEntry(
  ctx: any,
  queryEmbedding: number[],
): Promise<{
  entry: any;
  entryId: string;
} | null> {
  if (queryEmbedding.length === 0) return null;

  const results = await ctx.vectorSearch("semanticCache", "by_queryEmbedding", {
    vector: queryEmbedding,
    limit: 5,
  });

  for (const res of results) {
    if (!res) continue;
    const entry = await ctx.runQuery(_internal.cache.internal_queries.getCacheEntry, {
      id: res._id,
    });
    if (!entry || entry.expiresAt < Date.now()) continue;

    const similarity = cosineSimilarity(queryEmbedding, entry.queryEmbedding);
    if (similarity >= CACHE_SIMILARITY_THRESHOLD) {
      return { entry, entryId: res._id };
    }

    if (entry.alternateEmbeddings && entry.alternateEmbeddings.length > 0) {
      for (const altEmbedding of entry.alternateEmbeddings) {
        if (cosineSimilarity(queryEmbedding, altEmbedding) >= CACHE_SIMILARITY_THRESHOLD) {
          return { entry, entryId: res._id };
        }
      }
    }
  }

  return null;
}

async function checkSourceStaleness(ctx: any, entry: any): Promise<boolean> {
  const sourceEntryIds = entry.sourceEntryIds;
  if (!sourceEntryIds || sourceEntryIds.length === 0) return false;

  // Fast path: use denormalized maxDocumentUpdatedAt if available
  if (entry.maxDocumentUpdatedAt) {
    return entry.maxDocumentUpdatedAt > entry.createdAt;
  }

  // Fallback: fetch all source docs in a single query
  try {
    const docs = await ctx.runQuery(_internal.cache.internal_queries.getDocsByEntryIds, {
      entryIds: sourceEntryIds,
    });
    if (docs.some((d: any) => d.doc && d.doc.updatedAt > entry.createdAt)) {
      return true;
    }
  } catch (err) {
    console.error("checkSourceStaleness query failed:", err);
  }
  return false;
}

async function findMatchingCacheEntry(
  ctx: any,
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

  const isStale = await checkSourceStaleness(ctx, cached.entry);
  if (isStale) return null;

  // Defensive: verify source chunks still exist (orphaned by document deletion)
  if (cached.entry.sourceEntryIds && cached.entry.sourceEntryIds.length > 0) {
    const sourceExists = await ctx.runQuery(_internal.cache.internal_queries.chunksExistByRagIds, {
      ragIds: cached.entry.sourceEntryIds,
    });
    if (!sourceExists.every(Boolean)) {
      await ctx.runMutation(_internal.cache.internal_queries.deleteCacheEntry, {
        id: cached.entryId,
      });
      return null;
    }
  }

  await ctx.runMutation(_internal.cache.internal_queries.incrementHits, { id: cached.entryId });

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
