import { v } from "convex/values";
import { mutation } from "../_generated/server";

export const FRESHNESS_TTLS_DAYS = {
  high: 14,
  medium: 60,
  low: 180,
} as const;

export const runFreshnessSweepBatch = mutation({
  args: {
    batchSize: v.optional(v.number()),
    cursor: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const limit = args.batchSize || 100;
    const now = Date.now();
    const msPerDay = 24 * 60 * 60 * 1000;

    // Fetch batch of indexed documents
    const documents = await ctx.db
      .query("documents")
      .withIndex("by_status", (q) => q.eq("status", "indexed"))
      .take(limit);

    let examined = 0;
    let flaggedAged = 0;
    let clearedFresh = 0;

    for (const doc of documents) {
      examined += 1;
      const tier = doc.freshnessTier || "medium";
      const maxAgeMs = (FRESHNESS_TTLS_DAYS[tier] || 60) * msPerDay;
      const ageMs = now - (doc.updatedAt || doc.crawledAt);

      if (ageMs > maxAgeMs) {
        flaggedAged += 1;
        await ctx.db.patch(doc._id, {
          freshnessState: "aged",
          isStale: true,
        });
      } else {
        clearedFresh += 1;
        await ctx.db.patch(doc._id, {
          freshnessState: "fresh",
          isStale: false,
        });
      }
    }

    return {
      examined,
      flaggedAged,
      clearedFresh,
      timestamp: now,
    };
  },
});
