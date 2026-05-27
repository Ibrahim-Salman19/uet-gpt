import { ConvexError, v } from "convex/values";
import { mutation, query } from "../_generated/server";

/**
 * Admin dashboard overview stats.
 * Returns aggregate counts and recent activity across all data types.
 * Note: messages/threads tables are managed by @convex-dev/agent component,
 * so we use the component's API functions instead of querying them directly.
 */
export const dashboardStats = query({
  args: {},
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
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError("Authentication required");

    const user = await ctx.db
      .query("users")
      .withIndex(
        "by_clerkId",
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Convex query builder generic type limitation
        (q: any) => q.eq("clerkId", identity.subject),
      )
      .unique();
    if (!user || (user.role !== "admin" && user.role !== "superadmin")) {
      throw new ConvexError("Admin access required");
    }

    const now = Date.now();
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
      (ctx.db.query("documents") as any).count(),
      (ctx.db.query("feedback") as any).count(),
      (ctx.db.query("users") as any).count(),
      (ctx.db.query("crawlJobs") as any).count(),
      (ctx.db.query("semanticCache") as any).count(),
      (
        ctx.db
          .query("documents")
          .withIndex("by_status", (q: any) => q.eq("status", "indexed")) as any
      ).count(),
      (
        ctx.db
          .query("documents")
          .withIndex("by_status", (q: any) => q.eq("status", "pending")) as any
      ).count(),
      (
        ctx.db
          .query("documents")
          .withIndex("by_status", (q: any) => q.eq("status", "failed")) as any
      ).count(),
      ctx.db
        .query("users")
        .withIndex("by_lastLoginAt", (q: any) => q.gte("lastLoginAt", twentyFourHoursAgo))
        .collect()
        .then((items: any[]) => items.length),
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
      recentFeedback: recentFeedback.map((f: any) => ({
        _id: f._id,
        rating: f.rating,
        createdAt: f.createdAt,
        category: f.category,
      })),
      recentCrawls: recentCrawls.map((c: any) => ({
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
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError("Authentication required");

    const user = await ctx.db
      .query("users")
      .withIndex(
        "by_clerkId",
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Convex query builder generic type limitation
        (q: any) => q.eq("clerkId", identity.subject),
      )
      .unique();
    if (!user || (user.role !== "admin" && user.role !== "superadmin")) {
      throw new ConvexError("Admin access required");
    }

    const document = await ctx.db.get(args.documentId);
    if (!document) throw new ConvexError("Document not found");

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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Convex GenericDocument insert doesn't accept nested optional details object
    } as any);
  },
});

/**
 * Delete a feedback entry.
 */
export const deleteFeedback = mutation({
  args: { feedbackId: v.id("feedback") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError("Authentication required");

    const user = await ctx.db
      .query("users")
      .withIndex(
        "by_clerkId",
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Convex query builder generic type limitation
        (q: any) => q.eq("clerkId", identity.subject),
      )
      .unique();
    if (!user || (user.role !== "admin" && user.role !== "superadmin")) {
      throw new ConvexError("Admin access required");
    }

    await ctx.db.delete(args.feedbackId);
  },
});
