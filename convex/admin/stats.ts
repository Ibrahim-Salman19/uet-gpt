import { ConvexError, v } from "convex/values";
import { internal } from "../_generated/api";
import type { Doc } from "../_generated/dataModel";
import { internalMutation, type MutationCtx, mutation, query } from "../_generated/server";
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
 * Document stats - reads from precomputed dashboardStats table.
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
 * User stats - reads from precomputed dashboardStats table.
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
 * Feedback stats - uses ONE .take() for recent 10 feedback items.
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
 * Feedback count - reads from precomputed dashboardStats table.
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
 * Crawl stats - uses ONE .take() for recent 5.
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
 * Crawl count - reads from precomputed dashboardStats table.
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
 * Cache stats - reads from precomputed dashboardStats.
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
 * Consolidated dashboard overview data - fetches all metrics in a single request.
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

const DASHBOARD_STATS_PAGE_SIZE = 1000;
// Must exceed the 1-hour cron interval (crons.ts: "compute-dashboard-stats")
// comfortably, mirroring workflow.ts's failStuckJobs 3h-timeout-vs-2h-cron
// pattern, so a genuinely stuck build self-heals rather than blocking every
// future rebuild forever.
const STUCK_BUILD_TIMEOUT_MS = 2 * 60 * 60 * 1000;

const DASHBOARD_STATS_PHASES = [
  "documents",
  "users",
  "feedback",
  "crawlJobs",
  "semanticCache",
] as const;
type DashboardStatsPhase = (typeof DASHBOARD_STATS_PHASES)[number];

type DashboardStatsAccumulator = {
  docTotal: number;
  docIndexed: number;
  docPending: number;
  docFailed: number;
  userTotal: number;
  userActive: number;
  feedbackTotal: number;
  crawlTotal: number;
  cacheTotal: number;
};

const ZERO_ACCUMULATOR: DashboardStatsAccumulator = {
  docTotal: 0,
  docIndexed: 0,
  docPending: 0,
  docFailed: 0,
  userTotal: 0,
  userActive: 0,
  feedbackTotal: 0,
  crawlTotal: 0,
  cacheTotal: 0,
};

const accumulatorValidator = v.object({
  docTotal: v.number(),
  docIndexed: v.number(),
  docPending: v.number(),
  docFailed: v.number(),
  userTotal: v.number(),
  userActive: v.number(),
  feedbackTotal: v.number(),
  crawlTotal: v.number(),
  cacheTotal: v.number(),
});

/**
 * Background mutation run by cron to (re)start a dashboard-stats rebuild.
 *
 * Phase 6.21A Part 9: previously ran FIVE separate multi-page `.paginate()`
 * loops - one per source table - inside a single internalMutation, violating
 * this file's own "one paginated query per function" rule five times over
 * and risking the mutation's total transaction budget as any of those tables
 * grows. Now mirrors the cursor + ctx.scheduler.runAfter continuation
 * pattern already established by crawl/staleness.ts's flagExpiredDocuments:
 * this entry point only starts the build (idempotent, coalesced - see the
 * buildInProgress guard below); computeDashboardStatsStep does the actual
 * one-page-per-invocation work and performs the final atomic promotion.
 */
export const computeDashboardStats = internalMutation({
  args: {},
  handler: async (ctx) => {
    const existing = await ctx.db
      .query("dashboardStats")
      .withIndex("by_statsId", (q) => q.eq("statsId", "global"))
      .unique();

    const now = Date.now();
    if (
      existing?.buildInProgress === true &&
      existing.buildStartedAt !== undefined &&
      now - existing.buildStartedAt < STUCK_BUILD_TIMEOUT_MS
    ) {
      // Coalesce: a build is already in flight and not yet stuck - skip this
      // cron tick rather than starting an overlapping second rebuild.
      console.log("computeDashboardStats: build already in progress, skipping this tick.");
      return;
    }

    // Cache recount cadence (~4x/day, UTC hours 0/6/12/18) is decided ONCE
    // for the whole build, not re-evaluated when the semanticCache phase is
    // reached, so it reflects a single consistent "now" for this build.
    const skipCacheRecount = existing !== null && new Date(now).getUTCHours() % 6 !== 0;

    if (existing) {
      await ctx.db.patch(existing._id, { buildInProgress: true, buildStartedAt: now });
    } else {
      // First-ever run: insert a placeholder singleton with zeroed public
      // fields so documentStats/etc. readers have a row while the first
      // build runs; the final step below overwrites these with real values.
      await ctx.db.insert("dashboardStats", {
        statsId: "global",
        documentStats: { total: 0, indexed: 0, pending: 0, failed: 0 },
        userStats: { total: 0, activeLast24h: 0 },
        feedbackCount: 0,
        crawlCount: 0,
        cacheStats: { total: 0 },
        lastUpdatedAt: now,
        buildInProgress: true,
        buildStartedAt: now,
      });
    }

    await ctx.scheduler.runAfter(0, internal.admin.stats.computeDashboardStatsStep, {
      phase: "documents",
      cursor: null,
      now,
      skipCacheRecount,
      accumulated: ZERO_ACCUMULATOR,
    });
  },
});

