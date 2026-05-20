import { createTextStreamResponse, type LanguageModel } from "ai";
import { httpRouter } from "convex/server";
import { api } from "./_generated/api";
import { httpAction } from "./_generated/server";
import { getFallbackModels, robustStreamText } from "./rag/ask";
import { SYSTEM_PROMPT } from "./rag/prompts";

const http = httpRouter();

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

http.route({
  path: "/api/chat",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    try {
      const { question, threadId, userId } = await request.json();

      if (!question || !threadId || !userId) {
        return new Response(
          JSON.stringify({ error: "Missing required fields: question, threadId, userId" }),
          {
            status: 400,
            headers: { "Content-Type": "application/json", ...CORS_HEADERS },
          },
        );
      }

      // 1. Insert user message in database immediately
      await ctx.runMutation(api.messages.insert, {
        threadId,
        role: "user",
        content: question,
      });

      // 2. Retrieve Context, classification, embeddings, and semantic cache
      const contextData = await ctx.runAction(api.rag.ask.retrieveContext, {
        question,
      });

      const { intent, context, sources, cachedResponse, queryEmbedding } = contextData;

      // 3. Handle cached response
      if (cachedResponse) {
        await ctx.runMutation(api.messages.insert, {
          threadId,
          role: "assistant",
          content: cachedResponse,
          sources,
        });

        return createTextStreamResponse({
          textStream: new ReadableStream({
            start(controller) {
              controller.enqueue(cachedResponse);
              controller.close();
            },
          }),
          headers: CORS_HEADERS,
        });
      }

      // 4. Fetch fallback models
      const models = getFallbackModels(intent);
      if (models.length === 0) {
        const errResponse =
          "I'm sorry, but no AI model providers are currently configured. Please configure your API keys.";

        await ctx.runMutation(api.messages.insert, {
          threadId,
          role: "assistant",
          content: errResponse,
        });

        return createTextStreamResponse({
          textStream: new ReadableStream({
            start(controller) {
              controller.enqueue(errResponse);
              controller.close();
            },
          }),
          headers: CORS_HEADERS,
        });
      }

      // 5. Compile messages for prompt execution
      const systemMsg = SYSTEM_PROMPT.replace("{context}", context);

      // 6. Trigger fallback chain execution
      const { result, model } = await robustStreamText(models, {
        messages: [
          { role: "system", content: systemMsg },
          { role: "user", content: question },
        ],
        temperature: 0.3,
        maxOutputTokens: 2048,
      });

      // 7. Save to DB when stream finishes
      Promise.resolve(result.text)
        .then(async (textResponse) => {
          await ctx.runMutation(api.messages.insert, {
            threadId,
            role: "assistant",
            content: textResponse,
            sources,
            tokenCount: {
              prompt: 0,
              completion: 0,
              total: 0,
            },
          });

          if (queryEmbedding && queryEmbedding.length > 0) {
            try {
              await ctx.runMutation(api.cache.set.set, {
                queryText: question,
                queryEmbedding,
                response: textResponse,
                sources,
                model: modelName(model),
              });
            } catch (cacheError) {
              console.error("Failed to write to semantic cache:", cacheError);
            }
          }
        })
        .catch((e: unknown) => {
          console.error("Stream processing failed:", e);
        });

      // 8. Return SSE stream response
      return result.toUIMessageStreamResponse({ headers: CORS_HEADERS });
    } catch (e) {
      console.error("Critical error in POST /api/chat HTTP action:", e);
      return new Response(
        JSON.stringify({ error: e instanceof Error ? e.message : "Internal Server Error" }),
        {
          status: 500,
          headers: { "Content-Type": "application/json", ...CORS_HEADERS },
        },
      );
    }
  }),
});

function modelName(model: LanguageModel | string): string {
  if (typeof model === "string") return model;
  if (model?.modelId) return model.modelId;
  return String(model);
}

export default http;
