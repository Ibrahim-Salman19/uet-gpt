import { ConvexError, type Infer, v } from "convex/values";
import { api, internal } from "../_generated/api";
import { action } from "../_generated/server";
import {
  type CandidateEvidenceSummary,
  type EvidenceDecisionInput,
  evaluateEvidenceGate,
} from "../governance/evidenceGate";
import { recordTiming, truncateQuery } from "../observability/metrics";
import { REFUSAL_TEXT } from "../shared/refusal";
import { classifyQueryRisk } from "../shared/freshnessPolicy";
import { isOfficialUrlAllowed } from "../verification/officialSourceVerifier";
import { type ConfidenceTier, CRAG_CONFIG, INJECTION_RE, MAX_QUERY_LEN } from "./constants";

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
    console.warn("[SECURITY] Injection pattern detected in query - request blocked.");
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
  if (results.length === 0) {
    return {
      tier: "refuse",
      instruction:
        "SYSTEM INSTRUCTION TO AI: No relevant information was found for this query. " +
        "Do not state any UET-specific facts, figures, dates, or names. You MUST respond with: " +
        `'${REFUSAL_TEXT}' ` +
        "Do not attempt to guess or hallucinate an answer. " +
        "(If the user is only greeting you or asking what you can help with, reply briefly and politely instead.)\n\n",
    };
  }
  const topScore = results[0]!.relevanceScore;

  if (topScore < 0.2) {
    // We DID retrieve content here (results is non-empty); only the top reranker score
    // is very low. Reranker scores are NOT calibrated across the cascade tiers - the
    // word-overlap fallback and RRF fusion produce low numbers even for genuinely good
    // matches - so a low score does NOT reliably mean "irrelevant". The CRAG relevance
    // judge is the authoritative irrelevance gate (and it is not skipped at low scores).
    // Therefore HEDGE (answer strictly from context, with a strong qualifier) instead of
    // hard-refusing, so the bot stops replying "I don't have verified information" when it
    // actually retrieved relevant context. Only a genuinely EMPTY retrieval refuses (above).
    return {
      tier: "hedge",
      instruction:
        "SYSTEM INSTRUCTION TO AI: The retrieved documents have low confidence scores. " +
        "Answer ONLY from the provided context. Prefix your answer with " +
        "'Based on limited information available - ' and end with " +
        "'For authoritative details, please verify at uettaxila.edu.pk.' " +
        "If the provided context genuinely does not contain the answer, respond exactly with: " +
        `'${REFUSAL_TEXT}' ` +
        "Never invent facts beyond the provided context.\n\n",
    };
  }
  if (topScore < 0.4) {
    return {
      tier: "hedge",
      instruction:
        "SYSTEM INSTRUCTION TO AI: Retrieved documents have low relevance (score 0.20–0.40). " +
        "You MUST prefix your answer with: 'Based on limited information available - ' " +
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
        "If a claim cannot be attributed to a source, leave it out rather than hedging it.\n\n",
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

async function classifyUserIntent(ctx: any, internals: any, safeQuestion: string): Promise<string> {
  try {
    return await ctx.runAction(internals.rag.routing.classifyQueryAction, {
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
  internals: any,
  safeQuestion: string,
): Promise<{ rewrittenQuery: string; hydeQuery: string }> {
  const [rewrittenQuery, hydeQuery] = await Promise.allSettled([
    ctx.runAction(internals.rag.routing.rewriteQueryAction, { query: safeQuestion }),
    ctx.runAction(internals.rag.routing.hydeQueryAction, { query: safeQuestion }),
  ]);

  return {
    rewrittenQuery: rewrittenQuery.status === "fulfilled" ? rewrittenQuery.value : safeQuestion,
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
    const res = await ctx.runAction(actions.embeddings.generate.generate, {
      text: hydeQuery || rewrittenQuery || safeQuestion,
    });
    if (!res || !Array.isArray(res)) {
      throw new Error("Embedding generation returned invalid response shape");
    }
    return res;
  } catch (e) {
    console.error("Failed to generate embedding", e);
    throw new Error("Failed to generate embedding for the query. Cannot proceed with retrieval.");
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
  // Present on results from searchDocumentsAction (embeddings/search.ts computes
  // these per-candidate via shared/freshnessPolicy.ts) but not declared on that
  // action's TS-checked return type here, so treat as loose/untrusted strings.
  freshnessState?: string;
  applicability?: string;
  crawledAt?: number;
  freshnessTier?: string;
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
      questionText: safeQuestion,
      limit: 8,
    });
  } catch (e) {
    console.error(`Search failed for intent ${intent}: query text omitted`, e);
    return [];
  }
}

async function rerankSearchResults(
  ctx: any,
  internals: any,
  rewrittenQuery: string,
  safeQuestion: string,
  results: SearchResult[],
): Promise<SearchResult[]> {
  if (results.length === 0) return [];

  try {
    const reranked = await ctx.runAction(internals.reranking.cascade.cascadeRerank, {
      query: rewrittenQuery || safeQuestion,
      documents: results.map((r) => ({
        id: r.entryId,
        text: r.content,
      })),
      topK: 4,
    });

    return reranked
      .filter(
        (item: { text: string; score: number; index: number }) =>
          item.index >= 0 && item.index < results.length,
      )
      .map((item: { text: string; score: number; index: number }) => {
        const original = results[item.index];
        return { ...original, relevanceScore: item.score };
      });
  } catch (e) {
    console.warn("Cascade reranking failed, using original search fallback sliced to top 4:", e);
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

function narrowFreshnessState(value: string | undefined): "fresh" | "aged" | "unknown" {
  return value === "fresh" || value === "aged" ? value : "unknown";
}

function narrowApplicability(
  value: string | undefined,
): "current" | "historical" | "session_specific" | "expired" | "timeless" | "unknown" {
  // The live pipeline only ever produces "current" | "unknown" today
  // (embeddings/search.ts); the other literals exist on the shared
  // Applicability type but have no current producer.
  return value === "current" ? "current" : "unknown";
}

/**
 * Pure mapping from a live query + search results onto evaluateEvidenceGate's
 * input shape. Extracted from runEvidenceGateShadow so the mapping itself -
 * the part with real risk of being wrong (see that function's docstring) - is
 * directly unit-testable without mocking a Convex ctx. See
 * tests/unit/evidence-gate-shadow-mapping.test.ts.
 */
export function buildEvidenceGateInput(
  safeQuestion: string,
  finalResults: SearchResult[],
): EvidenceDecisionInput {
  const risk = classifyQueryRisk(safeQuestion);
  const queryRisk: EvidenceDecisionInput["queryRisk"] =
    risk === "high" ? "high_current" : risk === "medium" ? "medium_current" : "low_current";
  const temporalIntent: EvidenceDecisionInput["temporalIntent"] =
    risk === "low" ? "unknown" : "current";

  const candidates: CandidateEvidenceSummary[] = finalResults.map((r) => ({
    id: r.entryId,
    authority: isOfficialUrlAllowed(r.url) ? "official_primary" : "unknown",
    freshnessState: narrowFreshnessState(r.freshnessState),
    applicability: narrowApplicability(r.applicability),
  }));

  return { queryRisk, temporalIntent, candidates };
}

/**
 * SHADOW MODE ONLY (retrieval-pipeline remediation plan, Phase 3): computes what
 * evaluateEvidenceGate WOULD decide for this query and logs it via the existing
 * observability pipeline. Deliberately never reads its return value into the
 * response - do not wire this into `context`/`sources`/`cragTier` until the
 * shadow-mode review bar in the plan (200 queries / one week, checked against
 * high_current queries specifically) has been reviewed.
 *
 * queryRisk/temporalIntent are approximations: classifyQueryRisk only has a
 * 3-value "high"|"medium"|"low" scale (mapped 1:1 onto evidenceGate's
 * "*_current" values below), and temporalIntent has no live producer at all
 * (the only source, routing/understandQuery.ts, is dormant/retired) - it's
 * defaulted to "current" for high/medium risk since evaluateEvidenceGate only
 * consults temporalIntent after the high_current branch has already returned.
 * authority is derived from isOfficialUrlAllowed (verification/officialSourceVerifier.ts)
 * since the corpus is crawled exclusively from uettaxila.edu.pk subdomains
 * (scripts/crawl_config.json); sources without a checkable URL (e.g. FAQ
 * entries with no sourceUrl) are conservatively treated as non-primary.
 */
async function runEvidenceGateShadow(
  ctx: any,
  safeQuestion: string,
  finalResults: SearchResult[],
): Promise<void> {
  try {
    const verdict = evaluateEvidenceGate(buildEvidenceGateInput(safeQuestion, finalResults));

    await ctx.runMutation(api.observability.events.logOperationalEvent, {
      event: "evidence_gate_shadow_verdict",
      reason: verdict.reasonCode,
      queryRisk: verdict.queryRisk,
      eligibleSources: verdict.eligibleSourcesCount,
      freshPrimarySources: verdict.freshPrimarySourcesCount,
      agedSources: verdict.agedSourcesCount,
      unknownFreshnessSources: verdict.unknownFreshnessSourcesCount,
      metadataJson: JSON.stringify({
        shadowMode: true,
        decision: verdict.decision,
        freshSourcesCount: verdict.freshSourcesCount,
        currentApplicabilityConfirmed: verdict.currentApplicabilityConfirmed,
        temporalIntent: verdict.temporalIntent,
      }),
    });
  } catch (e) {
    console.warn("[EVIDENCE_GATE_SHADOW] failed, response unaffected:", e);
  }
}

type CragEval = { index: number; relevant: boolean; confidence: number };

type CragOutcome = {
  finalResults: SearchResult[];
  finalSources: SourceEntry[];
  tier: ConfidenceTier | null;
};

/**
 * Of a set of chunks CRAG rejected outright, the index it was LEAST confident about
 * rejecting, or -1 if there is no such chunk.
 *
 * Used for both no-survivor exits, so the rejections may all be high-confidence
 * (the allIrrelevant case). "Least rejected" is still the best available signal there.
 *
 * Emphatically not index 0. On the query this whole path exists for - "fee structure
 * for BS Software Engineering" - rank 0 is the M.Sc. fee table scoring 0.850, which is
 * exactly what CRAG was force-run to reject. Falling back to the rerank's top hit would
 * hand the answer model a postgraduate fee table as its single source and, under the
 * hedge tier's "answer ONLY from the provided context", get it presented as the BS fee.
 * A confident wrong number is worse than the refusal it replaced.
 */
export function pickLeastRejectedIndex(cragEval: CragEval[], count: number): number {
  let bestIndex = -1;
  let bestConfidence = Number.POSITIVE_INFINITY;
  for (let i = 0; i < count; i++) {
    const verdict = cragEval.find((e) => e.index === i);
    if (!verdict || verdict.relevant) continue;
    if (verdict.confidence < bestConfidence) {
      bestConfidence = verdict.confidence;
      bestIndex = i;
    }
  }
  return bestIndex;
}

/**
 * When CRAG is force-run on a high-impact query (see skipCrag below) and leaves no
 * survivor, keep the least-confidently-rejected chunk under the hedge tier rather than
 * refusing - the judge was invoked to reorder away from a confidently-wrong top hit,
 * not to empty a pool the reranker scored well.
 *
 * This covers BOTH no-survivor exits, including allIrrelevant. A forced run happens
 * only when the reranker already scored the pool at or above skipThreshold, so the
 * pre-CRAG state was "answer this"; letting the judge turn that into a refusal is a
 * strict regression, which is exactly what reached users on 2026-09-18.
 */
function demoteInsteadOfRefuse(results: SearchResult[], cragEval: CragEval[]): CragOutcome {
  const keepIndex = pickLeastRejectedIndex(cragEval, results.length);
  const keep = keepIndex >= 0 ? results[keepIndex] : undefined;
  if (!keep) {
    return { finalResults: [], finalSources: [], tier: "refuse" };
  }
  const kept = [keep];
  console.warn("[RETRIEVAL] Forced CRAG left no survivors - hedging on least-rejected chunk", {
    keptRank: keepIndex + 1,
    keptUrl: kept[0]?.url,
  });
  return { finalResults: kept, finalSources: buildSourcesFromResults(kept), tier: "hedge" };
}

/** CRAG evaluation: uses Groq to judge chunk relevance, adjusts tier. */
async function evaluateWithCrag(
  ctx: any,
  internals: any,
  safeQuestion: string,
  results: SearchResult[],
  neverRefuse = false,
): Promise<{
  finalResults: SearchResult[];
  finalSources: SourceEntry[];
  tier: ConfidenceTier | null;
}> {
  if (results.length === 0) {
    return { finalResults: results, finalSources: [], tier: null };
  }

  const cragEval = await ctx
    .runAction(internals.rag.crag.evaluateChunks, {
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

  const allIrrelevant =
    cragEval.length > 0 &&
    cragEval.every(
      (e: CragEval) => !e.relevant && e.confidence > CRAG_CONFIG.highConfidenceThreshold,
    );
  const someIrrelevant = cragEval.some((e: CragEval) => !e.relevant);

  if (allIrrelevant) {
    // A FORCED run must never refuse. Measured in production 2026-09-18: "What is the
    // fee structure for BS programs?" retrieved 8, reranked to 4 at topRerankScore 0.7
    // - comfortably above skipThreshold, i.e. the exact case that used to skip CRAG and
    // answer correctly - and the forced judge then returned allIrrelevant, giving
    // resultCount 0, sourceCount 0, cragTier 'refuse' and the verbatim refusal string to
    // the user. Forcing the judge is meant to REORDER away from a confidently-wrong top
    // hit, never to withhold an answer the reranker was confident about. An earlier
    // version of this branch exempted itself from neverRefuse on the theory that a
    // uniformly high-confidence rejection is worth honouring; production disproved it.
    //
    // Keep the WHOLE pre-CRAG pool here, not the single least-rejected chunk. When the
    // judge rejects everything it has produced no usable ranking signal, so there is
    // nothing to demote toward and narrowing to one chunk could discard the very chunk
    // that holds the answer. Falling back to the full set is exactly what skipping CRAG
    // would have done - the guarantee being restored is that forcing the judge can never
    // leave the user worse off than not running it - with the hedge tier added so the
    // answer is qualified rather than asserted flatly.
    if (neverRefuse) {
      console.warn("[RETRIEVAL] Forced CRAG rejected every chunk - hedging on the full pool", {
        poolSize: results.length,
      });
      return {
        finalResults: results,
        finalSources: buildSourcesFromResults(results),
        tier: "hedge",
      };
    }
    return { finalResults: [], finalSources: [], tier: "refuse" };
  }

  if (someIrrelevant) {
    const relevantChunks = results.filter((_, i) => {
      const eval_ = cragEval.find((e: CragEval) => e.index === i);
      return eval_ ? eval_.relevant : true;
    });

    if (relevantChunks.length === 0) {
      if (neverRefuse) return demoteInsteadOfRefuse(results, cragEval);
      return {
        finalResults: [],
        finalSources: [],
        tier: "refuse",
      };
    }

    // Few survivors is not low confidence: a fee or deadline usually lives in one
    // chunk. The tier comes from the surviving chunks' scores (determineConfidenceTier).
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
  internals: any,
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
  const reranked = await rerankSearchResults(ctx, internals, rewrittenQuery, safeQuestion, results);
  const sources = buildSourcesFromResults(reranked);
  return { results: reranked, sources };
}

type SourceEntry = Infer<typeof sourceValidator>;

// The confidence-tier directive is returned separately from `context` so the
// chat route can place it in trusted system text. It used to be prepended to
// `context`, which buildSystemPrompt fences as untrusted data the model is told
// never to obey, so every refuse/hedge/cite directive was silently neutralized.
async function buildResponseContext(
  ctx: any,
  internalActions: any,
  searchResults: SearchResult[],
  overrideTier?: ConfidenceTier | null,
): Promise<{ context: string; answerInstruction: string }> {
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
          crawledAt: r.crawledAt,
          freshnessTier: r.freshnessTier,
          freshnessState: r.freshnessState,
          applicability: r.applicability,
        })),
        maxTokens: 3000,
      });
    } catch (e) {
      console.error("Context building failed, falling back to raw concatenation:", e);
      const BUDGET = 3000;
      let total = 0;
      const parts: string[] = [];
      for (const r of searchResults) {
        if (total >= BUDGET) break;
        const remaining = BUDGET - total;
        let truncated = r.content.substring(0, remaining);
        if (truncated.length < r.content.length) {
          const lastSpace = truncated.lastIndexOf(" ");
          if (lastSpace > 0) {
            truncated = truncated.substring(0, lastSpace) + "...";
          }
        }
        parts.push(truncated);
        total += truncated.length;
      }
      context = parts.join("\n\n---\n\n");
    }
  }

  let answerInstruction: string;
  if (overrideTier === "refuse") {
    // CRAG judged the chunks irrelevant - use the genuine empty-retrieval refuse
    // instruction (determineConfidenceTier no longer hard-refuses on a low score alone).
    answerInstruction = determineConfidenceTier([]).instruction;
  } else if (overrideTier === "hedge") {
    answerInstruction = determineConfidenceTier([{ relevanceScore: 0.3 }]).instruction;
  } else {
    answerInstruction = determineConfidenceTier(searchResults).instruction;
  }

  return { context, answerInstruction: answerInstruction.trim() };
}

const MAX_HISTORY_MESSAGES = 6;
const MAX_HISTORY_CHARS_PER_MESSAGE = 1000;

async function resolveStandaloneQuestion(
  ctx: any,
  internals: any,
  question: string,
  history: Array<{ role: "user" | "assistant"; content: string }>,
): Promise<string> {
  const recent = history
    .slice(-MAX_HISTORY_MESSAGES)
    .map((m) => ({ role: m.role, content: m.content.slice(0, MAX_HISTORY_CHARS_PER_MESSAGE) }))
    .filter((m) => m.content.trim().length > 0);
  if (!recent.some((m) => m.role === "user")) return question;

  try {
    const condensed: string = (
      await ctx.runAction(internals.rag.routing.condenseQuestionAction, {
        question,
        history: recent,
      })
    ).trim();
    // The rewrite is model output derived from user-controlled text: hold it to the
    // same checks as the original question, and fall back to the original if it fails.
    if (!condensed || condensed.length > MAX_QUERY_LEN || INJECTION_RE.test(condensed)) {
      return question;
    }
    return condensed;
  } catch (e) {
    console.warn("Question condensing failed, using the original question:", e);
    return question;
  }
}

// ── Exported action ───────────────────────────────────────────────────────

export const retrieveContext = action({
  args: {
    question: v.string(),
    // Prior turns (oldest first, excluding `question`), used only to make a
    // follow-up question standalone before retrieval.
    history: v.optional(
      v.array(
        v.object({
          role: v.union(v.literal("user"), v.literal("assistant")),
          content: v.string(),
        }),
      ),
    ),
  },
  returns: v.object({
    intent: v.string(),
    context: v.string(),
    sources: v.array(sourceValidator),
    cachedResponse: v.union(v.string(), v.null()),
    // Trusted confidence-tier directive for the answer model (empty when none).
    answerInstruction: v.optional(v.string()),
    // The standalone question retrieval actually ran on (a condensed follow-up),
    // so the cache write keys on the same text the cache read used.
    retrievalQuestion: v.optional(v.string()),
    model: v.optional(v.string()),
    queryEmbedding: v.array(v.float64()),
  }),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError("Authentication required for RAG retrieval");
    }

    // Break circular type chain through internal (Convex known pattern).
    // generate/cache.get/search are internalAction, so all sub-actions resolve via `internal`.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const _i: any = internal;

    const timer = recordTiming();
    const safeQuestion = await resolveStandaloneQuestion(
      ctx,
      _i,
      scanForInjection(args.question),
      args.history ?? [],
    );

    console.log("[RETRIEVAL] Query start", {
      query: truncateQuery(safeQuestion),
      timestamp: Date.now(),
    });

    const intent = await classifyUserIntent(ctx, _i, safeQuestion);
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

    const { rewrittenQuery, hydeQuery } = await enrichQuery(ctx, _i, safeQuestion);

    // Generate cache embedding deterministically (ignoring HyDE)
    let cacheEmbedding: number[] = [];
    try {
      cacheEmbedding = await generateQueryEmbedding(ctx, _i, "", rewrittenQuery, safeQuestion);
    } catch (e) {
      console.warn("Failed to generate cache embedding:", e);
    }

    const cached = await checkSemanticCache(ctx, _i, safeQuestion, cacheEmbedding);
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
        queryEmbedding: cacheEmbedding,
      };
    }

    // Cache miss, now generate full query embedding with HyDE
    let queryEmbedding: number[] = [];
    try {
      queryEmbedding = await generateQueryEmbedding(
        ctx,
        _i,
        hydeQuery,
        rewrittenQuery,
        safeQuestion,
      );
    } catch (e) {
      console.warn("Failed to generate search embedding:", e);
    }

    console.log("[RETRIEVAL] Cache miss, searching", {
      query: truncateQuery(safeQuestion),
      latencyMs: timer.lap("cache_miss"),
      intent,
    });

    const { results } = await searchAndRerank(
      ctx,
      _i,
      _i,
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

    // Skip the (expensive, often redundant) CRAG LLM judge when the reranker is
    // already confident: if the top reranked score is at/above the "normal"
    // tier threshold, trust the rerank ordering and reserve CRAG for
    // borderline/low-confidence retrievals. Saves a Groq call per query on the
    // common high-confidence path.
    // ...except for high-impact queries. A confidently-wrong top hit scores just as
    // high as a right one: "fee structure for BS Software Engineering" ranks the M.Sc.
    // and Ph.D. fee tables at 0.850/0.800 and the undergraduate answer last at 0.550,
    // and because 0.850 clears skipThreshold the only component that could notice the
    // degree-level mismatch never runs. The tier then resolves to "normal" with an
    // empty instruction, so nothing hedges either. For fees, deadlines and merit the
    // judge is worth the LLM call on every query; demoteInsteadOfRefuse keeps that
    // extra run from opening a new path to the refusal string.
    const topRerankScore = results[0]?.relevanceScore ?? 0;
    const forceCrag = classifyQueryRisk(safeQuestion) === "high";
    const skipCrag =
      !forceCrag && results.length > 0 && topRerankScore >= CRAG_CONFIG.skipThreshold;

    const {
      finalResults,
      finalSources,
      tier: cragTier,
    } = skipCrag
      ? {
          finalResults: results,
          finalSources: buildSourcesFromResults(results),
          tier: null as ConfidenceTier | null,
        }
      : await evaluateWithCrag(ctx, _i, safeQuestion, results, forceCrag);

    if (skipCrag) {
      console.log("[RETRIEVAL] CRAG skipped (high-confidence rerank)", {
        query: truncateQuery(safeQuestion),
        topRerankScore,
      });
    } else if (forceCrag && topRerankScore >= CRAG_CONFIG.skipThreshold) {
      // Logged separately from the ordinary low-score path: this is the branch that
      // spends an LLM call the old threshold would have saved, so its real frequency
      // is what to measure if quota pressure ever shows up.
      console.log("[RETRIEVAL] CRAG forced (high-impact query above skipThreshold)", {
        query: truncateQuery(safeQuestion),
        topRerankScore,
      });
    }

    // Shadow mode: computes and logs what evaluateEvidenceGate would decide,
    // never affects context/sources/response. See runEvidenceGateShadow's
    // docstring and the retrieval-pipeline remediation plan, Phase 3.
    await runEvidenceGateShadow(ctx, safeQuestion, finalResults);

    const { context, answerInstruction } = await buildResponseContext(
      ctx,
      _i,
      finalResults,
      cragTier,
    );

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
      answerInstruction,
      sources: finalSources,
      cachedResponse: null,
      retrievalQuestion: safeQuestion,
      // Cache writes must use the same key space as cache reads: the HyDE-free
      // rewrite embedding, not the HyDE search embedding (a different vector).
      queryEmbedding: cacheEmbedding,
    };
  },
});
