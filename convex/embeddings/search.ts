import { v } from "convex/values";
import { api, internal } from "../_generated/api";
import { action } from "../_generated/server";
import { rag } from "../rag/instance";

function reciprocalRankFusion(
  vectorResults: Array<{ id: string; score: number }>,
  textResults: Array<{ id: string; score: number }>,
  k = 10,
  weights = { vector: 1.0, text: 1.0 },
): Array<{ id: string; score: number }> {
  const scores = new Map<string, number>();

  vectorResults.forEach((res, rank) => {
    scores.set(res.id, (scores.get(res.id) ?? 0) + weights.vector / (k + rank));
  });

  textResults.forEach((res, rank) => {
    scores.set(res.id, (scores.get(res.id) ?? 0) + weights.text / (k + rank));
  });

  return Array.from(scores.entries())
    .map(([id, score]) => ({ id, score }))
    .sort((a, b) => b.score - a.score);
}

const _api: any = api;
const getDocumentRef = internal.embeddings.doc_queries.getDocumentByEntryId;

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
    }),
  ),
  handler: async (
    ctx,
    args,
  ): Promise<
    Array<{ entryId: string; content: string; url: string; title: string; relevanceScore: number }>
  > => {
    const limit = args.limit ?? 8; // Default to 8

    let finalQueryText = args.queryText;
    if (args.hydeQuery) {
      finalQueryText = args.hydeQuery;
    } else if (!args.queryEmbedding && typeof args.queryText === "string") {
      // Consolidated HyDE: call primary action routing
      try {
        const hydeEnhanced = await ctx.runAction(_api.rag.routing.hydeQueryAction, {
          query: args.queryText,
        });
        finalQueryText = hydeEnhanced;
      } catch (err) {
        console.warn("HyDE routing action failed:", err);
      }
    }

    const searchArgs: {
      namespace: string;
      query: string | Array<number>;
      limit: number;
      chunkContext?: { before: number; after: number };
      filters?: Array<{ name: string; value: string }>;
    } = {
      namespace: "uet-global",
      query: args.queryEmbedding ?? args.queryText,
      limit: 40, // Fetch more for fusion (overfetch increased to 40 for RRF list overlap)
      chunkContext: { before: 2, after: 1 },
    };

    if (args.category) {
      searchArgs.filters = [{ name: "category", value: args.category }];
    }

    const vectorSearchP = rag.search(ctx, searchArgs);
    const textSearchP = ctx.runQuery(internal.crawl.queries.fullTextSearch, {
      query: finalQueryText,
      limit: 40, // Fetch more for fusion (overfetch increased to 40)
    });

    const [vectorRes, textResRaw] = await Promise.all([vectorSearchP, textSearchP]);
    const textRes = textResRaw as Array<{
      ragId: string;
      text: string;
      url: string;
      score: number;
    }>;

    const fused = reciprocalRankFusion(
      vectorRes.results.map((r: any) => ({ id: r.entryId, score: r.score ?? 0 })),
      textRes.map((r: any) => ({ id: r.ragId, score: r.score })),
      60,
      { vector: 1.0, text: 1.0 },
    ).slice(0, limit);

    // Batch-fetch document metadata
    const docLookups = await Promise.all(
      fused.map(async (item: any) => {
        const doc = await ctx.runQuery(getDocumentRef, {
          entryId: item.id,
        });
        return { entryId: item.id, doc };
      }),
    );

    const docMap = new Map<
      string,
      { url: string; title: string; crawledAt: number; freshnessTier: string }
    >();
    for (const { entryId, doc } of docLookups) {
      if (doc) {
        docMap.set(entryId, {
          url: doc.url,
          title: doc.title,
          crawledAt: doc.crawledAt,
          freshnessTier: doc.freshnessTier ?? "medium",
        });
      }
    }

    const enrichedResults = fused.map((item: any) => {
      const docMeta = docMap.get(item.id);
      let content = "";

      const vecMatch = vectorRes.results.find((r: any) => r.entryId === item.id);
      const textMatch = textRes.find((r: any) => r.ragId === item.id);

      if (vecMatch) {
        content = vecMatch.content.map((c: any) => c.text).join("\n");
      } else if (textMatch) {
        content = textMatch.text;
      }

      let score = item.score;
      if (docMeta) {
        const daysSinceCrawled = (Date.now() - docMeta.crawledAt) / (1000 * 60 * 60 * 24);
        let lambda = 0.0077; // medium
        if (docMeta.freshnessTier === "high") lambda = 0.023;
        if (docMeta.freshnessTier === "low") lambda = 0.0039;
        // TASK-B04: Floor at 0.20 — old docs stay visible when they are the best match.
        const decay = Math.max(0.20, Math.exp(-lambda * daysSinceCrawled));
        score = score * decay;
      }

      return {
        entryId: item.id,
        content,
        url: docMeta?.url ?? "",
        title: docMeta?.title ?? "",
        relevanceScore: score,
      };
    });

    const sortedEnriched = enrichedResults.sort(
      (a: any, b: any) => b.relevanceScore - a.relevanceScore,
    );

    // Search FAQs (Tier 1 Retriever)
    const faqs = await ctx.runQuery(api.faq.searchFaqs, { query: args.queryText });
    const now = Date.now();
    const activeFaqs = faqs.filter((f: any) => !f.expiresAt || f.expiresAt > now);

    const faqResults = activeFaqs.map((faq: any) => ({
      entryId: faq._id,
      content: `FAQ: ${faq.question}\nAnswer: ${faq.answer}`,
      url: faq.sourceUrl || "Verified FAQ Database",
      title: faq.question,
      relevanceScore: (faq._score ?? 1.0) * 2.0, // Dynamic FAQ Match Score
    }));

    const combinedResults = [...faqResults, ...sortedEnriched];

    return combinedResults.slice(0, limit).map((r: any) => ({
      entryId: r.entryId,
      content: r.content,
      url: r.url,
      title: r.title,
      relevanceScore: r.relevanceScore,
    }));
  },
});
