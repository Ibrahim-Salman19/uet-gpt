import { ConvexError, v } from "convex/values";
import { api, internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { action, internalMutation } from "../_generated/server";

const DAY = 24 * 60 * 60 * 1000;
const TTL_HIGH = 5 * DAY;
const TTL_MEDIUM = 1 * DAY;
const TTL_LOW = 0.5 * DAY;

function tierToTtl(tier: "high" | "medium" | "low" | undefined, fallback: number): number {
  if (tier === "high") return TTL_LOW;
  if (tier === "medium") return TTL_MEDIUM;
  if (tier === "low") return TTL_HIGH;
  return fallback;
}

export const set = internalMutation({
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
    ttlMs: v.optional(v.number()),
    freshnessTier: v.optional(v.union(v.literal("high"), v.literal("medium"), v.literal("low"))),
    sourceEntryIds: v.optional(v.array(v.string())),
    alternateQueryTexts: v.optional(v.array(v.string())),
    alternateEmbeddings: v.optional(v.array(v.array(v.float64()))),
  },
  returns: v.id("semanticCache"),
  handler: async (ctx, args) => {
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
      sourceEntryIds: args.sourceEntryIds,
      ...(args.alternateQueryTexts ? { alternateQueryTexts: args.alternateQueryTexts } : {}),
      ...(args.alternateEmbeddings ? { alternateEmbeddings: args.alternateEmbeddings } : {}),
    });
    return id;
  },
});

/**
 * Public action wrapper for cache set — validates caller is server-side.
 * Only callable from trusted server contexts (Next.js API routes, cron jobs).
 */
export const setFromServer = action({
  args: {
    secret: v.optional(v.string()),
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
    ttlMs: v.optional(v.number()),
    freshnessTier: v.optional(v.union(v.literal("high"), v.literal("medium"), v.literal("low"))),
    sourceEntryIds: v.optional(v.array(v.string())),
    alternateQueryTexts: v.optional(v.array(v.string())),
    alternateEmbeddings: v.optional(v.array(v.array(v.float64()))),
  },
  returns: v.id("semanticCache"),
  handler: async (ctx, args): Promise<Id<"semanticCache">> => {
    const internalSecret = process.env.INTERNAL_API_SECRET;
    let authorized = false;

    if (args.secret && internalSecret && args.secret === internalSecret) {
      authorized = true;
    }

    if (!authorized) {
      const identity = await ctx.auth.getUserIdentity();
      if (!identity) {
        throw new ConvexError("Authentication required or invalid API secret");
      }

      const user = await ctx.runQuery(api.users.getByClerkId, {
        clerkId: identity.subject,
      });

      if (!user || !user.isActive || (user.role !== "admin" && user.role !== "superadmin")) {
        throw new ConvexError("Unauthorized: Admin privileges required");
      }
      authorized = true;
    }

    const { secret, ...mutationArgs } = args;
    return await ctx.runMutation(internal.cache.set.set, mutationArgs);
  },
});
