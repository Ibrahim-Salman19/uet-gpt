import { ConvexError, v } from "convex/values";
import { mutation } from "../_generated/server";
import { rag } from "../rag/instance";

export const remove = mutation({
  args: { documentId: v.id("documents") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError("Authentication required");
    }

    const doc = await ctx.db.get("documents", args.documentId);
    if (doc?.entryId) {
      try {
        await rag.deleteAsync(ctx, { entryId: doc.entryId as any });
      } catch (error) {
        console.error(`Failed to delete associated RAG entry ${doc.entryId}:`, error);
      }
    }

    await ctx.db.delete("documents", args.documentId);
    return null;
  },
});
