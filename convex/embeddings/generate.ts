"use node";
import { ConvexError, v } from "convex/values";
import { action } from "../_generated/server";

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
    await new Promise((resolve) => setTimeout(resolve, delay));
  }
}

async function embedNativeGemini(texts: string[], apiKey: string): Promise<number[][]> {
  if (texts.length === 1) {
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
    const data = (await response.json()) as any;
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
    const data = (await response.json()) as any;
    if (!data.embeddings || !Array.isArray(data.embeddings)) {
      throw new Error("Unexpected shape in Gemini batchEmbedContents response");
    }
    return data.embeddings.map((emb: any) => {
      if (!emb.values) {
        throw new Error("Unexpected shape in Gemini batchEmbedContents values");
      }
      return emb.values;
    });
  }
}

export async function generateEmbeddingsInternal(texts: string[]): Promise<number[][]> {
  const geminiKeys = [
    process.env.GEMINI_API_KEY,
    process.env.GEMINI_API_KEY_1,
    process.env.GEMINI_API_KEY_2,
    process.env.GOOGLE_GENERATIVE_AI_API_KEY,
  ].filter((k): k is string => !!k);

  const openRouterKey = process.env.OPENROUTER_API_KEY;

  if (geminiKeys.length === 0 && !openRouterKey) {
    throw new ConvexError("GEMINI_API_KEY environment variable is not set");
  }

  const errors: string[] = [];

  if (geminiKeys.length > 0) {
    for (const key of geminiKeys) {
      try {
        const embeddings = await embedNativeGemini(texts, key);
        return embeddings;
      } catch (err: any) {
        const errMsg = err.message || String(err);
        console.warn(`Native Gemini Embeddings failed for key: ${errMsg}`);
        errors.push(`Gemini: ${errMsg}`);
      }
    }
  }

  // Fall back removed to prevent vector space incompatibility
  throw new ConvexError(`All embedding providers failed:\n- ${errors.join("\n- ")}`);
}

export const generate = action({
  args: {
    text: v.string(),
  },
  returns: v.array(v.float64()),
  handler: async (_ctx, args) => {
    try {
      const queryText = `task: search result | query: ${args.text}`;
      const embeddings = await generateEmbeddingsInternal([queryText]);
      return embeddings[0] as number[];
    } catch (error: any) {
      throw new ConvexError(error.message || String(error));
    }
  },
});
