import { v } from "convex/values";
import { action } from "../_generated/server";

export const generate = action({
  args: {
    text: v.string(),
  },
  handler: async (_ctx, args) => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY environment variable is not set");
    }

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${apiKey}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "models/text-embedding-004",
          content: {
            parts: [{ text: args.text }],
          },
          outputDimensionality: 768,
        }),
      },
    );

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Gemini API error (${response.status}): ${body}`);
    }

    const data = (await response.json()) as any;

    if (!data.embedding?.values) {
      throw new Error("Unexpected Gemini API response shape");
    }

    return data.embedding.values as number[];
  },
});
