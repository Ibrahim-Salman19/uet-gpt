import { v } from "convex/values";
import { internal } from "../_generated/api";
import { type ActionCtx, internalAction } from "../_generated/server";
import { recordTiming } from "../observability/metrics";
import { rag } from "../rag/instance";
import { estimateIdf } from "./idf";

// FAQ results are fused on the same reciprocal-rank scale as document results
// (1/(RRF_K + rank)) rather than by multiplying a raw, unbounded BM25 _score by
// a magic constant. FAQ_WEIGHT scales that rank-decay relative to the document
// channels; tune it with a retrieval eval rather than by hand.
const FAQ_WEIGHT = 1.0;
const RRF_K = 60;

import {
  candidateLimit,
  classifyFreshness,
  classifyQueryRisk,
  DEFAULT_STALE_SCORE_MULTIPLIER,
  isRetrievalEligibleStatus,
  shouldAbstainOnStaleOnly,
} from "../shared/freshnessPolicy";
import { hybridRank } from "./hybridRank";

// Re-exported for existing external references; the implementation now
// lives in ./hybridRank.ts (see that file's header comment for why).
export { hybridRank };

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
  freshnessState: "fresh" | "aged" | "unknown";
  applicability: "current" | "unknown";
  crawledAt?: number;
  freshnessTier?: string;
  isStale?: boolean;
};
type FusedItem = { id: string; score: number };
type DocMeta = {
  url: string;
  title: string;
  crawledAt?: number;
  freshnessTier?: string;
  isStale?: boolean;
  status?: string;
  lastVerifiedAt?: number;
  parentText?: string;
  headingPath?: string[];
  contextualizedText?: string;
};

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
        isStale: doc.isStale,
        status: doc.status,
        lastVerifiedAt: doc.lastVerifiedAt,
        parentText: doc.parentText,
        headingPath: doc.headingPath,
        contextualizedText: doc.contextualizedText,
      });
    }
  }
  return docMap;
}

function pickBestContent(
  docMeta: DocMeta | undefined,
  vectorRes: VectorSearchResult[],
  textRes: TextSearchResult[],
  chunkTextRes: TextSearchResult[],
  itemId: string,
): string {
  // Determine base detailed content (prioritize parent document chunk for context richness)
  let baseContent = "";
  if (docMeta?.parentText) {
    baseContent = docMeta.parentText;
  } else {
    const vecMatch = vectorRes.find((r) => r.entryId === itemId);
    if (vecMatch && vecMatch.content) {
      baseContent = vecMatch.content.map((c) => c.text).join("\n");
    } else {
      const textMatch = textRes.find((r) => r.ragId === itemId);
      if (textMatch) {
        baseContent = textMatch.text;
      } else {
        const chunkMatch = chunkTextRes.find((r) => r.ragId === itemId);
        if (chunkMatch) {
          baseContent = chunkMatch.text;
        }
      }
    }
  }

  // Prepend contextualized summary to the detailed text (Anthropic Contextual Retrieval pattern)
  if (docMeta?.contextualizedText && baseContent) {
    return `Context: ${docMeta.contextualizedText}\n\n${baseContent}`;
  }

  return baseContent || docMeta?.contextualizedText || "";
}

async function fetchActiveFaqs(
  ctx: ActionCtx,
  queryText: string,
): Promise<
  Array<{
    entryId: string;
    content: string;
    url: string;
    title: string;
    relevanceScore: number;
    freshnessState: "fresh" | "aged" | "unknown";
    applicability: "current" | "unknown";
  }>
