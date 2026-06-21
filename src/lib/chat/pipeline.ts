import { auth } from "@clerk/nextjs/server";
import { api } from "convex/_generated/api";
import { ConvexHttpClient } from "convex/browser";
import { type NextRequest, NextResponse } from "next/server";
import { getRoleFromClaims, isAdminRole } from "@/lib/clerk-claims";
import { buildSystemPrompt } from "@/lib/prompt";
import { checkChatRateLimit } from "@/lib/rate-limit";
import { buildCacheWriteCallback, encodeSourcesHeader } from "./cache";
import { getAvailableModels, getPreferredModel } from "./models";
import { tryStreamWithFallback } from "./stream";

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
    })
    .catch((_err) => {
      return NextResponse.json(
        { error: "RAG retrieval failed. Please try again." },
        { status: 500 },
      );
    });
}

export async function authAndRateLimitPhase(
  req: NextRequest,
): Promise<{ userId: string; role: "admin" | "user" } | NextResponse> {
  const authResult = await getAuthAndRole(req);
  if (authResult instanceof NextResponse) return authResult;
  const rateLimitError = await checkAppRateLimit(authResult.userId, authResult.role);
  if (rateLimitError) return rateLimitError;
  return { userId: authResult.userId, role: authResult.role };
}

export async function convexRagAndModelPhase(
  userId: string,
  question: string,
): Promise<
  { convex: ConvexHttpClient; ragResult: any; preferredModelKey: string | undefined } | NextResponse
> {
  const convexOrError = initConvexOrError();
  if (convexOrError instanceof NextResponse) return convexOrError;

  try {
    const { getToken } = await auth();
    const token = await getToken({ template: "convex" });
    if (token) {
      convexOrError.setAuth(token);
    }
  } catch (err) {
    console.error("Failed to set auth token on Convex HTTP client:", err);
  }

  const [ragOrError, preferredModelKey] = await Promise.all([
    fetchRagData(convexOrError, question),
    getPreferredModel(convexOrError, userId),
  ]);
  if (ragOrError instanceof NextResponse) return ragOrError;
  return { convex: convexOrError, ragResult: ragOrError, preferredModelKey };
}

export async function buildStreamResponse(
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
