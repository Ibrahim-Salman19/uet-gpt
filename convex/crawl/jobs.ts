import { v } from "convex/values";
import { internalMutation } from "../_generated/server";

export const cleanupOldRecords = internalMutation({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit }) => {
    const batchSize = limit ?? 100;
    const now = Date.now();
    const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
    const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
    let totalDeleted = 0;

    const abandonedDLQ = await ctx.db
      .query("crawlDeadLetter")
      .withIndex("by_status", (q) => q.eq("status", "abandoned"))
      .take(batchSize);

    for (const entry of abandonedDLQ) {
      if (now - entry.lastAttemptAt > SEVEN_DAYS_MS) {
        await ctx.db.delete(entry._id);
        totalDeleted++;
      }
    }

    if (totalDeleted < batchSize) {
      const remaining = batchSize - totalDeleted;
      const jobStatuses = ["completed", "failed", "cancelled"] as const;
      for (const status of jobStatuses) {
        const jobs = await ctx.db
          .query("crawlJobs")
          .withIndex("by_status", (q) => q.eq("status", status))
          .take(remaining);

        for (const job of jobs) {
          const ageMs = job.completedAt ?? job._creationTime ?? 0;
          if (now - ageMs > THIRTY_DAYS_MS) {
            await ctx.db.delete(job._id);
            totalDeleted++;
          }
        }

        if (totalDeleted >= batchSize) break;
      }
    }

    return { deleted: totalDeleted, remaining: totalDeleted >= batchSize ? "more" : "done" };
  },
});
