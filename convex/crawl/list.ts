import { v } from "convex/values";
import type { Doc } from "../_generated/dataModel";
import { query } from "../_generated/server";
import { requireAdmin } from "../auth";

export const list = query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("crawlJobs"),
      _creationTime: v.number(),
      trigger: v.union(v.literal("manual"), v.literal("scheduled"), v.literal("webhook")),
      startedBy: v.optional(v.id("users")),
      status: v.union(
        v.literal("pending"),
        v.literal("running"),
        v.literal("completed"),
        v.literal("failed"),
        v.literal("cancelled"),
      ),
      config: v.object({
        maxPages: v.number(),
        maxDepth: v.number(),
        includePaths: v.array(v.string()),
        excludePaths: v.array(v.string()),
        allowExternalLinks: v.boolean(),
      }),
      stats: v.object({
        totalPages: v.number(),
        successfulPages: v.number(),
        failedPages: v.number(),
        skippedPages: v.number(),
        totalChunks: v.number(),
        totalTokens: v.number(),
        bytesProcessed: v.number(),
      }),
      error: v.optional(v.string()),
      startedAt: v.number(),
      completedAt: v.optional(v.number()),
      duration: v.optional(v.number()),
    }),
  ),
  handler: async (ctx) => {
    await requireAdmin(ctx);
    return (await ctx.db.query("crawlJobs").order("desc").take(20)) as Doc<"crawlJobs">[];
  },
});
