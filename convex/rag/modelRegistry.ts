// Shared LLM provider registry for RAG structured/free-text tasks.
//
// Replaces the dying Groq Llama models (shutdown 2026-08-16) with qualified
// replacements. See docs/audit/TRACK_C_DESIGN.md for the qualification evidence:
// gpt-oss-20b and gpt-oss-120b BOTH support strict JSON Schema (the initial 400s
// were a schema-format bug — missing additionalProperties:false — not a model
// capability defect, proven by Diagnostic Tests 1+2 on 2026-07-26).
//
// Routing policy (per operator directive):
//   structured: Groq gpt-oss strict → Gemini 3.5-flash-lite strict → safe default
//   free-text:  Groq gpt-oss → Gemini fallback
//
// PRIVACY: Gemini free-tier data may be used to improve Google products. The
// fallback is acceptable for the structured-judge sites here because their
// inputs are public crawled UET web content, not student PII. Do not route
// user-supplied sensitive data (names/CNIC/emails) through the Gemini fallback.
"use node";

import { createGroq } from "@ai-sdk/groq";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import type { LanguageModel } from "ai";

// Qualified alive 2026-07-26 via live probes (see TRACK_C_DESIGN.md §2).
// Groq official replacements for the Aug-16-shutdown Llama models.
export const GROQ_STRUCTURED_MODEL = "openai/gpt-oss-20b" as const;
export const GROQ_STRUCTURED_MODEL_LARGE = "openai/gpt-oss-120b" as const;
export const GROQ_TEXT_MODEL = "openai/gpt-oss-20b" as const;
// Cross-provider structured-output fallback (qualified for all 4 schemas).
export const GEMINI_FALLBACK_MODEL = "gemini-3.5-flash-lite" as const;

function getGeminiKeys(): string[] {
  const keys = [
    process.env.GEMINI_API_KEY,
    process.env.GEMINI_API_KEY_1,
    process.env.GEMINI_API_KEY_2,
    process.env.GOOGLE_GENERATIVE_AI_API_KEY,
  ].filter((k): k is string => !!k && k.trim().length > 0);
  return Array.from(new Set(keys));
}

/**
 * Build the ordered list of (model, label) pairs to try for a structured task.
 * Groq primary (if key set) then Gemini fallback (first available key). Returns
 * an empty array only when NO provider key is configured — callers must handle
 * that by returning their task's safe default.
 */
export function getStructuredModelChain(
  useLarge = false,
): Array<{ model: LanguageModel; label: string }> {
  const chain: Array<{ model: LanguageModel; label: string }> = [];

  const groqKey = process.env.GROQ_API_KEY;
  if (groqKey) {
    const groq = createGroq({ apiKey: groqKey });
    const id = useLarge ? GROQ_STRUCTURED_MODEL_LARGE : GROQ_STRUCTURED_MODEL;
    chain.push({ model: groq(id), label: `groq:${id}` });
  }

  const geminiKeys = getGeminiKeys();
  if (geminiKeys.length > 0) {
    const google = createGoogleGenerativeAI({ apiKey: geminiKeys[0]! });
    chain.push({ model: google(GEMINI_FALLBACK_MODEL), label: `google:${GEMINI_FALLBACK_MODEL}` });
  }

  return chain;
}

/**
 * Build the ordered list of (model, label) pairs to try for a free-text task.
 * Same Groq-primary → Gemini-fallback ordering.
 */
export function getTextModelChain(): Array<{ model: LanguageModel; label: string }> {
  const chain: Array<{ model: LanguageModel; label: string }> = [];

  const groqKey = process.env.GROQ_API_KEY;
  if (groqKey) {
    const groq = createGroq({ apiKey: groqKey });
    chain.push({ model: groq(GROQ_TEXT_MODEL), label: `groq:${GROQ_TEXT_MODEL}` });
  }

  const geminiKeys = getGeminiKeys();
  if (geminiKeys.length > 0) {
    const google = createGoogleGenerativeAI({ apiKey: geminiKeys[0]! });
    chain.push({ model: google(GEMINI_FALLBACK_MODEL), label: `google:${GEMINI_FALLBACK_MODEL}` });
  }

  return chain;
}
