import { v } from "convex/values";
import { internalQuery } from "../_generated/server";

// The Sandwich Strategy mitigates "lost in the middle" by placing the most
// relevant chunks at the very beginning and very end of the context window.
//
// NOTE: This is a query (not an action) because it performs pure computation
// with no external API calls or database access. Actions have higher latency
// due to isolate cold starts, so queries are preferred for CPU-only work.
function formatChunkHeader(chunk: {
  title: string;
  url: string;
  headingPath?: string[];
  crawledAt?: number;
  freshnessTier?: string;
  freshnessState?: string;
  applicability?: string;
}): string {
  const sectionLabel = chunk.headingPath?.length
    ? `Section: ${chunk.headingPath.join(" > ")}\n`
    : "";
  const dateStr =
    chunk.crawledAt && Number.isFinite(chunk.crawledAt)
      ? new Date(chunk.crawledAt).toISOString().split("T")[0]
      : "unavailable";
  const tier = chunk.freshnessTier ?? "unknown";
  // Never infer freshness from the mere presence of a crawl timestamp: the answer
  // model treats these labels as authoritative (a "fresh"/"current" default would
  // let an old fee or deadline be presented as current).
  const state = chunk.freshnessState ?? "unknown";
  const applicability = chunk.applicability ?? "unknown";

  return `${sectionLabel}Source: [${chunk.title}](${chunk.url})
Retrieved: ${dateStr}
Freshness tier: ${tier}
Freshness state: ${state}
Applicability: ${applicability}`;
}

export const buildContext = internalQuery({
  args: {
    chunks: v.array(
      v.object({
        content: v.string(),
        relevanceScore: v.number(),
        url: v.string(),
        title: v.string(),
        headingPath: v.optional(v.array(v.string())),
        crawledAt: v.optional(v.number()),
        freshnessTier: v.optional(v.string()),
        freshnessState: v.optional(v.string()),
        applicability: v.optional(v.string()),
      }),
    ),
    maxTokens: v.optional(v.number()),
  },
  returns: v.string(),
  handler: async (_ctx, args) => {
    // 1. Sort chunks by relevance score descending
    const sortedChunks = [...args.chunks].sort((a, b) => b.relevanceScore - a.relevanceScore);

    // 2. Greedily pack chunks in rank order until the budget is exhausted.
    const maxChars = (args.maxTokens ?? 3000) * 4;
    const budgetedChunks: typeof sortedChunks = [];
    let currentChars = 0;

    for (const chunk of sortedChunks) {
      const header = formatChunkHeader(chunk);
      const chunkText = `${header}\n\n${chunk.content}\n\n---\n\n`;
      if (currentChars + chunkText.length > maxChars) {
        continue;
      }
      budgetedChunks.push(chunk);
      currentChars += chunkText.length;
    }

    // 3. Apply Sandwich Strategy only to the budgeted chunks
    const sandwiched: typeof sortedChunks = new Array(budgetedChunks.length);
    let left = 0;
    let right = budgetedChunks.length - 1;
    let isTop = true;

    for (const chunk of budgetedChunks) {
      if (isTop) {
        sandwiched[left++] = chunk;
      } else {
        sandwiched[right--] = chunk;
      }
      isTop = !isTop;
    }

    // 4. Format context string using array join
    const contextParts = sandwiched.filter(Boolean).map((chunk) => {
      const header = formatChunkHeader(chunk);
      return `${header}\n\n${chunk.content}\n\n---\n\n`;
    });

    return contextParts.join("").trim();
  },
});