export const computeDashboardStatsStep = internalMutation({
  args: {
    phase: v.union(
      v.literal("documents"),
      v.literal("users"),
      v.literal("feedback"),
      v.literal("crawlJobs"),
      v.literal("semanticCache"),
    ),
    cursor: v.union(v.string(), v.null()),
    now: v.number(),
    skipCacheRecount: v.boolean(),
    accumulated: accumulatorValidator,
  },
  handler: async (ctx, args) => {
    const acc: DashboardStatsAccumulator = { ...args.accumulated };

    // semanticCache re-count is skipped on most hourly ticks (see the
    // cadence comment above) - carry the last known total through unchanged
    // rather than reading the table at all.
    if (args.phase === "semanticCache" && args.skipCacheRecount) {
      const existing = await ctx.db
        .query("dashboardStats")
        .withIndex("by_statsId", (q) => q.eq("statsId", "global"))
        .unique();
      acc.cacheTotal = existing?.cacheStats?.total ?? 0;
      await finalizeDashboardStatsBuild(ctx, acc, args.now);
      return;
    }

    const page = await ctx.db
      .query(args.phase)
      .paginate({ numItems: DASHBOARD_STATS_PAGE_SIZE, cursor: args.cursor });

    if (args.phase === "documents") {
      for (const doc of page.page as Doc<"documents">[]) {
        acc.docTotal++;
        if (doc.status === "indexed") acc.docIndexed++;
        else if (doc.status === "pending") acc.docPending++;
        else if (doc.status === "failed") acc.docFailed++;
      }
    } else if (args.phase === "users") {
      const userCutoff = args.now - 24 * 60 * 60 * 1000;
      for (const u of page.page as Doc<"users">[]) {
        acc.userTotal++;
        if (u.lastLoginAt && u.lastLoginAt >= userCutoff) acc.userActive++;
      }
    } else if (args.phase === "feedback") {
      acc.feedbackTotal += page.page.length;
    } else if (args.phase === "crawlJobs") {
      acc.crawlTotal += page.page.length;
    } else {
      acc.cacheTotal += page.page.length;
    }

    if (!page.isDone) {
      await ctx.scheduler.runAfter(0, internal.admin.stats.computeDashboardStatsStep, {
        phase: args.phase,
        cursor: page.continueCursor,
        now: args.now,
        skipCacheRecount: args.skipCacheRecount,
        accumulated: acc,
      });
      return;
    }

    const nextPhase: DashboardStatsPhase | undefined =
      DASHBOARD_STATS_PHASES[DASHBOARD_STATS_PHASES.indexOf(args.phase) + 1];
    if (nextPhase) {
      await ctx.scheduler.runAfter(0, internal.admin.stats.computeDashboardStatsStep, {
        phase: nextPhase,
        cursor: null,
        now: args.now,
        skipCacheRecount: args.skipCacheRecount,
        accumulated: acc,
      });
      return;
    }

    await finalizeDashboardStatsBuild(ctx, acc, args.now);
  },
});

/**
 * Final promotion step: the ONLY place the public-facing documentStats/
 * userStats/feedbackCount/crawlCount/cacheStats fields are written. A
 * partial or crashed build therefore never overwrites the last good
 * snapshot - readers keep seeing the previous complete build's numbers
 * until this runs. Also clears buildInProgress so the next cron tick (or a
 * stuck-build timeout) can start a fresh rebuild.
 */
async function finalizeDashboardStatsBuild(
  ctx: MutationCtx,
  acc: DashboardStatsAccumulator,
  now: number,
): Promise<void> {
  const existing = await ctx.db
    .query("dashboardStats")
    .withIndex("by_statsId", (q) => q.eq("statsId", "global"))
    .unique();

  const statsData = {
    statsId: "global",
    documentStats: {
      total: acc.docTotal,
      indexed: acc.docIndexed,
      pending: acc.docPending,
      failed: acc.docFailed,
    },
    userStats: {
      total: acc.userTotal,
      activeLast24h: acc.userActive,
    },
    feedbackCount: acc.feedbackTotal,
    crawlCount: acc.crawlTotal,
    cacheStats: {
      total: acc.cacheTotal,
    },
    lastUpdatedAt: now,
    buildInProgress: false,
  };

  if (existing) {
    await ctx.db.patch(existing._id, statsData);
  } else {
    await ctx.db.insert("dashboardStats", statsData);
  }
}

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

    if (document.entryId) {
      await ctx.scheduler.runAfter(0, internal.doc.remove.ragCleanupAction, {
        entryId: document.entryId,
      });
    }

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
