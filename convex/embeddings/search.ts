import { v } from "convex/values";
import { internal } from "../_generated/api";
import type { Doc } from "../_generated/dataModel";
import { action, type ActionCtx } from "../_generated/server";
import { rag } from "../rag/instance";
import { recordTiming } from "../observability/metrics";
import { estimateIdf, type AdaptiveWeights } from "./idf";

const FAQ_BOOST_FACTOR = 2.0;

type VectorSearchResult = { entryId: string; score?: number; content?: { text: string }[] };
type TextSearchResult = { ragId: string; text: string; score: number };
type FaqResult = {
  _id: string;
  _score?: number;
  question: string;
  answer: string;
  sourceUrl?: string;
  expiresAt?: number;
};
type EnrichedResult = {
  entryId: string;
  content: string;
  url: string;
  title: string;
  relevanceScore: number;
  headingPath: string[];
};
type FusedItem = { id: string; score: number };
type DocMeta = {
  url: string;
  title: string;
  crawledAt?: number;
  freshnessTier?: string;
  parentText?: string;
  headingPath?: string[];
  contextualizedText?: string;
};

export function hybridRank(
  vectorResults: Array<{ id: string; score: number }>,
  textResults: Array<{ id: string; score: number }>,
  k = 60,
  weights: AdaptiveWeights = { vector: 1.0, text: 1.0 },
  decayStrategy: "linear" | "reciprocal" = "reciprocal",
  extraResults?: Array<{
    results: Array<{ id: string; score: number }>;
    weight: number;
  }>,
): Array<{ id: string; score: number }> {
  const scores = new Map<string, number>();

  const decay = (rank: number, total: number): number => {
    if (decayStrategy === "linear") {
      return Math.max(0.001, total - rank);
    }
    return 1 / (k + rank);
  };

  const addSet = (
    results: Array<{ id: string; score: number }>,
    weight: number,
  ): void => {
    results.forEach((res, rank) => {
      scores.set(
        res.id,
        (scores.get(res.id) ?? 0) + weight * decay(rank, results.length),
      );
    });
  };

  addSet(vectorResults, weights.vector);
  addSet(textResults, weights.text);

  if (extraResults) {
    for (const extra of extraResults) {
      addSet(extra.results, extra.weight);
    }
  }

  return Array.from(scores.entries())
    .map(([id, score]) => ({ id, score }))
    .sort((a, b) => b.score - a.score);
}

const getDocumentRef = internal.embeddings.doc_queries.getDocumentByEntryId;

async function batchFetchDocMeta(
  ctx: ActionCtx,
  fused: FusedItem[],
): Promise<Map<string, DocMeta>> {
  const docLookups = await Promise.all(
    fused.map(async (item) => {
      const doc = await ctx.runQuery(getDocumentRef, { entryId: item.id });
      return { entryId: item.id, doc };
    }),
  );

  const docMap = new Map<string, DocMeta>();
  for (const { entryId, doc } of docLookups) {
    if (doc) {
      docMap.set(entryId, {
        url: doc.url,
        title: doc.title,
        crawledAt: doc.crawledAt,
        freshnessTier: doc.freshnessTier,
        parentText: doc.parentText,
        headingPath: doc.headingPath,
        contextualizedText: doc.contextualizedText,
      });
    }
  }
  return docMap;
}

function computeDecayedScore(score: number, docMeta: DocMeta | undefined): number {
  if (!docMeta || docMeta.crawledAt === undefined) return score;
  const daysSinceCrawled = (Date.now() - docMeta.crawledAt) / (1000 * 60 * 60 * 24);
  let lambda = 0.0077;
  if (docMeta.freshnessTier === "high") lambda = 0.023;
  if (docMeta.freshnessTier === "low") lambda = 0.0039;
  const decay = Math.max(0.2, Math.exp(-lambda * daysSinceCrawled));
  return score * decay;
}

function pickBestContent(
  docMeta: DocMeta | undefined,
  vectorRes: VectorSearchResult[],
  textRes: TextSearchResult[],
  chunkTextRes: TextSearchResult[],
  itemId: string,
): string {
  if (docMeta?.contextualizedText) return docMeta.contextualizedText;
  if (docMeta?.parentText) return docMeta.parentText;
  const vecMatch = vectorRes.find((r) => r.entryId === itemId);
  if (vecMatch && vecMatch.content) return vecMatch.content.map((c) => c.text).join("\n");
  const textMatch = textRes.find((r) => r.ragId === itemId);
  if (textMatch) return textMatch.text;
  const chunkMatch = chunkTextRes.find((r) => r.ragId === itemId);
  if (chunkMatch) return chunkMatch.text;
  return "";
}

async function fetchActiveFaqs(
  ctx: ActionCtx,
  queryText: string,
): Promise<
  Array<{ entryId: string; content: string; url: string; title: string; relevanceScore: number }>
> {
  const faqs = await ctx.runQuery(internal.faq.searchFaqs, { query: queryText });
  const now = Date.now();
  return faqs
    .filter((f: FaqResult) => !f.expiresAt || f.expiresAt > now)
    .map((faq: FaqResult) => ({
      entryId: faq._id,
      content: `FAQ: ${faq.question}\nAnswer: ${faq.answer}`,
      url: faq.sourceUrl || "Verified FAQ Database",
      title: faq.question,
      relevanceScore: (faq._score ?? 1.0) * FAQ_BOOST_FACTOR,
    }));
}

