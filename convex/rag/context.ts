import { v } from "convex/values";
import { internalQuery } from "../_generated/server";

// The Sandwich Strategy mitigates "lost in the middle" by placing the most
// relevant chunks at the very beginning and very end of the context window.
//
// NOTE: This is a query (not an action) because it performs pure computation
// with no external API calls or database access. Actions have higher latency
// due to isolate cold starts, so queries are preferred for CPU-only work.
export const buildContext = internalQuery({
  args: {
    chunks: v.array(
      v.object({
        content: v.string(),
        relevanceScore: v.number(),
        url: v.string(),
        title: v.string(),
        headingPath: v.optional(v.array(v.string())),
      }),
    ),
    maxTokens: v.optional(v.number()),
  },
  returns: v.string(),
  handler: async (_ctx, args) => {
    // 1. Sort chunks by relevance score descending
    const sortedChunks = [...args.chunks].sort((a, b) => b.relevanceScore - a.relevanceScore);

    // 2. Greedily pack chunks in rank order until the budget is exhausted.
    //
    // Approximate chars-per-token at 4 (matches the rest of the pipeline and the
    // unit test). A true tokenizer would be more accurate but is unavailable in
    // the Convex runtime.
    const maxChars = (args.maxTokens ?? 3000) * 4;
    const budgetedChunks: typeof sortedChunks = [];
    let currentChars = 0;

    for (const chunk of sortedChunks) {
      const sectionLabel = chunk.headingPath?.length
        ? `Section: ${chunk.headingPath.join(" > ")}\n`
        : "";
      const chunkText = `${sectionLabel}Source: [${chunk.title}](${chunk.url})\n\n${chunk.content}\n\n---\n\n`;
      // Skip an oversized chunk but keep packing smaller, lower-ranked ones so a
      // single large top chunk never blanks out the entire context.
      if (currentChars + chunkText.length > maxChars) {
        continue;
      }
      budgetedChunks.push(chunk);
      currentChars += chunkText.length;
    }

    // 3. Apply Sandwich Strategy only to the budgeted chunks
    // Top chunks go at index 0, length-1, 1, length-2, etc.
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
      const sectionLabel = chunk.headingPath?.length
        ? `Section: ${chunk.headingPath.join(" > ")}\n`
        : "";
      return `${sectionLabel}Source: [${chunk.title}](${chunk.url})\n\n${chunk.content}\n\n---\n\n`;
    });

    return contextParts.join("").trim();
  },
});
