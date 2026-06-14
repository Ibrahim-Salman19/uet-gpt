import { ConvexError, v } from "convex/values";
import { api, internal } from "./_generated/api";
import { action, internalMutation, internalQuery } from "./_generated/server";

export const getChunksByRagIds = internalQuery({
  args: {
    ragIds: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const promises = args.ragIds.map(async (ragId) => {
      const chunk = await ctx.db
        .query("crawledChunks")
        .withIndex("by_ragId", (q) => q.eq("ragId", ragId))
        .first();

      if (!chunk) return null;
      const doc = await ctx.db.get(chunk.documentId);
      if (!doc) return null;
      return {
        ragId,
        text: chunk.text,
        url: doc.url,
      };
    });
    const results = await Promise.all(promises);
    return results.filter((r): r is { ragId: string; text: string; url: string } => r !== null);
  },
});

export const evaluateSearch = action({
  args: {
    query: v.string(),
    topK: v.number(),
  },
  handler: async (ctx, args): Promise<Array<{ ragId: string; text: string; url: string }>> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError("Authentication required");
    }

    const user = await ctx.runQuery(api.users.getByClerkId, {
      clerkId: identity.subject,
    });

    if (!user || !user.isActive || (user.role !== "admin" && user.role !== "superadmin")) {
      throw new ConvexError("Unauthorized: Admin privileges required");
    }

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

export const storeEvalResult = internalMutation({
  args: {
    evalName: v.string(),
    model: v.optional(v.string()),
    datasetSize: v.number(),
    metrics: v.object({
      recallAtK: v.number(),
      precisionAtK: v.number(),
      mrr: v.number(),
      avgLatency: v.number(),
      totalTokens: v.number(),
    }),
    metadata: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("evalResults", {
      evalName: args.evalName,
      model: args.model,
      datasetSize: args.datasetSize,
      timestamp: Date.now(),
      metrics: args.metrics,
      metadata: args.metadata,
    });
  },
});
