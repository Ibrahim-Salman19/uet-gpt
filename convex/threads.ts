import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const create = mutation({
  args: {
    userId: v.id("users"),
    title: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("threads", {
      userId: args.userId,
      title: args.title,
      isArchived: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  },
});

export const list = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const list = await ctx.db
      .query("threads")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .collect();

    return list.filter((t) => !t.isArchived);
  },
});

export const rename = mutation({
  args: {
    id: v.id("threads"),
    title: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      title: args.title,
      updatedAt: Date.now(),
    });
  },
});

export const remove = mutation({
  args: { id: v.id("threads") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      isArchived: true,
      updatedAt: Date.now(),
    });
  },
});
