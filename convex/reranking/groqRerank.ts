import { createGroq } from "@ai-sdk/groq";
import { generateObject } from "ai";
import { v } from "convex/values";
import { z } from "zod";
import { internalAction } from "../_generated/server";

function getGroq() {
  return createGroq({ apiKey: process.env.GROQ_API_KEY || "" });
}

export const groqRerank = internalAction({
  args: {
    query: v.string(),
    documents: v.array(v.object({ text: v.string(), id: v.string() })),
    topK: v.optional(v.number()),
  },
  returns: v.array(v.object({ text: v.string(), score: v.number(), index: v.number() })),
  handler: async (_ctx, args): Promise<Array<{ text: string; score: number; index: number }>> => {
    if (!process.env.GROQ_API_KEY) {
      const topK = args.topK ?? args.documents.length;
      return args.documents.slice(0, topK).map((d, i) => ({
        text: d.text,
        score: 1 - i / topK,
        index: i,
      }));
    }

    const topK = args.topK ?? args.documents.length;
    const docs = args.documents.slice(0, 20); // limit for token budget

    try {
      const { object } = await generateObject({
        model: getGroq()("llama-3.1-8b-instant"),
        schema: z.object({
          scores: z.array(z.object({ index: z.number(), score: z.number().min(0).max(1) })),
        }),
        system:
          "Rate each document's relevance to the query (0-1). " +
          "Return array of {index, score}. " +
          "Score 1 = directly answers query, 0 = completely irrelevant. " +
          "Be strict: prefer precision over recall.",
        // Escape the (untrusted, possibly LLM-rewritten) query with JSON.stringify
        // so quotes/newlines/instructions cannot break out of the delimiter and
        // manipulate the reranker — matching crag.ts / routing.ts prompt handling.
        prompt: `Query: ${JSON.stringify(args.query)}\n\nDocuments:\n${docs.map((d, i) => `[${i}] ${d.text.slice(0, 500)}`).join("\n---\n")}`,
        temperature: 0,
        maxOutputTokens: 500,
      });

      return object.scores
        .filter((s) => s.index >= 0 && s.index < docs.length)
        .sort((a, b) => b.score - a.score)
        .slice(0, topK)
        .map((s) => ({ text: docs[s.index]?.text ?? "", score: s.score, index: s.index }));
    } catch {
      return args.documents.slice(0, topK).map((d, i) => ({
        text: d.text,
        score: 1 - i / topK,
        index: i,
      }));
    }
  },
});
