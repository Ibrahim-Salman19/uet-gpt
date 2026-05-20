import { v } from "convex/values";
import { query } from "../_generated/server";

export const list = query({
  args: {
    limit: v.optional(v.number()),
    cursor: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 50;
    const docs = await ctx.db.query("documents").take(limit);
    return { documents: docs, cursor: null };
  },
});
