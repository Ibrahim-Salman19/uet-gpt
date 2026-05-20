import { v } from "convex/values";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { action, internalQuery } from "../_generated/server";

const K = 60;

interface ChunkData {
  _id: Id<"chunks">;
  content: string;
  documentId: Id<"documents">;
  chunkIndex: number;
}

interface DocData {
  _id: Id<"documents">;
  url: string;
  title: string;
}

interface FusedResult {
  chunkId: Id<"chunks">;
  score: number;
}

interface EnrichedChunk {
  _id: Id<"chunks">;
  content: string;
  documentId: Id<"documents">;
  url: string;
  title: string;
  chunkIndex: number;
}

export const fullTextSearchQuery = internalQuery({
  args: { queryText: v.string(), limit: v.number() },
  handler: async (ctx, args) => {
    const results = await ctx.db
      .query("chunks")
      .withSearchIndex("search_content", (q) => q.search("content", args.queryText))
      .take(args.limit);

    return results.map((r) => ({
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

    const vectorResults = await ctx.vectorSearch("chunks", "by_embedding", {
      vector: args.queryEmbedding,
      limit: limit * 2,
    });

    const textResults = (await ctx.runQuery(internal.embeddings.search.fullTextSearchQuery, {
      queryText: args.queryText,
      limit: limit * 2,
    })) as { _id: Id<"chunks"> }[];

    const rrfScores = new Map<string, number>();

    const addScore = (id: string, rank: number) => {
      const currentScore = rrfScores.get(id) ?? 0;
      rrfScores.set(id, currentScore + 1 / (K + rank));
    };

    vectorResults.forEach((res) => {
      addScore(res._id, vectorResults.indexOf(res) + 1);
    });

    textResults.forEach((res) => {
      addScore(res._id, textResults.indexOf(res) + 1);
    });

    const fusedResults: FusedResult[] = Array.from(rrfScores.entries())
      .sort(([, a], [, b]) => b - a)
      .slice(0, limit)
      .map(([id, score]) => ({
        chunkId: id as Id<"chunks">,
        score,
      }));

    const enrichedResults = (await ctx.runQuery(internal.embeddings.search.fetchEnrichedChunks, {
      chunkIds: fusedResults.map((r) => r.chunkId),
    })) as EnrichedChunk[];

    return enrichedResults
      .map((chunk) => {
        const rankData = fusedResults.find((f) => f.chunkId === chunk._id);
        return {
          ...chunk,
          relevanceScore: rankData?.score ?? 0,
        };
      })
      .sort((a, b) => b.relevanceScore - a.relevanceScore);
  },
});

export const fetchEnrichedChunks = internalQuery({
  args: { chunkIds: v.array(v.id("chunks")) },
  handler: async (ctx, args) => {
    const chunks = await Promise.all(args.chunkIds.map((id) => ctx.db.get(id)));
    const validChunks = chunks.filter((c): c is NonNullable<typeof c> => c !== null);

    const enriched: EnrichedChunk[] = await Promise.all(
      validChunks.map(async (chunk) => {
        const chunkData = chunk as unknown as ChunkData;
        const doc = await ctx.db.get(chunkData.documentId);
        const docData = doc as unknown as DocData;
        return {
          _id: chunkData._id,
          content: chunkData.content,
          documentId: docData._id,
          url: docData.url,
          title: docData.title,
          chunkIndex: chunkData.chunkIndex,
        };
      }),
    );

    return enriched;
  },
});
