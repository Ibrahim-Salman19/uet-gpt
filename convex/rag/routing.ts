import { generateObject, generateText } from "ai";
import { v } from "convex/values";
import { z } from "zod";
import { internalAction } from "../_generated/server";
import { getStructuredModelChain, getTextModelChain } from "./modelRegistry";

const INTENT_ENUM = [
  "admissions",
  "academic",
  "administrative",
  "campus_life",
  "general",
  "off_topic",
  "simple_fact",
] as const;

const intentValidator = v.union(
  v.literal("admissions"),
  v.literal("academic"),
  v.literal("administrative"),
  v.literal("campus_life"),
  v.literal("general"),
  v.literal("off_topic"),
  v.literal("simple_fact"),
);

// Deterministic keyword → intent rules. Run BEFORE the LLM so obvious intents
// skip the model call entirely (latency + quota savings) and so the classifier
// has a fast path when no provider key is configured. The LLM handles only
// ambiguous queries. Keywords are lowercased + word-boundary matched to avoid
// substring false positives (e.g. "fee" inside "feels").
const INTENT_KEYWORD_RULES: Array<{ intent: (typeof INTENT_ENUM)[number]; words: string[] }> = [
  {
    intent: "admissions",
    words: [
      "admission",
      "admit",
      "apply",
      "application",
      "merit",
      "prospectus",
      "fee",
      "fees",
      "scholarship",
      "eligibility",
      "requirement",
      "documents",
      "deadline",
      "entry",
      "test",
      "ecat",
    ],
  },
  {
    intent: "academic",
    words: [
      "course",
      "courses",
      "curriculum",
      "syllabus",
      "program",
      "programme",
      "degree",
      "semester",
      "department",
      "faculty",
      "professor",
      "teacher",
      "class",
      "lecture",
      "credit",
      "gpa",
      "cgpa",
      "result",
      "grades",
      "transcript",
    ],
  },
  {
    intent: "administrative",
    words: [
      "registrar",
      "examination",
      "exam",
      "exams",
      "datesheet",
      "date sheet",
      "schedule",
      "office",
      "contact",
      "email",
      "phone",
      "address",
      "administration",
      "notice",
      "circular",
    ],
  },
  {
    intent: "campus_life",
    words: [
      "hostel",
      "hostels",
      "transport",
      "bus",
      "library",
      "cafeteria",
      "mess",
      "campus",
      "society",
      "societies",
      "club",
      "sports",
      "event",
      "festival",
    ],
  },
];

function classifyByRules(query: string): (typeof INTENT_ENUM)[number] | null {
  const lower = ` ${query.toLowerCase().replace(/[^a-z\s]/g, " ")} `;
  let best: { intent: (typeof INTENT_ENUM)[number]; hits: number } | null = null;
  for (const rule of INTENT_KEYWORD_RULES) {
    let hits = 0;
    for (const w of rule.words) {
      // word-boundary match on the space-padded normalized string
      if (lower.includes(` ${w} `)) hits++;
    }
    if (hits > 0 && (!best || hits > best.hits)) {
      best = { intent: rule.intent, hits };
    }
  }
  return best?.intent ?? null;
}

export const classifyQueryAction = internalAction({
  args: { query: v.string() },
  returns: intentValidator,
  handler: async (_ctx, args) => {
    // Tier 0: deterministic rules — handles obvious intents with zero API cost.
    const ruleIntent = classifyByRules(args.query);
    if (ruleIntent) return ruleIntent;

    // Tier 1+: structured LLM chain (Groq gpt-oss strict → Gemini fallback).
    // Safe default on total failure is "general", NOT a guessed category.
    const chain = getStructuredModelChain();
    if (chain.length === 0) {
      console.warn("classifyQuery: no provider key configured, returning 'general'");
      return "general";
    }

    for (const { model, label } of chain) {
      try {
        const { object } = await generateObject({
          model,
          // .strict() emits additionalProperties:false — required for Groq gpt-oss
          // strict-schema mode (the fix that resolved the 400s; see TRACK_C_DESIGN.md).
          schema: z
            .object({
              intent: z
                .enum([...INTENT_ENUM] as [string, ...string[]])
                .describe("The category of the user's query regarding UET Taxila."),
            })
            .strict(),
          prompt: `Classify the following user query about UET Taxila into one of the categories.\n<query>\n${JSON.stringify(args.query)}\n</query>`,
          temperature: 0,
        });

        const intent = object.intent;
        if (INTENT_ENUM.includes(intent as (typeof INTENT_ENUM)[number])) {
          return intent as (typeof INTENT_ENUM)[number];
        }
        // Model returned a value outside the enum — try the next provider.
        console.warn(`classifyQuery: ${label} returned out-of-enum intent '${intent}'`);
      } catch (error) {
        console.warn(`classifyQuery: ${label} failed, trying next provider:`, error);
      }
    }

    // All providers failed → safe default, not a guess.
    return "general";
  },
});

export const rewriteQueryAction = internalAction({
  args: { query: v.string() },
  returns: v.string(),
  handler: async (_ctx, args) => {
    const chain = getTextModelChain();
    if (chain.length === 0) return args.query;

    for (const { model, label } of chain) {
      try {
        const { text } = await generateText({
          model,
          system:
            "You are a search expert. Rewrite the user's query to be a concise keyword-rich search query. " +
            "If the query is written in Roman Urdu (Urdu language written using Latin/English characters, e.g., 'fees kitni hai', 'daakhila kab hoga', 'hostel kahan hai', 'documents kya chahiye'), detect it, translate it to English first, and then rewrite it into keyword-rich English search terms. " +
            "Expand abbreviations like 'UET' to 'University of Engineering and Technology'. " +
            "Output ONLY the final rewritten keyword-rich search query in English, and absolutely nothing else.",
          prompt: args.query,
          temperature: 0.3,
          maxOutputTokens: 100,
        });
        return text.trim() || args.query;
      } catch (error) {
        console.warn(`rewriteQuery: ${label} failed, trying next provider:`, error);
      }
    }
    return args.query;
  },
});

export const hydeQueryAction = internalAction({
  args: { query: v.string() },
  returns: v.string(),
  handler: async (_ctx, args) => {
    // HyDE prefers Gemini (cheapest, already used elsewhere); falls back to the
    // shared Groq/Gemini text chain if no Gemini key is present.
    const geminiKey =
      process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY_1 || process.env.GEMINI_API_KEY_2;

    const chain: Array<{ model: import("ai").LanguageModel; label: string }> = [];
    if (geminiKey) {
      const { createGoogleGenerativeAI } = await import("@ai-sdk/google");
      const google = createGoogleGenerativeAI({ apiKey: geminiKey });
      chain.push({ model: google("gemini-2.5-flash"), label: "google:gemini-2.5-flash" });
    }
    chain.push(...getTextModelChain());

    if (chain.length === 0) return args.query;

    for (const { model, label } of chain) {
      try {
        const { text } = await generateText({
          model,
          system:
            "You are an expert on UET Taxila. Write a hypothetical, 3-5 sentence factual paragraph that directly answers the user's query. Pretend you are writing an official website excerpt.",
          prompt: args.query,
          temperature: 0.5,
          maxOutputTokens: 200,
        });
        return text.trim() || args.query;
      } catch (error) {
        console.warn(`hydeQuery: ${label} failed, trying next provider:`, error);
      }
    }
    return args.query;
  },
});
