import { generateObject } from "ai";
import { v } from "convex/values";
import { z } from "zod";
import { internalAction } from "../_generated/server";
import { CRAG_CONFIG } from "./constants";
import { getStructuredModelChain } from "./modelRegistry";

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
    if (args.chunks.length === 0) {
      return [];
    }

    const chain = getStructuredModelChain();
    if (chain.length === 0) {
      // No provider key: fail open (keep all chunks, low confidence) so retrieval
      // results are not stripped when the judge is unavailable.
      console.warn("CRAG: no provider key configured, failing open");
      return args.chunks.map((c) => ({ index: c.index, relevant: true, confidence: 0.5 }));
    }

    const results: Array<{
      index: number;
      relevant: boolean;
      confidence: number;
    }> = [];

    for (let i = 0; i < args.chunks.length; i += CRAG_CONFIG.batchSize) {
      const batch = args.chunks.slice(i, i + CRAG_CONFIG.batchSize);
      let batchJudged = false;

      for (const { model, label } of chain) {
        try {
          const { object } = await generateObject({
            model,
            // .strict() emits additionalProperties:false — required for Groq gpt-oss
            // strict-schema mode (see TRACK_C_DESIGN.md diagnostic evidence).
            schema: z
              .object({
                evaluations: z.array(
                  z.object({
                    index: z.number(),
                    relevant: z.boolean(),
                    // Constrain to [0,1] so a model returning e.g. 0-100 cannot
                    // silently skew downstream threshold comparisons.
                    confidence: z.number().min(0).max(1),
                  }),
                ),
              })
              .strict(),
            prompt: buildCragPrompt(args.query, batch),
            temperature: 0,
            maxOutputTokens: 500,
            // Groq gpt-oss (chain's primary provider) reasons by default, and
            // those tokens draw from this same budget - see rag/routing.ts's
            // LOW_REASONING comment for the directly-observed failure mode
            // (empty/truncated output, finish_reason "length") this avoids.
            providerOptions: { groq: { reasoningEffort: "low" } },
          });

          // Defense-in-depth: clamp confidence to [0,1] before it reaches any
          // threshold comparison, regardless of what the model emitted.
          results.push(
            ...object.evaluations.map((e) => ({
              ...e,
              confidence: Math.max(0, Math.min(1, e.confidence)),
            })),
          );
          batchJudged = true;
          break; // success — don't try the next provider for this batch
        } catch (error) {
          console.warn(`CRAG batch ${i}: ${label} failed, trying next provider:`, error);
        }
      }

      if (!batchJudged) {
        // All providers failed for this batch: fail open (keep chunks, low
        // confidence) rather than stripping good context. Reserve "not relevant"
        // for explicit model judgments.
        for (const chunk of batch) {
          results.push({ index: chunk.index, relevant: true, confidence: 0.5 });
        }
      }
    }

    return results;
  },
});
