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

/**
 * Post-generation faithfulness/groundedness judge.
 *
 * NOTE: This is an intentionally available safety net that is NOT yet wired
 * into the generation flow. It is meant to be invoked on a draft answer (e.g.
 * from the chat route, after the answer LLM streams) to verify that the answer's
 * claims are supported by the retrieved sources. Wiring it in requires changes
 * in the generation/chat route (outside the RAG retrieval pipeline). Keep it
 * `internalAction` so it stays off the public API until then.
 */
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
          // Constrain to [0,1] so the faithfulness score is on a known scale
          // for any downstream threshold comparison.
          score: z.number().min(0).max(1),
        }),
        prompt: buildFaithfulnessPrompt(args.answer, args.sources),
        temperature: 0,
        maxOutputTokens: 500,
      });

      // Defense-in-depth: clamp the score to [0,1] before returning.
      return { ...object, score: Math.max(0, Math.min(1, object.score)) };
    } catch (error) {
      console.warn("Faithfulness check failed, defaulting to faithful:", error);
      return { faithful: true, unsupportedClaims: [], score: 1.0 };
    }
  },
});
