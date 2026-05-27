import { mutation } from "../_generated/server";

export const resetDLQ = mutation(async (ctx) => {
  const abandoned = await ctx.db
    .query("crawlDeadLetter")
    .withIndex("by_status", (q) => q.eq("status", "abandoned"))
    .collect();

  for (const doc of abandoned) {
    await ctx.db.patch(doc._id, { status: "pending_retry", failureCount: 0 });
  }

  return abandoned.length;
});
