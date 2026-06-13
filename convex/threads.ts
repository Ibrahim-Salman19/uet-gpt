import { ConvexError, v } from "convex/values";
import { components, internal } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";
import {
  internalAction,
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./_generated/server";
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
    let user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .unique();

    if (!user) {
      const userId = await ctx.db.insert("users", {
        clerkId: identity.subject,
        name: identity.name ?? "Unknown",
        email: identity.email ?? "",
        imageUrl: identity.pictureUrl,
        role: "user",
        isActive: true,
        lastLoginAt: Date.now(),
      });
      user = await ctx.db.get(userId);
    }

    const thread = await ctx.runMutation(components.agent.threads.createThread, {
      userId: identity.subject,
      title: args.title,
    });

    // Handle both cases: if agent returns just the ID string, or the document object.
    return (typeof thread === "string" ? thread : thread._id) as string;
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
      .filter((t: { status?: string }) => t.status === "active")
      .map((t: { _id: string; _creationTime: number; userId?: string; title?: string }) => ({
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

export const getOldArchivedUsersBatch = internalQuery({
  args: { cursor: v.union(v.string(), v.null()) },
  handler: async (ctx, { cursor }) => {
    return await ctx.db.query("users").paginate({ numItems: 100, cursor });
  },
});

export const purgeOldArchived = internalAction({
  args: {
    userCursor: v.optional(v.union(v.string(), v.null())),
    purgedSoFar: v.optional(v.number()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const cutoff = Date.now() - 180 * 24 * 60 * 60 * 1000; // 6 months
    let userCursor = args.userCursor !== undefined ? args.userCursor : null;
    let userDone = false;
    let purged = args.purgedSoFar ?? 0;
    
    const startTime = Date.now();
    const MAX_EXECUTION_TIME_MS = 8 * 60 * 1000; // 8 minutes

    while (!userDone) {
      if (Date.now() - startTime > MAX_EXECUTION_TIME_MS) {
        console.log(`Execution time limit reached. Scheduling continuation. Purged so far: ${purged}`);
        await ctx.scheduler.runAfter(0, internal.threads.purgeOldArchived, {
          userCursor,
          purgedSoFar: purged,
        });
        return;
      }

      const userPage = (await ctx.runQuery(internal.threads.getOldArchivedUsersBatch, {
        cursor: userCursor,
      })) as { page: Doc<"users">[]; continueCursor: string; isDone: boolean };

      for (const user of userPage.page) {
        if (!user.clerkId) continue;

        let threadCursor = null as string | null;
        let threadDone = false;
        while (!threadDone) {
          const result = await ctx.runQuery(components.agent.threads.listThreadsByUserId, {
            userId: user.clerkId,
            paginationOpts: { numItems: 100, cursor: threadCursor },
          });

          for (const t of result.page) {
            if (t.status === "archived" && t._creationTime < cutoff) {
              await ctx.runMutation(components.agent.threads.deleteAllForThreadIdAsync, {
                threadId: t._id,
              });
              purged++;
            }
          }
          threadDone = result.isDone;
          threadCursor = result.continueCursor;
        }
      }
      userDone = userPage.isDone;
      userCursor = userPage.continueCursor;
    }

    console.log(`Purged ${purged} old archived threads.`);
  },
});
