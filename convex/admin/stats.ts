import { ConvexError, v } from "convex/values";
import type { Doc } from "../_generated/dataModel";
import { internalMutation, mutation, query } from "../_generated/server";
import { requireAdmin } from "../auth";

// ────────────────────────────────────────────────────────────────────────────
// Convex v1.40+ rule: ONE paginated query (.paginate/.collect/.take) per function.
// Each query below uses exactly ONE paginated call.
// Client calls all 5 in parallel via useQuery().
// ────────────────────────────────────────────────────────────────────────────

const feedbackValidator = v.object({
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
});

const crawlValidator = v.object({
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
});

/**
 * Document stats — reads from precomputed dashboardStats table.
 */
export const documentStats = query({
  args: {},
  returns: v.object({
    total: v.number(),
    indexed: v.number(),
    pending: v.number(),
    failed: v.number(),
  }),
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const stats = await ctx.db
      .query("dashboardStats")
      .withIndex("by_statsId", (q) => q.eq("statsId", "global"))
      .unique();
    return stats?.documentStats ?? { total: 0, indexed: 0, pending: 0, failed: 0 };
  },
});

/**
 * User stats — reads from precomputed dashboardStats table.
 */
export const userStats = query({
  args: { refTime: v.optional(v.number()) },
  returns: v.object({
    total: v.number(),
    activeLast24h: v.number(),
  }),
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const stats = await ctx.db
      .query("dashboardStats")
      .withIndex("by_statsId", (q) => q.eq("statsId", "global"))
      .unique();
    return stats?.userStats ?? { total: 0, activeLast24h: 0 };
  },
});

/**
 * Feedback stats — uses ONE .take() for recent 10 feedback items.
 */
export const feedbackStats = query({
  args: {},
  returns: v.object({
    total: v.number(),
    recent: v.array(feedbackValidator),
  }),
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const recent = await ctx.db.query("feedback").order("desc").take(10);
    const stats = await ctx.db
      .query("dashboardStats")
      .withIndex("by_statsId", (q) => q.eq("statsId", "global"))
      .unique();
    return {
      // Use the precomputed count rather than the page size (recent.length capped at 10).
      total: stats?.feedbackCount ?? 0,
      recent: recent.map((f: Doc<"feedback">) => ({
        _id: f._id,
        rating: f.rating,
        createdAt: f.createdAt,
        category: f.category,
      })),
    };
  },
});

/**
 * Feedback count — reads from precomputed dashboardStats table.
 */
export const feedbackCount = query({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const stats = await ctx.db
      .query("dashboardStats")
      .withIndex("by_statsId", (q) => q.eq("statsId", "global"))
      .unique();
    return stats?.feedbackCount ?? 0;
  },
});

/**
 * Crawl stats — uses ONE .take() for recent 5.
 */
export const crawlStats = query({
  args: {},
  returns: v.object({
    total: v.number(),
    recent: v.array(crawlValidator),
  }),
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const recent = await ctx.db.query("crawlJobs").order("desc").take(5);
    const stats = await ctx.db
      .query("dashboardStats")
      .withIndex("by_statsId", (q) => q.eq("statsId", "global"))
      .unique();

    return {
      // Use the precomputed count rather than the page size (recent.length capped at 5).
      total: stats?.crawlCount ?? 0,
      recent: recent.map((c: Doc<"crawlJobs">) => ({
        _id: c._id,
        status: c.status,
        startedAt: c.startedAt,
        trigger: c.trigger,
      })),
    };
  },
});

/**
 * Crawl count — reads from precomputed dashboardStats table.
 */
export const crawlCount = query({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const stats = await ctx.db
      .query("dashboardStats")
      .withIndex("by_statsId", (q) => q.eq("statsId", "global"))
      .unique();
    return stats?.crawlCount ?? 0;
  },
});

/**
 * Cache stats — reads from precomputed dashboardStats.
 */
export const cacheStats = query({
  args: {},
  returns: v.object({ total: v.number() }),
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const stats = await ctx.db
      .query("dashboardStats")
      .withIndex("by_statsId", (q) => q.eq("statsId", "global"))
      .unique();
    return stats?.cacheStats ?? { total: 0 };
  },
});

/**
 * Consolidated dashboard overview data — fetches all metrics in a single request.
 */
