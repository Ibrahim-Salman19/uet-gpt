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

async function deleteDocumentChunks(ctx: any, doc: Doc<"documents">): Promise<void> {
  while (true) {
    const chunks = await ctx.db
      .query("crawledChunks")
      .withIndex("by_documentId", (q: any) => q.eq("documentId", doc._id))
      .take(100);

    if (chunks.length === 0) {
      break;
    }

    await Promise.all(
      chunks.map(async (chunk: any) => {
        try {
          if (chunk.ragId) {
            try {
              await rag.delete(ctx, {
                entryId: chunk.ragId as unknown as import("@convex-dev/rag").EntryId,
              });
            } catch (err) {
              console.warn(`Failed to delete vector ${chunk.ragId} from RAG during dedup:`, err);
            }
          }
          await ctx.db.delete(chunk._id);
        } catch (err) {
          console.error("Failed to delete chunk:", err);
          throw err;
        }
      }),
    );
  }
}

export const deleteDuplicateDocuments = internalMutation({
  args: { documentIds: v.array(v.id("documents")) },
  handler: async (ctx, { documentIds }) => {
    const results = await Promise.all(
      documentIds.map(async (docId): Promise<number> => {
        const doc = await ctx.db.get(docId);
        if (!doc) return 0;

        await deleteDocumentChunks(ctx, doc);
        await ctx.db.delete(doc._id);
        return 1;
      }),
    );
    const deleted = results.reduce((sum, count) => sum + count, 0);
    return { deleted };
  },
});
