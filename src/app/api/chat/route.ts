import { createCerebras } from "@ai-sdk/cerebras";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createGroq } from "@ai-sdk/groq";
import { auth } from "@clerk/nextjs/server";
import { type LanguageModel, streamText } from "ai";
import { api } from "convex/_generated/api";
import { ConvexHttpClient } from "convex/browser";
import { after, type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getRoleFromClaims, isAdminRole } from "@/lib/clerk-claims";
import { LLM_FALLBACK_CHAIN } from "@/lib/llm-models";
import { buildSystemPrompt, extractText } from "@/lib/prompt";
import { checkChatRateLimit } from "@/lib/rate-limit";
// Rate limiting is enforced server-side in convex/messages.ts via enforceRateLimit
import { assignFreshnessTier } from "../../../../convex/crawl/chunking";

function getAllowedOrigins(req: NextRequest): string[] {
  const allowed = [process.env.NEXT_PUBLIC_APP_URL]
    .filter((url): url is string => !!url)
    .map((url) => url.replace(/\/$/, ""));
  if (process.env.NODE_ENV === "development") {
    allowed.push("http://localhost:3000");
  }
  // Derive the app's own origin from the Host header as a safe fallback.
  // This prevents a total outage when NEXT_PUBLIC_APP_URL is not set in env vars.
  // Same-host requests cannot be CSRF by definition.
  const host = req.headers.get("host");
  if (host) {
    const proto = req.headers.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
    const selfOrigin = `${proto}://${host}`;
    if (!allowed.includes(selfOrigin)) {
      allowed.push(selfOrigin);
    }
  }
  return allowed;
}

function checkOrigin(origin: string | null, allowed: string[]): NextResponse | null {
  if (origin && !allowed.includes(origin)) {
    return new NextResponse("Forbidden: CSRF check failed (origin)", { status: 403 });
  }
  return null;
}

function checkReferer(referer: string | null, allowed: string[]): NextResponse | null {
  if (!referer) return null;
  try {
    const refererUrl = new URL(referer);
    if (!allowed.includes(refererUrl.origin)) {
      return new NextResponse("Forbidden: CSRF check failed (referer)", { status: 403 });
    }
  } catch {
    return new NextResponse("Forbidden: Invalid referer", { status: 400 });
  }
  return null;
}

function checkCsrf(req: NextRequest): NextResponse | null {
  const origin = req.headers.get("origin");
  const referer = req.headers.get("referer");
  const allowed = getAllowedOrigins(req);

  // Require at least one of Origin or Referer (block requests with neither)
  if (!origin && !referer) {
    return new NextResponse("Forbidden: CSRF check failed (missing origin/referer)", {
      status: 403,
    });
  }

  return checkOrigin(origin, allowed) ?? checkReferer(referer, allowed);
}

const MessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().max(8000).optional(),
  parts: z.array(z.object({ type: z.string(), text: z.string() })).optional(),
});

const ChatRequestSchema = z
  .object({
    messages: z.array(MessageSchema).min(1),
  })
  .refine((data) => data.messages.every((m) => m.content || (m.parts && m.parts.length > 0)), {
    message: "Each message must have content or parts",
  });

function parseBodyOrError(
  bodyText: string,
):
  | { messages: { role: string; content: string }[]; rawMessages: z.infer<typeof MessageSchema>[] }
  | NextResponse {
  const MAX_BODY = 100 * 1024;
  if (bodyText.length > MAX_BODY) {
    return NextResponse.json({ error: "Request body too large" }, { status: 413 });
  }

  let body: unknown;
  try {
    body = JSON.parse(bodyText);
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = ChatRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request body", details: parsed.error.issues },
      { status: 400 },
    );
  }

  const messages = parsed.data.messages.map((m) => ({
    role: m.role,
    content: extractText(m as { content?: string; parts?: { type: string; text: string }[] }),
  }));

  return { messages, rawMessages: parsed.data.messages };
}

function extractClientIp(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
}

function resolveClientRole(sessionClaims: Record<string, unknown>): "admin" | "user" {
  const role = getRoleFromClaims(sessionClaims);
  return isAdminRole(role) ? "admin" : "user";
}

