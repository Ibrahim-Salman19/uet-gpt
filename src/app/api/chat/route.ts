import { createCerebras } from "@ai-sdk/cerebras";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createGroq } from "@ai-sdk/groq";
import { auth } from "@clerk/nextjs/server";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { type LanguageModel, streamText } from "ai";
import { api } from "convex/_generated/api";
import { ConvexHttpClient } from "convex/browser";
import { after, type NextRequest, NextResponse } from "next/server";

// Rate limiting setup with Upstash Redis
// Fallback to in-memory rate limiting if environment variables are not set
let ratelimit: Ratelimit | null = null;
const FALLBACK_WINDOW = 60_000;
const FALLBACK_MAX = 20;
const fallbackRateLimitMap = new Map<string, { count: number; resetAt: number }>();

const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;

if (redisUrl && redisToken) {
  try {
    const redis = new Redis({
      url: redisUrl,
      token: redisToken,
    });
    ratelimit = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(20, "60 s"),
      analytics: true,
      prefix: "uetgpt_ratelimit",
    });
  } catch (error) {
    console.error("Failed to initialize Upstash Redis rate limiter, using fallback:", error);
  }
} else {
  console.warn("Upstash Redis credentials missing. Using local in-memory rate limiter.");
}

async function isRateLimited(key: string): Promise<boolean> {
  if (ratelimit) {
    try {
      const result = await ratelimit.limit(key);
      return !result.success;
    } catch (error) {
      console.error("Upstash rate limit check failed, using fallback:", error);
    }
  }

  // Fallback in-memory rate limiter
  const now = Date.now();
  const entry = fallbackRateLimitMap.get(key);
  if (!entry || now > entry.resetAt) {
    fallbackRateLimitMap.set(key, { count: 1, resetAt: now + FALLBACK_WINDOW });
    return false;
  }
  if (entry.count >= FALLBACK_MAX) return true;
  entry.count++;
  return false;
}

// Clean up in-memory rate limit map periodically
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of fallbackRateLimitMap) {
      if (now > entry.resetAt) fallbackRateLimitMap.delete(key);
    }
  }, 120_000);
}

function extractText(message: {
  content?: string;
  parts?: { type: string; text: string }[];
}): string {
  if (message.content) return message.content;
  if (message.parts) {
    return message.parts
      .filter((p) => p.type === "text")
      .map((p) => p.text)
      .join("");
  }
  return "";
}

function getAvailableModels(): LanguageModel[] {
  const groq = createGroq({ apiKey: process.env.GROQ_API_KEY || "" });
  const google = createGoogleGenerativeAI({
    apiKey: process.env.GEMINI_API_KEY || "",
  });
  const cerebras = createCerebras({
    apiKey: process.env.CEREBRAS_API_KEY || "",
  });

  const models: LanguageModel[] = [];

  if (process.env.GROQ_API_KEY) {
    models.push(groq("meta-llama/llama-4-scout-17b-16e-instruct"));
  }
  if (process.env.CEREBRAS_API_KEY) {
    models.push(cerebras("llama-3.3-70b"));
  }
  if (process.env.GROQ_API_KEY) {
    models.push(groq("llama-3.1-8b-instant"));
  }
  if (process.env.GEMINI_API_KEY) {
    models.push(google("gemini-1.5-flash"));
  }

  return models;
}

async function tryStreamWithFallback(
  models: LanguageModel[],
  config: {
    system: string;
    messages: unknown[];
    temperature: number;
    maxOutputTokens: number;
    onFinish?: (text: string, model: string) => void;
  },
) {
  let lastError: unknown;
  for (const model of models) {
    try {
      const result = streamText({
        model,
        system: config.system,
        messages: config.messages,
        temperature: config.temperature,
        maxOutputTokens: config.maxOutputTokens,
      } as Parameters<typeof streamText>[0]);

      // Read the first chunk to verify the handshake is successful before returning
      const reader = result.textStream.getReader();
      const first = await reader.read();

      // Reconstruct the stream with the first chunk prepended
      const textStream = new ReadableStream({
        async start(controller) {
          let accumulatedText = "";
          if (!first.done && first.value !== undefined) {
            controller.enqueue(first.value);
            accumulatedText += first.value;
          }
          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) {
                controller.close();
                if (config.onFinish) {
                  const m = model as any;
                  config.onFinish(accumulatedText, m.modelId || m.provider || "unknown");
                }
                break;
              }
              controller.enqueue(value);
              accumulatedText += value;
            }
          } catch (e) {
            controller.error(e);
          } finally {
            reader.releaseLock();
          }
        },
        cancel() {
          reader.cancel();
          reader.releaseLock();
        },
      });

      // Override the textStream property on the result object
      Object.defineProperty(result, "textStream", {
        value: textStream,
        writable: true,
        configurable: true,
      });

      return result;
    } catch (error) {
      console.warn("Model failed, trying fallback:", error);
      lastError = error;
    }
  }
  throw lastError || new Error("All LLM providers failed");
}

