import { v } from "convex/values";
import { api, internal } from "../_generated/api";
import { action } from "../_generated/server";

const sourceValidator = v.object({
  entryId: v.string(),
  url: v.string(),
  title: v.string(),
  relevanceScore: v.number(),
  excerpt: v.string(),
});

const _api: any = api;
const _internal: any = internal;

export const retrieveContext = action({
  args: {
    question: v.string(),
  },
  returns: v.object({
    intent: v.string(),
    context: v.string(),
    sources: v.array(sourceValidator),
    cachedResponse: v.union(v.string(), v.null()),
    model: v.optional(v.string()),
    queryEmbedding: v.array(v.float64()),
  }),
  handler: async (ctx, args) => {
    let intent: string;
    try {
      intent = await ctx.runAction(_api.rag.routing.classifyQueryAction, {
        query: args.question,
      });
    } catch (error) {
      console.error("Intent classification failed, defaulting to 'general':", error);
      intent = "general";
    }

    if (intent === "off_topic") {
      return {
        intent,
        context: "",
        sources: [],
        cachedResponse:
          "I am UET GPT, designed to answer questions about UET Taxila. It seems your query is about another topic. How can I help you with UET Taxila admissions, fee structures, departments, or campus life instead?",
        queryEmbedding: [],
      };
    }

    const [rewrittenQuery, hydeQuery] = await Promise.allSettled([
      ctx.runAction(_api.rag.routing.rewriteQueryAction, { query: args.question }),
      ctx.runAction(_api.rag.routing.hydeQueryAction, { query: args.question }),
    ]);

    const rewrittenQueryText =
      rewrittenQuery.status === "fulfilled" ? rewrittenQuery.value : args.question;
    const hydeQueryText = hydeQuery.status === "fulfilled" ? hydeQuery.value : args.question;

    let queryEmbedding: number[];
    try {
      queryEmbedding = await ctx.runAction(_api.embeddings.generate.generate, {
        text: hydeQueryText || rewrittenQueryText || args.question,
      });
    } catch (e) {
      console.error("Failed to generate embedding, falling back to empty vector", e);
      queryEmbedding = [];
    }

    if (queryEmbedding.length > 0) {
      try {
        const cached = await ctx.runAction(_api.cache.get.get, {
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
      } catch (e) {
        console.warn("Semantic cache check failed, continuing with search:", e);
      }
    }

    let searchResults: {
      entryId: string;
      url: string;
      title: string;
      relevanceScore: number;
      content: string;
    }[] = [];
    if (queryEmbedding.length > 0) {
      try {
        searchResults = await ctx.runAction(_api.embeddings.search.searchDocumentsAction, {
          queryText: rewrittenQueryText || args.question,
          queryEmbedding,
          limit: 10,
        });
      } catch (e) {
        console.error("Search failed:", e);
      }
    }

    const sources = searchResults.map((r) => ({
      entryId: r.entryId,
      url: r.url,
      title: r.title,
      relevanceScore: r.relevanceScore,
      excerpt: r.content.substring(0, 300),
    }));

    const buildContextRef = _internal.rag.context.buildContext;

    let context = "";
    if (searchResults.length > 0) {
      try {
        context = await ctx.runQuery(buildContextRef, {
          chunks: searchResults.map((r) => ({
            content: r.content,
            relevanceScore: r.relevanceScore,
            url: r.url,
            title: r.title,
          })),
          maxTokens: 3000,
        });
      } catch (e) {
        console.error("Context building failed, falling back to raw concatenation:", e);
        context = searchResults.map((r) => r.content).join("\n\n---\n\n");
      }
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
