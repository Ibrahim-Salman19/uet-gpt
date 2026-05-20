import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const insert = mutation({
  args: {
    threadId: v.id("threads"),
    role: v.union(v.literal("user"), v.literal("assistant")),
    content: v.string(),
    sources: v.optional(
      v.array(
        v.object({
          documentId: v.id("documents"),
          chunkId: v.id("chunks"),
          url: v.string(),
          title: v.string(),
          relevanceScore: v.number(),
          excerpt: v.string(),
        }),
      ),
    ),
    tokenCount: v.optional(
      v.object({
        prompt: v.number(),
        completion: v.number(),
        total: v.number(),
      }),
    ),
  },
  handler: async (ctx, args) => {
    // 1. Insert message
    const messageId = await ctx.db.insert("messages", {
      threadId: args.threadId,
      role: args.role,
      content: args.content,
      ...(args.sources && { sources: args.sources }),
      ...(args.tokenCount && { tokenCount: args.tokenCount }),
      createdAt: Date.now(),
    });

    // 2. Update thread's updatedAt
    await ctx.db.patch(args.threadId, {
      updatedAt: Date.now(),
    });

    return messageId;
  },
});

export const list = query({
  args: { threadId: v.id("threads") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("messages")
      .withIndex("by_threadId", (q) => q.eq("threadId", args.threadId))
      .order("asc")
      .collect();
  },
});
