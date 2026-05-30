import { ConvexError, v } from "convex/values";
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Convex GenericDocument return doesn't match validator type
    return (await ctx.db.query("feedback").order("desc").take(50)) as any;
  },
});
