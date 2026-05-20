import { v } from "convex/values";
import { mutation } from "../_generated/server";

export const set = mutation({
  args: {
    queryText: v.string(),
    queryEmbedding: v.array(v.float64()),
    response: v.string(),
    sources: v.array(
      v.object({
        documentId: v.id("documents"),
        chunkId: v.id("chunks"),
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
  handler: async (ctx, args) => {
    const ttl = (args.ttlMs as number | undefined) ?? 86400000;
    return await ctx.db.insert("semanticCache", {
      queryText: args.queryText,
      queryEmbedding: args.queryEmbedding,
      response: args.response,
      sources: args.sources,
      model: args.model,
      ...(args.tokenCount && { tokenCount: args.tokenCount }),
      hits: 0,
      expiresAt: Date.now() + ttl,
      createdAt: Date.now(),
    });
  },
});
