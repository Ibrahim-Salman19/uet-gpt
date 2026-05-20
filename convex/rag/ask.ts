import { createCerebras } from "@ai-sdk/cerebras";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createGroq } from "@ai-sdk/groq";
import { type LanguageModel, streamText } from "ai";
import { v } from "convex/values";
import { api } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { action } from "../_generated/server";

interface SearchResult {
  documentId: Id<"documents">;
  _id: Id<"chunks">;
  url: string;
  title: string;
  relevanceScore: number;
  content: string;
}

// Initialize LLM Providers
const groq = createGroq({ apiKey: process.env.GROQ_API_KEY || "" });
const google = createGoogleGenerativeAI({ apiKey: process.env.GEMINI_API_KEY || "" });
const cerebras = createCerebras({ apiKey: process.env.CEREBRAS_API_KEY || "" });

function modelName(model: LanguageModel | string): string {
  if (typeof model === "string") return model;
  if (model?.modelId) return model.modelId;
  return String(model);
}

/**
 * robustStreamText tries to stream using the specified models in order.
 * If a model fails to connect (e.g., 429 Rate Limit, timeout), it catches the error
 * on the result.response promise and immediately falls back to the next model.
 */
export async function robustStreamText(
  models: LanguageModel[],
  options: Omit<Parameters<typeof streamText>[0], "model">,
) {
  let lastError: unknown;
  for (const model of models) {
    try {
      console.log(`Attempting RAG stream with model: ${modelName(model)}`);
      const result = streamText({ ...options, model } as Parameters<typeof streamText>[0]);
      // Awaiting result.response checks the connection/handshake (resolves on headers).
      // If rate limited or service is down, this immediately throws an error.
      await result.response;
      return { result, model };
    } catch (error) {
      console.warn(`Model ${modelName(model)} handshake failed:`, error);
      lastError = error;
    }
  }
  throw lastError || new Error("All fallback models failed.");
}

/**
 * getFallbackModels returns the array of valid configured language models.
 * In a zero-budget setup, we fall back between Groq, Cerebras, and Gemini.
 */
export function getFallbackModels(_intent: string) {
  const models: LanguageModel[] = [];

  // 1. Groq Llama 4 Scout (Primary for complex RAG)
  if (process.env.GROQ_API_KEY) {
    models.push(groq("meta-llama/llama-4-scout-17b-16e-instruct"));
  }

  // 2. Cerebras Llama 3.3 70B (Primary for speed / simple queries, secondary for RAG)
  if (process.env.CEREBRAS_API_KEY) {
    models.push(cerebras("llama-3.3-70b"));
  }

  // 3. Groq Llama 3.1 8B (Fast fallback)
  if (process.env.GROQ_API_KEY) {
    models.push(groq("llama-3.1-8b-instant"));
  }

  // 4. Google Gemini 1.5 Flash (Reliable high-limit fallback)
  if (process.env.GEMINI_API_KEY) {
    // Standard GA model for stability
    models.push(google("gemini-1.5-flash"));
  }

  return models;
}

export const retrieveContext = action({
  args: {
    question: v.string(),
  },
  handler: async (ctx, args) => {
    // 1. Intent Classification
    const intent = await ctx.runAction(api.rag.routing.classifyQueryAction, {
      query: args.question,
    });

    if (intent === "off_topic") {
      return {
        intent,
        context: "",
        sources: [],
        cachedResponse:
          "I am UET GPT, designed to answer questions about UET Taxila. It seems your query is about another topic. How can I help you with UET Taxila admissions, fee structures, departments, or campus life instead?",
        queryEmbedding: [] as number[],
      };
    }

    // 2. Query Rewriting and HyDE
    const rewrittenQuery = await ctx.runAction(api.rag.routing.rewriteQueryAction, {
      query: args.question,
    });

    const hydeQuery = await ctx.runAction(api.rag.routing.hydeQueryAction, {
      query: args.question,
    });

    // 3. Embedding Generation
    let queryEmbedding: number[];
    try {
      queryEmbedding = await ctx.runAction(api.embeddings.generate.generate, {
        text: hydeQuery || rewrittenQuery || args.question,
      });
    } catch (e) {
      console.error("Failed to generate embedding, falling back to empty vector", e);
      queryEmbedding = [];
    }

    // 4. Semantic Cache Check (Only if we have a valid embedding)
    if (queryEmbedding.length > 0) {
      const cached = await ctx.runAction(api.cache.get.get, {
        queryText: args.question,
        queryEmbedding,
      });

      if (cached) {
        console.log("Semantic Cache Hit!");
        return {
          intent,
          context: "",
          sources: cached.sources,
          cachedResponse: cached.response,
          model: cached.model,
          queryEmbedding,
        };
      }
    }

    // 5. Hybrid search retrieval
    let searchResults: SearchResult[] = [];
    if (queryEmbedding.length > 0) {
      try {
        searchResults = await ctx.runAction(api.embeddings.search.searchDocumentsAction, {
          queryText: rewrittenQuery || args.question,
          queryEmbedding,
          limit: 10,
        });
      } catch (e) {
        console.error("Search failed:", e);
      }
    }

    const sources = searchResults.map((r) => ({
      documentId: r.documentId,
      chunkId: r._id,
      url: r.url,
      title: r.title,
      relevanceScore: r.relevanceScore,
      excerpt: r.content.substring(0, 300),
    }));

    // 6. Context Assembly via Sandwich Strategy
    let context = "";
    if (searchResults.length > 0) {
      context = await ctx.runAction(api.rag.context.buildContextAction, {
        chunks: searchResults,
        maxTokens: 3000,
      });
    }

    return {
      intent,
      context,
      sources,
      cachedResponse: null,
      queryEmbedding,
    };
  },
});
