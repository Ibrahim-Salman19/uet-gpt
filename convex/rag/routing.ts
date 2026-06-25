import { createGroq } from "@ai-sdk/groq";
import { generateObject, generateText } from "ai";
import { v } from "convex/values";
import { z } from "zod";
import { internalAction } from "../_generated/server";

function getGroq() {
  return createGroq({ apiKey: process.env.GROQ_API_KEY || "" });
}

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

export const classifyQueryAction = internalAction({
  args: { query: v.string() },
  returns: intentValidator,
  handler: async (_ctx, args) => {
    if (!process.env.GROQ_API_KEY) {
      console.warn("GROQ_API_KEY missing, falling back to 'general' category");
      return "general";
    }

    try {
      const { object } = await generateObject({
        model: getGroq()("llama-3.1-8b-instant"),
        schema: z.object({
          intent: z
            .enum([...INTENT_ENUM] as [string, ...string[]])
            .describe("The category of the user's query regarding UET Taxila."),
        }),
        prompt: `Classify the following user query about UET Taxila into one of the categories.\n<query>\n${JSON.stringify(args.query)}\n</query>`,
        temperature: 0,
      });

      const intent = object.intent;
      if (INTENT_ENUM.includes(intent as (typeof INTENT_ENUM)[number])) {
        return intent as (typeof INTENT_ENUM)[number];
      }
      return "general";
    } catch (error) {
      console.error("Failed to classify query:", error);
      return "general";
    }
  },
});

export const rewriteQueryAction = internalAction({
  args: { query: v.string() },
  returns: v.string(),
  handler: async (_ctx, args) => {
    if (!process.env.GROQ_API_KEY) return args.query;

    try {
      const { text } = await generateText({
        model: getGroq()("llama-3.1-8b-instant"),
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
      console.error("Failed to rewrite query:", error);
      return args.query;
    }
  },
});

export const hydeQueryAction = internalAction({
  args: { query: v.string() },
  returns: v.string(),
  handler: async (_ctx, args) => {
    const geminiKey =
      process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY_1 || process.env.GEMINI_API_KEY_2;

    try {
      let model;
      if (geminiKey) {
        const { createGoogleGenerativeAI } = await import("@ai-sdk/google");
        const google = createGoogleGenerativeAI({ apiKey: geminiKey });
        model = google("gemini-2.5-flash");
      } else if (process.env.GROQ_API_KEY) {
        model = getGroq()("llama-3.1-8b-instant");
      } else {
        return args.query;
      }

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
      console.error("Failed to generate HyDE:", error);
      return args.query;
    }
  },
});
