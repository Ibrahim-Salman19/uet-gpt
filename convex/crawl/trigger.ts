import { ConvexError, v } from "convex/values";
import { internal } from "../_generated/api";
import { mutation } from "../_generated/server";
import { requireAdmin } from "../auth";
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
    const existing = await ctx.db
      .query("crawlJobs")
      .withIndex("by_status", (q) => q.eq("status", "pending"))
      .first();
    if (existing !== null) {
      throw new ConvexError("A crawl job is already pending");
    }
    const jobId = await ctx.db.insert(
      "crawlJobs",
      buildCrawlJobInsertPayload({ ...args, startedBy: admin._id }) as any,
    );

    await crawlPool.enqueueAction(ctx, internal.crawl.actions.executeCrawlJob, { jobId });

    return jobId;
  },
});
