import { v } from "convex/values";
import { mutation } from "../_generated/server";

export const submit = mutation({
  args: {
    messageId: v.id("messages"),
    userId: v.id("users"),
    rating: v.union(v.literal("thumbsUp"), v.literal("thumbsDown")),
    comment: v.optional(v.string()),
    category: v.optional(
      v.union(
        v.literal("accurate"),
        v.literal("inaccurate"),
        v.literal("incomplete"),
        v.literal("irrelevant"),
        v.literal("other"),
      ),
    ),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("feedback", {
      messageId: args.messageId,
      userId: args.userId,
      rating: args.rating,
      ...(args.comment && { comment: args.comment }),
      ...(args.category && { category: args.category }),
      createdAt: Date.now(),
    });
  },
});
