// fallow-ignore-file security-sink
"use node";
import { NonRetryableError } from "@convex-dev/workpool";
import { ConvexError, v } from "convex/values";
import { internalAction } from "../_generated/server";
import { recordTiming } from "../observability/metrics";
import { assertEmbeddingDimension, assertFiniteVector } from "../shared/invariants";
import { EMBEDDING_DIMENSION } from "./dimension";

// gemini-embedding-2 - stable as of May 2026
// Dimensions: 768 (MRL supports 768/1536/3072)
// Context: 8192 tokens
// Free tier: ~60 RPM, ~1500 RPD (post-Dec 2025 cuts)
// Paid Tier 1: 3000 RPM, 1M TPM
// Batch API: 50% discount ($0.10/M vs $0.20/M)
// Note: taskType parameter has no effect on gemini-embedding-2 (confirmed bug)
const BATCH_THRESHOLD = 2;

// gemini-embedding-2 context is 8192 tokens. There is no tokenizer in this
// runtime, so cap by characters using a conservative ~3.5 chars/token estimate
// (8192 * 3.5 ≈ 28_672) so typical English/Roman-Urdu text stays under the token
// limit and the tail is not silently dropped by the server. Upstream chunking
// should already keep inputs well under this; the cap is only a safety net.
const MAX_EMBED_CHARS = 28_000;

// Parse a Retry-After header (delta-seconds or HTTP-date) into milliseconds.
// Returns null if absent or unparseable.
function parseRetryAfter(header: string | null): number | null {
  if (!header) return null;
  const seconds = Number(header);
  if (Number.isFinite(seconds)) {
    return Math.max(0, seconds * 1000);
  }
  const dateMs = Date.parse(header);
  if (!Number.isNaN(dateMs)) {
    return Math.max(0, dateMs - Date.now());
  }
  return null;
}

async function fetchWithRetry(
  url: string,
  options: RequestInit,
  maxRetries = 3,
): Promise<Response> {
  const isTest = process.env.NODE_ENV === "test";
  const baseDelayMs = isTest ? 1 : 100;
  const maxDelayMs = isTest ? 50 : 20_000;
  let attempt = 0;
  while (true) {
    attempt++;
    let retryAfterMs: number | null = null;
    try {
      const response = await fetch(url, options);
      if (response.ok) {
        return response;
      }
      const isTransient =
        response.status === 429 || (response.status >= 500 && response.status < 600);
      if (!isTransient || attempt >= maxRetries) {
        return response;
      }
      // Honor the server's Retry-After instruction when present (Gemini returns
      // it on 429/503), capped to avoid pathologically long sleeps.
      retryAfterMs = parseRetryAfter(response.headers.get("retry-after"));
    } catch (err) {
      if (attempt >= maxRetries) {
        throw err;
      }
    }
    let delay: number;
    if (retryAfterMs !== null) {
      delay = Math.min(retryAfterMs, maxDelayMs);
    } else {
      // Capped exponential backoff with jitter.
      const expo = Math.min(baseDelayMs * 2 ** (attempt - 1), maxDelayMs);
      delay = expo + expo * Math.random() * 0.5;
    }
    await new Promise((resolve) => setTimeout(resolve, delay));
  }
}

// Carries the upstream HTTP status so the key-rotation loop can decide whether
// an error is key-specific (rotate) or deterministic (fail fast).
class GeminiHttpError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "GeminiHttpError";
  }
}

// Only auth/quota failures justify trying a different API key; any other status
// (e.g. 400 bad request) is deterministic and would just be re-thrown per key.
function isKeySpecificStatus(status: number): boolean {
  return status === 401 || status === 403 || status === 429;
}

// Pure, side-effect-free request-body construction for a single embedContent
// call. Extracted so the retrieval-baseline evaluator (scripts/
// stage_e_retrieval_eval.py) can be tested for byte-for-byte parity against
// this exact function via scripts/print_embedding_request.mts, rather than
// against a hand-copied spec that could silently drift from the real code.
// No task-type prefix, no title wrapping - raw text only, matching what this
// project's own investigation found: "taskType parameter has no effect on
// gemini-embedding-2 (confirmed bug)" (see the model comment above).
export function buildGeminiEmbedContentRequestBody(
  text: string,
  dimensions: number,
): { content: { parts: [{ text: string }] }; outputDimensionality: number } {
  return {
    content: {
      parts: [{ text }],
    },
    outputDimensionality: dimensions,
  };
}

