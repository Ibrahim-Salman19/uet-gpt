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
  // Groq: primary — highly reliable, fast, free tier
  { id: "llama-3.3-70b-versatile", provider: "groq" },
  { id: "llama-3.1-8b-instant", provider: "groq" },
  // Cerebras: secondary — llama models deprecated May 2026; use active models
  { id: "gemma-4-31b", provider: "cerebras" },
  { id: "gpt-oss-120b", provider: "cerebras" },
  // Google: tertiary — use newer models; gemini-2.0-flash has exhausted free quota
  // gemini-3.5-flash-lite: verified HTTP 200, free tier, newest & fastest
  { id: "gemini-3.5-flash-lite", provider: "google" },
  // gemini-3.1-flash-lite: verified HTTP 200, free tier, backup
  { id: "gemini-3.1-flash-lite", provider: "google" },
];

/**
 * Returns the ids of fallback models whose provider API key is configured.
 *
 * May return an empty array when NO provider key is set - in that case there is
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
      "[LLM] No provider API keys configured (GROQ_API_KEY / GEMINI_API_KEY / CEREBRAS_API_KEY) - no model available.",
    );
  }
  return ids;
}
