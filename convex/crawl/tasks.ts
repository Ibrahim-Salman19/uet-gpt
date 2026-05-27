import { v } from "convex/values";
import type { Id } from "../_generated/dataModel";
import { mutation } from "../_generated/server";

/**
 * Clean up expired entries from the semantic cache.
 * Called periodically to prevent the cache table from growing indefinitely.
 */
export const cleanupExpiredCache = mutation({
  args: {
    limit: v.optional(v.number()),
  },
  returns: v.number(),
  handler: async (ctx, args) => {
    const maxToDelete = args.limit ?? 100;
    const now = Date.now();
    let deletedCount = 0;

    const expired = await ctx.db
      .query("semanticCache")
      .withIndex(
        "by_expiresAt",
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Convex query builder generic type limitation
        (q: any) => q.lte("expiresAt", now),
      )
      .take(maxToDelete);

    for (const entry of expired) {
      await ctx.db.delete(entry._id as Id<"semanticCache">);
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
      .withIndex(
        "by_createdAt",
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Convex query builder generic type limitation
        (q: any) => q.gte("createdAt", twentyFourHoursAgo),
      )
      .collect();

    const positiveFeedback = recentFeedback.filter((f) => f.rating === "thumbsUp").length;

    const statsDoc = await ctx.db.query("crawlStats").first();
    const totalDocuments = statsDoc?.totalDocuments || 0;
    const indexedDocuments = statsDoc?.indexedDocuments || 0;

    // Look up the first admin user to associate with the audit log entry
    const adminUser = await ctx.db
      .query("users")
      .withIndex(
        "by_role",
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Convex query builder generic type limitation
        (q: any) => q.eq("role", "admin"),
      )
      .first();

    const auditUserId: string | undefined =
      (adminUser?._id as string | undefined) ??
      ((
        await ctx.db
          .query("users")
          .withIndex(
            "by_role",
            // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Convex query builder generic type limitation
            (q: any) => q.eq("role", "superadmin"),
          )
          .first()
      )?._id as string | undefined);

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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Convex GenericDocument doesn't match nested object validator
      } as any);
    }

    return null;
  },
});
