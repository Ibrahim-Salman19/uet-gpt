import { ConvexError, v, Infer } from "convex/values";
import { api, internal } from "../_generated/api";
import { action } from "../_generated/server";
import { truncateQuery, recordTiming } from "../observability/metrics";
import {
  type ConfidenceTier,
  INJECTION_RE,
  MAX_QUERY_LEN,
  CRAG_CONFIG,
} from "./constants";

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

function determineConfidenceTier(results: { relevanceScore: number }[]): {
  tier: ConfidenceTier;
  instruction: string;
} {
  if (results.length === 0) return { tier: "normal", instruction: "" };
  const topScore = results[0]!.relevanceScore;

  if (topScore < 0.2) {
    return {
      tier: "refuse",
      instruction:
        "SYSTEM INSTRUCTION TO AI: The retrieved documents have extremely low relevance " +
        "(score < 0.20) to the user's query. You MUST respond exactly with: " +
        "'I don't have verified information about this — please check uettaxila.edu.pk directly.' " +
        "Do not attempt to guess or hallucinate an answer.\n\n",
    };
  }
  if (topScore < 0.4) {
    return {
      tier: "hedge",
      instruction:
        "SYSTEM INSTRUCTION TO AI: Retrieved documents have low relevance (score 0.20–0.40). " +
        "You MUST prefix your answer with: 'Based on limited information available — ' " +
        "and end with: 'For authoritative details, please verify at uettaxila.edu.pk.' " +
        "Do not present uncertain information as fact.\n\n",
    };
  }
  if (topScore < 0.6) {
    return {
      tier: "cite",
      instruction:
        "SYSTEM INSTRUCTION TO AI: Retrieved documents have moderate relevance (score 0.40–0.60). " +
        "You MUST cite specific sources by name for every factual claim. " +
        "If a claim cannot be attributed to a source, qualify it with 'approximately' or 'generally'.\n\n",
    };
  }
  return { tier: "normal", instruction: "" };
}

const sourceValidator = v.object({
  entryId: v.string(),
  url: v.string(),
  title: v.string(),
  relevanceScore: v.number(),
  excerpt: v.string(),
  headingPath: v.optional(v.array(v.string())),
});

async function classifyUserIntent(
  ctx: any,
  actions: any,
  safeQuestion: string,
): Promise<string> {
  try {
    return await ctx.runAction(actions.rag.routing.classifyQueryAction, {
      query: safeQuestion,
    });
  } catch (error) {
    console.error(
      "Intent classification failed, defaulting to 'general': query text omitted, error:",
      error,
    );
    return "general";
  }
}

async function enrichQuery(
  ctx: any,
  actions: any,
  safeQuestion: string,
): Promise<{ rewrittenQuery: string; hydeQuery: string }> {
  const [rewrittenQuery, hydeQuery] = await Promise.allSettled([
    ctx.runAction(actions.rag.routing.rewriteQueryAction, { query: safeQuestion }),
    ctx.runAction(actions.rag.routing.hydeQueryAction, { query: safeQuestion }),
  ]);

  return {
    rewrittenQuery:
      rewrittenQuery.status === "fulfilled" ? rewrittenQuery.value : safeQuestion,
    hydeQuery: hydeQuery.status === "fulfilled" ? hydeQuery.value : safeQuestion,
  };
}

async function generateQueryEmbedding(
  ctx: any,
  actions: any,
  hydeQuery: string,
  rewrittenQuery: string,
  safeQuestion: string,
): Promise<number[]> {
  try {
    return await ctx.runAction(actions.embeddings.generate.generate, {
      text: hydeQuery || rewrittenQuery || safeQuestion,
    });
  } catch (e) {
    console.error("Failed to generate embedding, falling back to empty vector", e);
    return [];
  }
}

async function checkSemanticCache(
  ctx: any,
  actions: any,
  safeQuestion: string,
  queryEmbedding: number[],
): Promise<{
  response: string;
  sources: Array<{
    entryId: string;
    url: string;
    title: string;
    relevanceScore: number;
    excerpt: string;
  }>;
  model: string;
} | null> {
  if (queryEmbedding.length === 0) return null;

  try {
    const cached = await ctx.runAction(actions.cache.get.get, {
      queryText: safeQuestion,
      queryEmbedding,
    });

    if (cached) return cached;
  } catch (e) {
    console.warn("Semantic cache check failed, continuing with search:", e);
  }

  return null;
}

