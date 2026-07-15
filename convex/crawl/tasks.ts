import { ConvexError, v } from "convex/values";
import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import { internalMutation, mutation } from "../_generated/server";
import { constantTimeCompare } from "./utils";

/**
 * Clean up expired entries from the semantic cache.
 * Called periodically to prevent the cache table from growing indefinitely.
 */
export const cleanupExpiredCache = internalMutation({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const maxToDelete = args.limit ?? 500;
    const now = Date.now();
    let deletedCount = 0;

    const expired = await ctx.db
      .query("semanticCache")
      .withIndex("by_expiresAt", (q) => q.lte("expiresAt", now))
      .take(maxToDelete);

    for (const entry of expired) {
      await ctx.db.delete(entry._id);
      deletedCount++;
    }

    const expiredWebhooks = await ctx.db
      .query("processedWebhooks")
      .withIndex("by_expiresAt", (q) => q.lte("expiresAt", now))
      .take(maxToDelete);

    for (const entry of expiredWebhooks) {
      await ctx.db.delete(entry._id);
      deletedCount++;
    }

    return deletedCount;
  },
});

/**
 * Aggregate daily usage stats for the admin analytics dashboard.
 * Creates a snapshot of key metrics in the audit log.
 */
export const aggregateDailyStats = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const now = Date.now();
    const twentyFourHoursAgo = now - 24 * 60 * 60 * 1000;

    // Use withIndex on the createdAt field instead of .filter() for efficiency
    const recentFeedback = await ctx.db
      .query("feedback")
      .withIndex("by_createdAt", (q) => q.gte("createdAt", twentyFourHoursAgo))
      .take(1000);

    const positiveFeedback = recentFeedback.filter((f) => f.rating === "thumbsUp").length;

    const statsDoc = await ctx.db.query("crawlStats").first();
    const totalDocuments = statsDoc?.totalDocuments || 0;
    const indexedDocuments = statsDoc?.indexedDocuments || 0;

    // Look up the first admin user to associate with the audit log entry
    const adminUser = await ctx.db
      .query("users")
      .withIndex("by_role", (q) => q.eq("role", "admin"))
      .first();

    const auditUserId: Id<"users"> | undefined =
      adminUser?._id ??
      (
        await ctx.db
          .query("users")
          .withIndex("by_role", (q) => q.eq("role", "superadmin"))
          .first()
      )?._id;

    // Log stats to the adminAuditLog for historical tracking
    // If no admin/superadmin user exists, skip the audit log (cron runs before any admin setup)
    if (auditUserId) {
      await ctx.db.insert("adminAuditLog", {
        userId: auditUserId as Id<"users">,
        action: "settings.update",
        target: "daily-stats",
        details: {
          newValue: JSON.stringify({
            date: new Date(now).toISOString().split("T")[0],
            feedback: recentFeedback.length,
            positiveFeedback,
            positiveRate:
              recentFeedback.length > 0
                ? Math.round((positiveFeedback / recentFeedback.length) * 100)
                : 0,
            indexedDocuments,
            totalDocuments,
          }),
        },
        createdAt: now,
      });
    }

    return null;
  },
});

export const runStatsAggregation = mutation({
  args: {
    secret: v.optional(v.string()),
    timestamp: v.optional(v.number()),
    signature: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    // SECURITY: only ONE purpose-specific secret (CRON_SECRET) may authorize this
    // cron-style operation — a webhook secret must NOT grant cron access (over-broad
    // blast radius). Compare with constantTimeCompare (the codebase's timing-safe
    // primitive in ./utils) instead of `===` to avoid a timing side-channel on the
    // shared secret, matching how the webhook handlers compare secrets.
    const cronSecret = process.env.CRON_SECRET;

    if (args.timestamp && args.signature && cronSecret) {
      // 1. Time-window validation (must be within last 5 minutes / 300 seconds)
      const nowSeconds = Math.floor(Date.now() / 1000);
      const timeDiff = Math.abs(nowSeconds - args.timestamp);
      if (timeDiff <= 300) {
        try {
          const encoder = new TextEncoder();
          const key = await crypto.subtle.importKey(
            "raw",
            encoder.encode(cronSecret),
            { name: "HMAC", hash: "SHA-256" },
            false,
            ["sign"],
          );
          const signatureBuffer = await crypto.subtle.sign(
            "HMAC",
            key,
            encoder.encode(`${args.timestamp}`),
          );
          const expectedSignature = Array.from(new Uint8Array(signatureBuffer))
            .map((b) => b.toString(16).padStart(2, "0"))
            .join("");

          if (constantTimeCompare(args.signature, expectedSignature)) {
            await ctx.runMutation(internal.crawl.tasks.aggregateDailyStats);
            return null;
          }
        } catch (err) {
          console.error("Cron signature generation failed:", err);
        }
      }
    }

    if (args.secret && cronSecret && constantTimeCompare(args.secret, cronSecret)) {
      await ctx.runMutation(internal.crawl.tasks.aggregateDailyStats);
      return null;
    }

    const identity = await ctx.auth.getUserIdentity();
    if (identity) {
      const caller = await ctx.db
        .query("users")
        .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
        .unique();
      if (caller && (caller.role === "admin" || caller.role === "superadmin")) {
        await ctx.runMutation(internal.crawl.tasks.aggregateDailyStats);
        return null;
      }
    }

    throw new ConvexError("Unauthorized: admin or valid secret/signature required");
  },
});
