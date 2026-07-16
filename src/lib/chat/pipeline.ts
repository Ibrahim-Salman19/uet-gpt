import { auth } from "@clerk/nextjs/server";
import type { ModelMessage } from "ai";
import { api } from "convex/_generated/api";
import { ConvexHttpClient } from "convex/browser";
import { ConvexError } from "convex/values";
import { type NextRequest, NextResponse } from "next/server";
import { getRoleFromClaims, isAdminRole } from "@/lib/clerk-claims";
import { buildSystemPrompt } from "@/lib/prompt";
import { checkChatRateLimit } from "@/lib/rate-limit";
import { buildCacheWriteCallback, encodeSourcesHeader, type RagResult } from "./cache";
import { getAvailableModels, getPreferredModel } from "./models";
import { tryStreamWithFallback } from "./stream";

function resolveClientRole(sessionClaims: Record<string, unknown>): "admin" | "user" {
  const role = getRoleFromClaims(sessionClaims);
  return isAdminRole(role) ? "admin" : "user";
}

// NOTE: rate limiting is per-account (userId) only. A per-IP dimension was
// intentionally NOT wired here because the only available client IP source is
// the spoofable `x-forwarded-for`/`x-real-ip` header - trusting it without a
// trusted edge that overwrites it would give a false sense of IP throttling.
// Adding a real per-IP limiter requires a trusted edge header + a change to the
// rate-limit module (out of this bucket's scope).
async function getAuthAndRole(
  _req: NextRequest,
): Promise<{ userId: string; role: "admin" | "user" } | NextResponse> {
  const { userId, sessionClaims } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return { userId, role: resolveClientRole(sessionClaims) };
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

// Map a failed RAG retrieval onto an actionable HTTP response. retrieval.ts
// throws structured ConvexErrors (validation, injection, auth) whose `data` is a
// string message; we surface those as 4xx instead of collapsing everything to a
// generic 500, and we always log the underlying cause for observability.
function mapRagError(err: unknown): NextResponse {
  console.error("RAG retrieval failed:", err);

  const message = err instanceof ConvexError && typeof err.data === "string" ? err.data : undefined;

  if (message) {
    const lower = message.toLowerCase();
    if (lower.includes("authentication required")) {
      return NextResponse.json({ error: message }, { status: 401 });
    }
    if (
      lower.includes("too long") ||
      lower.includes("invalid query") ||
      lower.includes("cannot be processed")
    ) {
      return NextResponse.json({ error: message }, { status: 400 });
    }
  }

  return NextResponse.json({ error: "RAG retrieval failed. Please try again." }, { status: 500 });
}

function fetchRagData(
  convex: ConvexHttpClient,
  question: string,
): Promise<RagResult | NextResponse> {
  return convex
    .action(api.rag.retrieval.retrieveContext, {
      question,
    })
    .catch((err) => mapRagError(err));
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
  | { convex: ConvexHttpClient; ragResult: RagResult; preferredModelKey: string | undefined }
  | NextResponse
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
  ragResult: RagResult,
  preferredModelKey: string | undefined,
): Promise<Response | NextResponse> {
  if (ragResult.cachedResponse) {
    return new Response(ragResult.cachedResponse, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        // Authenticated, per-user response: never let an intermediary/browser
        // cache one user's answer for another.
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
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
  // Roles are constrained to "user"/"assistant" by MessageSchema (validate.ts),
  // so this narrows safely to the AI SDK's ModelMessage shape.
  const modelMessages: ModelMessage[] = messages.map((m) => ({
    role: m.role === "assistant" ? "assistant" : "user",
    content: m.content,
  }));
  const result = await tryStreamWithFallback(models, {
    system: systemPrompt,
    messages: modelMessages,
    temperature: 0.3,
    maxOutputTokens: 2000,
    onFinish: buildCacheWriteCallback(question, ragResult, convex),
  });
  return result.toTextStreamResponse({
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "X-Sources": encodeSourcesHeader(ragResult.sources),
      "X-Intent": ragResult.intent,
    },
  });
}