export const searchDocumentsAction = action({
  args: {
    queryText: v.string(),
    queryEmbedding: v.optional(v.array(v.float64())),
    hydeQuery: v.optional(v.string()),
    limit: v.optional(v.number()),
    category: v.optional(v.string()),
  },
  returns: v.array(
    v.object({
      entryId: v.string(),
      content: v.string(),
      url: v.string(),
      title: v.string(),
      relevanceScore: v.number(),
      headingPath: v.optional(v.array(v.string())),
    }),
  ),
  handler: async (
    ctx,
    args,
  ): Promise<
    Array<{ entryId: string; content: string; url: string; title: string; relevanceScore: number }>
  > => {
    const timer = recordTiming();
    const limit = args.limit ?? 8;

    // Bandwidth optimization: only run HyDE for queries > 15 words
    // Short queries don't benefit from HyDE and it saves Groq call + embedding
    const wordCount = args.queryText.split(/\s+/).filter(Boolean).length;
    const shouldUseHyde = !args.queryEmbedding && typeof args.queryText === "string" && wordCount > 15;

    let finalQueryText = args.queryText;
    if (args.hydeQuery) {
      finalQueryText = args.hydeQuery;
    } else if (shouldUseHyde) {
      try {
        const hydeEnhanced = await ctx.runAction(internal.rag.routing.hydeQueryAction, {
          query: args.queryText,
        });
        finalQueryText = hydeEnhanced;
      } catch (err) {
        console.warn("HyDE routing action failed:", err);
      }
    }

    // Bandwidth optimization: reduce search limit from 40 to 20
    const searchLimit = 20;

    const searchArgs: {
      namespace: string;
      query: string | Array<number>;
      limit: number;
      chunkContext?: { before: number; after: number };
      filters?: Array<{ name: string; value: string }>;
    } = {
      namespace: "uet-global",
      query: args.queryEmbedding ?? args.queryText,
      limit: searchLimit,
      chunkContext: { before: 2, after: 1 },
    };

    if (args.category) {
      searchArgs.filters = [{ name: "category", value: args.category }];
    }

    const adaptiveWeights = estimateIdf(args.queryText).weights;
    const useThreeWayFusion = false;

    const vectorSearchP = rag.search(ctx, searchArgs);
    const textSearchP = ctx.runQuery(internal.crawl.queries.fullTextSearch, {
      query: finalQueryText,
      limit: searchLimit,
    });
    const chunkSearchP = useThreeWayFusion
      ? ctx.runQuery(internal.embeddings.chunkTextSearch.run, {
          query: finalQueryText,
          limit: 10,
        })
      : Promise.resolve([]);

    const [vectorRes, textResRaw, chunkTextResRaw] = await Promise.all([
      vectorSearchP,
      textSearchP,
      chunkSearchP,
    ]);
    const textRes = textResRaw as Array<{
      ragId: string;
      text: string;
      url: string;
      score: number;
    }>;
    const chunkTextRes = chunkTextResRaw as Array<{
      ragId: string;
      text: string;
      url: string;
      score: number;
    }>;

    const vectorRanked = vectorRes.results.map((r: VectorSearchResult) => ({
      id: r.entryId,
      score: r.score ?? 0,
    }));
    const textRanked = textRes.map((r: TextSearchResult) => ({ id: r.ragId, score: r.score }));

    const fused = hybridRank(
      vectorRanked,
      textRanked,
      60,
      adaptiveWeights,
      "reciprocal",
      useThreeWayFusion
        ? [
            {
              results: chunkTextRes.map((r: TextSearchResult) => ({
                id: r.ragId,
                score: r.score,
              })),
              weight: adaptiveWeights.text * 0.5,
            },
          ]
        : undefined,
    ).slice(0, limit);

    const vectorResults = vectorRes.results as VectorSearchResult[];
    const docMap = await batchFetchDocMeta(ctx, fused);

    const enrichedResults = fused.map((item: FusedItem) => {
      const docMeta = docMap.get(item.id);
      const score = computeDecayedScore(item.score, docMeta);
      const content = pickBestContent(docMeta, vectorResults, textRes, chunkTextRes, item.id);
      return {
        entryId: item.id,
        content,
        url: docMeta?.url ?? "",
        title: docMeta?.title ?? "",
        relevanceScore: score,
        headingPath: docMeta?.headingPath ?? [],
      };
    });

    const sortedEnriched = enrichedResults.sort(
      (a: EnrichedResult, b: EnrichedResult) => b.relevanceScore - a.relevanceScore,
    );

    const faqResults = await fetchActiveFaqs(ctx, args.queryText);
    const combinedResults = [...faqResults, ...sortedEnriched];

    const finalResults = combinedResults.slice(0, limit).map((r) => ({
      entryId: r.entryId,
      content: r.content,
      url: r.url,
      title: r.title,
      relevanceScore: r.relevanceScore,
      headingPath: "headingPath" in r ? (r.headingPath ?? []) : [],
    }));

    const searchLatency = timer.end();
    console.log("[SEARCH] Hybrid search complete", {
      latencyMs: searchLatency,
      vectorResults: vectorRes.results.length,
      textResults: textRes.length,
      fusedResults: fused.length,
      faqResults: faqResults.length,
      finalResults: finalResults.length,
    });

    return finalResults;
  },
});
