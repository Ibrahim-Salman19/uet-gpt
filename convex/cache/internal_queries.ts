import { v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
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
      headingPath: v.optional(v.array(v.string())),
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
  embeddingModel: v.optional(v.string()),
  sourceEntryIds: v.optional(v.array(v.string())),
  alternateQueryTexts: v.optional(v.array(v.string())),
  alternateEmbeddings: v.optional(v.array(v.array(v.float64()))),
});

export const getCacheEntry = internalQuery({
  args: { id: v.id("semanticCache") },
  returns: v.union(cacheEntryValidator, v.null()),
  handler: async (ctx, args) => {
    return (await ctx.db.get(args.id)) as Doc<"semanticCache"> | null;
  },
});

export const incrementHits = internalMutation({
  args: { id: v.id("semanticCache") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const entry = await ctx.db.get(args.id);
    if (entry) {
      const currentHits = typeof entry.hits === "number" ? entry.hits : 0;
      await ctx.db.patch(args.id, { hits: currentHits + 1 });
    }
  },
});

export const getDocByEntryId = internalQuery({
  args: { entryId: v.string() },
  returns: v.union(
    v.object({
      updatedAt: v.number(),
      crawledAt: v.number(),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const doc = await ctx.db
      .query("documents")
      .withIndex("by_entryId", (q) => q.eq("entryId", args.entryId))
      .first();
    if (!doc) return null;
    return { updatedAt: doc.updatedAt, crawledAt: doc.crawledAt };
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
      .withIndex("by_expiresAt", (q) => q.lte("expiresAt", now))
      .take(maxToDelete);

    for (const entry of expired) {
      await ctx.db.delete(entry._id as Id<"semanticCache">);
    }

    return expired.length;
  },
});
