import { ConvexError, v } from "convex/values";
import type { Doc } from "../_generated/dataModel";
import { mutation, query } from "../_generated/server";
import { requireAdmin } from "../auth";
import { fastCount, fastFilteredCount } from "../lib/db_helpers";

/**
 * Admin dashboard overview stats.
 * Returns aggregate counts and recent activity across all data types.
 * Note: messages/threads tables are managed by @convex-dev/agent component,
 * so we use the component's API functions instead of querying them directly.
 */
/**
 * Accepts a client-provided refTime to enable query caching.
 * Client should pass Date.now() rounded to nearest minute.
 */
export const dashboardStats = query({
  args: { refTime: v.optional(v.number()) },
  returns: v.object({
    totalDocuments: v.number(),
    totalFeedback: v.number(),
    totalUsers: v.number(),
    totalCrawlJobs: v.number(),
    totalCacheEntries: v.number(),
    indexedDocuments: v.number(),
    pendingDocuments: v.number(),
    failedDocuments: v.number(),
    recentFeedback: v.array(
      v.object({
        _id: v.id("feedback"),
        rating: v.union(v.literal("thumbsUp"), v.literal("thumbsDown")),
        createdAt: v.number(),
        category: v.optional(
          v.union(
            v.literal("accurate"),
            v.literal("inaccurate"),
            v.literal("incomplete"),
            v.literal("irrelevant"),
            v.literal("other"),
          ),
        ),
      }),
    ),
    recentCrawls: v.array(
      v.object({
        _id: v.id("crawlJobs"),
        status: v.union(
          v.literal("pending"),
          v.literal("running"),
          v.literal("completed"),
          v.literal("failed"),
          v.literal("cancelled"),
        ),
        startedAt: v.number(),
        trigger: v.union(v.literal("manual"), v.literal("scheduled"), v.literal("webhook")),
      }),
    ),
    activeUsersLast24h: v.number(),
    storageUsed: v.object({
      documents: v.number(),
      cache: v.number(),
      total: v.number(),
    }),
  }),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const now = args.refTime ?? Date.now();
    const twentyFourHoursAgo = now - 24 * 60 * 60 * 1000;

    const [
      totalDocuments,
      totalFeedback,
      totalUsers,
      totalCrawlJobs,
      totalCacheEntries,
      indexedDocuments,
      pendingDocuments,
      failedDocuments,
      activeUsersLast24h,
      recentFeedback,
      recentCrawls,
    ] = await Promise.all([
      fastCount(ctx.db, "documents"),
      fastCount(ctx.db, "feedback"),
      fastCount(ctx.db, "users"),
      fastCount(ctx.db, "crawlJobs"),
      fastCount(ctx.db, "semanticCache"),
      fastFilteredCount(() =>
        ctx.db.query("documents").withIndex("by_status", (q) => q.eq("status", "indexed")),
      ),
      fastFilteredCount(() =>
        ctx.db.query("documents").withIndex("by_status", (q) => q.eq("status", "pending")),
      ),
      fastFilteredCount(() =>
        ctx.db.query("documents").withIndex("by_status", (q) => q.eq("status", "failed")),
      ),
      fastFilteredCount(() =>
        ctx.db
          .query("users")
          .withIndex("by_lastLoginAt", (q) => q.gte("lastLoginAt", twentyFourHoursAgo)),
      ),
      ctx.db.query("feedback").order("desc").take(10),
      ctx.db.query("crawlJobs").order("desc").take(5),
    ]);

    // Estimate storage (rough calculation based on content length without loading all rows)
    const avgDocSize = 250; // estimate average url + title length
    const docStorage = totalDocuments * avgDocSize;
    const avgCacheSize = 1000; // estimate average query + response size
    const cacheStorage = totalCacheEntries * avgCacheSize;

    return {
      totalDocuments,
      totalFeedback,
      totalUsers,
      totalCrawlJobs,
      totalCacheEntries,
      indexedDocuments,
      pendingDocuments,
      failedDocuments,
      recentFeedback: recentFeedback.map((f: Doc<"feedback">) => ({
        _id: f._id,
        rating: f.rating,
        createdAt: f.createdAt,
        category: f.category,
      })),
      recentCrawls: recentCrawls.map((c: Doc<"crawlJobs">) => ({
        _id: c._id,
        status: c.status,
        startedAt: c.startedAt,
        trigger: c.trigger,
      })),
      activeUsersLast24h,
      storageUsed: {
        documents: docStorage,
        cache: cacheStorage,
        total: docStorage + cacheStorage,
      },
    };
  },
});

/**
 * Delete a document from the system.
 */
export const deleteDocument = mutation({
  args: { documentId: v.id("documents") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await requireAdmin(ctx);

    const document = await ctx.db.get(args.documentId);
    if (!document) throw new ConvexError("Document not found");

    const chunks = await ctx.db
      .query("crawledChunks")
      .withIndex("by_documentId", (q) => q.eq("documentId", args.documentId))
      .collect();

    for (const chunk of chunks) {
      await ctx.db.delete(chunk._id);
    }

    await ctx.db.delete(args.documentId);

    await ctx.db.insert("adminAuditLog", {
      userId: user._id,
      action: "document.delete",
      target: document.url,
      details: {
        oldValue: document.title,
        reason: "Admin deletion",
      },
      createdAt: Date.now(),
    });
  },
});

/**
 * Delete a feedback entry.
 */
export const deleteFeedback = mutation({
  args: { feedbackId: v.id("feedback") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    await ctx.db.delete(args.feedbackId);
  },
});
