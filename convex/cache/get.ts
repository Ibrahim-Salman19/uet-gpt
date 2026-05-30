import { v } from "convex/values";
import { internal } from "../_generated/api";
import { action } from "../_generated/server";

import { CACHE_SIMILARITY_THRESHOLD } from "../constants";

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

export const get = action({
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
        }),
      ),
      model: v.string(),
    }),
  ),
  handler: async (ctx: any, args: any) => {
    if (args.queryEmbedding.length === 0) return null;

    const results = await ctx.vectorSearch("semanticCache", "by_queryEmbedding", {
      vector: args.queryEmbedding,
      limit: 1,
    });

    if (results.length === 0) return null;

    const firstResult = results[0];
    if (!firstResult) return null;
    const entryId = firstResult._id;

    const entry = await ctx.runQuery(_internal.cache.internal_queries.getCacheEntry, {
      id: entryId,
    });

    if (!entry || entry.expiresAt < Date.now()) return null;

    const similarity = cosineSimilarity(args.queryEmbedding, entry.queryEmbedding);
    if (similarity < CACHE_SIMILARITY_THRESHOLD) return null;

    await ctx.runMutation(_internal.cache.internal_queries.incrementHits, { id: entryId });

    return {
      response: entry.response,
      sources: entry.sources,
      model: entry.model,
    };
  },
});
