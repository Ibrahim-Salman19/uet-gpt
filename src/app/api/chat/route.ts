import { createCerebras } from "@ai-sdk/cerebras";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createGroq } from "@ai-sdk/groq";
import { auth } from "@clerk/nextjs/server";
import { type LanguageModel, streamText } from "ai";
import { api } from "convex/_generated/api";
import { ConvexHttpClient } from "convex/browser";
import { after, type NextRequest, NextResponse } from "next/server";
import { getRoleFromClaims, isAdminRole } from "@/lib/clerk-claims";
import { checkChatRateLimit } from "@/lib/rate-limit";
import { LLM_FALLBACK_CHAIN } from "@/lib/llm-models";


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

const MODEL_MAPPING: Record<string, { id: string; provider: string }> = {
  "llama-4-scout": { id: "meta-llama/llama-4-scout-17b-16e-instruct", provider: "groq" },
  "llama-3.3-70b": { id: "llama-3.3-70b-versatile", provider: "groq" },
  "llama-3.1-8b": { id: "llama-3.1-8b-instant", provider: "groq" },
};

function getAvailableModels(preferredModelKey?: string): LanguageModel[] {
  const groq = createGroq({ apiKey: process.env.GROQ_API_KEY || "" });
  const google = createGoogleGenerativeAI({
    apiKey: process.env.GEMINI_API_KEY || "",
  });
  const cerebras = createCerebras({
    apiKey: process.env.CEREBRAS_API_KEY || "",
  });

  const models: LanguageModel[] = [];

  let chain = [...LLM_FALLBACK_CHAIN];
  if (preferredModelKey && MODEL_MAPPING[preferredModelKey]) {
    const preferredConfig = MODEL_MAPPING[preferredModelKey];
    chain = [preferredConfig, ...LLM_FALLBACK_CHAIN.filter((m) => m.id !== preferredConfig.id)];
  }

  for (const modelConfig of chain) {
    if (modelConfig.provider === "groq" && process.env.GROQ_API_KEY) {
      models.push(groq(modelConfig.id));
    } else if (modelConfig.provider === "cerebras" && process.env.CEREBRAS_API_KEY) {
      models.push(cerebras(modelConfig.id));
    } else if (modelConfig.provider === "google" && process.env.GEMINI_API_KEY) {
      models.push(google(modelConfig.id));
    }
  }

  return models;
}

