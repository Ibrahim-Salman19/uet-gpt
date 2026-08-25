import { v } from "convex/values";
import { internalAction } from "../_generated/server";

// ────────────────────────────────────────────────────────────────────────────
// Alternative to cascade.ts's RERANKER_URL tier that needs NO Worker
// deployment. RERANKER_URL assumes an HTTP reranker service already exists
// somewhere (a deployed Cloudflare Worker, in
// docs/rag-store-evaluation/cloudflare-workers-ai-2026-08/reranker-worker/);
// that path turned out to need a Cloudflare API token permission
// (Workers Scripts: Edit) beyond what CLOUDFLARE_API_TOKEN was deliberately
// scoped for (Workers AI only, per the least-privilege recommendation when
// that token was created).
//
// This calls Cloudflare's @cf/baai/bge-reranker-base model directly via its
// REST API (verified live, see report.md §6a) using ONLY Workers AI
// permission - no script deployment, no wrangler, no additional grant. It is
// therefore usable immediately, unlike the Worker-adapter path.
//
// Follows groqRerank.ts's exact convention: a real, tested internalAction,
// deliberately left UNWIRED from cascade.ts's live tiers ("The internal
// .reranking.groqRerank action is retained but unwired" - cascade.ts). Wiring
// a new tier into the live retrieval cascade is a production-code activation
// decision that sits behind the mandate's independent-review gate; this file
// makes that decision cheap and safe to make later; it does not make it now.
// ────────────────────────────────────────────────────────────────────────────

const MODEL = "@cf/baai/bge-reranker-base";
const RERANKER_TIMEOUT_MS = 5_000; // matches cascade.ts's own tier timeout

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

export const cloudflareRerank = internalAction({
  args: {
    query: v.string(),
    documents: v.array(v.object({ text: v.string(), id: v.string() })),
    topK: v.optional(v.number()),
  },
  returns: v.array(v.object({ text: v.string(), score: v.number(), index: v.number() })),
  handler: async (_ctx, args): Promise<Array<{ text: string; score: number; index: number }>> => {
    const topK = args.topK ?? args.documents.length;

    // Same graceful-degradation shape as groqRerank.ts: no credentials ->
    // return input order with a decaying score, never throw and break the
    // cascade over a missing optional tier.
    const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
    const apiToken = process.env.CLOUDFLARE_API_TOKEN;
    if (!accountId || !apiToken) {
      return args.documents.slice(0, topK).map((d, i) => ({
        text: d.text,
        score: 1 - i / topK,
        index: i,
      }));
    }

    try {
      const response = await fetchWithTimeout(
        `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${MODEL}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            query: args.query,
            contexts: args.documents.map((d) => ({ text: d.text })),
          }),
        },
        RERANKER_TIMEOUT_MS,
      );

      if (!response.ok) {
        console.warn(`cloudflareRerank: HTTP ${response.status}`);
        throw new Error(`HTTP ${response.status}`);
      }

      const body = (await response.json()) as {
        result?: { response?: Array<{ id: number; score: number }> };
      };
      const scored = body.result?.response;
      if (!Array.isArray(scored)) {
        throw new Error("unexpected response shape");
      }

      return scored
        .filter((r) => Number.isInteger(r.id) && r.id >= 0 && r.id < args.documents.length)
        .sort((a, b) => b.score - a.score)
        .slice(0, topK)
        .map((r) => ({
          text: args.documents[r.id]?.text ?? "",
          score: r.score,
          index: r.id,
        }));
    } catch (error) {
      console.warn("cloudflareRerank failed:", error);
      return args.documents.slice(0, topK).map((d, i) => ({
        text: d.text,
        score: 1 - i / topK,
        index: i,
      }));
    }
  },
});
