import { v } from "convex/values";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { action, internalQuery } from "../_generated/server";

const K = 60; // Constant for Reciprocal Rank Fusion

export const fullTextSearchQuery = internalQuery({
  args: { queryText: v.string(), limit: v.number() },
  handler: async (ctx, args) => {
    const results = await ctx.db
      .query("chunks")
      .withSearchIndex("search_content", (q: any) => q.search("content", args.queryText))
      .take(args.limit);

    // Convex full text search returns sorted by relevance natively.
    return results.map((r: any, index: number) => ({
      _id: r._id,
    }));
  },
});

export const searchDocumentsAction = action({
  args: {
    queryText: v.string(),
    queryEmbedding: v.array(v.float64()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 10;

    // 1. Vector Search
    const vectorResults = await ctx.vectorSearch("chunks", "by_embedding", {
      vector: args.queryEmbedding,
      limit: limit * 2,
    });

    // 2. Full-text Search via internal query
    const textResults = await ctx.runQuery(internal.embeddings.search.fullTextSearchQuery, {
      queryText: args.queryText,
      limit: limit * 2,
    });

    // 3. Reciprocal Rank Fusion (RRF)
    const rrfScores = new Map<string, number>();

    const addScore = (id: string, rank: number) => {
      const currentScore = rrfScores.get(id) ?? 0;
      rrfScores.set(id, currentScore + 1 / (K + rank));
    };

    vectorResults.forEach((res: any, index: number) => {
      addScore(res._id, index + 1);
    });

    textResults.forEach((res: any, index: number) => {
      addScore(res._id, index + 1);
    });

    // 4. Sort and limit
    const fusedResults = Array.from(rrfScores.entries())
      .sort((a: [string, number], b: [string, number]) => b[1] - a[1]) // Sort descending by fused score
      .slice(0, limit)
      .map(([id, score]: [string, number]) => ({
        chunkId: id as Id<"chunks">,
        score,
      }));

    // 5. Enrich chunks with parent document data
    const enrichedResults = await ctx.runQuery(internal.embeddings.search.fetchEnrichedChunks, {
      chunkIds: fusedResults.map((r) => r.chunkId),
    });

    return enrichedResults
      .map((chunk: any) => {
        const rankData = fusedResults.find((f: any) => f.chunkId === chunk._id);
        return {
          ...chunk,
          relevanceScore: rankData?.score ?? 0,
        };
      })
      .sort((a: any, b: any) => b.relevanceScore - a.relevanceScore);
  },
});

export const fetchEnrichedChunks = internalQuery({
  args: { chunkIds: v.array(v.id("chunks")) },
  handler: async (ctx, args) => {
    const chunks = await Promise.all(args.chunkIds.map((id) => ctx.db.get(id)));

    const validChunks = chunks.filter((c): c is NonNullable<typeof c> => c !== null);

    const enriched = await Promise.all(
      validChunks.map(async (chunk) => {
        const doc = await ctx.db.get(chunk.documentId as any);
        return {
          _id: chunk._id,
          content: chunk.content,
          documentId: doc?._id ?? "",
          url: doc?.url ?? "",
          title: doc?.title ?? "",
          chunkIndex: chunk.chunkIndex,
        };
      }),
    );

    return enriched;
  },
});
