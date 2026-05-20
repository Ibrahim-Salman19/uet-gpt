import { v } from "convex/values";
import { mutation } from "../_generated/server";

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
  handler: async (ctx, args) => {
    return await ctx.db.insert("crawlJobs", {
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
  },
});
