import { v } from "convex/values";
import { internal } from "../_generated/api";
import { action, internalMutation, internalQuery } from "../_generated/server";

const CACHE_SIMILARITY_THRESHOLD = 0.95;

function cosineSimilarity(a: number[], b: number[]) {
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
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

export const get = action({
  args: {
    queryText: v.string(),
    queryEmbedding: v.array(v.float64()),
  },
  handler: async (ctx, args) => {
    const results = await ctx.vectorSearch("semanticCache", "by_queryEmbedding", {
      vector: args.queryEmbedding,
      limit: 1,
    });

    if (results.length === 0) return null;

    const firstResult = results[0];
    if (!firstResult) return null;
    const entryId = firstResult._id;
    // Retrieve the actual entry via an internal query
    const entry = await ctx.runQuery(internal.cache.get.getCacheEntry, { id: entryId });

    if (!entry || entry.expiresAt < Date.now()) return null;

    const similarity = cosineSimilarity(args.queryEmbedding, entry.queryEmbedding);
    if (similarity < CACHE_SIMILARITY_THRESHOLD) return null;

    // Increment hit counter asynchronously via an internal mutation
    await ctx.runMutation(internal.cache.get.incrementHits, { id: entryId });

    return {
      response: entry.response,
      sources: entry.sources,
      model: entry.model,
    };
  },
});

export const getCacheEntry = internalQuery({
  args: { id: v.id("semanticCache") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const incrementHits = internalMutation({
  args: { id: v.id("semanticCache") },
  handler: async (ctx, args) => {
    const entry = await ctx.db.get(args.id);
    if (entry) {
      await ctx.db.patch(args.id, { hits: (entry.hits as number) + 1 });
    }
  },
});
