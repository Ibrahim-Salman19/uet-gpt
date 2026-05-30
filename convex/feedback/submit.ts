import { ConvexError, v } from "convex/values";
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Convex GenericDocument _id type doesn't match branded Id<"feedback">
      return existingByUser._id as any;
    }
    return (await ctx.db.insert("feedback", {
      messageId: args.messageId,
      userId: user._id,
      rating: args.rating,
      ...(args.comment && { comment: args.comment }),
      ...(args.category && { category: args.category }),
      createdAt: Date.now(),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Convex insert doesn't accept optional spreads in its generic type
    } as any)) as any;
  },
});
