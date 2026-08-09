// fallow-ignore-file security-sink
import { v } from "convex/values";
import { internalAction } from "../_generated/server";
import { CASCADE_CONFIG } from "../rag/constants";

// Bound external reranker latency so a hung/slow reranker degrades quickly to
// the next cascade tier (Groq/Cohere) instead of stalling the whole retrieval
// action and burning action compute.
const RERANKER_TIMEOUT_MS = 5_000;

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function computeWordOverlap(query: string, chunk: string): number {
  const queryWords = new Set(
    query
      .toLowerCase()
      .replace(/[^\w\s]/g, "")
      .split(/\s+/)
      .filter(Boolean),
  );
  if (queryWords.size === 0) return 0;

  const chunkWords = new Set(
    chunk
      .toLowerCase()
      .replace(/[^\w\s]/g, "")
      .split(/\s+/)
      .filter(Boolean),
  );
  if (chunkWords.size === 0) return 0;

  let overlap = 0;
  for (const word of queryWords) {
    if (chunkWords.has(word)) overlap++;
  }
  return overlap / queryWords.size;
}

export const cascadeRerank = internalAction({
  args: {
    query: v.string(),
    documents: v.array(v.object({ text: v.string(), id: v.string() })),
    topK: v.optional(v.number()),
  },
  returns: v.array(v.object({ text: v.string(), score: v.number(), index: v.number() })),
  handler: async (ctx, args): Promise<Array<{ text: string; score: number; index: number }>> => {
    const docs = args.documents;
    const topK = args.topK ?? docs.length;
    if (docs.length === 0) return [];

    // ── Tier 1: Word overlap + positional scoring (fast, zero API calls) ──
    const tier1Scored = docs.map((doc, i) => {
      const overlap = computeWordOverlap(args.query, doc.text);
      const positionScore = 1 - i / docs.length;
      const combined =
        CASCADE_CONFIG.overlapWeight * overlap + CASCADE_CONFIG.positionWeight * positionScore;
      return { ...doc, overlap, combined, originalIndex: i };
    });

    // Filter chunks below the word overlap threshold
    const filtered = tier1Scored.filter((d) => d.overlap >= CASCADE_CONFIG.minWordOverlap);
    if (filtered.length === 0) {
      return tier1Scored.slice(0, topK).map((d) => ({
        text: d.text,
        score: d.combined,
        index: d.originalIndex,
      }));
    }

    // Sort filtered by combined score, take top N for Tier 2
    filtered.sort((a, b) => b.combined - a.combined);
    const tier2Candidates = filtered.slice(0, CASCADE_CONFIG.tier2CandidateCount);

    // ── Tier 2: RERANKER_URL cross-encoder ──
    const rerankerUrl = process.env.RERANKER_URL;
    if (rerankerUrl) {
      try {
        const response = await fetchWithTimeout(
          `${rerankerUrl.replace(/\/$/, "")}/rerank`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              query: args.query,
              documents: tier2Candidates.map((d) => d.text),
              top_n: Math.min(topK, tier2Candidates.length),
            }),
          },
          RERANKER_TIMEOUT_MS,
        );

        if (response.ok) {
          type RerankerResult = { index: number; score: number; text: string };
          const results = (await response.json()) as RerankerResult[];
          return results.map((r) => {
            const candidate =
              r.index >= 0 && r.index < tier2Candidates.length
                ? tier2Candidates[r.index]
                : undefined;
            return {
              text: r.text,
              score: r.score,
              index: candidate?.originalIndex ?? r.index,
            };
          });
        }
        console.warn(`RERANKER_URL returned status ${response.status}`);
      } catch (error) {
        console.warn("RERANKER_URL request failed:", error);
      }
    }

    // ── Tier 2b: REMOVED — was a generative-JSON Groq reranker (llama-3.1-8b,
    // dying 2026-08-16). Per Track C design, reranking should use dedicated
    // rerankers, not ask an LLM to manufacture a JSON ranking. The cascade now
    // falls through directly to Cohere (Tier 3) → Tier-1 word-overlap/RRF.
    // The internal.reranking.groqRerank action is retained but unwired.

    // ── Tier 3: Cohere free rerank fallback ──
    const cohereKey = process.env.COHERE_API_KEY;
    if (cohereKey && tier2Candidates.length > 0) {
      try {
        const response = await fetchWithTimeout(
          CASCADE_CONFIG.cohereEndpoint,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${cohereKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: CASCADE_CONFIG.cohereModel,
              query: args.query,
              documents: tier2Candidates.map((d) => d.text),
              top_n: Math.min(topK, tier2Candidates.length),
            }),
          },
          RERANKER_TIMEOUT_MS,
        );

        if (response.ok) {
          type CohereResult = { index: number; relevance_score: number };
          const body = (await response.json()) as { results: CohereResult[] };
          return body.results.map((r) => {
            const candidate =
              r.index >= 0 && r.index < tier2Candidates.length
                ? tier2Candidates[r.index]
                : undefined;
            return {
              text: candidate?.text ?? "",
              score: r.relevance_score,
              index: candidate?.originalIndex ?? r.index,
            };
          });
        }
        console.warn(`Cohere rerank returned status ${response.status}`);
      } catch (error) {
        console.warn("Cohere rerank failed:", error);
      }
    }

    // ── Final fallback: Tier 1 combined scores (use all scored docs if filtered is empty) ──
    const fallbackDocs = filtered.length > 0 ? filtered : tier1Scored;
    return fallbackDocs.slice(0, topK).map((d) => ({
      text: d.text,
      score: d.combined,
      index: d.originalIndex,
    }));
  },
});
