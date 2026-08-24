/**
 * Cloudflare Worker exposing POST /rerank in EXACTLY the contract that
 * convex/reranking/cascade.ts already expects, backed by
 * @cf/baai/bge-reranker-base on Workers AI.
 *
 * Why an adapter instead of editing cascade.ts: the production retrieval path
 * sits behind the mandate's independent-review gate, and cascade.ts is already
 * correct (tiered, bounded timeout, graceful degradation). Adapting the
 * provider to the existing interface means the only production change is
 * setting the RERANKER_URL env var - no retrieval code is touched, and
 * reverting is a matter of unsetting one variable.
 *
 * Contract expected by cascade.ts (convex/reranking/cascade.ts):
 *   POST {RERANKER_URL}/rerank
 *   body:     { query: string, documents: string[], top_n: number }
 *   response: [{ index: number, score: number, text: string }]
 *             where `index` indexes into the SUBMITTED documents array -
 *             cascade.ts maps it back to originalIndex itself.
 *
 * Cloudflare's native shape differs:
 *   run('@cf/baai/bge-reranker-base', { query, contexts: [{text}] })
 *   -> { response: [{ id, score }] }   (id indexes into contexts)
 *
 * Deploy:  wrangler deploy      (requires an [ai] binding, see wrangler.toml)
 * Then set RERANKER_URL to the deployed worker origin (no trailing /rerank -
 * cascade.ts appends that itself).
 */

const MODEL = "@cf/baai/bge-reranker-base";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/health") {
      return json({ ok: true, model: MODEL });
    }

    if (url.pathname !== "/rerank") {
      return json({ error: "not found" }, 404);
    }
    if (request.method !== "POST") {
      return json({ error: "method not allowed" }, 405);
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return json({ error: "invalid JSON" }, 400);
    }

    const { query, documents, top_n } = body ?? {};
    if (typeof query !== "string" || !query.trim()) {
      return json({ error: "query must be a non-empty string" }, 400);
    }
    if (!Array.isArray(documents) || documents.length === 0) {
      return json({ error: "documents must be a non-empty array" }, 400);
    }
    if (!documents.every((d) => typeof d === "string")) {
      return json({ error: "documents must be an array of strings" }, 400);
    }

    // Clamp rather than reject: cascade.ts already passes
    // min(topK, candidates.length), but a defensive clamp keeps a bad caller
    // from requesting more rows than exist.
    const limit =
      Number.isInteger(top_n) && top_n > 0
        ? Math.min(top_n, documents.length)
        : documents.length;

    let result;
    try {
      result = await env.AI.run(MODEL, {
        query,
        contexts: documents.map((text) => ({ text })),
      });
    } catch (err) {
      // Returning a non-2xx lets cascade.ts fall through to its next tier,
      // which is the correct degradation path - never fabricate a ranking.
      return json({ error: `inference failed: ${err?.message ?? err}` }, 502);
    }

    const scored = result?.response;
    if (!Array.isArray(scored)) {
      return json({ error: "unexpected upstream response shape" }, 502);
    }

    const ranked = scored
      .filter((r) => Number.isInteger(r?.id) && r.id >= 0 && r.id < documents.length)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map((r) => ({
        index: r.id,
        score: r.score,
        text: documents[r.id],
      }));

    return json(ranked);
  },
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });
}
