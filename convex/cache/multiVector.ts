"use node";
import { createGroq } from "@ai-sdk/groq";
import { generateText } from "ai";
import { v } from "convex/values";
import { internalAction } from "../_generated/server";
import { generateEmbeddingsInternal } from "../embeddings/generate";

const groq = createGroq({
  apiKey: process.env.GROQ_API_KEY || "",
});

export async function generateAlternatePhrasingsInternal(
  queryText: string,
): Promise<string[] | null> {
  if (!process.env.GROQ_API_KEY) return null;

  try {
    const { text } = await generateText({
      model: groq("llama-3.1-8b-instant"),
      system:
        "Generate 2 alternate phrasings of the given search query about UET Taxila. " +
        "Each should use different keywords but preserve the same search intent. " +
        "If the query is in Roman Urdu, first translate to English, then generate alternates. " +
        "Output each alternate on its own line, prefixed with '1. ' and '2. '.",
      prompt: queryText,
      temperature: 0.5,
      maxOutputTokens: 150,
    });

    const lines = text
      .split("\n")
      .map((l) => l.replace(/^\d+\.\s*/, "").trim())
      .filter((l) => l.length > 0);

    return lines.length >= 2 ? lines.slice(0, 2) : null;
  } catch (error) {
    console.warn("Failed to generate alternate phrasings:", error);
    return null;
  }
}

export const generateAlternates = internalAction({
  args: { queryText: v.string() },
  returns: v.union(
    v.null(),
    v.object({
      alternateQueryTexts: v.array(v.string()),
      alternateEmbeddings: v.array(v.array(v.float64())),
    }),
  ),
  handler: async (_ctx, args) => {
    const phrasings = await generateAlternatePhrasingsInternal(args.queryText);
    if (!phrasings) return null;

    try {
      const embeddings = await generateEmbeddingsInternal(phrasings);
      return {
        alternateQueryTexts: phrasings,
        alternateEmbeddings: embeddings,
      };
    } catch (error) {
      console.warn("Failed to generate alternate embeddings:", error);
      return null;
    }
  },
});
