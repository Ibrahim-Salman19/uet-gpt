import { v } from "convex/values";
import { UET_CRAWL_CONFIG } from "../../src/lib/constants.js";
import { internal } from "../_generated/api";
import { internalMutation } from "../_generated/server";
import { crawlPool } from "./workpools";

const SEED_URLS = UET_CRAWL_CONFIG.seedUrls;

export const kickoffDailyCrawl = internalMutation({
  args: {},
  handler: async (ctx) => {
    // Idempotency: Prevent running if there's already a pending or running crawl
    const existingJobs = await ctx.db
      .query("crawlJobs")
      .withIndex("by_status", (q) => q.eq("status", "pending"))
      .collect();

    const runningJobs = await ctx.db
      .query("crawlJobs")
      .withIndex("by_status", (q) => q.eq("status", "running"))
      .collect();

    if (existingJobs.length > 0 || runningJobs.length > 0) {
      console.warn("A crawl job is already active. Skipping daily kick-off.");
      return null;
    }

    // Insert the tracking record
    const jobId = await ctx.db.insert("crawlJobs", {
      trigger: "scheduled",
      status: "pending",
      config: {
        maxPages: 500,
        maxDepth: 5,
        includePaths: ["https://web.uettaxila.edu.pk/**"],
        excludePaths: [
          "https://web.uettaxila.edu.pk/**/edit",
          "https://web.uettaxila.edu.pk/**/delete",
          "https://web.uettaxila.edu.pk/wp-admin/**",
        ],
        allowExternalLinks: false,
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

    const updatePayload: any = {};
    if (args.status && job.status !== args.status) updatePayload.status = args.status;
    if (args.providerJobId && job.providerJobId !== args.providerJobId)
      updatePayload.providerJobId = args.providerJobId;
    if (args.error && job.error !== args.error) updatePayload.error = args.error;

    if (Object.keys(updatePayload).length === 0) return; // Compare-before-write check passed: No changes needed

    if (args.status === "failed" || args.status === "completed" || args.status === "cancelled") {
      updatePayload.completedAt = Date.now();
    }

    await ctx.db.patch(args.jobId, updatePayload);
  },
});

export const completeJobByTaskId = internalMutation({
  args: {
    taskId: v.string(),
    status: v.union(v.literal("completed"), v.literal("failed")),
    stats: v.optional(
      v.object({
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
      const update: any = {
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
    const TIMEOUT_MS = 2 * 60 * 60 * 1000; // 2 hours

    for (const job of runningJobs) {
      if (now - job.startedAt > TIMEOUT_MS) {
        await ctx.db.patch(job._id, {
          status: "failed",
          error: "Job timed out (no webhook response after 2 hours)",
          completedAt: now,
        });
      }
    }
  },
});
