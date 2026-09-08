import { v } from "convex/values";
import { internalAction } from "../_generated/server";
import { assertEmbeddingDimension, assertFiniteVector } from "../shared/invariants";

// ────────────────────────────────────────────────────────────────────────────
// Query-time embedding for the Pinecone dense channel (SHIP.md Step 5).
//
// This is deliberately NOT the same embedding path as embeddings/generate.ts
// (Gemini gemini-embedding-2, 768d - EMBEDDING_DIMENSION in ./dimension.ts,
// used by the @convex-dev/rag component / semanticCache and left completely
// unchanged here). It calls Cloudflare Workers AI's @cf/qwen/qwen3-embedding-0.6b
// (1024d) - the SAME model, endpoint, and request shape used to build the
// live corpus's 44,792 Pinecone vectors
// (docs/rag-store-evaluation/cloudflare-workers-ai-2026-08/cf_embed_corpus.py).
// A query embedded anywhere else would not share that vector space and
// dense search would silently return meaningless nearest-neighbors - this
// file exists specifically so query-time and corpus-time embedding stay the
// same model, same dimension, same normalization.
//
// Follows cloudflareRerank.ts's conventions: Bearer auth via
// CLOUDFLARE_ACCOUNT_ID/CLOUDFLARE_API_TOKEN (Workers AI scope only, already
// verified sufficient for inference calls - no Worker deployment needed),
// fetchWithTimeout, and no credentials -> a clean "unavailable" signal rather
// than throwing. Unlike reranking (which has a meaningful score-decay
// fallback), there is no sane fallback vector for a missing embedding - the
// caller (embeddings/search.ts) is expected to skip the dense channel and
// continue with lexical + FAQ results when this returns null, the same
// graceful-degradation shape the hybrid search already has for other
// channels failing individually.
// ────────────────────────────────────────────────────────────────────────────

const MODEL = "@cf/qwen/qwen3-embedding-0.6b";
const DENSE_DIM = 1024;
const EMBED_TIMEOUT_MS = 8_000;

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

export const cloudflareEmbedQuery = internalAction({
  args: {
    text: v.string(),
  },
  returns: v.union(v.array(v.float64()), v.null()),
  handler: async (_ctx, args): Promise<number[] | null> => {
    const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
    const apiToken = process.env.CLOUDFLARE_API_TOKEN;
    if (!accountId || !apiToken) {
      console.warn("cloudflareEmbedQuery: CLOUDFLARE_ACCOUNT_ID/CLOUDFLARE_API_TOKEN not set");
      return null;
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
          // The API takes a batch (`text: string[]`) even for one query -
          // matches cf_embed_corpus.py's request shape exactly.
          body: JSON.stringify({ text: [args.text] }),
        },
        EMBED_TIMEOUT_MS,
      );

      if (!response.ok) {
        console.warn(`cloudflareEmbedQuery: HTTP ${response.status}`);
        return null;
      }

      const body = (await response.json()) as {
        result?: { data?: number[][]; embeddings?: number[][]; vectors?: number[][] };
      };
      const vectors = body.result?.data ?? body.result?.embeddings ?? body.result?.vectors;
      const vector = Array.isArray(vectors) ? vectors[0] : undefined;
      if (!Array.isArray(vector)) {
        console.warn("cloudflareEmbedQuery: unexpected response shape", {
          keys: body.result ? Object.keys(body.result) : [],
        });
        return null;
      }

      // Same invariant checks cf_embed_corpus.py applies before trusting a
      // corpus vector - a silently-wrong query vector is worse than no dense
      // channel at all.
      assertEmbeddingDimension(vector, DENSE_DIM);
      assertFiniteVector(vector);

      return vector;
    } catch (error) {
      console.warn("cloudflareEmbedQuery failed:", error);
      return null;
    }
  },
});
