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
        for (const doc of docsToUpdate) {
          await ctx.db.patch(doc._id, { chunksEmbedded: doc.chunkCount || 0 });
          updated++;
        }
      }

      cursor = page.continueCursor;
      isDone = page.isDone;
    }

    return `Updated ${updated} documents with chunksEmbedded counter`;
  },
});
