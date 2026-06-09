import { v } from "convex/values";
import { internalMutation } from "../_generated/server";

async function deleteAbandonedDLQ(ctx: any, batchSize: number, now: number, cutoff: number): Promise<number> {
  const abandonedDLQ = await ctx.db
    .query("crawlDeadLetter")
    .withIndex("by_status", (q: any) => q.eq("status", "abandoned"))
    .take(batchSize);

  let totalDeleted = 0;
  for (const entry of abandonedDLQ) {
    if (now - entry.lastAttemptAt > cutoff) {
      await ctx.db.delete(entry._id);
      totalDeleted++;
    }
  }
  return totalDeleted;
}

async function deleteOldJobsByStatus(ctx: any, batchSize: number, now: number, cutoff: number): Promise<number> {
  const jobStatuses = ["completed", "failed", "cancelled"] as const;
  let totalDeleted = 0;
  for (const status of jobStatuses) {
    const jobs = await ctx.db
      .query("crawlJobs")
      .withIndex("by_status", (q: any) => q.eq("status", status))
      .take(batchSize);

    for (const job of jobs) {
      const ageMs = job.completedAt ?? job._creationTime ?? 0;
      if (now - ageMs > cutoff) {
        await ctx.db.delete(job._id);
        totalDeleted++;
      }
    }

    if (totalDeleted >= batchSize) break;
  }
  return totalDeleted;
}

export const cleanupOldRecords = internalMutation({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit }) => {
    const batchSize = limit ?? 100;
    const now = Date.now();
    const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
    const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

    let totalDeleted = await deleteAbandonedDLQ(ctx, batchSize, now, SEVEN_DAYS_MS);

    if (totalDeleted < batchSize) {
      const remaining = batchSize - totalDeleted;
      totalDeleted += await deleteOldJobsByStatus(ctx, remaining, now, THIRTY_DAYS_MS);
    }

    return { deleted: totalDeleted, remaining: totalDeleted >= batchSize ? "more" : "done" };
  },
});
