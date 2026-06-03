import { v } from "convex/values";
import { mutation } from "../_generated/server";
import { requireAdmin } from "../auth";
import { rag } from "../rag/instance";

export const remove = mutation({
  args: { documentId: v.id("documents") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const doc = await ctx.db.get(args.documentId);
    if (doc?.entryId) {
      try {
        await rag.deleteAsync(ctx, {
          entryId: doc.entryId as unknown as import("@convex-dev/rag").EntryId,
        });
      } catch (error) {
        console.error(`Failed to delete associated RAG entry ${doc.entryId}:`, error);
      }
    }

    await ctx.db.delete(args.documentId);
    return null;
  },
});
