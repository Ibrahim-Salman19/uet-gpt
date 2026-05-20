import { v } from "convex/values";
import { action } from "../_generated/server";

// The Sandwich Strategy mitigates "lost in the middle" by placing the most
// relevant chunks at the very beginning and very end of the context window.
export const buildContextAction = action({
  args: {
    chunks: v.array(
      v.object({
        content: v.string(),
        relevanceScore: v.number(),
        url: v.string(),
        title: v.string(),
      }),
    ),
    maxTokens: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // 1. Sort chunks by relevance score descending
    const sortedChunks = [...args.chunks].sort((a, b) => b.relevanceScore - a.relevanceScore);

    // 2. Apply Sandwich Strategy
    // Top chunks go at index 0, length-1, 1, length-2, etc.
    const sandwiched: typeof sortedChunks = new Array(sortedChunks.length);

    let left = 0;
    let right = sortedChunks.length - 1;
    let isTop = true;

    for (const chunk of sortedChunks) {
      if (isTop) {
        sandwiched[left++] = chunk;
      } else {
        sandwiched[right--] = chunk;
      }
      isTop = !isTop;
    }

    // 3. Format context string
    let contextString = "";

    // We use a rough heuristic: 1 token ~= 4 characters to avoid heavy
    // tokenizer dependencies within the Convex isolate.
    const maxChars = (args.maxTokens ?? 3000) * 4;
    let currentChars = 0;

    for (const chunk of sandwiched) {
      if (!chunk) continue; // safety check
      const chunkText = `Source: [${chunk.title}](${chunk.url})\n\n${chunk.content}\n\n---\n\n`;
      if (currentChars + chunkText.length > maxChars) {
        break;
      }
      contextString += chunkText;
      currentChars += chunkText.length;
    }

    return contextString.trim();
  },
});
