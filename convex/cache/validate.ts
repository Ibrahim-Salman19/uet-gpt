import { v } from "convex/values";
import { query } from "../_generated/server";

export const validateCacheHit = query({
  args: {
    cacheId: v.id("semanticCache"),
    queryRisk: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const cacheEntry = await ctx.db.get(args.cacheId);
    if (!cacheEntry) {
      return { isValid: false, reason: "CACHE_ENTRY_NOT_FOUND" };
    }

    const now = Date.now();
    if (cacheEntry.expiresAt && now > cacheEntry.expiresAt) {
      return { isValid: false, reason: "CACHE_EXPIRED" };
    }

    // High current query max TTL check (1 hour)
    if (args.queryRisk === "high_current") {
      const maxAgeMs = 60 * 60 * 1000;
      if (now - cacheEntry.createdAt > maxAgeMs) {
        return { isValid: false, reason: "HIGH_CURRENT_TTL_EXPIRED" };
      }
    }

    // Source version & lifecycle revalidation
    if (cacheEntry.sourceEntryIds && cacheEntry.sourceEntryIds.length > 0) {
      for (const entryId of cacheEntry.sourceEntryIds) {
        const doc = await ctx.db
          .query("documents")
          .withIndex("by_entryId", (q) => q.eq("entryId", entryId))
          .first();

        if (!doc) continue;

        if (doc.isStale === true) {
          return { isValid: false, reason: "SOURCE_DOCUMENT_STALE" };
        }

        if (doc.lifecycleStatus === "superseded" || doc.lifecycleStatus === "withdrawn") {
          return { isValid: false, reason: "SOURCE_DOCUMENT_SUPERSEDED" };
        }

        if (cacheEntry.maxDocumentUpdatedAt && doc.updatedAt > cacheEntry.maxDocumentUpdatedAt) {
          return { isValid: false, reason: "SOURCE_DOCUMENT_UPDATED" };
        }
      }
    }

    return { isValid: true };
  },
});
