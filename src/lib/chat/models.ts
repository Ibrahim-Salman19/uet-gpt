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
  "llama-4-scout": { id: "meta-llama/llama-4-scout-17b-16e-instruct", provider: "groq" },
  "llama-3.3-70b": { id: "llama-3.3-70b-versatile", provider: "groq" },
  "llama-3.1-8b": { id: "llama-3.1-8b-instant", provider: "groq" },
};

function buildFallbackChain(preferredModelKey?: string): { id: string; provider: string }[] {
  if (!preferredModelKey || !MODEL_MAPPING[preferredModelKey]) {
    return [...LLM_FALLBACK_CHAIN];
  }
  const preferredConfig = MODEL_MAPPING[preferredModelKey];
  return [preferredConfig, ...LLM_FALLBACK_CHAIN.filter((m) => m.id !== preferredConfig.id)];
}

export function getAvailableModels(preferredModelKey?: string): LanguageModel[] {
  const chain = buildFallbackChain(preferredModelKey);
  return chain.flatMap((modelConfig) => {
    const factory = PROVIDER_FACTORIES[modelConfig.provider];
    if (!factory) return [];
    const apiKey = process.env[factory.envKey];
    if (!apiKey) return [];
    return [factory.create(apiKey)(modelConfig.id)];
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
