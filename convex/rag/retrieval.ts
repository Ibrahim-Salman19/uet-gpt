import { ConvexError, v } from "convex/values";
import { api, internal } from "../_generated/api";
import { action } from "../_generated/server";

// TASK-S03: Pre-retrieval query injection scanner.
// Detects prompt injection attempts before any LLM call is made.
// Patterns: same blocklist as PDF metadata sanitizer for consistency.
const INJECTION_RE = new RegExp(
  [
    String.raw`ignore\s+previous\s+instructions?`,
    String.raw`(?:system|role)\s*:`,
    String.raw`\[INST\]`,
    String.raw`<\/s>`,
    String.raw`<\|im_(?:start|end)\|>`,
    String.raw`###\s*[Ii]nstruction`,
    String.raw`<\s*script[\s>]`, // XSS-in-prompt attempt
    String.raw`from\s+now\s+on\s+`,
    String.raw`you\s+are\s+(?:now|an?)\s+`,
    String.raw`disregard\s+`,
    String.raw`override\s+`,
    String.raw`do\s+not\s+follow\s+`,
  ].join("|"),
  "i",
);

/** Max query length in characters (prevents context-flooding attacks) */
const MAX_QUERY_LEN = 2_000;

/**
 * Returns a sanitized version of the query, or throws ConvexError
 * if the query contains an injection attempt or is too long.
 */
function scanForInjection(query: string): string {
  if (!query || typeof query !== "string") {
    throw new ConvexError("Invalid query");
  }
  if (query.length > MAX_QUERY_LEN) {
    throw new ConvexError(
      `Query too long (${query.length} chars). Please limit your question to ${MAX_QUERY_LEN} characters.`,
    );
  }
  if (INJECTION_RE.test(query)) {
    console.warn("[SECURITY] Injection pattern detected in query — request blocked.");
    throw new ConvexError(
      "Your query contains patterns that cannot be processed. Please rephrase your question.",
    );
  }
  return query.trim();
}

const sourceValidator = v.object({
  entryId: v.string(),
  url: v.string(),
  title: v.string(),
  relevanceScore: v.number(),
  excerpt: v.string(),
  headingPath: v.optional(v.array(v.string())),
});

