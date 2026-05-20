import { v } from "convex/values";
import { query } from "../_generated/server";

export const status = query({
  args: { jobId: v.id("crawlJobs") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.jobId);
  },
});
