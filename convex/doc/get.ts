import { v } from "convex/values";
import { query } from "../_generated/server";

export const get = query({
  args: { documentId: v.id("documents") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.documentId);
  },
});
