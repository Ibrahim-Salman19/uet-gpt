import { v } from "convex/values";
import { action } from "../_generated/server";
import { createGroq } from "@ai-sdk/groq";
import { generateText } from "ai";
import { z } from "zod";

const groq = createGroq({
  apiKey: process.env.GROQ_API_KEY || "",
});

export const expandQueryAction = action({
  args: { query: v.string() },
  returns: v.array(v.string()),
  handler: async (_ctx, args) => {
    if (!process.env.GROQ_API_KEY) return [args.query];

    const wordCount = args.query.split(/\s+/).filter(Boolean).length;
    if (wordCount > 5) return [args.query];

    try {
      const { text } = await generateText({
        model: groq("llama-3.1-8b-instant"),
        system:
          "Generate 3 diverse search query variations for the given short query. " +
          "Each variation should use different keywords/phrasing but preserve the same intent. " +
          "If the query is in Roman Urdu, translate to English first. " +
          "Output as JSON array of strings only. Example: [\"variation 1\", \"variation 2\", \"variation 3\"]",
        prompt: args.query,
        temperature: 0.4,
        maxOutputTokens: 200,
      });

      const cleaned = text.replace(/```json?/gi, "").replace(/```/g, "").trim();
      const variations = JSON.parse(cleaned) as string[];

      if (Array.isArray(variations) && variations.length > 0) {
        return [args.query, ...variations.slice(0, 3)];
      }
    } catch {
      console.warn("Query expansion failed:", args.query);
    }

    return [args.query];
  },
});