import { v } from "convex/values";
import { UET_CRAWL_CONFIG } from "../../src/lib/constants.js";
import { internal } from "../_generated/api";
import type { Doc } from "../_generated/dataModel";
import { internalMutation } from "../_generated/server";
import { crawlPool } from "./workpools";

const SEED_URLS = UET_CRAWL_CONFIG.seedUrls;

export const kickoffDailyCrawl = internalMutation({
  args: {},
  handler: async (ctx) => {
    // Idempotency: Prevent running if there's already a pending or running crawl
    const existingJob = await ctx.db
      .query("crawlJobs")
      .withIndex("by_status", (q) => q.eq("status", "pending"))
      .first();

    const runningJob = await ctx.db
      .query("crawlJobs")
      .withIndex("by_status", (q) => q.eq("status", "running"))
      .first();

    if (existingJob !== null || runningJob !== null) {
      console.warn("A crawl job is already active. Skipping daily kick-off.");
      return null;
    }

    // Enforce daily cadence: skip if completed crawl exists from < 23 hours ago
    const lastCompletedJob = await ctx.db
      .query("crawlJobs")
      .withIndex("by_status", (q) => q.eq("status", "completed"))
      .order("desc")
      .first();
    if (lastCompletedJob && Date.now() - lastCompletedJob.startedAt < 23 * 60 * 60 * 1000) {
      console.warn("Last completed crawl was < 23 hours ago. Skipping daily kick-off.");
      return null;
    }

    // Insert the tracking record
    const jobId = await ctx.db.insert("crawlJobs", {
      trigger: "scheduled",
      status: "pending",
      config: {
        maxPages: UET_CRAWL_CONFIG.maxPages,
        maxDepth: UET_CRAWL_CONFIG.maxDepth,
        includePaths: [...UET_CRAWL_CONFIG.includePaths],
        excludePaths: [...UET_CRAWL_CONFIG.excludePaths],
        allowExternalLinks: UET_CRAWL_CONFIG.allowExternalLinks,
      },
      stats: {
        totalPages: SEED_URLS.length,
        successfulPages: 0,
        failedPages: 0,
        skippedPages: 0,
        totalChunks: 0,
        totalTokens: 0,
        bytesProcessed: 0,
      },
      startedAt: Date.now(),
    });

    // Enqueue the crawl job initiation action (defined in actions.ts) into the crawlPool workpool
    await crawlPool.enqueueAction(ctx, internal.crawl.actions.executeCrawlJob, { jobId });

    return jobId;
  },
});

function buildUpdatePayload(
  job: Doc<"crawlJobs">,
  args: { status?: string; providerJobId?: string; error?: string },
): Partial<Doc<"crawlJobs">> {
  const updatePayload: Partial<Doc<"crawlJobs">> = {};
  if (args.status && job.status !== args.status) updatePayload.status = args.status as any;
  if (args.providerJobId && job.providerJobId !== args.providerJobId)
    updatePayload.providerJobId = args.providerJobId;
  if (args.error && job.error !== args.error) updatePayload.error = args.error;
  return updatePayload;
}

function isTerminalStatus(status?: string): boolean {
  return status === "failed" || status === "completed" || status === "cancelled";
}

export const updateJobState = internalMutation({
  args: {
    jobId: v.id("crawlJobs"),
    status: v.optional(
      v.union(
        v.literal("pending"),
        v.literal("running"),
        v.literal("completed"),
        v.literal("failed"),
        v.literal("cancelled"),
      ),
    ),
    providerJobId: v.optional(v.string()),
    error: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.jobId);
    if (!job) return;

    const updatePayload = buildUpdatePayload(job, args);
    if (Object.keys(updatePayload).length === 0) return;

    if (isTerminalStatus(args.status)) {
      (updatePayload as any).completedAt = Date.now();
    }

    await ctx.db.patch(args.jobId, updatePayload as any);
  },
});

export const completeJobByTaskId = internalMutation({
  args: {
    taskId: v.string(),
    status: v.union(v.literal("completed"), v.literal("failed")),
    stats: v.optional(
      v.object({
        totalPages: v.number(),
        successfulPages: v.number(),
        failedPages: v.number(),
        skippedPages: v.number(),
        totalChunks: v.number(),
        totalTokens: v.number(),
        bytesProcessed: v.number(),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const job = await ctx.db
      .query("crawlJobs")
      .withIndex("by_providerJobId", (q) => q.eq("providerJobId", args.taskId))
      .first();

    if (job && job.status !== args.status) {
      const update: Partial<Doc<"crawlJobs">> = {
        status: args.status,
        completedAt: Date.now(),
      };
      if (args.stats) {
        update.stats = args.stats;
      }
      await ctx.db.patch(job._id, update);
    }
  },
});

export const failStuckJobs = internalMutation({
  args: {},
  handler: async (ctx) => {
    const runningJobs = await ctx.db
      .query("crawlJobs")
      .withIndex("by_status", (q) => q.eq("status", "running"))
      .take(100);

    const now = Date.now();
    const TIMEOUT_MS = 3 * 60 * 60 * 1000; // 3 hours (must exceed 2h cron interval to avoid race)
    const TIMEOUT_HOURS = TIMEOUT_MS / (60 * 60 * 1000);

    for (const job of runningJobs) {
      if (now - job.startedAt > TIMEOUT_MS) {
        await ctx.db.patch(job._id, {
          status: "failed",
          // Message derived from TIMEOUT_MS so it always matches the actual threshold.
          error: `Job timed out (no webhook response after ${TIMEOUT_HOURS} hours)`,
          completedAt: now,
        });
      }
    }
  },
});
