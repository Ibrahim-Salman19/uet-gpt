import { ConvexError, v } from "convex/values";
import { components } from "./_generated/api";
import { internalMutation, mutation, query } from "./_generated/server";
import { threadValidator } from "./threads/validator";

export const create = mutation({
  args: {
    title: v.string(),
  },
  returns: v.string(),
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

    const thread = await ctx.runMutation(components.agent.threads.createThread, {
      userId: identity.subject,
      title: args.title,
    });

    return thread._id as string;
  },
});

export const list = query({
  args: {},
  returns: v.array(threadValidator),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return [];
    }
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .unique();
    if (!user) return [];

    const result = await ctx.runQuery(components.agent.threads.listThreadsByUserId, {
      userId: identity.subject,
      paginationOpts: { numItems: 100, cursor: null },
    });

    // Transform component format → app format
    return result.page
      .filter((t: any) => t.status === "active")
      .map((t: any) => ({
        _id: t._id as string,
        _creationTime: t._creationTime,
        userId: t.userId ?? "",
        title: t.title ?? undefined,
        isArchived: false,
        createdAt: t._creationTime,
        updatedAt: t._creationTime,
      }));
  },
});

export const rename = mutation({
  args: {
    id: v.string(),
    title: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError("Authentication required");
    }

    // Verify thread exists via component query
    const thread = await ctx.runQuery(components.agent.threads.getThread, { threadId: args.id });
    if (!thread) {
      throw new ConvexError("Thread not found");
    }

    // Authorize: thread owner must match current user
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .unique();
    if (!user || thread.userId !== identity.subject) {
      throw new ConvexError("Not authorized");
    }

    await ctx.runMutation(components.agent.threads.updateThread, {
      threadId: args.id,
      patch: { title: args.title },
    });

    return null;
  },
});

export const remove = mutation({
  args: { id: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError("Authentication required");
    }

    // Verify thread exists via component query
    const thread = await ctx.runQuery(components.agent.threads.getThread, { threadId: args.id });
    if (!thread) {
      throw new ConvexError("Thread not found");
    }

    // Authorize: thread owner must match current user
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .unique();
    if (!user || thread.userId !== identity.subject) {
      throw new ConvexError("Not authorized");
    }

    // Soft-delete: update status to "archived" instead of hard delete
    await ctx.runMutation(components.agent.threads.updateThread, {
      threadId: args.id,
      patch: { status: "archived" },
    });

    return null;
  },
});

export const purgeOldArchived = internalMutation(async (ctx) => {
  const cutoff = Date.now() - 180 * 24 * 60 * 60 * 1000; // 6 months
  const users = await ctx.db.query("users").collect(); // Safe for moderate scale, could paginate if userbase grows
  let purged = 0;

  for (const user of users) {
    if (!user.clerkId) continue;
    let cursor = null;
    do {
      const result: any = await ctx.runQuery(components.agent.threads.listThreadsByUserId, {
        userId: user.clerkId,
        paginationOpts: { numItems: 100, cursor },
      });
      for (const t of result.page) {
        if (t.status === "archived" && t._creationTime < cutoff) {
          await ctx.runMutation(components.agent.threads.deleteAllForThreadIdAsync, {
            threadId: t._id,
          });
          purged++;
        }
      }
      cursor = result.isDone ? null : result.continueCursor;
    } while (cursor !== null);
  }

  console.log(`Purged ${purged} old archived threads.`);
});
