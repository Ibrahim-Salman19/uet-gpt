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
    String.raw`<\s*script[\s>]`,  // XSS-in-prompt attempt
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
});

const _api: any = api;
const _internal: any = internal;

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
    // TASK-S03: Scan for injection attempts before any LLM action.
    const safeQuestion = scanForInjection(args.question);

    let intent: string;
    try {
      intent = await ctx.runAction(_api.rag.routing.classifyQueryAction, {
        query: safeQuestion,
      });
    } catch (error) {
      console.error("Intent classification failed, defaulting to 'general':", error);
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
      ctx.runAction(_api.rag.routing.rewriteQueryAction, { query: safeQuestion }),
      ctx.runAction(_api.rag.routing.hydeQueryAction, { query: safeQuestion }),
    ]);

    const rewrittenQueryText =
      rewrittenQuery.status === "fulfilled" ? rewrittenQuery.value : safeQuestion;
    const hydeQueryText = hydeQuery.status === "fulfilled" ? hydeQuery.value : safeQuestion;

    let queryEmbedding: number[];
    try {
      queryEmbedding = await ctx.runAction(_api.embeddings.generate.generate, {
        text: hydeQueryText || rewrittenQueryText || safeQuestion,
      });
    } catch (e) {
      console.error("Failed to generate embedding, falling back to empty vector", e);
      queryEmbedding = [];
    }

    if (queryEmbedding.length > 0) {
      try {
        const cached = await ctx.runAction(_api.cache.get.get, {
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
    }[] = [];
    if (queryEmbedding.length > 0) {
      try {
        searchResults = await ctx.runAction(_api.embeddings.search.searchDocumentsAction, {
          queryText: rewrittenQueryText || safeQuestion,
          queryEmbedding,
          hydeQuery: hydeQueryText,
          limit: 10,
        });
      } catch (e) {
        console.error("Search failed:", e);
      }
    }

    const sources = searchResults.map((r) => ({
      entryId: r.entryId,
      url: r.url,
      title: r.title,
      relevanceScore: r.relevanceScore,
      excerpt: r.content.substring(0, 300),
    }));

    const buildContextRef = _internal.rag.context.buildContext;

    let context = "";
    // TASK-E05: Anti-hallucination confidence tiers based on top retrieval score.
    // Tier 1 (<0.20): refuse  — score too low to be useful; LLM must decline.
    // Tier 2 (0.20–0.40): hedge — LLM must caveat heavily and cite sources.
    // Tier 3 (0.40–0.60): cite  — LLM should explicitly name its sources.
    // Above 0.60: normal — proceed without additional system instruction.
    let confidenceTier: "refuse" | "hedge" | "cite" | "normal" = "normal";

    if (searchResults.length > 0) {
      const topScore = searchResults[0]?.relevanceScore ?? 1.0;

      if      (topScore < 0.20) { confidenceTier = "refuse"; }
      else if (topScore < 0.40) { confidenceTier = "hedge";  }
      else if (topScore < 0.60) { confidenceTier = "cite";   }
      else                      { confidenceTier = "normal"; }

      try {
        context = await ctx.runQuery(buildContextRef, {
          chunks: searchResults.map((r) => ({
            content: r.content,
            relevanceScore: r.relevanceScore,
            url: r.url,
            title: r.title,
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
