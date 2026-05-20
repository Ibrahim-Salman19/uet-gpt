import { createGroq } from "@ai-sdk/groq";
import { generateObject, generateText } from "ai";
import { v } from "convex/values";
import { z } from "zod";
import { action } from "../_generated/server";

const groq = createGroq({
  apiKey: process.env.GROQ_API_KEY || "",
});

export const classifyQueryAction = action({
  args: { query: v.string() },
  handler: async (ctx, args) => {
    if (!process.env.GROQ_API_KEY) {
      console.warn("GROQ_API_KEY missing, falling back to 'general' category");
      return "general";
    }

    try {
      const { object } = await generateObject({
        model: groq("llama-3.1-8b-instant"),
        schema: z.object({
          intent: z
            .enum([
              "admissions",
              "academic",
              "administrative",
              "campus_life",
              "general",
              "off_topic",
              "simple_fact",
            ])
            .describe("The category of the user's query regarding UET Taxila."),
        }),
        prompt: `Classify the following user query about UET Taxila into one of the categories. Query: "${args.query}"`,
      });
      return object.intent;
    } catch (error) {
      console.error("Failed to classify query:", error);
      return "general";
    }
  },
});

export const rewriteQueryAction = action({
  args: { query: v.string() },
  handler: async (ctx, args) => {
    if (!process.env.GROQ_API_KEY) return args.query;

    try {
      const { text } = await generateText({
        model: groq("llama-3.1-8b-instant"),
        system:
          "You are a search expert. Rewrite the user's query to be a concise keyword-rich search query. Expand abbreviations like 'UET' to 'University of Engineering and Technology'. Output ONLY the rewritten query, nothing else.",
        prompt: args.query,
      });
      return text.trim();
    } catch (error) {
      console.error("Failed to rewrite query:", error);
      return args.query;
    }
  },
});

export const hydeQueryAction = action({
  args: { query: v.string() },
  handler: async (ctx, args) => {
    if (!process.env.GROQ_API_KEY) return args.query;

    try {
      const { text } = await generateText({
        model: groq("llama-3.1-8b-instant"),
        system:
          "You are an expert on UET Taxila. Write a hypothetical, 3-5 sentence factual paragraph that directly answers the user's query. Pretend you are writing an official website excerpt.",
        prompt: args.query,
      });
      return text.trim();
    } catch (error) {
      console.error("Failed to generate HyDE:", error);
      return args.query;
    }
  },
});