// Same extraction rationale as buildGeminiEmbedContentRequestBody above, for the
// batchEmbedContents per-item shape instead (used when texts.length >= BATCH_THRESHOLD).
// Unlike the single embedContent call, each batch item must carry its own "model"
// field since the model isn't otherwise implied by a per-item URL path.
export function buildGeminiBatchEmbedContentsRequestItem(
  text: string,
  dimensions: number,
): { model: string; content: { parts: [{ text: string }] }; outputDimensionality: number } {
  return {
    model: "models/gemini-embedding-2",
    content: {
      parts: [{ text }],
    },
    outputDimensionality: dimensions,
  };
}

async function embedNativeGemini(texts: string[], apiKey: string): Promise<number[][]> {
  // Single endpoint is faster for small batches; batch API for 2+
  if (texts.length < BATCH_THRESHOLD) {
    const url =
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-2:embedContent";
    const response = await fetchWithRetry(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify(buildGeminiEmbedContentRequestBody(texts[0]!, EMBEDDING_DIMENSION)),
    });
    if (!response.ok) {
      const errText = await response.text();
      throw new GeminiHttpError(
        `Gemini embedContent failed (${response.status}): ${errText}`,
        response.status,
      );
    }
    const data = (await response.json()) as { embedding?: { values: number[] } };
    if (!data.embedding?.values) {
      throw new Error("Unexpected shape in Gemini embedContent response");
    }
    return [data.embedding.values];
  } else {
    const url =
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-2:batchEmbedContents";
    const response = await fetchWithRetry(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        requests: texts.map((text) =>
          buildGeminiBatchEmbedContentsRequestItem(text, EMBEDDING_DIMENSION),
        ),
      }),
    });
    if (!response.ok) {
      const errText = await response.text();
      throw new GeminiHttpError(
        `Gemini batchEmbedContents failed (${response.status}): ${errText}`,
        response.status,
      );
    }
    const data = (await response.json()) as { embeddings?: Array<{ values: number[] }> };
    if (!data.embeddings || !Array.isArray(data.embeddings)) {
      throw new Error("Unexpected shape in Gemini batchEmbedContents response");
    }
    return data.embeddings.map((emb: { values: number[] }) => {
      if (!emb.values) {
        throw new Error("Unexpected shape in Gemini batchEmbedContents values");
      }
      return emb.values;
    });
  }
}

// Phase 6.21A: local-test-only bypass for real Gemini embedding calls, so
// storage/lifecycle tests (which only need SOME deterministic 768-dim
// vector, not a semantically meaningful one) can run against a local Convex
// backend without a paid API key or real network calls. Default DISABLED.
// Must be the EXACT string "1" (not just truthy) - and is only ever read
// per-deployment via `npx convex env set`, which does not propagate between
// deployments, so this can only activate where a human deliberately set it
// on that specific deployment. The real GEMINI_API_KEY path below is
// completely unmodified and unconditional on every other deployment,
// including production.
function generateDeterministicFakeEmbedding(text: string): number[] {
  // FNV-1a hash → xorshift32 PRNG. Deterministic and dependency-free; this
  // vector's semantic content is irrelevant to storage/lifecycle tests.
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  let seed = hash >>> 0 || 1;
  const next = () => {
    seed ^= seed << 13;
    seed ^= seed >>> 17;
    seed ^= seed << 5;
    seed >>>= 0;
    return seed / 4294967296;
  };
  const vec = Array.from({ length: EMBEDDING_DIMENSION }, () => next() * 2 - 1);
  const norm = Math.sqrt(vec.reduce((sum, x) => sum + x * x, 0)) || 1;
  return vec.map((x) => x / norm);
}

