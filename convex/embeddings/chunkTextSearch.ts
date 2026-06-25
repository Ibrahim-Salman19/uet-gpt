import { v } from "convex/values";
import { internalQuery } from "../_generated/server";

type ChunkTextSearchResult = {
  ragId: string;
  text: string;
  url: string;
  score: number;
};

export const run = internalQuery({
  args: { query: v.string(), limit: v.number() },
  handler: async (ctx, args): Promise<ChunkTextSearchResult[]> => {
    const results = await ctx.db
      .query("crawledChunks")
      .withSearchIndex("search_text", (q) => q.search("text", args.query))
      .take(args.limit);

    const docIds = [...new Set(results.map((c) => c.documentId))];
    const docs = await Promise.all(docIds.map((id) => ctx.db.get(id)));
    const docMap = new Map(
      docs.filter((d): d is NonNullable<typeof d> => d !== null).map((d) => [d._id, d]),
    );

    const chunksWithDocs = results
      .map((chunk) => {
        const doc = docMap.get(chunk.documentId);
        if (!doc) return null;
        return {
          ragId: chunk.ragId,
          text: chunk.text,
          url: doc.url,
          // Convex search indexes do not expose a numeric BM25 score; results are
          // already returned in relevance order, so use a constant and let the
          // downstream RRF / hybridRank re-rank by position.
          score: 1.0,
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);
    return chunksWithDocs;
  },
});
