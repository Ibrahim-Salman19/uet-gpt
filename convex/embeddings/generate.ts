// fallow-ignore-file security-sink
"use node";
import { ConvexError, v } from "convex/values";
import { action } from "../_generated/server";
import { recordTiming } from "../observability/metrics";

// gemini-embedding-2 — stable as of May 2026
// Dimensions: 3072 (MRL supports 768/1536/3072)
// Context: 8192 tokens
// Free tier: ~60 RPM, ~1500 RPD (post-Dec 2025 cuts)
// Paid Tier 1: 3000 RPM, 1M TPM
// Batch API: 50% discount ($0.10/M vs $0.20/M)
// Note: taskType parameter has no effect on gemini-embedding-2 (confirmed bug)
const BATCH_THRESHOLD = 2;

async function fetchWithRetry(
  url: string,
  options: RequestInit,
  maxRetries = 3,
): Promise<Response> {
  const baseDelayMs = process.env.NODE_ENV === "test" ? 1 : 100;
  let attempt = 0;
  while (true) {
    attempt++;
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
    } catch (err) {
      if (attempt >= maxRetries) {
        throw err;
      }
    }
    const delay = baseDelayMs * 2 ** (attempt - 1);
    const jitter = delay * Math.random() * 0.5;
    await new Promise((resolve) => setTimeout(resolve, delay + jitter));
  }
}

async function embedNativeGemini(texts: string[], apiKey: string): Promise<number[][]> {
  // Single endpoint is faster for small batches; batch API for 2+
  if (texts.length < BATCH_THRESHOLD) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-2:embedContent?key=${apiKey}`;
    const response = await fetchWithRetry(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        content: {
          parts: [{ text: texts[0] }],
        },
        outputDimensionality: 3072,
      }),
    });
    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Gemini embedContent failed (${response.status}): ${errText}`);
    }
    const data = (await response.json()) as { embedding?: { values: number[] } };
    if (!data.embedding?.values) {
      throw new Error("Unexpected shape in Gemini embedContent response");
    }
    return [data.embedding.values];
  } else {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-2:batchEmbedContents?key=${apiKey}`;
    const response = await fetchWithRetry(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        requests: texts.map((text) => ({
          model: "models/gemini-embedding-2",
          content: {
            parts: [{ text }],
          },
          outputDimensionality: 3072,
        })),
      }),
    });
    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Gemini batchEmbedContents failed (${response.status}): ${errText}`);
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

export async function generateEmbeddingsInternal(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];

  const sanitizedTexts = texts.map((t) => t.substring(0, 32000));

  const geminiKeys: string[] = [
    process.env.GEMINI_API_KEY,
    process.env.GEMINI_API_KEY_1,
    process.env.GEMINI_API_KEY_2,
    process.env.GOOGLE_GENERATIVE_AI_API_KEY,
  ].filter((k): k is string => !!k);

  if (geminiKeys.length === 0) {
    throw new ConvexError("GEMINI_API_KEY environment variable is not set");
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

export const generate = action({
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
      if (!emb || emb.length !== 3072) {
        throw new ConvexError(`Invalid embedding dimension: expected 3072, got ${emb?.length}`);
      }
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
