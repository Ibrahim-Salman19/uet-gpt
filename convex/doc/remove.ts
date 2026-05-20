import { v } from "convex/values";
import { mutation } from "../_generated/server";

export const remove = mutation({
  args: { documentId: v.id("documents") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.documentId);
  },
});
