import { v } from "convex/values";
import { internalMutation, internalQuery } from "../_generated/server";

const cacheEntryValidator = v.object({
  _id: v.id("semanticCache"),
  _creationTime: v.number(),
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
  hits: v.number(),
  expiresAt: v.number(),
  createdAt: v.number(),
});

export const getCacheEntry = internalQuery({
  args: { id: v.id("semanticCache") },
  returns: v.union(cacheEntryValidator, v.null()),
  handler: async (ctx, args) => {
    return (await ctx.db.get("semanticCache", args.id)) as any;
  },
});

export const incrementHits = internalMutation({
  args: { id: v.id("semanticCache") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const entry = await ctx.db.get("semanticCache", args.id);
    if (entry) {
      const currentHits = typeof entry.hits === "number" ? entry.hits : 0;
      await ctx.db.patch("semanticCache", args.id, { hits: currentHits + 1 });
    }
  },
});

export const cleanupExpired = internalMutation({
  args: {
    limit: v.optional(v.number()),
  },
  returns: v.number(),
  handler: async (ctx, args) => {
    const maxToDelete = args.limit ?? 50;
    const now = Date.now();

    const expired = await ctx.db
      .query("semanticCache")
      .withIndex("by_expiresAt", (q: any) => q.lte("expiresAt", now))
      .take(maxToDelete);

    for (const entry of expired) {
      await ctx.db.delete(entry._id as any);
    }

    return expired.length;
  },
});
