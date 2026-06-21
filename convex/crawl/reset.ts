import { v } from "convex/values";
import { mutation } from "../_generated/server";
import { requireAdmin } from "../auth";

export const resetDLQ = mutation({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const abandoned = await ctx.db
      .query("crawlDeadLetter")
      .withIndex("by_status", (q) => q.eq("status", "abandoned"))
      .take(100);

    await Promise.all(
      abandoned.map((doc) => ctx.db.patch(doc._id, { status: "pending_retry", failureCount: 0 })),
    );

    return abandoned.length;
  },
});