async function getAuthAndRole(
  req: NextRequest,
): Promise<{ userId: string; role: "admin" | "user"; ip: string } | NextResponse> {
  const { userId, sessionClaims } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return { userId, role: resolveClientRole(sessionClaims), ip: extractClientIp(req) };
}

async function checkAppRateLimit(
  userId: string,
  role: "admin" | "user",
): Promise<NextResponse | null> {
  const rateLimitResult = await checkChatRateLimit(userId, role);
  if (rateLimitResult && !rateLimitResult.success) {
    return NextResponse.json(
      { error: "Too many requests. Please wait before sending another message." },
      { status: 429 },
    );
  }
  return null;
}

function initConvexOrError(): ConvexHttpClient | NextResponse {
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!convexUrl) {
    return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
  }
  return new ConvexHttpClient(convexUrl);
}

function fetchRagData(
  convex: ConvexHttpClient,
  question: string,
): Promise<
  | {
      context: string | null;
      sources: any[];
      intent: string;
      queryEmbedding: number[] | null;
      cachedResponse: string | null;
    }
  | NextResponse
> {
  return convex
    .action(api.rag.retrieval.retrieveContext, {
      question,
      secret: process.env.INTERNAL_API_SECRET,
    })
    .catch((_err) => {
      return NextResponse.json(
        { error: "RAG retrieval failed. Please try again." },
        { status: 500 },
      );
    });
}

async function getPreferredModel(
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

type ModelFactory = (modelId: string) => LanguageModel;

const PROVIDER_FACTORIES: Record<
  string,
  { create: (apiKey: string) => ModelFactory; envKey: string }
> = {
  groq: { create: (key) => createGroq({ apiKey: key }), envKey: "GROQ_API_KEY" },
  google: { create: (key) => createGoogleGenerativeAI({ apiKey: key }), envKey: "GEMINI_API_KEY" },
  cerebras: { create: (key) => createCerebras({ apiKey: key }), envKey: "CEREBRAS_API_KEY" },
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

function getAvailableModels(preferredModelKey?: string): LanguageModel[] {
  const chain = buildFallbackChain(preferredModelKey);
  return chain.flatMap((modelConfig) => {
    const factory = PROVIDER_FACTORIES[modelConfig.provider];
    if (!factory) return [];
    const apiKey = process.env[factory.envKey];
    if (!apiKey) return [];
    return [factory.create(apiKey)(modelConfig.id)];
  });
}

function flushTextFn(
  text: string,
  controller: ReadableStreamDefaultController,
  accumulated: { current: string },
) {
  if (!text) return;
  controller.enqueue(text);
  accumulated.current += text;
}

function getModelName(model: LanguageModel): string {
  const m = model as { modelId?: string; provider?: string };
  return m.modelId || m.provider || "unknown";
}

function finalizeStream(
  buffer: string,
  accumulatedText: string,
  onFinish: ((text: string, model: string) => void) | undefined,
  reader: ReadableStreamDefaultReader<string>,
  controller: ReadableStreamDefaultController,
  model: LanguageModel,
) {
  if (buffer && !buffer.startsWith("<")) {
    controller.enqueue(buffer);
  }
  controller.close();
  if (onFinish) {
    onFinish(accumulatedText, getModelName(model));
  }
}

function processChunk(
  value: string,
  buffer: { current: string },
  accumulated: { current: string },
  state: { isThinking: boolean },
  controller: ReadableStreamDefaultController,
) {
  let remaining = buffer.current + value;
  buffer.current = "";

  while (remaining.length > 0) {
    if (state.isThinking) {
      const partialCloseMatch = remaining.match(/<\/t?h?i?n?k?>?$/);
      if (partialCloseMatch) {
        buffer.current = remaining.substring(partialCloseMatch.index!);
        remaining = remaining.substring(0, partialCloseMatch.index!);
        if (remaining.length === 0) break;
      }

      const closeIdx = remaining.indexOf("</think>");
      if (closeIdx === -1) {
        remaining = "";
      } else {
        state.isThinking = false;
        remaining = remaining.substring(closeIdx + 8);
      }
    } else {
      const partialOpenMatch = remaining.match(/<t?h?i?n?k?>?$/);
      if (partialOpenMatch) {
        buffer.current = remaining.substring(partialOpenMatch.index!);
        remaining = remaining.substring(0, partialOpenMatch.index!);
        if (remaining.length === 0) break;
      }

      const openIdx = remaining.indexOf("<think>");
      if (openIdx === -1) {
        flushTextFn(remaining, controller, accumulated);
        remaining = "";
      } else {
        const before = remaining.substring(0, openIdx);
        flushTextFn(before, controller, accumulated);
        state.isThinking = true;
        remaining = remaining.substring(openIdx + 7);
      }
    }
  }
}

function streamWithStrippedThinking(
  reader: ReadableStreamDefaultReader<string>,
  model: LanguageModel,
  state: { isThinking: boolean },
  onFinish?: (text: string, model: string) => void,
): ReadableStream<string> {
  return new ReadableStream({
    async start(controller) {
      const accumulated = { current: "" };
      const buf = { current: "" };

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            finalizeStream(buf.current, accumulated.current, onFinish, reader, controller, model);
            break;
          }
          processChunk(value, buf, accumulated, state, controller);
        }
      } catch (e) {
        console.error("Stream interrupted:", e);
        controller.enqueue("\n\n[Error: Connection to AI provider lost mid-stream]");
        controller.close();
      } finally {
        reader.releaseLock();
      }
    },
    cancel() {
      reader.cancel();
    },
  });
}

