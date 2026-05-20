import { v } from "convex/values";
import { mutation } from "../_generated/server";

export const create = mutation({
  args: {
    url: v.string(),
    title: v.optional(v.string()),
    content: v.optional(v.string()),
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("documents", {
      url: args.url,
      title: args.title ?? args.url,
      content: args.content ?? "",
      metadata: args.metadata ?? {},
    });
  },
});
