import { v } from "convex/values";
import type { Doc } from "../_generated/dataModel";
import { internalMutation, internalQuery } from "../_generated/server";
import { rag } from "../rag/instance";

export const findDuplicatesBatch = internalQuery({
  args: { cursor: v.union(v.string(), v.null()) },
  handler: async (ctx, { cursor }) => {
    return await ctx.db.query("documents").withIndex("by_url").paginate({ numItems: 500, cursor });
  },
});

export const deleteDuplicateDocuments = internalMutation({
  args: { documentIds: v.array(v.id("documents")) },
  handler: async (ctx, { documentIds }) => {
    let deleted = 0;
    for (const docId of documentIds) {
      const doc = await ctx.db.get(docId);
      if (!doc) continue;

      const chunks: Doc<"crawledChunks">[] = [];
      let paginationCursor: string | null = null;
      let paginationDone = false;
      while (!paginationDone) {
        const page = await ctx.db
          .query("crawledChunks")
          .withIndex("by_documentId", (q) => q.eq("documentId", doc._id))
          .paginate({ numItems: 500, cursor: paginationCursor });
        chunks.push(...page.page);
        paginationDone = page.isDone;
        paginationCursor = page.continueCursor;
      }

      for (const chunk of chunks) {
        try {
          if (chunk.ragId) {
            await rag.delete(ctx, {
              entryId: chunk.ragId as unknown as import("@convex-dev/rag").EntryId,
            });
          }
          await ctx.db.delete(chunk._id);
        } catch (err) {
          console.warn(`Failed to delete vector ${chunk.ragId} from RAG during dedup:`, err);
        }
      }
      await ctx.db.delete(doc._id);
      deleted++;
    }
    return { deleted };
  },
});
