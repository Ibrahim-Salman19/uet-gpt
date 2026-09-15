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

// Retrieval-pipeline remediation plan, Phase 4: searches the Gemini-generated
// context blurb (contextualizedText) rather than the raw chunk text - a
// separate, smaller lexical signal that only exists for chunks the
// contextualization cron has already processed. See search_contextualized_text
// in schema.ts.
export const runContextualized = internalQuery({
  args: { query: v.string(), limit: v.number() },
  handler: async (ctx, args): Promise<ChunkTextSearchResult[]> => {
    const results = await ctx.db
      .query("crawledChunks")
      .withSearchIndex("search_contextualized_text", (q) =>
        q.search("contextualizedText", args.query),
      )
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
          // Return the raw chunk text (not the context blurb itself) so this
          // channel's hits still surface real chunk content downstream via
          // pickBestContent, consistent with the search_text channel.
          text: chunk.text,
          url: doc.url,
          score: 1.0,
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);
    return chunksWithDocs;
  },
});