export const retrieveContext = action({
  args: {
    question: v.string(),
  },
  returns: v.object({
    intent: v.string(),
    context: v.string(),
    sources: v.array(sourceValidator),
    cachedResponse: v.union(v.string(), v.null()),
    model: v.optional(v.string()),
    queryEmbedding: v.array(v.float64()),
  }),
  handler: async (ctx, args) => {
    // Break circular type chain through api/internal
    const _a = api as any;
    const _i = internal as any;

    // TASK-S03: Scan for injection attempts before any LLM action.
    const safeQuestion = scanForInjection(args.question);

    let intent: string;
    try {
      intent = await ctx.runAction(_a.rag.routing.classifyQueryAction, {
        query: safeQuestion,
      });
    } catch (error) {
      console.error(
        "Intent classification failed, defaulting to 'general': query text omitted, error:",
        error,
      );
      intent = "general";
    }

    if (intent === "off_topic") {
      return {
        intent,
        context: "",
        sources: [],
        cachedResponse:
          "I am UET GPT, designed to answer questions about UET Taxila. It seems your query is about another topic. How can I help you with UET Taxila admissions, fee structures, departments, or campus life instead?",
        queryEmbedding: [],
      };
    }

    const [rewrittenQuery, hydeQuery] = await Promise.allSettled([
      ctx.runAction(_a.rag.routing.rewriteQueryAction, { query: safeQuestion }),
      ctx.runAction(_a.rag.routing.hydeQueryAction, { query: safeQuestion }),
    ]);

    const rewrittenQueryText =
      rewrittenQuery.status === "fulfilled" ? rewrittenQuery.value : safeQuestion;
    const hydeQueryText = hydeQuery.status === "fulfilled" ? hydeQuery.value : safeQuestion;

    let queryEmbedding: number[];
    try {
      queryEmbedding = await ctx.runAction(_a.embeddings.generate.generate, {
        text: hydeQueryText || rewrittenQueryText || safeQuestion,
      });
    } catch (e) {
      console.error("Failed to generate embedding, falling back to empty vector", e);
      queryEmbedding = [];
    }

    if (queryEmbedding.length > 0) {
      try {
        const cached: {
          response: string;
          sources: Array<{
            entryId: string;
            url: string;
            title: string;
            relevanceScore: number;
            excerpt: string;
          }>;
          model: string;
        } | null = await ctx.runAction(_a.cache.get.get, {
          queryText: safeQuestion,
          queryEmbedding,
        });

        if (cached) {
          console.log("Semantic Cache Hit!");
          return {
            intent,
            context: "",
            sources: cached.sources,
            cachedResponse: cached.response,
            model: cached.model,
            queryEmbedding,
          };
        }
      } catch (e) {
        console.warn("Semantic cache check failed, continuing with search:", e);
      }
    }

    let searchResults: {
      entryId: string;
      url: string;
      title: string;
      relevanceScore: number;
      content: string;
      headingPath?: string[];
    }[] = [];
    if (queryEmbedding.length > 0) {
      try {
        searchResults = await ctx.runAction(_a.embeddings.search.searchDocumentsAction, {
          queryText: rewrittenQueryText || safeQuestion,
          queryEmbedding,
          hydeQuery: hydeQueryText,
          limit: 8,
        });
      } catch (e) {
        console.error(`Search failed for intent ${intent}: query text omitted`, e);
      }
    }

    // TASK-E03: FlashRank reranker (k=8 -> 4).
    // Reranks the top 8 fused candidates from hybrid search into the top 4 most relevant.
    if (searchResults.length > 0) {
      try {
        const reranked = await ctx.runAction(_a.reranking.rerank.rerank, {
          query: rewrittenQueryText || safeQuestion,
          documents: searchResults.map((r) => ({
            id: r.entryId,
            text: r.content,
          })),
          topK: 4,
        });

        searchResults = reranked.map((item: { text: string; score: number; index: number }) => {
          const original = searchResults[item.index];
          if (!original) {
            throw new Error(`Reranker index ${item.index} out of search results bounds`);
          }
          return {
            ...original,
            relevanceScore: item.score,
          };
        });
      } catch (e) {
        console.warn("Reranking failed, using original search fallback sliced to top 4:", e);
        searchResults = searchResults.slice(0, 4);
      }
    }

    const sources = searchResults.map((r) => ({
      entryId: r.entryId,
      url: r.url,
      title: r.title,
      relevanceScore: r.relevanceScore,
      excerpt: r.content.substring(0, 300),
      headingPath: r.headingPath,
    }));

    const buildContextRef = (internal as any).rag.context.buildContext;

    let context = "";
    // TASK-E05: Anti-hallucination confidence tiers based on top retrieval score.
    // Tier 1 (<0.20): refuse  — score too low to be useful; LLM must decline.
    // Tier 2 (0.20–0.40): hedge — LLM must caveat heavily and cite sources.
    // Tier 3 (0.40–0.60): cite  — LLM should explicitly name its sources.
    // Above 0.60: normal — proceed without additional system instruction.
    let confidenceTier: "refuse" | "hedge" | "cite" | "normal" = "normal";

    if (searchResults.length > 0) {
      const topScore = searchResults[0]?.relevanceScore ?? 1.0;

      if (topScore < 0.2) {
        confidenceTier = "refuse";
      } else if (topScore < 0.4) {
        confidenceTier = "hedge";
      } else if (topScore < 0.6) {
        confidenceTier = "cite";
      } else {
        confidenceTier = "normal";
      }

      try {
        context = await ctx.runQuery(buildContextRef, {
          chunks: searchResults.map((r) => ({
            content: r.content,
            relevanceScore: r.relevanceScore,
            url: r.url,
            title: r.title,
            headingPath: r.headingPath,
          })),
          maxTokens: 3000,
        });
      } catch (e) {
        console.error("Context building failed, falling back to raw concatenation:", e);
        context = searchResults.map((r) => r.content).join("\n\n---\n\n");
      }

      // Prepend tier-specific system instruction
      if (confidenceTier === "refuse") {
        context =
          "SYSTEM INSTRUCTION TO AI: The retrieved documents have extremely low relevance " +
          "(score < 0.20) to the user's query. You MUST respond exactly with: " +
          "'I don\\'t have verified information about this — please check uettaxila.edu.pk directly.' " +
          "Do not attempt to guess or hallucinate an answer.\n\n" +
          context;
      } else if (confidenceTier === "hedge") {
        context =
          "SYSTEM INSTRUCTION TO AI: Retrieved documents have low relevance (score 0.20–0.40). " +
          "You MUST prefix your answer with: 'Based on limited information available — ' " +
          "and end with: 'For authoritative details, please verify at uettaxila.edu.pk.' " +
          "Do not present uncertain information as fact.\n\n" +
          context;
      } else if (confidenceTier === "cite") {
        context =
          "SYSTEM INSTRUCTION TO AI: Retrieved documents have moderate relevance (score 0.40–0.60). " +
          "You MUST cite specific sources by name for every factual claim. " +
          "If a claim cannot be attributed to a source, qualify it with 'approximately' or 'generally'.\n\n" +
          context;
      }
    }

    return {
      intent,
      context,
      sources,
      cachedResponse: null,
      queryEmbedding,
    };
  },
});