// Note: This logic is duplicated in convex/rag/ask.ts as robustStreamText
// to avoid cross-boundary imports between Next.js Edge and Convex Isolates.
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
      // Determine model-specific temperature: reasoning models must run at temperature=1.0
      const isReasoningModel = (model as any).modelId === "gpt-oss-120b";
      const resolvedTemp = isReasoningModel ? 1.0 : config.temperature;

      const result = streamText({
        model,
        system: config.system,
        messages: config.messages,
        temperature: resolvedTemp,
        maxOutputTokens: config.maxOutputTokens,
      } as Parameters<typeof streamText>[0]);

      // Read the first chunk to verify the handshake is successful before returning
      const reader = result.textStream.getReader();
      const first = await reader.read();

      // Reconstruct the stream with the first chunk prepended and thinking tokens stripped
      const textStream = new ReadableStream({
        async start(controller) {
          let accumulatedText = "";
          let inThinking = false;
          let pendingBuffer = "";

          function processChunk(value: string) {
            let text = pendingBuffer + value;
            pendingBuffer = "";

            while (text.length > 0) {
              if (!inThinking) {
                const index = text.indexOf("<think>");
                if (index !== -1) {
                  // Enqueue everything before <think>
                  if (index > 0) {
                    const toEnqueue = text.substring(0, index);
                    controller.enqueue(toEnqueue);
                    accumulatedText += toEnqueue;
                  }
                  inThinking = true;
                  text = text.substring(index + 7);
                } else {
                  // Look for partial "<think>" at the end of the text
                  let partialIndex = -1;
                  for (let i = 1; i < 7; i++) {
                    if (text.endsWith("<think>".substring(0, i))) {
                      partialIndex = text.length - i;
                      break;
                    }
                  }
                  if (partialIndex !== -1) {
                    pendingBuffer = text.substring(partialIndex);
                    const toEnqueue = text.substring(0, partialIndex);
                    if (toEnqueue.length > 0) {
                      controller.enqueue(toEnqueue);
                      accumulatedText += toEnqueue;
                    }
                    text = "";
                  } else {
                    controller.enqueue(text);
                    accumulatedText += text;
                    text = "";
                  }
                }
              } else {
                const index = text.indexOf("</think>");
                if (index !== -1) {
                  inThinking = false;
                  text = text.substring(index + 8);
                } else {
                  // Look for partial "</think>" at the end of the text
                  let partialIndex = -1;
                  for (let i = 1; i < 8; i++) {
                    if (text.endsWith("</think>".substring(0, i))) {
                      partialIndex = text.length - i;
                      break;
                    }
                  }
                  if (partialIndex !== -1) {
                    pendingBuffer = text.substring(partialIndex);
                    text = "";
                  } else {
                    // Suppress all of it since we are in thinking mode
                    text = "";
                  }
                }
              }
            }
          }

          if (!first.done && first.value !== undefined) {
            processChunk(first.value);
          }

          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) {
                // If there's any remaining buffer that was not a full tag, enqueue it
                if (pendingBuffer.length > 0 && !inThinking && !pendingBuffer.startsWith("<")) {
                  controller.enqueue(pendingBuffer);
                  accumulatedText += pendingBuffer;
                }
                controller.close();
                if (config.onFinish) {
                  const m = model as any;
                  config.onFinish(accumulatedText, m.modelId || m.provider || "unknown");
                }
                break;
              }
              processChunk(value);
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

// TASK-B03: Mirror of crawler.py assign_tier() — derives freshnessTier from URL.
// Used to set cache TTL matching content volatility.
function assignTier(url: string): "high" | "medium" | "low" {
  const lower = url.toLowerCase();
  if (
    lower === "https://web.uettaxila.edu.pk/" ||
    lower === "https://uettaxila.edu.pk/" ||
    lower.includes("admission") ||
    lower.includes("academic")
  ) {
    return "high";
  }
  if (lower.includes("department") || lower.includes("faculty")) {
    return "medium";
  }
  return "low";
}

export async function POST(req: NextRequest) {
  try {
    // 1. CSRF Protection - Verify Origin and Referer
    const origin = req.headers.get("origin");
    const referer = req.headers.get("referer");
    const allowed = [process.env.NEXT_PUBLIC_APP_URL].filter(Boolean);

    // In development mode, allow localhost/127.0.0.1
    if (process.env.NODE_ENV === "development") {
      allowed.push("http://localhost:3000");
    }

    if (origin && !allowed.includes(origin)) {
      return new Response("Forbidden: CSRF check failed (origin)", { status: 403 });
    }

    if (referer) {
      try {
        const refererUrl = new URL(referer);
        if (!allowed.includes(refererUrl.origin)) {
          return new Response("Forbidden: CSRF check failed (referer)", { status: 403 });
        }
      } catch {
        return new Response("Forbidden: Invalid referer", { status: 400 });
      }
    }

    // 2. DoS Guard: Enforce strict request body size limit (100KB)
    const MAX_BODY = 100 * 1024; // 100KB
    const bodyText = await req.text();
    if (bodyText.length > MAX_BODY) {
      return NextResponse.json({ error: "Request body too large" }, { status: 413 });
    }

    const body = JSON.parse(bodyText);

    // 3. Enforce Authentication at the API route level
    const { userId, sessionClaims } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip") ||
      "unknown";

    // 4. Perform Rate Limit check using Auth user ID (preferred) or IP address
    const rateLimitKey = userId || ip;
    const role = getRoleFromClaims(sessionClaims as any);
    const resolvedRole = isAdminRole(role) ? "admin" : "user";
    const rateLimitResult = await checkChatRateLimit(rateLimitKey, resolvedRole);
    if (rateLimitResult && !rateLimitResult.success) {
      return NextResponse.json(
        { error: "Too many requests. Please wait before sending another message." },
        { status: 429 },
      );
    }

    const rawMessages: unknown[] = body.messages;

    if (!Array.isArray(rawMessages) || rawMessages.length === 0) {
      return NextResponse.json({ error: "Messages array is required" }, { status: 400 });
    }

    // 5. DoS Guard: Validate per-message length cap (8000 chars)
    for (const msg of rawMessages as any[]) {
      const content = msg.content || "";
      if (typeof content === "string" && content.length > 8000) {
        return NextResponse.json(
          { error: "Message length exceeds the limit of 8000 characters" },
          { status: 400 },
        );
      }
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
          "X-Sources": Buffer.from(JSON.stringify(ragResult.sources)).toString("base64"),
          "X-Intent": ragResult.intent,
        },
      });
    }

    let preferredModelKey: string | undefined;
    try {
      const userDoc = await convex.query(api.users.getByClerkId, { clerkId: userId });
      if (userDoc?.preferences?.model) {
        preferredModelKey = userDoc.preferences.model;
      }
    } catch (err) {
      console.error("Failed to query user preferences from Convex:", err);
    }

    const models = getAvailableModels(preferredModelKey);
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
              // TASK-B03: derive freshnessTier from top source URL for TTL matching
              const topSourceUrl = ragResult.sources[0]?.url ?? "";
              const freshnessTier = assignTier(topSourceUrl);
              await convex.mutation(api.cache.set.set, {
                queryText: question,
                queryEmbedding: ragResult.queryEmbedding,
                response: text,
                sources: ragResult.sources,
                model: modelName,
                freshnessTier,
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
        "X-Sources": Buffer.from(JSON.stringify(ragResult.sources)).toString("base64"),
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
