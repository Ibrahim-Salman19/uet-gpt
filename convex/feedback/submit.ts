import { ConvexError, v } from "convex/values";
import type { Id } from "../_generated/dataModel";
import { mutation } from "../_generated/server";

export const submit = mutation({
  args: {
    messageId: v.string(),
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
  returns: v.id("feedback"),
  handler: async (ctx, args) => {
    if (args.comment && args.comment.length > 2000) {
      throw new ConvexError("Feedback comment must be under 2000 characters");
    }
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError("Authentication required");
    }
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .unique();
    if (!user) {
      throw new ConvexError("User not found");
    }
    const existing = await ctx.db
      .query("feedback")
      .withIndex("by_messageId", (q) => q.eq("messageId", args.messageId))
      .collect();
    const existingByUser = existing.find((f) => f.userId === user._id);
    if (existingByUser) {
      return existingByUser._id;
    }
    return (await ctx.db.insert("feedback", {
      messageId: args.messageId,
      userId: user._id,
      rating: args.rating,
      comment: args.comment,
      category: args.category,
      createdAt: Date.now(),
    })) as Id<"feedback">;
  },
});
