import { ConvexError, v } from "convex/values";
import { action } from "../_generated/server";
import { CASCADE_CONFIG } from "../rag/constants";

export const rerank = action({
  args: {
    query: v.string(),
    documents: v.array(v.object({ text: v.string(), id: v.string() })),
    topK: v.optional(v.number()),
  },
  returns: v.array(v.object({ text: v.string(), score: v.number(), index: v.number() })),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError("Authentication required");
    }
    const docs = args.documents;
    const topK = args.topK ?? docs.length;

    // Tier 1: RERANKER_URL (primary precision reranker)
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
        console.warn("External reranking request failed, trying Cohere fallback:", error);
      }
    }

    // Tier 2: Cohere free rerank fallback (100 calls/day limit)
    const cohereKey = process.env.COHERE_API_KEY;
    if (cohereKey && docs.length > 0) {
      try {
        const response = await fetch(CASCADE_CONFIG.cohereEndpoint, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${cohereKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: CASCADE_CONFIG.cohereModel,
            query: args.query,
            documents: docs.map((d) => d.text),
            top_n: topK,
          }),
        });

        if (response.ok) {
          type CohereResult = { index: number; relevance_score: number };
          const body = (await response.json()) as { results: CohereResult[] };
          return body.results
            .filter((r) => r.index >= 0 && r.index < docs.length)
            .map((r) => ({
              text: docs[r.index]?.text ?? "",
              score: r.relevance_score,
              index: r.index,
            }));
        }
        console.warn(`Cohere rerank returned status ${response.status}`);
      } catch (error) {
        console.warn("Cohere rerank failed:", error);
      }
    }

    // Tier 3: Graceful fallback to positional ordering
    return docs.slice(0, topK).map((d, i) => ({
      text: d.text,
      score: 1 - i / docs.length,
      index: i,
    }));
  },
});
