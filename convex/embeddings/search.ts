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
  chunkContextualizedTextRes: TextSearchResult[] = [],
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
        } else {
          // Falls back here only for chunks that ranked via the
          // search_contextualized_text channel (Phase 4) but weren't already
          // found above - runContextualized returns the chunk's raw text
          // (not the context blurb), so this is real content, not the summary.
          const contextualizedMatch = chunkContextualizedTextRes.find((r) => r.ragId === itemId);
          if (contextualizedMatch) {
            baseContent = contextualizedMatch.text;
          }
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

    // SHIP.md Step 5: KNOWLEDGE_STORE_BACKEND selects the dense channel only.
    // Lexical (fullTextSearch/chunkTextSearch below) is already Convex-native
    // and independent of this switch either way. Default ("convex" or unset)
    // keeps today's @convex-dev/rag path byte-for-byte unchanged.
    const usePineconeBackend = process.env.KNOWLEDGE_STORE_BACKEND === "pinecone";

    let vectorRes: { results: VectorSearchResult[] } = { results: [] };
    let vectorRanked: Array<{ id: string; score: number }> = [];
    // Populated only on the Pinecone path - see the module-level note where
    // this is consumed for why pickBestContent needs it: denseSearch always
    // returns text: "", and docMeta.parentText is null for chunks with no
    // distinct parent, so without this a dense-only hit renders with empty
    // content (a real result observed in end-to-end testing, not a
    // theoretical gap).
    let denseHitContent: TextSearchResult[] = [];

    if (usePineconeBackend) {
      // Deliberately NOT args.queryEmbedding here - that vector, when the
      // caller supplies one (convex/rag/retrieval.ts, reused from the
      // semantic-cache lookup), is Gemini's 768d space. Pinecone's index is
      // Cloudflare/Qwen3's 1024d space - a different, incompatible vector
      // space keyed to the same corpus. Always embed fresh for this channel.
      const cfEmbedding: number[] | null = await ctx.runAction(
        internal.embeddings.cloudflareEmbed.cloudflareEmbedQuery,
        { text: finalQueryText },
      );

      if (cfEmbedding === null) {
        // No sane fallback vector exists - continue with lexical + FAQ only,
        // but SAY SO in the existing [SEARCH] log line below rather than
        // letting a silently-empty dense channel look identical to "no
        // dense matches for this query".
        console.warn(
          "[SEARCH] Pinecone dense channel unavailable this query (cloudflareEmbedQuery " +
            "returned null - see its own warning above for cause); continuing lexical+FAQ only",
        );
      } else {
        const denseHits = await ctx.runAction(
          internal.knowledgeStore.denseSearchAction.denseSearch,
          {
            queryEmbedding: cfEmbedding,
            topK: searchLimit,
            category: args.category,
          },
        );

        // Pinecone hits are identified by (documentId, chunkKey); everything
        // downstream (hybridRank fusion, batchFetchDocMeta, pickBestContent)
        // is keyed by ragId, because the other two channels below always
        // have been and citations elsewhere depend on that. Resolve once via
        // the crawledChunks row both id schemes already share (schema.ts:
        // ragId + chunkKey on the same row) rather than rekeying established
        // call sites. text comes back in the same call - see denseHitContent
        // above for why it's needed.
        const resolved = await ctx.runQuery(
          internal.knowledgeStore.convexQueries.getRagIdAndTextByChunkRefs,
          { refs: denseHits.map((h) => ({ documentId: h.documentId, chunkKey: h.chunkKey })) },
        );

        vectorRanked = denseHits
          .map((h, i) => ({ id: resolved[i]?.ragId ?? null, score: h.score }))
          .filter((r): r is { id: string; score: number } => r.id !== null);

        denseHitContent = resolved
          .map((r) => ({ ragId: r.ragId, text: r.text }))
          .filter((r): r is { ragId: string; text: string } => r.ragId !== null && r.text !== null)
          .map((r) => ({ ragId: r.ragId, text: r.text, score: 0 }));

        if (vectorRanked.length < denseHits.length) {
          // A Pinecone vector with no matching crawledChunks row: the two
          // backends have diverged (a stale/orphaned vector). Surfaced, not
          // silently dropped-and-forgotten - see compositeStore.ts's own
          // stats()/verifyIntegrity() rationale for why divergence should
          // never be averaged away.
          console.warn("[SEARCH] Pinecone dense channel: some hits had no matching ragId", {
            denseHits: denseHits.length,
            resolved: vectorRanked.length,
          });
        }

        // A block of text repeated across several overlapping chunk windows
        // (observed: a page's nav/footer link list, chunked 5 near-identical
        // ways) can consume most of a fixed-size dense window with the same
        // content, crowding out that page's actual distinct chunks - and any
        // other document's chunks - out of the searchLimit-sized candidate
        // pool entirely. denseHits arrives score-sorted from Pinecone, so
        // keeping the first (highest-scoring) occurrence per exact chunk
        // text is correct.
        const textByRagId = new Map(denseHitContent.map((h) => [h.ragId, h.text]));
        const seenChunkText = new Set<string>();
        const beforeDedup = vectorRanked.length;
        vectorRanked = vectorRanked.filter((r) => {
          const text = textByRagId.get(r.id);
          if (text === undefined) return true;
          if (seenChunkText.has(text)) return false;
          seenChunkText.add(text);
          return true;
        });
        if (vectorRanked.length < beforeDedup) {
          console.log("[SEARCH] Pinecone dense channel: collapsed duplicate-content chunks", {
            before: beforeDedup,
            after: vectorRanked.length,
          });
        }
      }
    } else {
      vectorRes = await rag.search(ctx, {
        namespace: "uet-global",
        query: args.queryEmbedding ?? finalQueryText,
        limit: searchLimit,
        chunkContext: { before: 0, after: 0 },
        ...(args.category ? { filters: [{ name: "category", value: args.category }] } : {}),
      });

      vectorRanked = vectorRes.results.map((r: VectorSearchResult) => ({
        id: r.entryId,
        score: r.score ?? 0,
      }));
    }

    // Lexical channels search the keyword query, never the HyDE paragraph. HyDE is a
    // dense-retrieval technique; as a BM25 query a 3-5 sentence hypothetical answer is
    // mostly generic words, and Convex full-text search only uses 16 terms. Measured on
    // production 2026-09-15: "first merit list display date Fall 2026 UET Taxila
    // admissions" ranked the Schedule.php merit-list chunk #1; a HyDE-style paragraph for
    // the same question did not return it in the top 20 (meeting minutes, IEEE reports).
    const lexicalQueryText = args.queryText;
    const [textResRaw, chunkTextResRaw, chunkContextualizedTextResRaw] = await Promise.all([
      ctx.runQuery(internal.crawl.queries.fullTextSearch, {
        query: lexicalQueryText,
        limit: searchLimit,
      }),
      ctx.runQuery(internal.embeddings.chunkTextSearch.run, {
        query: lexicalQueryText,
        limit: Math.min(20, searchLimit),
      }),
      ctx.runQuery(internal.embeddings.chunkTextSearch.runContextualized, {
        query: lexicalQueryText,
        limit: Math.min(20, searchLimit),
      }),
    ]);

    const textRes = textResRaw as TextSearchResult[];
    const chunkTextRes = chunkTextResRaw as TextSearchResult[];
    const chunkContextualizedTextRes = chunkContextualizedTextResRaw as TextSearchResult[];

    const textRanked = textRes.map((r) => ({ id: r.ragId, score: r.score }));
    const chunkRanked = chunkTextRes.map((r) => ({ id: r.ragId, score: r.score }));
    const chunkContextualizedRanked = chunkContextualizedTextRes.map((r) => ({
      id: r.ragId,
      score: r.score,
    }));

    // 4-way RRF fusion across overfetched candidate pools. The contextualized
    // channel is weighted at half of the already-half-weighted chunk-text
    // channel: it's a new, unevaluated signal covering only whatever fraction
    // of the corpus has been contextualized so far (Phase 4 of the retrieval-
    // pipeline remediation plan) - conservative until real eval data supports
    // raising it.
    const fused = hybridRank(vectorRanked, textRanked, RRF_K, adaptiveWeights, "reciprocal", [
      { results: chunkRanked, weight: adaptiveWeights.text * 0.5 },
      { results: chunkContextualizedRanked, weight: adaptiveWeights.text * 0.25 },
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
      // denseHitContent is a pickBestContent content-lookup fallback ONLY -
      // deliberately concatenated here, after chunkRanked (used for RRF
      // fusion above) was already computed from chunkTextRes alone, so
      // these entries never get a second, duplicate ranking contribution.
      const content = pickBestContent(
        docMeta,
        vectorRes.results as VectorSearchResult[],
        textRes,
        denseHitContent.length > 0 ? [...chunkTextRes, ...denseHitContent] : chunkTextRes,
        item.id,
        chunkContextualizedTextRes,
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
      denseBackend: usePineconeBackend ? "pinecone" : "convex",
      vectorResults: vectorRanked.length,
      textResults: textRes.length,
      fusedResults: fused.length,
      faqResults: faqResults.length,
      finalResults: finalResults.length,
    });

    return finalResults;
  },
});