function buildSystemPrompt(context: string | null, intent: string): string {
  const parts: string[] = ["You are UET GPT, an intelligent assistant for UET Taxila."];

  if (context) {
    parts.push(
      `Here is relevant context from UET Taxila's official sources:\n\n${context}\n\nUse this context to answer the user's question. If the context doesn't contain enough information, say so clearly and provide what you know. Always cite sources when possible.`,
    );
  } else {
    parts.push(
      "You don't have specific context for this question. Answer based on your general knowledge about UET Taxila, but note when you're uncertain.",
    );
  }

  if (intent === "off_topic") {
    parts.push(
      "The user's query appears to be off-topic. Politely redirect them to UET Taxila topics.",
    );
  }

  parts.push(
    "Guidelines:\n- Be concise and accurate\n- Cite sources when using specific information\n- If unsure, acknowledge uncertainty\n- Respond in the same language as the user's query",
  );

  return parts.join("\n\n");
}

export async function POST(req: NextRequest) {
  try {
    // 1. Enforce Authentication at the API route level
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip") ||
      "unknown";

    // 2. Perform Rate Limit check using Auth user ID (preferred) or IP address
    const rateLimitKey = userId || ip;
    if (await isRateLimited(rateLimitKey)) {
      return NextResponse.json(
        { error: "Too many requests. Please wait before sending another message." },
        { status: 429 },
      );
    }

    const body = await req.json();
    const rawMessages: unknown[] = body.messages;

    if (!Array.isArray(rawMessages) || rawMessages.length === 0) {
      return NextResponse.json({ error: "Messages array is required" }, { status: 400 });
    }

    const lastMessage = rawMessages[rawMessages.length - 1] as {
      content?: string;
      parts?: { type: string; text: string }[];
    };
    const question = extractText(lastMessage);

    const messages = rawMessages.map((m: any) => {
      let textContent = m.content;
      if (!textContent && m.parts) {
        textContent = m.parts
          .filter((p: any) => p.type === "text")
          .map((p: any) => p.text)
          .join("");
      }
      return {
        role: m.role,
        content: textContent || "",
      };
    });

    if (!question) {
      return NextResponse.json({ error: "Message content is required" }, { status: 400 });
    }

    const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
    if (!convexUrl) {
      return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
    }

    const convex = new ConvexHttpClient(convexUrl);

    const ragResult = await convex.action(api.rag.retrieval.retrieveContext, {
      question,
    });

    if (ragResult.cachedResponse) {
      return new Response(ragResult.cachedResponse, {
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "X-Sources": JSON.stringify(ragResult.sources),
          "X-Intent": ragResult.intent,
        },
      });
    }

    const models = getAvailableModels();
    if (models.length === 0) {
      return NextResponse.json({ error: "No AI providers available" }, { status: 500 });
    }

    const systemPrompt = buildSystemPrompt(ragResult.context, ragResult.intent);

    const result = await tryStreamWithFallback(models, {
      system: systemPrompt,
      messages: messages as any,
      temperature: 0.3,
      maxOutputTokens: 2000,
      onFinish: (text, modelName) => {
        if (ragResult.queryEmbedding && ragResult.queryEmbedding.length > 0) {
          // Write the response to the semantic cache asynchronously in the background
          after(async () => {
            try {
              await convex.mutation((api as any).cache.set.set, {
                queryText: question,
                queryEmbedding: ragResult.queryEmbedding,
                response: text,
                sources: ragResult.sources,
                model: modelName,
              });
            } catch (err) {
              console.error("Failed to write to semantic cache:", err);
            }
          });
        }
      },
    });

    return result.toTextStreamResponse({
      headers: {
        "X-Sources": JSON.stringify(ragResult.sources),
        "X-Intent": ragResult.intent,
      },
    });
  } catch (error) {
    console.error("Chat API error:", error);
    const isDev = process.env.NODE_ENV === "development";
    return NextResponse.json(
      { error: isDev && error instanceof Error ? error.message : "An unexpected error occurred" },
      { status: 500 },
    );
  }
}