type SearchResult = {
  entryId: string;
  url: string;
  title: string;
  relevanceScore: number;
  content: string;
  headingPath?: string[];
};

async function searchVectorDB(
  ctx: any,
  actions: any,
  queryEmbedding: number[],
  rewrittenQuery: string,
  safeQuestion: string,
  hydeQuery: string,
  intent: string,
): Promise<SearchResult[]> {
  if (queryEmbedding.length === 0) return [];

  try {
    return await ctx.runAction(actions.embeddings.search.searchDocumentsAction, {
      queryText: rewrittenQuery || safeQuestion,
      queryEmbedding,
      hydeQuery: hydeQuery,
      limit: 8,
    });
  } catch (e) {
    console.error(`Search failed for intent ${intent}: query text omitted`, e);
    return [];
  }
}

async function rerankSearchResults(
  ctx: any,
  actions: any,
  rewrittenQuery: string,
  safeQuestion: string,
  results: SearchResult[],
): Promise<SearchResult[]> {
  if (results.length === 0) return [];

  try {
    const reranked = await ctx.runAction(actions.reranking.cascade.cascadeRerank, {
      query: rewrittenQuery || safeQuestion,
      documents: results.map((r) => ({
        id: r.entryId,
        text: r.content,
      })),
      topK: 4,
    });

    return reranked.map(
      (item: { text: string; score: number; index: number }) => {
        const original = results[item.index];
        return { ...original, relevanceScore: item.score };
      },
    );
  } catch (e) {
    console.warn(
      "Cascade reranking failed, using original search fallback sliced to top 4:",
      e,
    );
    return results.slice(0, 4);
  }
}

function buildSourcesFromResults(results: SearchResult[]): SourceEntry[] {
  return results.map((r) => ({
    entryId: r.entryId,
    url: r.url,
    title: r.title,
    relevanceScore: r.relevanceScore,
    excerpt: r.content.substring(0, 300),
    headingPath: r.headingPath,
  }));
}

type CragEval = { index: number; relevant: boolean; confidence: number };

/** CRAG evaluation: uses Groq to judge chunk relevance, adjusts tier. */
async function evaluateWithCrag(
  ctx: any,
  actions: any,
  safeQuestion: string,
  results: SearchResult[],
): Promise<{
  finalResults: SearchResult[];
  finalSources: SourceEntry[];
  tier: ConfidenceTier | null;
}> {
  if (results.length === 0) {
    return { finalResults: results, finalSources: [], tier: null };
  }

  const cragEval = await ctx
    .runAction(actions.rag.crag.evaluateChunks, {
      query: safeQuestion,
      chunks: results.map((r, i) => ({ text: r.content, index: i })),
    })
    .catch((e: Error) => {
      console.warn("CRAG evaluation failed, continuing without:", e);
      return null;
    });

  if (!cragEval) {
    return {
      finalResults: results,
      finalSources: buildSourcesFromResults(results),
      tier: null,
    };
  }

  const allIrrelevant = cragEval.every(
    (e: CragEval) => !e.relevant && e.confidence > CRAG_CONFIG.highConfidenceThreshold,
  );
  const someIrrelevant = cragEval.some((e: CragEval) => !e.relevant);

  if (allIrrelevant) {
    return { finalResults: [], finalSources: [], tier: "refuse" };
  }

  if (someIrrelevant) {
    const relevantChunks = results.filter((_, i) => {
      const eval_ = cragEval.find((e: CragEval) => e.index === i);
      return eval_ ? eval_.relevant : true;
    });

    if (relevantChunks.length <= 2) {
      return {
        finalResults: relevantChunks,
        finalSources: buildSourcesFromResults(relevantChunks),
        tier: "hedge",
      };
    }

    return {
      finalResults: relevantChunks,
      finalSources: buildSourcesFromResults(relevantChunks),
      tier: null,
    };
  }

  return {
    finalResults: results,
    finalSources: buildSourcesFromResults(results),
    tier: null,
  };
}

