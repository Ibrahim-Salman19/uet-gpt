import { createGroq } from "@ai-sdk/groq";
import { generateObject } from "ai";
import { v } from "convex/values";
import { z } from "zod";
import { action } from "../_generated/server";
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

export const evaluateChunks = action({
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
                confidence: z.number(),
              }),
            ),
          }),
          prompt: buildCragPrompt(args.query, batch),
          temperature: 0,
          maxOutputTokens: 500,
        });

        results.push(...object.evaluations);
      } catch (error) {
        console.warn(`CRAG batch ${i} failed, marking as NOT relevant (conservative):`, error);
        for (const chunk of batch) {
          results.push({ index: chunk.index, relevant: false, confidence: 0.3 });
        }
      }
    }

    return results;
  },
});
