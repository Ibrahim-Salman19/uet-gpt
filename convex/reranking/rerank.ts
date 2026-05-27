import { v } from "convex/values";
import { action } from "../_generated/server";

export const rerank = action({
  args: {
    query: v.string(),
    documents: v.array(v.object({ text: v.string(), id: v.string() })),
    topK: v.optional(v.number()),
  },
  returns: v.array(v.object({ text: v.string(), score: v.number(), index: v.number() })),
  handler: async (_ctx, args) => {
    const docs = args.documents;
    const topK = args.topK ?? docs.length;

    const rerankerUrl = process.env.RERANKER_URL;
    if (rerankerUrl) {
      try {
        const response = await fetch(`${rerankerUrl.replace(/\/$/, "")}/rerank`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            query: args.query,
            documents: docs.map((d) => d.text),
            top_n: topK,
          }),
        });

        if (response.ok) {
          const results = (await response.json()) as Array<{
            index: number;
            score: number;
            text: string;
          }>;
          return results.map((r) => ({
            text: r.text,
            score: r.score,
            index: r.index,
          }));
        }
        console.warn(`Reranker API returned error: ${response.status}`);
      } catch (error) {
        console.warn("External reranking request failed, using fallback:", error);
      }
    }

    // Graceful fallback to original query order
    return docs.slice(0, topK).map((d, i) => ({
      text: d.text,
      score: 1 - i / docs.length,
      index: i,
    }));
  },
});
