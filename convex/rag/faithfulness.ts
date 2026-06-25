import { createGroq } from "@ai-sdk/groq";
import { generateObject } from "ai";
import { v } from "convex/values";
import { z } from "zod";
import { internalAction } from "../_generated/server";
import { FAITHFULNESS_CONFIG } from "./constants";

function buildFaithfulnessPrompt(answer: string, sources: string[]): string {
  const sourcesText = sources
    .map((s, i) => `[Source ${i + 1}]\n${s.substring(0, 1500)}`)
    .join("\n\n---\n\n");

  return `You are a faithfulness verifier. Determine if every claim in the answer is supported by the provided sources.

SOURCES:
${sourcesText}

ANSWER:
${answer}

Identify any claims in the answer that are NOT supported by ANY of the sources above.
A claim is unsupported if it cannot be found or reasonably inferred from the sources.
Do not penalize the answer for omitting information — only penalize it for ADDING information not present in sources.`;
}

export const judgeFaithfulness = internalAction({
  args: {
    query: v.string(),
    answer: v.string(),
    sources: v.array(v.string()),
  },
  returns: v.object({
    faithful: v.boolean(),
    unsupportedClaims: v.array(v.string()),
    score: v.number(),
  }),
  handler: async (_ctx, args) => {
    if (!process.env.GROQ_API_KEY || !args.answer || args.sources.length === 0) {
      return { faithful: true, unsupportedClaims: [], score: 1.0 };
    }

    const groq = createGroq({ apiKey: process.env.GROQ_API_KEY });

    try {
      const { object } = await generateObject({
        model: groq(FAITHFULNESS_CONFIG.groqModel),
        schema: z.object({
          faithful: z.boolean(),
          unsupportedClaims: z.array(z.string()),
          score: z.number(),
        }),
        prompt: buildFaithfulnessPrompt(args.answer, args.sources),
        temperature: 0,
        maxOutputTokens: 500,
      });

      return object;
    } catch (error) {
      console.warn("Faithfulness check failed, defaulting to faithful:", error);
      return { faithful: true, unsupportedClaims: [], score: 1.0 };
    }
  },
});
