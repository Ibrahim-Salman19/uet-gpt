import { internalMutation } from "../_generated/server";

export const run = internalMutation({
  args: {},
  handler: async (ctx) => {
    let updated = 0;
    let cursor: string | null = null;
    let isDone = false;

    while (!isDone) {
      const page = await ctx.db
        .query("documents")
        .withIndex("by_crawledAt")
        .paginate({
          cursor,
          numItems: 100,
        });

      for (const doc of page.page) {
        if (doc.chunksEmbedded === undefined) {
          if (doc.status === "indexed") {
            await ctx.db.patch(doc._id, { chunksEmbedded: doc.chunkCount || 0 });
            updated++;
          } else {
            const chunks = await ctx.db
              .query("crawledChunks")
              .withIndex("by_documentId", (q) => q.eq("documentId", doc._id))
              .take(200);
            await ctx.db.patch(doc._id, { chunksEmbedded: chunks.length });
            updated++;
          }
        }
      }

      cursor = page.continueCursor;
      isDone = page.isDone;
    }

    return `Updated ${updated} documents with chunksEmbedded counter`;
  },
});
