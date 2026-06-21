export const LLM_FALLBACK_CHAIN = [
  { id: "meta-llama/llama-4-scout-17b-16e-instruct", provider: "groq" },
  { id: "gpt-oss-120b", provider: "cerebras" },
  { id: "llama-3.1-8b-instant", provider: "groq" },
  { id: "gemini-2.5-flash", provider: "google" },
];

export const PROVIDER_ENV_KEYS = {
  groq: "GROQ_API_KEY",
  google: "GEMINI_API_KEY",
  cerebras: "CEREBRAS_API_KEY",
} as const;

export function getModelPriorities(): string[] {
  return LLM_FALLBACK_CHAIN.filter((m) => {
    const key = PROVIDER_ENV_KEYS[m.provider as keyof typeof PROVIDER_ENV_KEYS];
    return key ? !!process.env[key] : false;
  }).map((m) => m.id);
}