function resolveTemperature(model: LanguageModel, defaultTemp: number): number {
  const isReasoningModel = (model as { modelId?: string }).modelId === "gpt-oss-120b";
  return isReasoningModel ? 1.0 : defaultTemp;
}

async function tryModelWithFallback(
  model: LanguageModel,
  config: {
    system: string;
    messages: unknown[];
    temperature: number;
    maxOutputTokens: number;
    onFinish?: (text: string, model: string) => void;
  },
) {
  const resolvedTemp = resolveTemperature(model, config.temperature);

  const result = streamText({
    model,
    system: config.system,
    messages: config.messages,
    temperature: resolvedTemp,
    maxOutputTokens: config.maxOutputTokens,
  } as Parameters<typeof streamText>[0]);

  const reader = result.textStream.getReader();

  const { done, value } = await reader.read();

  const textStream = new ReadableStream<string>({
    async start(controller) {
      if (!done && value) {
        controller.enqueue(value);
      }
      try {
        while (true) {
          const { done: d, value: val } = await reader.read();
          if (d) break;
          controller.enqueue(val);
        }
        controller.close();
      } catch (e) {
        controller.error(e);
      } finally {
        reader.releaseLock();
      }
    }
  });

  const state = { isThinking: false };
  const strippedStream = streamWithStrippedThinking(textStream.getReader(), model, state, config.onFinish);

  Object.defineProperty(result, "textStream", {
    value: strippedStream,
    writable: true,
    configurable: true,
  });

  return result;
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
      return await tryModelWithFallback(model, config);
    } catch (error) {
      console.warn("Model failed, trying fallback:", error);
      lastError = error;
    }
  }
  throw lastError || new Error("All LLM providers failed");
}

function encodeSourcesHeader(sources: any[]): string {
  const jsonString = JSON.stringify(sources);
  const bytes = new TextEncoder().encode(jsonString);
  const binString = Array.from(bytes, (byte) => String.fromCodePoint(byte)).join("");
  return btoa(binString);
}

function buildCacheWriteCallback(
  question: string,
  ragResult: any,
  convex: ConvexHttpClient,
): (text: string, modelName: string) => void {
  return (text, modelName) => {
    if (ragResult.queryEmbedding && ragResult.queryEmbedding.length > 0) {
      after(async () => {
        try {
          const [altResult] = await Promise.allSettled([
            convex.action((api as any)["cache/multiVector"].generateAlternates, {
              queryText: question,
            }),
          ]);

          const alternates =
            altResult.status === "fulfilled" && altResult.value
              ? {
                  alternateQueryTexts: altResult.value.alternateQueryTexts,
                  alternateEmbeddings: altResult.value.alternateEmbeddings,
                }
              : {};

          const topSourceUrl = Array.isArray(ragResult.sources) && ragResult.sources[0]
            ? ragResult.sources[0].url ?? ""
            : "";
          const freshnessTier = assignFreshnessTier(topSourceUrl);
          const sourceEntryIds = ragResult.sources.map((s: any) => s.entryId).filter(Boolean);

          await convex.action(api.cache.set.setFromServer, {
            secret: process.env.INTERNAL_API_SECRET,
            queryText: question,
            queryEmbedding: ragResult.queryEmbedding,
            response: text,
            sources: ragResult.sources,
            model: modelName,
            freshnessTier,
            sourceEntryIds,
            ...alternates,
          });
        } catch (err) {
          console.error("Failed to write to semantic cache:", err);
        }
      });
    }
  };
}

