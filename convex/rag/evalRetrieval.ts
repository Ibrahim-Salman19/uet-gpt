import { v } from "convex/values";
import { internal } from "../_generated/api";
import { internalAction } from "../_generated/server";

// Controlled evaluation entry point for the retrieval-baseline remediation
// (docs/rag-store-evaluation/retrieval-baseline-2026-08/). Reuses the REAL
// production retrieval functions verbatim - internal.embeddings.generate.generate,
// internal.embeddings.search.searchDocumentsAction, internal.reranking.cascade.cascadeRerank
// - rather than reimplementing any of their logic in a second (Python) copy.
// Returns intermediate ranked IDs/scores/metadata; never generates an LLM answer.
//
// Deliberately skips everything upstream of embedding (intent classification,
// query rewriting, HyDE) and everything downstream of Cascade rerank (CRAG's
// Groq LLM judge, answer generation) - both are non-deterministic/LLM-based and
// out of scope for a frozen, rerunnable retrieval-quality baseline. See
// source-of-truth-specification.json for the full pipeline trace and the exact
// reasoning for each excluded stage. The caller supplies the exact text to
// embed and search with (the frozen baseline uses the normalized query text,
// matching production's own scanForInjection()+trim() - see retrieval.ts).
//
// internalAction, not action: this returns raw candidate rankings for a
// caller-supplied query text with no rate limiting, no injection scanning,
// and no per-user auth - not something to leave reachable from the public
// client API. Same posture as knowledgeStore/lifecycleTest.ts. Invoke with:
//   npx convex run rag/evalRetrieval:evalRetrieveDocuments '{"queryText":"..."}'

const rankedCandidateValidator = v.object({
  entryId: v.string(),
  url: v.string(),
  title: v.string(),
  relevanceScore: v.number(),
  freshnessState: v.optional(v.string()),
  applicability: v.optional(v.string()),
  crawledAt: v.optional(v.number()),
  freshnessTier: v.optional(v.string()),
  isStale: v.optional(v.boolean()),
  contentExcerpt: v.string(),
});

export const evalRetrieveDocuments = internalAction({
  args: {
    // Exact text to embed and search with - the caller (the evaluator) is
    // responsible for any normalization; this endpoint does none itself.
    queryText: v.string(),
    // Matches searchVectorDB's real production call site default (limit: 8,
    // convex/rag/retrieval.ts:201).
    limit: v.optional(v.number()),
    // Matches rerankSearchResults' real production call site default
    // (topK: 4, convex/rag/retrieval.ts:225).
    rerankTopK: v.optional(v.number()),
    category: v.optional(v.string()),
  },
  returns: v.object({
    queryEmbeddingDimensions: v.number(),
    baselineAPreRerank: v.array(rankedCandidateValidator),
    baselineBPostRerank: v.array(rankedCandidateValidator),
  }),
  handler: async (ctx, args) => {
    const limit = args.limit ?? 8;
    const rerankTopK = args.rerankTopK ?? 4;

    // Step 4 (source-of-truth-specification.json): embed exactly as
    // production does - same model/dimensions/raw-text request shape,
    // the real embeddings/generate.ts action, unmodified.
    const queryEmbedding: number[] = await ctx.runAction(internal.embeddings.generate.generate, {
      text: args.queryText,
    });

    // Steps 6-15: the real searchDocumentsAction, unmodified. Passing a
    // precomputed queryEmbedding means its own internal HyDE auto-trigger
    // (search.ts's wordCount>15 branch, gated on `!args.queryEmbedding`)
    // never fires, keeping this call deterministic given deterministic input.
    const baselineA = await ctx.runAction(internal.embeddings.search.searchDocumentsAction, {
      queryText: args.queryText,
      queryEmbedding,
      limit,
      category: args.category,
    });

    // Step 16: the real cascadeRerank, unmodified. In this deployment
    // (neither RERANKER_URL nor COHERE_API_KEY configured, verified during
    // this remediation), Cascade falls through to its deterministic Tier-1
    // word-overlap/position scoring - no external network call in the loop.
    const reranked =
      baselineA.length === 0
        ? []
        : await ctx.runAction(internal.reranking.cascade.cascadeRerank, {
            query: args.queryText,
            documents: baselineA.map((r) => ({ id: r.entryId, text: r.content })),
            topK: rerankTopK,
          });

    // Mirrors rerankSearchResults' own index-validation and field-merge
    // exactly (convex/rag/retrieval.ts:228-236).
    const baselineB = reranked
      .filter((item) => item.index >= 0 && item.index < baselineA.length)
      .map((item) => {
        const original = baselineA[item.index]!;
        return { ...original, relevanceScore: item.score };
      });

    const toRankedCandidate = (result: (typeof baselineA)[number]) => ({
      entryId: result.entryId,
      url: result.url,
      title: result.title,
      relevanceScore: result.relevanceScore,
      freshnessState: result.freshnessState,
      applicability: result.applicability,
      crawledAt: result.crawledAt,
      freshnessTier: result.freshnessTier,
      isStale: result.isStale,
      contentExcerpt: result.content.slice(0, 500),
    });

    return {
      queryEmbeddingDimensions: queryEmbedding.length,
      baselineAPreRerank: baselineA.map(toRankedCandidate),
      baselineBPostRerank: baselineB.map(toRankedCandidate),
    };
  },
});