export async function generateEmbeddingsInternal(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];

  if (process.env.FAKE_EMBEDDINGS_FOR_LOCAL_TEST === "1") {
    return texts.map((t) => generateDeterministicFakeEmbedding(t));
  }

  const sanitizedTexts = texts.map((t) => t.substring(0, MAX_EMBED_CHARS));

  const geminiKeys: string[] = [
    process.env.GEMINI_API_KEY,
    process.env.GEMINI_API_KEY_1,
    process.env.GEMINI_API_KEY_2,
    process.env.GOOGLE_GENERATIVE_AI_API_KEY,
  ].filter((k): k is string => !!k);

  if (geminiKeys.length === 0) {
    // Permanent configuration error - no retry, however many Workpool
    // attempts or DLQ cycles are configured, will ever fix a missing key.
    // August 2026 incident remediation: previously this was a plain
    // ConvexError, indistinguishable to Workpool from a transient failure,
    // so a misconfigured deployment would burn its full retry budget on
    // every single chunk before anything surfaced the real cause.
    throw new NonRetryableError("GEMINI_API_KEY environment variable is not set");
  }

  const errors: string[] = [];

  for (let keyIndex = 0; keyIndex < geminiKeys.length; keyIndex++) {
    const key = geminiKeys[keyIndex]!;
    try {
      if (keyIndex > 0) {
        console.warn(`Embedding failover: using key index ${keyIndex}`);
      }
      const embeddings = await embedNativeGemini(sanitizedTexts, key);
      return embeddings;
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      // Fail fast on deterministic errors (e.g. 400 bad request, malformed
      // response): retrying the same input against every other key just wastes
      // quota/latency and hides the real cause. Only rotate on auth/quota errors.
      if (err instanceof GeminiHttpError && !isKeySpecificStatus(err.status)) {
        // Deterministic input/request error (e.g. 400): the same text will
        // fail identically on every retry. Conservative by design - only
        // this already-fail-fast branch is promoted to NonRetryableError.
        // 401/403/429 (isKeySpecificStatus) and network errors stay ordinary
        // ConvexErrors below, since those genuinely can succeed on a later
        // attempt (key rotation, backoff, or a quota window resetting).
        throw new NonRetryableError(
          `Gemini embedding request failed (non-retryable): ${errMsg}`,
        );
      }
      console.warn(`Native Gemini Embeddings failed for key: ${errMsg}`);
      errors.push(`Gemini: ${errMsg}`);
    }
  }

  // No cross-provider fallback: a different embedding model (e.g. OpenRouter's
  // text-embedding-3-large) would produce vectors in a different latent space,
  // silently breaking all vector similarity scores in the existing index.
  // The multiple-GEMINI_API_KEY rotation above is the intended redundancy.
  throw new ConvexError(`All embedding providers failed:\n- ${errors.join("\n- ")}`);
}

// internalAction: only callable server-side (e.g. internal.embeddings.generate.generate
// from the already-authenticated RAG retrieval pipeline). Not part of the public API
// surface, so unauthenticated clients cannot trigger paid Gemini embedding calls.
export const generate = internalAction({
  args: {
    text: v.string(),
  },
  returns: v.array(v.float64()),
  handler: async (_ctx, args) => {
    const timer = recordTiming();
    try {
      const queryText = args.text;
      const embeddings = await generateEmbeddingsInternal([queryText]);
      const latencyMs = timer.end();
      console.log("[EMBEDDING] Generated embedding", {
        latencyMs,
        textLength: args.text.length,
      });
      const emb = embeddings[0];
      if (!emb) {
        throw new ConvexError("No embedding returned");
      }
      assertEmbeddingDimension(emb, EMBEDDING_DIMENSION);
      assertFiniteVector(emb);
      return emb;
    } catch (error: unknown) {
      const latencyMs = timer.end();
      console.error("[EMBEDDING] Failed to generate embedding", {
        latencyMs,
        textLength: args.text.length,
        error: error instanceof Error ? error.message : String(error),
      });
      throw new ConvexError(error instanceof Error ? error.message : String(error));
    }
  },
});
