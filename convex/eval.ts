import { v } from "convex/values";
import { internal } from "./_generated/api";
import { action, internalQuery } from "./_generated/server";

export const getChunksByRagIds = internalQuery({
  args: {
    ragIds: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const results = [];
    for (const ragId of args.ragIds) {
      const chunk = await ctx.db
        .query("crawledChunks")
        .withIndex("by_ragId", (q) => q.eq("ragId", ragId))
        .first();

      if (chunk) {
        const doc = await ctx.db.get(chunk.documentId);
        if (doc) {
          results.push({
            ragId,
            text: chunk.text,
            url: doc.url,
          });
        }
      }
    }
    return results;
  },
});

export const evaluateSearch = action({
  args: {
    query: v.string(),
    topK: v.number(),
  },
  handler: async (ctx, args): Promise<Array<{ ragId: string; text: string; url: string }>> => {
    const { rag } = await import("./rag/instance.js");
    const vectorResults = await rag.search(ctx, {
      namespace: "uet-global",
      query: args.query,
      limit: args.topK,
    });

    const ragIds = vectorResults.results.map(
      (r: import("@convex-dev/rag").SearchResult) => r.entryId,
    );

    const chunks = (await ctx.runQuery(internal.eval.getChunksByRagIds, {
      ragIds,
    })) as Array<{ ragId: string; text: string; url: string }>;

    return chunks;
  },
});
