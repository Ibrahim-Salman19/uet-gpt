import { ConvexError, v } from "convex/values";
import type { Doc } from "../_generated/dataModel";
import { query } from "../_generated/server";

export const list = query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("feedback"),
      _creationTime: v.number(),
      messageId: v.string(),
      userId: v.id("users"),
      rating: v.union(v.literal("thumbsUp"), v.literal("thumbsDown")),
      comment: v.optional(v.string()),
      category: v.optional(v.string()),
      createdAt: v.number(),
    }),
  ),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError("Authentication required");
    }
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .unique();
    if (!user) throw new ConvexError("User not found");

    if (user.role === "admin" || user.role === "superadmin") {
      return (await ctx.db.query("feedback").order("desc").take(50)) as Doc<"feedback">[];
    }

    return (await ctx.db
      .query("feedback")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .order("desc")
      .take(50)) as Doc<"feedback">[];
  },
});
