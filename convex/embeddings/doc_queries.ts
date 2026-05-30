import { v } from "convex/values";
import { internalQuery } from "../_generated/server";

export const getDocumentByEntryId = internalQuery({
  args: { entryId: v.string() },
  returns: v.union(
    v.null(),
    v.object({
      url: v.string(),
      title: v.string(),
      category: v.string(),
      crawledAt: v.optional(v.number()),
      freshnessTier: v.optional(v.string()),
      parentText: v.optional(v.string()),
    }),
  ),
  handler: async (ctx, args) => {
    // 1. Try to find the document via crawledChunks mapping (O(1) index query)
    const chunk = await ctx.db
      .query("crawledChunks")
      .withIndex("by_ragId", (q) => q.eq("ragId", args.entryId))
      .unique();

    if (chunk) {
      const doc = await ctx.db.get(chunk.documentId);
      if (doc) {
        return {
          url: doc.url,
          title: doc.title,
          category: doc.category,
          crawledAt: doc.crawledAt,
          freshnessTier: doc.freshnessTier,
          parentText: chunk.parentText,
        } as any;
      }
    }

    // 2. Fallback to direct lookup on documents table (e.g. for legacy or manual documents)
    const doc = await ctx.db
      .query("documents")
      .withIndex("by_entryId", (q) => q.eq("entryId", args.entryId))
      .unique();

    if (!doc) return null;

    return {
      url: doc.url,
      title: doc.title,
      category: doc.category,
      crawledAt: doc.crawledAt,
      freshnessTier: doc.freshnessTier,
      parentText: undefined,
    } as any;
  },
});
