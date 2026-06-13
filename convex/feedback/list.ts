import { ConvexError, v } from "convex/values";
import type { Doc } from "../_generated/dataModel";
import { query } from "../_generated/server";

export const list = query({
  args: {
    limit: v.optional(v.number()),
    cursor: v.optional(v.string()),
  },
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
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError("Authentication required");
    }
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .unique();
    if (!user) throw new ConvexError("User not found");

    const limit = args.limit ?? 50;
    const cursor = args.cursor;

    if (user.role === "admin" || user.role === "superadmin") {
      const page = await ctx.db.query("feedback").order("desc").paginate({ numItems: limit, cursor: cursor ?? null });
      return page.page as Doc<"feedback">[];
    }

    const page = await ctx.db
      .query("feedback")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .order("desc")
      .paginate({ numItems: limit, cursor: cursor ?? null });
    return page.page as Doc<"feedback">[];
  },
});