function errorResponse(error: unknown): NextResponse {
  console.error("Chat API error:", error);
  const isDev = process.env.NODE_ENV === "development";
  return NextResponse.json(
    { error: isDev && error instanceof Error ? error.message : "An unexpected error occurred" },
    { status: 500 },
  );
}

async function validateRequestPhase(
  req: NextRequest,
): Promise<{ messages: { role: string; content: string }[]; question: string } | NextResponse> {
  const csrfError = checkCsrf(req);
  if (csrfError) return csrfError;
  const bodyText = await req.text();
  const bodyOrError = parseBodyOrError(bodyText);
  if (bodyOrError instanceof NextResponse) return bodyOrError;
  const lastMessage = bodyOrError.messages[bodyOrError.messages.length - 1];
  if (lastMessage?.role !== "user" || !lastMessage?.content) {
    return NextResponse.json({ error: "Last message must be a user message and have content" }, { status: 400 });
  }
  return { messages: bodyOrError.messages, question: lastMessage.content };
}

async function authAndRateLimitPhase(
  req: NextRequest,
): Promise<{ userId: string; role: "admin" | "user" } | NextResponse> {
  const authResult = await getAuthAndRole(req);
  if (authResult instanceof NextResponse) return authResult;
  const rateLimitError = await checkAppRateLimit(authResult.userId, authResult.role);
  if (rateLimitError) return rateLimitError;
  return { userId: authResult.userId, role: authResult.role };
}

async function convexRagAndModelPhase(
  userId: string,
  question: string,
): Promise<
  { convex: ConvexHttpClient; ragResult: any; preferredModelKey: string | undefined } | NextResponse
> {
  const convexOrError = initConvexOrError();
  if (convexOrError instanceof NextResponse) return convexOrError;
  const ragOrError = await fetchRagData(convexOrError, question);
  if (ragOrError instanceof NextResponse) return ragOrError;
  const preferredModelKey = await getPreferredModel(convexOrError, userId);
  return { convex: convexOrError, ragResult: ragOrError, preferredModelKey };
}

async function buildStreamResponse(
  messages: { role: string; content: string }[],
  question: string,
  convex: ConvexHttpClient,
  ragResult: any,
  preferredModelKey: string | undefined,
): Promise<Response | NextResponse> {
  if (ragResult.cachedResponse) {
    return new Response(ragResult.cachedResponse, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "X-Sources": encodeSourcesHeader(ragResult.sources),
        "X-Intent": ragResult.intent,
      },
    });
  }
  const models = getAvailableModels(preferredModelKey);
  if (models.length === 0) {
    return NextResponse.json({ error: "No AI providers available" }, { status: 500 });
  }
  const systemPrompt = buildSystemPrompt(ragResult.context, ragResult.intent);
  const result = await tryStreamWithFallback(models, {
    system: systemPrompt,
    messages,
    temperature: 0.3,
    maxOutputTokens: 2000,
    onFinish: buildCacheWriteCallback(question, ragResult, convex),
  });
  return result.toTextStreamResponse({
    headers: {
      "X-Sources": encodeSourcesHeader(ragResult.sources),
      "X-Intent": ragResult.intent,
    },
  });
}

async function handlePost(req: NextRequest): Promise<Response> {
  const phase1 = await validateRequestPhase(req);
  if (phase1 instanceof NextResponse) return phase1;
  const phase2 = await authAndRateLimitPhase(req);
  if (phase2 instanceof NextResponse) return phase2;
  const phase3 = await convexRagAndModelPhase(phase2.userId, phase1.question);
  if (phase3 instanceof NextResponse) return phase3;
  return buildStreamResponse(
    phase1.messages,
    phase1.question,
    phase3.convex,
    phase3.ragResult,
    phase3.preferredModelKey,
  );
}

export async function POST(req: NextRequest) {
  try {
    return await handlePost(req);
  } catch (error) {
    return errorResponse(error);
  }
}
