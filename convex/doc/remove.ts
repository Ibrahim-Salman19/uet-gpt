import { v } from "convex/values";
import { internalAction, mutation } from "../_generated/server";
import { requireAdmin } from "../auth";
import { rag } from "../rag/instance";
import { internal } from "../_generated/api";

export const remove = mutation({
  args: { documentId: v.id("documents") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const doc = await ctx.db.get(args.documentId);
    if (doc?.entryId) {
      await ctx.scheduler.runAfter(0, internal.doc.remove.ragCleanupAction, {
        entryId: doc.entryId,
      });
    }

    // Clean up orphaned crawledChunks before deleting document
    let cursor: string | null = null;
    let isDone = false;
    while (!isDone) {
      const page = await ctx.db
        .query("crawledChunks")
        .withIndex("by_documentId", (q) => q.eq("documentId", args.documentId))
        .paginate({ numItems: 200, cursor });
      for (const chunk of page.page) {
        await ctx.db.delete(chunk._id);
      }
      cursor = page.continueCursor;
      isDone = page.isDone;
    }

    await ctx.db.delete(args.documentId);
    return null;
  },
});

export const ragCleanupAction = internalAction({
  args: { entryId: v.string() },
  handler: async (ctx, args) => {
    try {
      await rag.deleteAsync(ctx as any, {
        entryId: args.entryId as unknown as import("@convex-dev/rag").EntryId,
      });
    } catch (error) {
      console.error(`Failed to delete associated RAG entry ${args.entryId}:`, error);
    }
  },
});
