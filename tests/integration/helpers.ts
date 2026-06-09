import { buildSystemPrompt, extractText } from "@/lib/prompt";
import { LLM_FALLBACK_CHAIN } from "@/lib/llm-models";

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

export function getModelPriorities(): string[] {
  const envKeyMap: Record<string, string> = {
    groq: "GROQ_API_KEY",
    cerebras: "CEREBRAS_API_KEY",
    google: "GEMINI_API_KEY",
  };
  return LLM_FALLBACK_CHAIN
    .filter((m) => {
      const key = envKeyMap[m.provider];
      return key ? process.env[key] : false;
    })
    .map((m) => m.id);
}

export { buildSystemPrompt, extractText };
