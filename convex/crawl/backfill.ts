import { internalMutation } from "../_generated/server";

export const run = internalMutation({
  args: {},
  handler: async (ctx) => {
    let updated = 0;
    let cursor: string | null = null;
    let isDone = false;

    while (!isDone) {
      const page = await ctx.db.query("documents").withIndex("by_crawledAt").paginate({
        cursor,
        numItems: 100,
      });

      const docsToUpdate = page.page.filter((doc) => doc.chunksEmbedded === undefined);
      if (docsToUpdate.length > 0) {
        const updates = await Promise.all(
          docsToUpdate.map(async (doc) => {
            if (doc.status === "indexed") {
              return { id: doc._id, count: doc.chunkCount || 0 };
            } else {
              const chunks = await ctx.db
                .query("crawledChunks")
                .withIndex("by_documentId", (q) => q.eq("documentId", doc._id))
                .take(200);
              return { id: doc._id, count: chunks.length };
            }
          }),
        );
        for (const update of updates) {
          await ctx.db.patch(update.id, { chunksEmbedded: update.count });
          updated++;
        }
      }

      cursor = page.continueCursor;
      isDone = page.isDone;
    }

    return `Updated ${updated} documents with chunksEmbedded counter`;
  },
});
