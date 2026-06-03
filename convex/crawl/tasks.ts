import { v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import { internalMutation, mutation } from "../_generated/server";

/**
 * Clean up expired entries from the semantic cache.
 * Called periodically to prevent the cache table from growing indefinitely.
 */
export const cleanupExpiredCache = internalMutation({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const maxToDelete = args.limit ?? 100;
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
export const aggregateDailyStats = mutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const now = Date.now();
    const twentyFourHoursAgo = now - 24 * 60 * 60 * 1000;

    // Use withIndex on the createdAt field instead of .filter() for efficiency
    const recentFeedback = await ctx.db
      .query("feedback")
      .withIndex("by_createdAt", (q) => q.gte("createdAt", twentyFourHoursAgo))
      .take(10000);

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
            date: new Date().toISOString().split("T")[0],
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