export const getOverviewData = query({
  args: {},
  returns: v.object({
    documentStats: v.object({
      total: v.number(),
      indexed: v.number(),
      pending: v.number(),
      failed: v.number(),
    }),
    userStats: v.object({
      total: v.number(),
      activeLast24h: v.number(),
    }),
    feedbackCount: v.number(),
    crawlCount: v.number(),
    cacheStats: v.object({
      total: v.number(),
    }),
    recentCrawls: v.array(crawlValidator),
    recentFeedback: v.array(feedbackValidator),
  }),
  handler: async (ctx) => {
    await requireAdmin(ctx);

    const stats = await ctx.db
      .query("dashboardStats")
      .withIndex("by_statsId", (q) => q.eq("statsId", "global"))
      .unique();

    const recentCrawls = await ctx.db.query("crawlJobs").order("desc").take(5);
    const recentFeedback = await ctx.db.query("feedback").order("desc").take(10);

    return {
      documentStats: stats?.documentStats ?? { total: 0, indexed: 0, pending: 0, failed: 0 },
      userStats: stats?.userStats ?? { total: 0, activeLast24h: 0 },
      feedbackCount: stats?.feedbackCount ?? 0,
      crawlCount: stats?.crawlCount ?? 0,
      cacheStats: stats?.cacheStats ?? { total: 0 },
      recentCrawls: recentCrawls.map((c: Doc<"crawlJobs">) => ({
        _id: c._id,
        status: c.status,
        startedAt: c.startedAt,
        trigger: c.trigger,
      })),
      recentFeedback: recentFeedback.map((f: Doc<"feedback">) => ({
        _id: f._id,
        rating: f.rating,
        createdAt: f.createdAt,
        category: f.category,
      })),
    };
  },
});

/**
 * Background mutation run by cron to compute and store dashboard statistics.
 */
export const computeDashboardStats = internalMutation({
  args: {},
  handler: async (ctx) => {
    // 1. Compute documentStats
    let docTotal = 0;
    let docIndexed = 0;
    let docPending = 0;
    let docFailed = 0;
    let docCursor: string | null = null;
    while (true) {
      const page = await ctx.db.query("documents").paginate({ numItems: 1000, cursor: docCursor });
      for (const doc of page.page) {
        docTotal++;
        if (doc.status === "indexed") docIndexed++;
        else if (doc.status === "pending") docPending++;
        else if (doc.status === "failed") docFailed++;
      }
      if (page.isDone) break;
      docCursor = page.continueCursor;
    }

    // 2. Compute userStats
    const now = Date.now();
    const userCutoff = now - 24 * 60 * 60 * 1000;
    let userTotal = 0;
    let userActive = 0;
    let userCursor: string | null = null;
    while (true) {
      const page = await ctx.db.query("users").paginate({ numItems: 1000, cursor: userCursor });
      for (const u of page.page) {
        userTotal++;
        if (u.lastLoginAt && u.lastLoginAt >= userCutoff) userActive++;
      }
      if (page.isDone) break;
      userCursor = page.continueCursor;
    }

    // 3. Compute feedbackCount
    let feedbackTotal = 0;
    let feedbackCursor: string | null = null;
    while (true) {
      const page = await ctx.db
        .query("feedback")
        .paginate({ numItems: 1000, cursor: feedbackCursor });
      feedbackTotal += page.page.length;
      if (page.isDone) break;
      feedbackCursor = page.continueCursor;
    }

    // 4. Compute crawlCount
    let crawlTotal = 0;
    let crawlCursor: string | null = null;
    while (true) {
      const page = await ctx.db
        .query("crawlJobs")
        .paginate({ numItems: 1000, cursor: crawlCursor });
      crawlTotal += page.page.length;
      if (page.isDone) break;
      crawlCursor = page.continueCursor;
    }

    // 5. Compute cacheStats
    let cacheTotal = 0;
    let cacheCursor: string | null = null;
    while (true) {
      const page = await ctx.db
        .query("semanticCache")
        .paginate({ numItems: 1000, cursor: cacheCursor });
      cacheTotal += page.page.length;
      if (page.isDone) break;
      cacheCursor = page.continueCursor;
    }

    const statsData = {
      statsId: "global",
      documentStats: {
        total: docTotal,
        indexed: docIndexed,
        pending: docPending,
        failed: docFailed,
      },
      userStats: {
        total: userTotal,
        activeLast24h: userActive,
      },
      feedbackCount: feedbackTotal,
      crawlCount: crawlTotal,
      cacheStats: {
        total: cacheTotal,
      },
      lastUpdatedAt: now,
    };

    const existing = await ctx.db
      .query("dashboardStats")
      .withIndex("by_statsId", (q) => q.eq("statsId", "global"))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, statsData);
    } else {
      await ctx.db.insert("dashboardStats", statsData);
    }
  },
});

// ────────────────────────────────────────────────────────────────────────────
// Mutations
// ────────────────────────────────────────────────────────────────────────────

export const deleteDocument = mutation({
  args: { documentId: v.id("documents") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await requireAdmin(ctx);

    const document = await ctx.db.get(args.documentId);
    if (!document) throw new ConvexError("Document not found");

    while (true) {
      const chunks = await ctx.db
        .query("crawledChunks")
        .withIndex("by_documentId", (q) => q.eq("documentId", args.documentId))
        .take(100);

      if (chunks.length === 0) {
        break;
      }

      await Promise.all(chunks.map((chunk) => ctx.db.delete(chunk._id)));
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

export const deleteFeedback = mutation({
  args: { feedbackId: v.id("feedback") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    await ctx.db.delete(args.feedbackId);
  },
});
