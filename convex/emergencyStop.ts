import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalAction, internalMutation } from "./_generated/server";

export const stopBatch = internalMutation({
  args: {},
  returns: v.boolean(),
  handler: async (ctx) => {
    const docs = await ctx.db
      .query("documents")
      .withIndex("by_status", (q) => q.eq("status", "processing"))
      .take(500);
    for (const d of docs) {
      await ctx.db.patch(d._id, { status: "failed" });
    }

    const jobs = await ctx.db
      .query("crawlJobs")
      .withIndex("by_status", (q) => q.eq("status", "running"))
      .take(500);
    for (const j of jobs) {
      await ctx.db.patch(j._id, { status: "cancelled" });
    }

    return docs.length === 500 || jobs.length === 500;
  },
});

export const stopAll = internalAction({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    let hasMore = true;
    while (hasMore) {
      hasMore = await ctx.runMutation(internal.emergencyStop.stopBatch);
    }
    console.log("Emergency stop complete.");
  },
});

export default stopAll;
