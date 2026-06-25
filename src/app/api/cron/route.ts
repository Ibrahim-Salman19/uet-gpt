import { timingSafeEqual } from "node:crypto";
import { api } from "convex/_generated/api";
import { ConvexHttpClient } from "convex/browser";
import { headers } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const ALLOWED_TASKS = new Set(["daily", "all"]);

/**
 * Constant-time comparison of a bearer header against the expected value.
 * Checks length first (still running a same-length comparison on mismatch) so
 * timingSafeEqual never throws and no early-exit leaks the secret byte-by-byte.
 */
function timingSafeBearerMatch(provided: string | null, expected: string): boolean {
  if (!provided) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(`Bearer ${expected}`);
  if (a.length !== b.length) {
    // Still run a comparison of equal-length buffers to avoid leaking length.
    timingSafeEqual(b, b);
    return false;
  }
  return timingSafeEqual(a, b);
}

async function verifyCronSecret(_request: NextRequest): Promise<boolean> {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    // Fail closed: require CRON_SECRET in every environment except an explicit
    // local dev run. NODE_ENV must be strictly "development" to bypass.
    if (process.env.NODE_ENV === "development") return true;
    return false;
  }

  const headerPayload = await headers();
  const authHeader = headerPayload.get("authorization");

  return timingSafeBearerMatch(authHeader, cronSecret);
}

async function executeCronTask(
  convex: ConvexHttpClient,
  task: string,
): Promise<Record<string, unknown>> {
  const results: Record<string, unknown> = {};

  if (task === "daily" || task === "all") {
    try {
      const cronSecret = process.env.CRON_SECRET || "";
      await convex.mutation(api.crawl.tasks.runStatsAggregation, {
        secret: cronSecret,
      });
      results.dailyStats = { status: "ok" };
    } catch (error) {
      results.dailyStats = {
        status: "error",
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  return results;
}

export async function GET(request: NextRequest) {
  try {
    const isAuthorized = await verifyCronSecret(request);
    if (!isAuthorized) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
    if (!convexUrl) {
      return NextResponse.json({ error: "Convex URL not configured" }, { status: 500 });
    }

    const convex = new ConvexHttpClient(convexUrl);

    const url = new URL(request.url);
    const task = url.searchParams.get("task") || "daily";

    if (!ALLOWED_TASKS.has(task)) {
      return NextResponse.json({ error: `Unknown task: ${task}` }, { status: 400 });
    }

    const results = await executeCronTask(convex, task);

    return NextResponse.json({
      status: "ok",
      task,
      results,
      timestamp: Date.now(),
    });
  } catch (error) {
    console.error("Cron API error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 },
    );
  }
}
