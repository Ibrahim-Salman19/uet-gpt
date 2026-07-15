import "server-only";

export const PROVIDER_ENV_KEYS = {
  groq: "GROQ_API_KEY",
  google: "GEMINI_API_KEY",
  cerebras: "CEREBRAS_API_KEY",
} as const;

/** A provider that has a configured env-var key. Typo'd providers are a compile error. */
export type LlmProvider = keyof typeof PROVIDER_ENV_KEYS;

interface ModelConfig {
  id: string;
  provider: LlmProvider;
  isReasoning?: boolean;
}

export const LLM_FALLBACK_CHAIN: ModelConfig[] = [
  { id: "meta-llama/llama-4-scout-17b-16e-instruct", provider: "groq" },
  { id: "gpt-oss-120b", provider: "cerebras", isReasoning: true },
  { id: "llama-3.1-8b-instant", provider: "groq" },
  { id: "gemini-2.5-flash", provider: "google" },
];

/**
 * Returns the ids of fallback models whose provider API key is configured.
 *
 * May return an empty array when NO provider key is set — in that case there is
 * no LLM available at all. We emit a distinct warning so the empty result is
 * observable; callers must still handle `[]` with a clear "no model configured"
 * error rather than silently iterating an empty chain.
 */
export function getModelPriorities(): string[] {
  const ids = LLM_FALLBACK_CHAIN.filter((m) => !!process.env[PROVIDER_ENV_KEYS[m.provider]]).map(
    (m) => m.id,
  );
  if (ids.length === 0) {
    console.warn(
      "[LLM] No provider API keys configured (GROQ_API_KEY / GEMINI_API_KEY / CEREBRAS_API_KEY) — no model available.",
    );
  }
  return ids;
}
