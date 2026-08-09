import { generateText } from "ai";
import { v } from "convex/values";
import { api, internal } from "../_generated/api";
import { internalAction } from "../_generated/server";
import { getTextModelChain } from "../rag/modelRegistry";
import { EVAL_BATCH_SIZE, EVAL_MAX_QUERIES, EVAL_TOP_K } from "./constants";

type EvalQuery = {
  query: string;
  expectedAnswer?: string;
  rating?: string;
  category?: string;
};

type RelevanceJudgment = {
  index: number;
  relevant: boolean;
};

type PerQueryResult = {
  query: string;
  latency: number;
  tokenUsage: number;
  retrievedCount: number;
  relevantCount: number;
  reciprocalRank: number;
  retrievedChunks: Array<{ text: string; url: string; score: number }>;
  error?: string;
};

type EvalMetrics = {
  recallAtK: number;
  precisionAtK: number;
  mrr: number;
  avgLatency: number;
  totalTokens: number;
  totalQueries: number;
  errorCount: number;
};

type EvalResult = {
  metrics: EvalMetrics;
  perQuery: PerQueryResult[];
  timestamp: number;
};

async function judgeRelevanceBatch(
  query: string,
  chunks: Array<{ text: string; url: string; score: number }>,
): Promise<RelevanceJudgment[]> {
  const chain = getTextModelChain();
  if (chain.length === 0) {
    return chunks.map((_, i) => ({ index: i, relevant: false }));
  }

  const chunkList = chunks.map((c, i) => `[${i}] ${c.text.substring(0, 500)}`).join("\n---\n");

  for (const { model, label } of chain) {
    try {
      const { text } = await generateText({
        model,
        system:
          "You are a strict relevance judge. Given a query and a list of text chunks, " +
          "determine which chunks contain information that helps answer the query. " +
          "Output a JSON array of objects with 'index' (number) and 'relevant' (boolean). " +
          'Example: [{"index":0,"relevant":true},{"index":1,"relevant":false}]',
        prompt: `Query: "${query}"\n\nChunks:\n${chunkList}\n\nWhich chunks are relevant?`,
        temperature: 0,
        maxOutputTokens: 500,
      });

      const cleaned = text
        .replace(/```json?/gi, "")
        .replace(/```/g, "")
        .trim();
      const parsed = JSON.parse(cleaned) as RelevanceJudgment[];

      if (Array.isArray(parsed) && parsed.length === chunks.length) {
        return parsed;
      }
      // Model returned malformed JSON or wrong count — try next provider.
      console.warn(`judgeRelevanceBatch: ${label} returned unusable output, trying next provider`);
    } catch (error) {
      console.warn(`judgeRelevanceBatch: ${label} failed, trying next provider:`, error);
    }
  }

  return chunks.map((_, i) => ({ index: i, relevant: false }));
}

