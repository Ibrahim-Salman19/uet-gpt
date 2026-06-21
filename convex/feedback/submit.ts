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
    if (!user.isActive) {
      throw new ConvexError("User account is inactive");
    }
    const existingByUser = await ctx.db
      .query("feedback")
      .withIndex("by_messageId_and_userId", (q) =>
        q.eq("messageId", args.messageId).eq("userId", user._id),
      )
      .unique();
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
