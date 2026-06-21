import { type NextRequest, NextResponse } from "next/server";
import {
  authAndRateLimitPhase,
  buildStreamResponse,
  convexRagAndModelPhase,
} from "@/lib/chat/pipeline";
import { validateRequestPhase } from "@/lib/chat/validate";

function errorResponse(error: unknown): NextResponse {
  console.error("Chat API error:", error);
  const isDev = process.env.NODE_ENV === "development";
  return NextResponse.json(
    { error: isDev && error instanceof Error ? error.message : "An unexpected error occurred" },
    { status: 500 },
  );
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