> {
  try {
    const now = Date.now();
    const faqs = await ctx.runQuery(internal.faq.searchFaqs, { query: queryText, now });
    return faqs
      .filter((f: FaqResult) => !f.expiresAt || f.expiresAt > now)
      .map((faq: FaqResult, rank: number) => ({
        entryId: faq._id,
        content: `FAQ: ${faq.question}\nAnswer: ${faq.answer}`,
        url: faq.sourceUrl || "Verified FAQ Database",
        title: faq.question,
        relevanceScore: FAQ_WEIGHT * (1 / (RRF_K + rank)),
        freshnessState: "fresh" as const,
        applicability: "current" as const,
      }));
  } catch (err) {
    console.error("FAQ search failed, falling back to empty FAQ list:", err);
    return [];
  }
}

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
      freshnessState: v.optional(v.string()),
      applicability: v.optional(v.string()),
      crawledAt: v.optional(v.number()),
      freshnessTier: v.optional(v.string()),
      isStale: v.optional(v.boolean()),
    }),
  ),
  handler: async (
    ctx,
    args,
  ): Promise<
    Array<{
      entryId: string;
      content: string;
      url: string;
      title: string;
      relevanceScore: number;
      headingPath?: string[];
      freshnessState?: string;
      applicability?: string;
      crawledAt?: number;
      freshnessTier?: string;
      isStale?: boolean;
    }>
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

    // Amendment #5: Candidate overfetch to prevent post-filter top-k starvation.
    const searchLimit = candidateLimit(limit);

    const vectorRes = await rag.search(ctx, {
      namespace: "uet-global",
      query: args.queryEmbedding ?? finalQueryText,
      limit: searchLimit,
      chunkContext: { before: 0, after: 0 },
      ...(args.category ? { filters: [{ name: "category", value: args.category }] } : {}),
    });

    const vectorRanked: Array<{ id: string; score: number }> = vectorRes.results.map(
      (r: VectorSearchResult) => ({ id: r.entryId, score: r.score ?? 0 }),
    );

    const [textResRaw, chunkTextResRaw] = await Promise.all([
      ctx.runQuery(internal.crawl.queries.fullTextSearch, {
        query: finalQueryText,
        limit: searchLimit,
      }),
      ctx.runQuery(internal.embeddings.chunkTextSearch.run, {
        query: finalQueryText,
        limit: Math.min(20, searchLimit),
      }),
    ]);

    const textRes = textResRaw as TextSearchResult[];
    const chunkTextRes = chunkTextResRaw as TextSearchResult[];

    const textRanked = textRes.map((r) => ({ id: r.ragId, score: r.score }));
    const chunkRanked = chunkTextRes.map((r) => ({ id: r.ragId, score: r.score }));

    // 3-way RRF fusion across overfetched candidate pools
    const fused = hybridRank(vectorRanked, textRanked, RRF_K, adaptiveWeights, "reciprocal", [
      { results: chunkRanked, weight: adaptiveWeights.text * 0.5 },
    ]);

    const docMap = await batchFetchDocMeta(ctx, fused);
    const now = Date.now();

    // Amendment #4 & #5: Hard-exclude invalid statuses before scoring, apply freshness decay
    const enrichedResults: EnrichedResult[] = [];
    for (const item of fused) {
      const docMeta = docMap.get(item.id);

      // Amendment #4: Hard exclusion by status
      if (docMeta?.status && !isRetrievalEligibleStatus(docMeta.status)) {
        continue;
      }

      const decision = classifyFreshness({
        status: docMeta?.status,
        isStale: docMeta?.isStale,
        crawledAt: docMeta?.crawledAt,
        freshnessTier: docMeta?.freshnessTier,
        now,
      });

      if (!decision.eligible) {
        continue;
      }

      const finalScore = decision.penalized
        ? item.score * DEFAULT_STALE_SCORE_MULTIPLIER
        : item.score;
      const content = pickBestContent(
        docMeta,
        vectorRes.results as VectorSearchResult[],
        textRes,
        chunkTextRes,
        item.id,
      );

      enrichedResults.push({
        entryId: item.id,
        content,
        url: docMeta?.url ?? "",
        title: docMeta?.title ?? "",
        relevanceScore: finalScore,
        headingPath: docMeta?.headingPath ?? [],
        freshnessState: decision.state,
        applicability: decision.applicability,
        crawledAt: docMeta?.crawledAt,
        freshnessTier: docMeta?.freshnessTier,
        isStale: docMeta?.isStale,
      });
    }

    const sortedEnriched = enrichedResults.sort((a, b) => b.relevanceScore - a.relevanceScore);

    // Check query risk & staleness abstention (Amendment #6)
    const queryRisk = classifyQueryRisk(args.queryText);
    const anyFreshSource = sortedEnriched.some((r) => r.freshnessState === "fresh");
    const allSourcesAgedOrUnknown = sortedEnriched.length > 0 && !anyFreshSource;
    const mustAbstain = shouldAbstainOnStaleOnly({
      risk: queryRisk,
      anyFreshSource,
      allSourcesAgedOrUnknown,
    });

    if (mustAbstain) {
      console.warn("[SEARCH] High-impact query with only stale/unknown evidence -> abstaining", {
        query: args.queryText,
        risk: queryRisk,
        resultsCount: sortedEnriched.length,
      });
    }

    const faqResults = (await fetchActiveFaqs(ctx, args.queryText)).slice(0, 2);
    const combinedResults = [...faqResults, ...sortedEnriched].sort(
      (a, b) => b.relevanceScore - a.relevanceScore,
    );

    const finalResults = combinedResults.slice(0, limit).map((r) => {
      const isDoc = "headingPath" in r;
      const doc = isDoc ? (r as EnrichedResult) : undefined;
      return {
        entryId: r.entryId,
        content: r.content,
        url: r.url,
        title: r.title,
        relevanceScore: r.relevanceScore,
        headingPath: doc?.headingPath ?? [],
        freshnessState: r.freshnessState as string | undefined,
        applicability: r.applicability as string | undefined,
        crawledAt: doc?.crawledAt,
        freshnessTier: doc?.freshnessTier,
        isStale: doc?.isStale,
      };
    });

    const searchLatency = timer.end();
    console.log("[SEARCH] Hybrid search complete", {
      latencyMs: searchLatency,
      queryRisk,
      mustAbstain,
      vectorResults: vectorRanked.length,
      textResults: textRes.length,
      fusedResults: fused.length,
      faqResults: faqResults.length,
      finalResults: finalResults.length,
    });

    return finalResults;
  },
});
