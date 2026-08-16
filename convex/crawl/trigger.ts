import { ConvexError, v } from "convex/values";
import { internal } from "../_generated/api";
import { mutation } from "../_generated/server";
import { requireAdmin } from "../auth";
import { assertBulkOperationsEnabled } from "./bulkOperationsControl";
import { crawlPool } from "./workpools";

function buildCrawlJobInsertPayload(args: {
  startedBy: string;
  maxPages?: number;
  maxDepth?: number;
  includePaths?: string[];
  excludePaths?: string[];
  allowExternalLinks?: boolean;
}) {
  return {
    // Provenance is server-derived, not client-supplied: this client-facing
    // mutation always records a manual trigger attributed to the authenticated admin.
    trigger: "manual",
    startedBy: args.startedBy,
    status: "pending",
    config: {
      maxPages: args.maxPages ?? 10,
      maxDepth: args.maxDepth ?? 2,
      includePaths: args.includePaths ?? [],
      excludePaths: args.excludePaths ?? [],
      allowExternalLinks: args.allowExternalLinks ?? false,
    },
    stats: {
      totalPages: 0,
      successfulPages: 0,
      failedPages: 0,
      skippedPages: 0,
      totalChunks: 0,
      totalTokens: 0,
      bytesProcessed: 0,
    },
    startedAt: Date.now(),
  };
}

export const trigger = mutation({
  args: {
    url: v.string(),
    maxPages: v.optional(v.number()),
    maxDepth: v.optional(v.number()),
    includePaths: v.optional(v.array(v.string())),
    excludePaths: v.optional(v.array(v.string())),
    allowExternalLinks: v.optional(v.boolean()),
  },
  returns: v.id("crawlJobs"),
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    await assertBulkOperationsEnabled(ctx);

    // August 2026 incident remediation: this previously only checked
    // "pending" - executeCrawlJob flips a job to "running" almost
    // immediately, so repeated trigger() calls (double-clicking "NEW CRAWL",
    // or a script calling it more than once) were not actually blocked by a
    // crawl already in flight. Checking both statuses closes that gap.
    const existingPending = await ctx.db
      .query("crawlJobs")
      .withIndex("by_status", (q) => q.eq("status", "pending"))
      .first();
    const existingRunning = await ctx.db
      .query("crawlJobs")
      .withIndex("by_status", (q) => q.eq("status", "running"))
      .first();
    if (existingPending !== null || existingRunning !== null) {
      throw new ConvexError("A crawl job is already pending or running");
    }
    const jobId = await ctx.db.insert(
      "crawlJobs",
      buildCrawlJobInsertPayload({ ...args, startedBy: admin._id }) as any,
    );

    await crawlPool.enqueueAction(ctx, internal.crawl.actions.executeCrawlJob, { jobId });

    return jobId;
  },
});
