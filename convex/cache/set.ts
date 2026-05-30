import { v } from "convex/values";
import { mutation } from "../_generated/server";

// TASK-B03: TTL tiers matching freshnessTier from crawler assign_tier().
// high  = admissions/academic pages — expire in 7 days (may change each cycle)
// medium = department/faculty pages — expire in 2 days
// low   = everything else          — expire in 1 day
const DAY = 24 * 60 * 60 * 1000;
const TTL_HIGH   = 7 * DAY;
const TTL_MEDIUM = 2 * DAY;
const TTL_LOW    = 1 * DAY;

function tierToTtl(tier: "high" | "medium" | "low" | undefined, fallback: number): number {
  if (tier === "high")   return TTL_HIGH;
  if (tier === "medium") return TTL_MEDIUM;
  if (tier === "low")    return TTL_LOW;
  return fallback;
}

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
    // TASK-B03: freshnessTier from top source URL — overrides ttlMs if provided
    freshnessTier: v.optional(v.union(v.literal("high"), v.literal("medium"), v.literal("low"))),
  },
  returns: v.id("semanticCache"),
  handler: async (ctx, args) => {
    // Tier-aware TTL: freshnessTier > explicit ttlMs > default 2 days
    const ttl: number = tierToTtl(args.freshnessTier, args.ttlMs ?? TTL_MEDIUM);
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
