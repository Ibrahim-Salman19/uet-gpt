import { createGroq } from "@ai-sdk/groq";
import { generateObject } from "ai";
import { v } from "convex/values";
import { z } from "zod";
import { internalAction } from "../_generated/server";
import { CRAG_CONFIG } from "./constants";

function buildCragPrompt(query: string, batch: Array<{ text: string; index: number }>): string {
  const chunksText = batch
    .map(
      (c, i) => `[Chunk ${i}]
Text: "${c.text.substring(0, 1000)}"
---`,
    )
    .join("\n\n");

  return `You are evaluating whether retrieved document chunks are relevant to answering a user query.

User query: ${JSON.stringify(query)}

${chunksText}

For each chunk above, determine if it is relevant to answering the user query.
Respond with a JSON array of evaluations, one per chunk in the order shown above.`;
}

export const evaluateChunks = internalAction({
  args: {
    query: v.string(),
    chunks: v.array(
      v.object({
        text: v.string(),
        index: v.number(),
      }),
    ),
  },
  returns: v.array(
    v.object({
      index: v.number(),
      relevant: v.boolean(),
      confidence: v.number(),
    }),
  ),
  handler: async (_ctx, args) => {
    if (!process.env.GROQ_API_KEY || args.chunks.length === 0) {
      return args.chunks.map((c) => ({ index: c.index, relevant: true, confidence: 0.5 }));
    }

    const groq = createGroq({ apiKey: process.env.GROQ_API_KEY });
    const results: Array<{
      index: number;
      relevant: boolean;
      confidence: number;
    }> = [];

    for (let i = 0; i < args.chunks.length; i += CRAG_CONFIG.batchSize) {
      const batch = args.chunks.slice(i, i + CRAG_CONFIG.batchSize);

      try {
        const { object } = await generateObject({
          model: groq(CRAG_CONFIG.groqModel),
          schema: z.object({
            evaluations: z.array(
              z.object({
                index: z.number(),
                relevant: z.boolean(),
                // Constrain to [0,1] so a model returning e.g. 0-100 cannot
                // silently skew downstream threshold comparisons.
                confidence: z.number().min(0).max(1),
              }),
            ),
          }),
          prompt: buildCragPrompt(args.query, batch),
          temperature: 0,
          maxOutputTokens: 500,
        });

        // Defense-in-depth: clamp confidence to [0,1] before it reaches any
        // threshold comparison, regardless of what the model emitted.
        results.push(
          ...object.evaluations.map((e) => ({
            ...e,
            confidence: Math.max(0, Math.min(1, e.confidence)),
          })),
        );
      } catch (error) {
        // Fail OPEN: on a transient LLM failure (rate limit/timeout) keep the
        // chunks the search + rerank cascade already vetted, rather than marking
        // them NOT relevant - which would strip good context and could force a
        // spurious "refuse" exactly when upstream retrieval succeeded. Reserve
        // "not relevant" for explicit model judgments. Use a low-but-nonzero
        // confidence so callers can still distinguish unjudged from confident.
        console.warn(`CRAG batch ${i} failed, keeping chunks (fail-open):`, error);
        for (const chunk of batch) {
          results.push({ index: chunk.index, relevant: true, confidence: 0.5 });
        }
      }
    }

    return results;
  },
});
