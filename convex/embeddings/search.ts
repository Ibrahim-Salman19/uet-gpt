import { v } from "convex/values";
import { internal } from "../_generated/api";
import { type ActionCtx, internalAction } from "../_generated/server";
import { recordTiming } from "../observability/metrics";
import { rag } from "../rag/instance";
import { type AdaptiveWeights, estimateIdf } from "./idf";

// FAQ results are fused on the same reciprocal-rank scale as document results
// (1/(RRF_K + rank)) rather than by multiplying a raw, unbounded BM25 _score by
// a magic constant. FAQ_WEIGHT scales that rank-decay relative to the document
// channels; tune it with a retrieval eval rather than by hand.
const FAQ_WEIGHT = 1.0;
const RRF_K = 60;

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
      return Math.max(0.001, total > 0 ? (total - rank) / total : 0);
    }
    return 1 / (k + rank);
  };

  const addSet = (results: Array<{ id: string; score: number }>, weight: number): void => {
    results.forEach((res, rank) => {
      scores.set(res.id, (scores.get(res.id) ?? 0) + weight * decay(rank, results.length));
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

async function batchFetchDocMeta(
  ctx: ActionCtx,
  fused: FusedItem[],
): Promise<Map<string, DocMeta>> {
  const entryIds = fused.map((f) => f.id);
  const lookups = await ctx.runQuery(internal.embeddings.doc_queries.getDocumentsByEntryIds, {
    entryIds,
  });

  const docMap = new Map<string, DocMeta>();
  for (const { entryId, doc } of lookups) {
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
  try {
    const now = Date.now();
    const faqs = await ctx.runQuery(internal.faq.searchFaqs, { query: queryText, now });
    // searchFaqs returns results already ordered by BM25 relevance, so use the
    // rank position to compute a reciprocal-rank score on the same scale as the
    // fused document results, instead of a raw BM25 _score * constant.
    return faqs
      .filter((f: FaqResult) => !f.expiresAt || f.expiresAt > now)
      .map((faq: FaqResult, rank: number) => ({
        entryId: faq._id,
        content: `FAQ: ${faq.question}\nAnswer: ${faq.answer}`,
        url: faq.sourceUrl || "Verified FAQ Database",
        title: faq.question,
        relevanceScore: FAQ_WEIGHT * (1 / (RRF_K + rank)),
      }));
  } catch (err) {
    console.error("FAQ search failed, falling back to empty FAQ list:", err);
    return [];
  }
}

// internalAction: only callable server-side via
// internal.embeddings.search.searchDocumentsAction from the already-authenticated
// RAG retrieval pipeline. Removing it from the public API surface prevents
// unauthenticated vector/full-text/FAQ search + HyDE LLM cost-amplification.
export const searchDocumentsAction = internalAction({
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
    const wordCount = args.queryText.split(/\s+/).filter(Boolean).length;
    const adaptiveWeights = estimateIdf(args.queryText).weights;

    // HyDE: only for long queries (>15 words)
    let finalQueryText = args.queryText;
    if (args.hydeQuery) {
      finalQueryText = args.hydeQuery;
    } else if (!args.queryEmbedding && wordCount > 15) {
      try {
        const hydeEnhanced = await ctx.runAction(internal.rag.routing.hydeQueryAction, {
          query: args.queryText,
        });
        finalQueryText = hydeEnhanced;
      } catch (err) {
        console.warn("HyDE routing action failed:", err);
      }
    }

    const searchLimit = 20;

    // Run vector search
    const vectorRes = await rag.search(ctx, {
      namespace: "uet-global",
      query: args.queryEmbedding ?? finalQueryText,
      limit: searchLimit,
      chunkContext: { before: 2, after: 1 },
      ...(args.category ? { filters: [{ name: "category", value: args.category }] } : {}),
    });

    const vectorRanked: Array<{ id: string; score: number }> = vectorRes.results.map(
      (r: VectorSearchResult) => ({ id: r.entryId, score: r.score ?? 0 }),
    );

    // Text search and chunk-level full-text search in parallel
    const [textResRaw, chunkTextResRaw] = await Promise.all([
      ctx.runQuery(internal.crawl.queries.fullTextSearch, {
        query: finalQueryText,
        limit: searchLimit,
      }),
      ctx.runQuery(internal.embeddings.chunkTextSearch.run, {
        query: finalQueryText,
        limit: 10,
      }),
    ]);

    const textRes = textResRaw as TextSearchResult[];
    const chunkTextRes = chunkTextResRaw as TextSearchResult[];

    const textRanked = textRes.map((r) => ({ id: r.ragId, score: r.score }));
    const chunkRanked = chunkTextRes.map((r) => ({ id: r.ragId, score: r.score }));

    // 3-way RRF fusion: vector + text + chunk text search
    const fused = hybridRank(vectorRanked, textRanked, RRF_K, adaptiveWeights, "reciprocal", [
      { results: chunkRanked, weight: adaptiveWeights.text * 0.5 },
    ]).slice(0, limit);

    const docMap = await batchFetchDocMeta(ctx, fused);

    const enrichedResults = fused.map((item: FusedItem) => {
      const docMeta = docMap.get(item.id);
      const score = computeDecayedScore(item.score, docMeta);
      const content = pickBestContent(
        docMeta,
        vectorRes.results as VectorSearchResult[],
        textRes,
        chunkTextRes,
        item.id,
      );
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

    const faqResults = (await fetchActiveFaqs(ctx, args.queryText)).slice(0, 2);
    const combinedResults = [...faqResults, ...sortedEnriched].sort(
      (a, b) => b.relevanceScore - a.relevanceScore,
    );

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
      vectorResults: vectorRanked.length,
      textResults: textRes.length,
      fusedResults: fused.length,
      faqResults: faqResults.length,
      finalResults: finalResults.length,
    });

    return finalResults;
  },
});
