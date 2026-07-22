import { createCerebras } from "@ai-sdk/cerebras";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createGroq } from "@ai-sdk/groq";
import type { LanguageModel } from "ai";
import { api } from "convex/_generated/api";
import type { ConvexHttpClient } from "convex/browser";
import { LLM_FALLBACK_CHAIN, PROVIDER_ENV_KEYS } from "@/lib/llm-models";

type ModelFactory = (modelId: string) => LanguageModel;

const PROVIDER_FACTORIES: Record<
  string,
  { create: (apiKey: string) => ModelFactory; envKey: string }
> = {
  groq: { create: (key) => createGroq({ apiKey: key }), envKey: PROVIDER_ENV_KEYS.groq },
  google: {
    create: (key) => createGoogleGenerativeAI({ apiKey: key }),
    envKey: PROVIDER_ENV_KEYS.google,
  },
  cerebras: {
    create: (key) => createCerebras({ apiKey: key }),
    envKey: PROVIDER_ENV_KEYS.cerebras,
  },
};

const MODEL_MAPPING: Record<string, { id: string; provider: string }> = {
  "llama-3.3-70b": { id: "llama-3.3-70b-versatile", provider: "groq" },
  "llama-3.1-8b": { id: "llama-3.1-8b-instant", provider: "groq" },
  "gemini-2.0-flash": { id: "gemini-2.0-flash", provider: "google" },
};

function buildFallbackChain(preferredModelKey?: string): { id: string; provider: string }[] {
  if (!preferredModelKey || !MODEL_MAPPING[preferredModelKey]) {
    return [...LLM_FALLBACK_CHAIN];
  }
  const preferredConfig = MODEL_MAPPING[preferredModelKey];
  return [preferredConfig, ...LLM_FALLBACK_CHAIN.filter((m) => m.id !== preferredConfig.id)];
}

function getProviderApiKeys(provider: string): string[] {
  if (provider === "google") {
    const keys = [
      process.env.GEMINI_API_KEY,
      process.env.GEMINI_API_KEY_1,
      process.env.GEMINI_API_KEY_2,
      process.env.GOOGLE_GENERATIVE_AI_API_KEY,
    ].filter((k): k is string => !!k && k.trim().length > 0);
    return Array.from(new Set(keys));
  }
  const mainKey = process.env[PROVIDER_ENV_KEYS[provider as keyof typeof PROVIDER_ENV_KEYS]];
  return mainKey ? [mainKey] : [];
}

export function getAvailableModels(preferredModelKey?: string): LanguageModel[] {
  const chain = buildFallbackChain(preferredModelKey);
  return chain.flatMap((modelConfig) => {
    const factory = PROVIDER_FACTORIES[modelConfig.provider];
    if (!factory) return [];
    const keys = getProviderApiKeys(modelConfig.provider);
    return keys.map((key) => factory.create(key)(modelConfig.id));
  });
}

export async function getPreferredModel(
  convex: ConvexHttpClient,
  userId: string,
): Promise<string | undefined> {
  try {
    const userDoc = await convex.query(api.users.getByClerkId, { clerkId: userId });
    if (userDoc?.preferences?.model) {
      return userDoc.preferences.model;
    }
  } catch (err) {
    console.error("Failed to query user preferences from Convex:", err);
  }
  return undefined;
}
