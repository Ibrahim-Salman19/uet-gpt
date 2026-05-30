export const FALLBACK_MAX = 20;

export function createRateLimiter() {
  const store = new Map<string, { count: number; resetAt: number }>();
  return {
    async isRateLimited(key: string): Promise<boolean> {
      const now = Date.now();
      const entry = store.get(key);
      if (!entry || now > entry.resetAt) {
        store.set(key, { count: 1, resetAt: now + 60_000 });
        return false;
      }
      if (entry.count >= FALLBACK_MAX) return true;
      entry.count++;
      return false;
    },
    store,
  };
}

export function extractText(message: {
  content?: string;
  parts?: { type: string; text: string }[];
}): string {
  if (message.content) return message.content;
  if (message.parts) {
    return message.parts
      .filter((p) => p.type === "text")
      .map((p) => p.text)
      .join("");
  }
  return "";
}

export function buildSystemPrompt(context: string | null, intent?: string): string {
  const parts: string[] = [
    "You are UET GPT, an intelligent assistant for UET Taxila.",
  ];
  if (context) {
    parts.push(
      `Here is relevant context from UET Taxila's official sources:\n\n${context}\n\nUse this context to answer the user's question. If the context doesn't contain enough information, say so clearly and provide what you know. Always cite sources when possible.`,
    );
  } else {
    parts.push(
      "You don't have specific context for this question. Answer based on your general knowledge about UET Taxila, but note when you're uncertain.",
    );
  }
  if (intent === "off_topic") {
    parts.push(
      "The user's query appears to be off-topic. Politely redirect them to UET Taxila topics.",
    );
  }
  return parts.join("\n\n");
}

export function getModelPriorities(): string[] {
  const order: string[] = [];
  if (process.env.GROQ_API_KEY) order.push("meta-llama/llama-4-scout");
  if (process.env.CEREBRAS_API_KEY) order.push("cerebras-llama-3.3-70b");
  if (process.env.GROQ_API_KEY) order.push("llama-3.1-8b-instant");
  if (process.env.GEMINI_API_KEY) order.push("gemini-1.5-flash");
  return order;
}
