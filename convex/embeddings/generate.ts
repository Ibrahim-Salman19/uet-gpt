"use node";
import { ConvexError, v } from "convex/values";
import { KeyPool } from "keymux";
import { action } from "../_generated/server";

async function embedNativeGemini(texts: string[], apiKey: string): Promise<number[][]> {
  if (texts.length === 1) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-2:embedContent?key=${apiKey}`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        content: {
          parts: [{ text: texts[0] }],
        },
      }),
    });
    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Gemini embedContent failed (${response.status}): ${errText}`);
    }
    const data = await response.json() as any;
    if (!data.embedding?.values) {
      throw new Error("Unexpected shape in Gemini embedContent response");
    }
    return [data.embedding.values];
  } else {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-2:batchEmbedContents?key=${apiKey}`;
    const response = await fetch(url, {
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
        })),
      }),
    });
    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Gemini batchEmbedContents failed (${response.status}): ${errText}`);
    }
    const data = await response.json() as any;
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

  // Fall back to OpenRouter
  if (openRouterKey) {
    try {
      console.log("Attempting embedding generation using OpenRouter Fallback API");
      const response = await fetch("https://openrouter.ai/api/v1/embeddings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${openRouterKey}`,
        } as Record<string, string>,
        body: JSON.stringify({
          model: "google/gemini-embedding-001",
          input: texts,
        }),
      });

      if (!response.ok) {
        const status = response.status;
        const errText = await response.text();
        throw new ConvexError(`OpenRouter API error (Status ${status}): ${errText}`);
      }

      const data = (await response.json()) as any;
      if (!data.data || !Array.isArray(data.data)) {
        throw new ConvexError("Unexpected OpenRouter API response shape");
      }

      const sortedData = [...data.data].sort((a: any, b: any) => (a.index ?? 0) - (b.index ?? 0));
      return sortedData.map((d: any) => {
        if (!d.embedding) throw new ConvexError("Unexpected OpenRouter API response shape");
        return d.embedding as number[];
      });
    } catch (err: any) {
      if (err instanceof ConvexError) throw err;
      const errMsg = err.message || String(err);
      console.error(`OpenRouter Fallback failed: ${errMsg}`);
      errors.push(`OpenRouter: ${errMsg}`);
    }
  }

  throw new ConvexError(`All embedding providers failed:\n- ${errors.join("\n- ")}`);
}

export const generate = action({
  args: {
    text: v.string(),
  },
  returns: v.array(v.float64()),
  handler: async (_ctx, args) => {
    try {
      const embeddings = await generateEmbeddingsInternal([args.text]);
      return embeddings[0] as number[];
    } catch (error: any) {
      throw new ConvexError(error.message || String(error));
    }
  },
});