async function searchAndRerank(
  ctx: any,
  actions: any,
  queryEmbedding: number[],
  rewrittenQuery: string,
  safeQuestion: string,
  hydeQuery: string,
  intent: string,
): Promise<{ results: SearchResult[]; sources: SourceEntry[] }> {
  const results = await searchVectorDB(
    ctx,
    actions,
    queryEmbedding,
    rewrittenQuery,
    safeQuestion,
    hydeQuery,
    intent,
  );
  const reranked = await rerankSearchResults(
    ctx,
    actions,
    rewrittenQuery,
    safeQuestion,
    results,
  );
  const sources = buildSourcesFromResults(reranked);
  return { results: reranked, sources };
}

type SourceEntry = Infer<typeof sourceValidator>;

async function buildResponseContext(
  ctx: any,
  internalActions: any,
  searchResults: SearchResult[],
  overrideTier?: ConfidenceTier | null,
): Promise<string> {
  let context: string;

  if (searchResults.length === 0) {
    context = "";
  } else {
    try {
      context = await ctx.runQuery(internalActions.rag.context.buildContext, {
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
      console.error(
        "Context building failed, falling back to raw concatenation:",
        e,
      );
      context = searchResults.map((r) => r.content).join("\n\n---\n\n");
    }
  }

  if (overrideTier === "refuse") {
    const { instruction } = determineConfidenceTier([{ relevanceScore: 0.1 }]);
    if (instruction) context = instruction + context;
  } else if (overrideTier === "hedge") {
    const { instruction } = determineConfidenceTier([{ relevanceScore: 0.3 }]);
    if (instruction) context = instruction + context;
  } else {
    const { instruction } = determineConfidenceTier(searchResults);
    if (instruction) context = instruction + context;
  }

  return context;
}

// ── Exported action ───────────────────────────────────────────────────────

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
    // Break circular type chain through api/internal (Convex known pattern)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const _a: any = api;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const _i: any = internal;

    const timer = recordTiming();
    const safeQuestion = scanForInjection(args.question);

    console.log("[RETRIEVAL] Query start", {
      query: truncateQuery(safeQuestion),
      timestamp: Date.now(),
    });

    const intent = await classifyUserIntent(ctx, _a, safeQuestion);
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

    const { rewrittenQuery, hydeQuery } = await enrichQuery(ctx, _a, safeQuestion);
    const queryEmbedding = await generateQueryEmbedding(
      ctx,
      _a,
      hydeQuery,
      rewrittenQuery,
      safeQuestion,
    );

    const cached = await checkSemanticCache(ctx, _a, safeQuestion, queryEmbedding);
    if (cached) {
      console.log("[RETRIEVAL] Cache hit", {
        query: truncateQuery(safeQuestion),
        latencyMs: timer.lap("cache_hit"),
        model: cached.model,
      });
      return {
        intent,
        context: "",
        sources: cached.sources,
        cachedResponse: cached.response,
        model: cached.model,
        queryEmbedding,
      };
    }

    console.log("[RETRIEVAL] Cache miss, searching", {
      query: truncateQuery(safeQuestion),
      latencyMs: timer.lap("cache_miss"),
      intent,
    });

    const { results, sources } = await searchAndRerank(
      ctx,
      _a,
      queryEmbedding,
      rewrittenQuery,
      safeQuestion,
      hydeQuery,
      intent,
    );

    const retrievalLatency = timer.lap("retrieval");

    console.log("[RETRIEVAL] Search complete", {
      query: truncateQuery(safeQuestion),
      resultCount: results.length,
      retrievalLatencyMs: retrievalLatency,
    });

    const { finalResults, finalSources, tier: cragTier } =
      await evaluateWithCrag(ctx, _a, safeQuestion, results);

    const context = await buildResponseContext(ctx, _i, finalResults, cragTier);

    const totalLatency = timer.end();
    console.log("[RETRIEVAL] Query complete", {
      query: truncateQuery(safeQuestion),
      totalLatencyMs: totalLatency,
      resultCount: finalResults.length,
      sourceCount: finalSources.length,
      cragTier,
    });

    return {
      intent,
      context,
      sources: finalSources,
      cachedResponse: null,
      queryEmbedding,
    };
  },
});
