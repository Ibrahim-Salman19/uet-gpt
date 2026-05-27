import { v } from "convex/values";
import { mutation } from "../_generated/server";

export const set = mutation({
  args: {
    queryText: v.string(),
    queryEmbedding: v.array(v.float64()),
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
    tokenCount: v.optional(
      v.object({
        prompt: v.number(),
        completion: v.number(),
        total: v.number(),
      }),
    ),
    ttlMs: v.optional(v.number()),
  },
  returns: v.id("semanticCache"),
  handler: async (ctx, args) => {
    const ttl = args.ttlMs ?? 86400000;
    const id = await ctx.db.insert("semanticCache", {
      queryText: args.queryText,
      queryEmbedding: args.queryEmbedding,
      response: args.response,
      sources: args.sources,
      model: args.model,
      tokenCount: args.tokenCount,
      hits: 0,
      expiresAt: Date.now() + ttl,
      createdAt: Date.now(),
    });
    return id;
  },
});
