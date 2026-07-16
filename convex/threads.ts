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
import { requireAuth } from "./auth";
import { threadValidator } from "./threads/validator";

export const create = mutation({
  args: {
    title: v.string(),
  },
  returns: v.string(),
  handler: async (ctx, args) => {
    // requireAuth enforces identity, user existence, and isActive.
    // Provisioning is handled by getOrCreate/webhook - do not auto-insert here,
    // so a deactivated user cannot resurrect their own row by creating a thread.
    const user = await requireAuth(ctx);

    const thread = await ctx.runMutation(components.agent.threads.createThread, {
      userId: user.clerkId,
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
    // Gracefully return [] when the user record hasn't been created yet
    // (race window during OAuth sign-in before UserSync mutation completes).
    // requireAuth throws ConvexError("User not found") which would crash the
    // entire React tree. Instead, check identity + user existence manually.
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .unique();
    if (!user || !user.isActive) return [];

    const result = await ctx.runQuery(components.agent.threads.listThreadsByUserId, {
      userId: user.clerkId,
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
    // requireAuth enforces identity, user existence, and isActive.
    const user = await requireAuth(ctx);

    // Verify thread exists via component query
    const thread = await ctx.runQuery(components.agent.threads.getThread, { threadId: args.id });
    if (!thread) {
      throw new ConvexError("Thread not found");
    }

    // Authorize: thread owner must match current user
    if (thread.userId !== user.clerkId) {
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
    // requireAuth enforces identity, user existence, and isActive.
    const user = await requireAuth(ctx);

    // Verify thread exists via component query
    const thread = await ctx.runQuery(components.agent.threads.getThread, { threadId: args.id });
    if (!thread) {
      throw new ConvexError("Thread not found");
    }

    // Authorize: thread owner must match current user
    if (thread.userId !== user.clerkId) {
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

export const safeDeleteThread = internalMutation({
  args: {
    threadId: v.string(),
    cutoff: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const thread = await ctx.runQuery(components.agent.threads.getThread, {
      threadId: args.threadId,
    });
    if (!thread) {
      return null;
    }
    if (thread.status === "archived" && thread._creationTime < args.cutoff) {
      // 1. Get messages in the thread to identify all message IDs via pagination
      let cursor = null;
      const messageIds: string[] = [];
      while (true) {
        const messagesResult: any = await ctx.runQuery(
          components.agent.messages.listMessagesByThreadId,
          {
            threadId: args.threadId,
            order: "asc",
            paginationOpts: { numItems: 200, cursor },
          },
        );
        messageIds.push(...messagesResult.page.map((m: any) => m._id));
        if (messagesResult.isDone) {
          break;
        }
        cursor = messagesResult.continueCursor;
      }

      // 2. Delete feedback records associated with those messages. Batch queries to avoid
      // excessive concurrent index scans.
      const BATCH_SIZE = 50;
      const allFeedbackIds: any[] = [];
      for (let i = 0; i < messageIds.length; i += BATCH_SIZE) {
        const batchIds = messageIds.slice(i, i + BATCH_SIZE);
        const feedbackEntries = await Promise.all(
          batchIds.map((msgId: string) =>
            ctx.db
              .query("feedback")
              .withIndex("by_messageId", (q) => q.eq("messageId", msgId))
              .take(5),
          ),
        );
        for (const entries of feedbackEntries) {
          for (const fb of entries) {
            allFeedbackIds.push(fb._id);
          }
        }
      }

      for (let i = 0; i < allFeedbackIds.length; i += BATCH_SIZE) {
        const batchDeleteIds = allFeedbackIds.slice(i, i + BATCH_SIZE);
        await Promise.all(batchDeleteIds.map((fbId) => ctx.db.delete(fbId)));
      }

      // 3. Delete thread and messages inside the agent component
      await ctx.runMutation(components.agent.threads.deleteAllForThreadIdAsync, {
        threadId: args.threadId,
      });
    }
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
    threadCursor: v.optional(v.union(v.string(), v.null())),
    purgedSoFar: v.optional(v.number()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const cutoff = Date.now() - 180 * 24 * 60 * 60 * 1000; // 6 months
    const userCursor = args.userCursor !== undefined ? args.userCursor : null;
    let threadCursor = args.threadCursor !== undefined ? args.threadCursor : null;
    let purged = args.purgedSoFar ?? 0;

    const startTime = Date.now();
    const MAX_EXECUTION_TIME_MS = 20 * 1000; // Yield every 20s to stay safe

    // 1. Fetch exactly 1 user using the cursor
    const userPage = (await ctx.runQuery(internal.threads.getOldArchivedUsersBatch, {
      cursor: userCursor,
    })) as { page: Doc<"users">[]; continueCursor: string; isDone: boolean };

    if (userPage.page.length === 0) {
      console.log(`Purged ${purged} old archived threads. Purge complete.`);
      return;
    }

    const user = userPage.page[0];
    if (user && user.clerkId) {
      let threadDone = false;
      while (!threadDone) {
        // Yield early if we have been running for too long
        if (Date.now() - startTime > MAX_EXECUTION_TIME_MS) {
          console.log(
            `Execution limit reached. Yielding and rescheduling user ${user.clerkId} from threadCursor ${threadCursor}`,
          );
          await ctx.scheduler.runAfter(0, internal.threads.purgeOldArchived, {
            userCursor,
            threadCursor,
            purgedSoFar: purged,
          });
          return;
        }

        const result = await ctx.runQuery(components.agent.threads.listThreadsByUserId, {
          userId: user.clerkId,
          paginationOpts: { numItems: 100, cursor: threadCursor },
        });

        // Batch parallel deletions for independent thread IDs
        const threadsToDelete = result.page.filter(
          (t: any) => t.status === "archived" && t._creationTime < cutoff,
        );

        const BATCH_SIZE = 5;
        for (let i = 0; i < threadsToDelete.length; i += BATCH_SIZE) {
          const chunk = threadsToDelete.slice(i, i + BATCH_SIZE);
          await Promise.all(
            chunk.map((t: any) =>
              ctx.runMutation(internal.threads.safeDeleteThread, {
                threadId: t._id,
                cutoff,
              }),
            ),
          );
          purged += chunk.length;
        }

        threadCursor = result.continueCursor;
        threadDone = result.isDone;
      }
    }

    // Finished processing the current user. Move to the next user!
    if (!userPage.isDone) {
      await ctx.scheduler.runAfter(0, internal.threads.purgeOldArchived, {
        userCursor: userPage.continueCursor,
        threadCursor: null,
        purgedSoFar: purged,
      });
    } else {
      console.log(`Purged ${purged} old archived threads. Purge complete.`);
    }
  },
});
