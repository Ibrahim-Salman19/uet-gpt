import { ConvexError, v } from "convex/values";
import { internal } from "../_generated/api";
import { mutation } from "../_generated/server";
import { requireAdmin } from "../auth";
import { crawlPool } from "./workpools";

export const trigger = mutation({
  args: {
    url: v.string(),
    maxPages: v.optional(v.number()),
    maxDepth: v.optional(v.number()),
    includePaths: v.optional(v.array(v.string())),
    excludePaths: v.optional(v.array(v.string())),
    allowExternalLinks: v.optional(v.boolean()),
    startedBy: v.optional(v.id("users")),
    trigger: v.optional(v.union(v.literal("manual"), v.literal("scheduled"), v.literal("webhook"))),
  },
  returns: v.id("crawlJobs"),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const existing = await ctx.db
      .query("crawlJobs")
      .withIndex("by_status", (q) => q.eq("status", "pending"))
      .first();
    if (existing !== null) {
      throw new ConvexError("A crawl job is already pending");
    }
    const jobId = await ctx.db.insert("crawlJobs", {
      trigger: args.trigger ?? "manual",
      ...(args.startedBy && { startedBy: args.startedBy }),
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
    });

    await crawlPool.enqueueAction(ctx, internal.crawl.actions.executeCrawlJob, { jobId });

    return jobId;
  },
});
