import { ConvexError, v } from "convex/values";
import { api, internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { action, internalMutation } from "../_generated/server";
import { constantTimeCompare } from "../crawl/utils";

const DAY = 24 * 60 * 60 * 1000;
const FRESHNESS_TTL = {
  high: 12 * 60 * 60 * 1000, // 12 hours — data refreshes often
  medium: 1 * DAY, // 24 hours
  low: 5 * DAY, // 5 days — rarely changes
} as const;

const MAX_CACHE_ENTRY_BYTES = 900_000; // 900KB — leaves margin for Convex ~1MB doc limit

function estimateDocSize(obj: unknown): number {
  return Buffer.byteLength(JSON.stringify(obj), "utf-8");
}

function tierToTtl(tier: "high" | "medium" | "low" | undefined, fallback: number): number {
  if (tier === "high") return FRESHNESS_TTL.high;
  if (tier === "medium") return FRESHNESS_TTL.medium;
  if (tier === "low") return FRESHNESS_TTL.low;
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
    maxDocumentUpdatedAt: v.optional(v.number()),
  },
  returns: v.id("semanticCache"),
  handler: async (ctx, args) => {
    const ttl: number = tierToTtl(args.freshnessTier, args.ttlMs ?? FRESHNESS_TTL.medium);

    let maxDocUpdatedAt = args.maxDocumentUpdatedAt;

    // If caller didn't provide maxDocumentUpdatedAt, derive it from ALL source
    // documents. The denormalized value is trusted by the read fast-path
    // (get.ts checkSourceStaleness) for the entire entry, so it must cover every
    // source — sampling only a prefix would let updates to later sources go
    // undetected and serve stale answers. Resolve ragId -> chunk in batches of
    // 100 to bound the concurrent query fan-out.
    if (maxDocUpdatedAt === undefined && args.sourceEntryIds && args.sourceEntryIds.length > 0) {
      const docIds = new Set<Id<"documents">>();
      const RESOLVE_BATCH = 100;
      for (let i = 0; i < args.sourceEntryIds.length; i += RESOLVE_BATCH) {
        const chunkBatch = await Promise.all(
          args.sourceEntryIds.slice(i, i + RESOLVE_BATCH).map((ragId) =>
            ctx.db
              .query("crawledChunks")
              .withIndex("by_ragId", (q) => q.eq("ragId", ragId))
              .first(),
          ),
        );
        for (const chunk of chunkBatch) {
          if (chunk) docIds.add(chunk.documentId);
        }
      }
      const uniqueDocIds = Array.from(docIds);
      for (let i = 0; i < uniqueDocIds.length; i += RESOLVE_BATCH) {
        const docs = await Promise.all(
          uniqueDocIds.slice(i, i + RESOLVE_BATCH).map((id) => ctx.db.get(id)),
        );
        for (const doc of docs) {
          if (doc && (maxDocUpdatedAt === undefined || doc.updatedAt > maxDocUpdatedAt)) {
            maxDocUpdatedAt = doc.updatedAt;
          }
        }
      }
    }

    const entry = {
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
      ...(maxDocUpdatedAt !== undefined ? { maxDocumentUpdatedAt: maxDocUpdatedAt } : {}),
      ...(args.alternateQueryTexts ? { alternateQueryTexts: args.alternateQueryTexts } : {}),
      ...(args.alternateEmbeddings ? { alternateEmbeddings: args.alternateEmbeddings } : {}),
    };

    const size = estimateDocSize(entry);
    if (size > MAX_CACHE_ENTRY_BYTES) {
      console.warn(
        `[cache/set] Skipping insert: estimated size ${size} bytes exceeds limit ${MAX_CACHE_ENTRY_BYTES} bytes`,
      );
      throw new ConvexError(
        `Cache entry too large (${size} bytes). Max allowed: ${MAX_CACHE_ENTRY_BYTES} bytes.`,
      );
    }

    const id = await ctx.db.insert("semanticCache", entry);
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
    maxDocumentUpdatedAt: v.optional(v.number()),
  },
  returns: v.id("semanticCache"),
  handler: async (ctx, args): Promise<Id<"semanticCache">> => {
    const internalSecret = process.env.INTERNAL_API_SECRET;
    let authorized = false;

    if (args.secret && internalSecret && constantTimeCompare(args.secret, internalSecret)) {
      authorized = true;
    }

    if (!authorized) {
      const identity = await ctx.auth.getUserIdentity();
      if (!identity) {
        throw new ConvexError("Authentication required or invalid API secret");
      }

      const user = await ctx.runQuery(internal.users.getByClerkIdInternal, {
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