export const runEval = internalAction({
  args: {
    queries: v.array(
      v.object({
        query: v.string(),
        expectedAnswer: v.optional(v.string()),
        rating: v.optional(v.string()),
        category: v.optional(v.string()),
      }),
    ),
    topK: v.optional(v.number()),
  },
  returns: v.object({
    metrics: v.object({
      recallAtK: v.number(),
      precisionAtK: v.number(),
      mrr: v.number(),
      avgLatency: v.number(),
      totalTokens: v.number(),
      totalQueries: v.number(),
      errorCount: v.number(),
    }),
    perQuery: v.array(
      v.object({
        query: v.string(),
        latency: v.number(),
        tokenUsage: v.number(),
        retrievedCount: v.number(),
        relevantCount: v.number(),
        reciprocalRank: v.number(),
        retrievedChunks: v.array(
          v.object({
            text: v.string(),
            url: v.string(),
            score: v.number(),
          }),
        ),
        error: v.optional(v.string()),
      }),
    ),
    timestamp: v.number(),
  }),
  handler: async (ctx, args): Promise<EvalResult> => {
    const topK = args.topK ?? EVAL_TOP_K;
    const queries = args.queries.slice(0, EVAL_MAX_QUERIES);
    const perQuery: PerQueryResult[] = [];
    let totalTokens = 0;

    for (let i = 0; i < queries.length; i += EVAL_BATCH_SIZE) {
      const batch = queries.slice(i, i + EVAL_BATCH_SIZE);

      const batchResults = await Promise.allSettled(
        batch.map(async (item) => {
          const start = Date.now();
          let latency = 0;
          let tokenUsage = 0;
          let retrievedChunks: PerQueryResult["retrievedChunks"] = [];
          let error: string | undefined;

          try {
            const chunks = await ctx.runAction(api.eval.evaluateSearch, {
              query: item.query,
              topK,
            });

            const chunksTyped = chunks as Array<{
              ragId: string;
              text: string;
              url: string;
            }>;

            retrievedChunks = chunksTyped.map((c) => ({
              text: c.text,
              url: c.url,
              score: 0,
            }));

            const judgments = await judgeRelevanceBatch(item.query, retrievedChunks);

            const relevantSet = new Set(judgments.filter((j) => j.relevant).map((j) => j.index));

            const relevantCount = relevantSet.size;

            const firstRelevantRank = judgments.findIndex((j) => j.relevant);
            const reciprocalRank = firstRelevantRank >= 0 ? 1 / (firstRelevantRank + 1) : 0;

            retrievedChunks = retrievedChunks.map((c, idx) => ({
              ...c,
              score: judgments[idx]?.relevant ? 1 : 0,
            }));

            latency = Date.now() - start;
            tokenUsage = 0;

            return {
              query: item.query,
              latency,
              tokenUsage,
              retrievedCount: retrievedChunks.length,
              relevantCount,
              reciprocalRank,
              retrievedChunks,
              error: undefined,
            };
          } catch (e) {
            latency = Date.now() - start;
            error = e instanceof Error ? e.message : String(e);

            return {
              query: item.query,
              latency,
              tokenUsage,
              retrievedCount: 0,
              relevantCount: 0,
              reciprocalRank: 0,
              retrievedChunks: [],
              error,
            };
          }
        }),
      );

      for (const result of batchResults) {
        if (result.status === "fulfilled") {
          perQuery.push(result.value);
          totalTokens += result.value.tokenUsage;
        } else {
          perQuery.push({
            query: "unknown",
            latency: 0,
            tokenUsage: 0,
            retrievedCount: 0,
            relevantCount: 0,
            reciprocalRank: 0,
            retrievedChunks: [],
            error: result.reason?.toString(),
          });
        }
      }
    }

    const completedQueries = perQuery.filter((q) => !q.error);
    const totalQueries = perQuery.length;
    const errorCount = totalQueries - completedQueries.length;

    const recallAtK =
      completedQueries.length > 0
        ? completedQueries.filter((q) => q.relevantCount > 0).length / completedQueries.length
        : 0;

    const precisionAtK =
      completedQueries.length > 0
        ? completedQueries.reduce(
            (sum, q) => sum + q.relevantCount / Math.max(q.retrievedCount, 1),
            0,
          ) / completedQueries.length
        : 0;

    const mrr =
      completedQueries.length > 0
        ? completedQueries.reduce((sum, q) => sum + q.reciprocalRank, 0) / completedQueries.length
        : 0;

    const avgLatency =
      completedQueries.length > 0
        ? completedQueries.reduce((sum, q) => sum + q.latency, 0) / completedQueries.length
        : 0;

    const metrics: EvalMetrics = {
      recallAtK: Math.round(recallAtK * 10000) / 10000,
      precisionAtK: Math.round(precisionAtK * 10000) / 10000,
      mrr: Math.round(mrr * 10000) / 10000,
      avgLatency: Math.round(avgLatency),
      totalTokens,
      totalQueries,
      errorCount,
    };

    return {
      metrics,
      perQuery,
      timestamp: Date.now(),
    };
  },
});

export const runEvalWithDataset = internalAction({
  args: {
    topK: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<EvalResult> => {
    const topK = args.topK ?? EVAL_TOP_K;

    const exportResult = await ctx.runQuery(internal.eval.exportDataset.exportGoldenDataset, {
      maxFeedbackEntries: EVAL_MAX_QUERIES,
    });

    const queries: EvalQuery[] = exportResult.entries.map(
      (e: {
        query: string;
        expectedAnswer: string;
        rating: string;
        category: string | undefined;
      }) => ({
        query: e.query,
        expectedAnswer: e.expectedAnswer,
        rating: e.rating,
        category: e.category,
      }),
    );

    if (queries.length === 0) {
      return {
        metrics: {
          recallAtK: 0,
          precisionAtK: 0,
          mrr: 0,
          avgLatency: 0,
          totalTokens: 0,
          totalQueries: 0,
          errorCount: 0,
        },
        perQuery: [],
        timestamp: Date.now(),
      };
    }

    return await ctx.runAction(internal.eval.runEval.runEval, {
      queries,
      topK,
    });
  },
});
