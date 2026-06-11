import { ConvexHttpClient } from "convex/browser";
import { headers } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function verifyCronSecret(request: NextRequest): Promise<boolean> {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    // If no CRON_SECRET is configured, only allow in development
    if (process.env.NODE_ENV === "development") return true;
    return false;
  }

  const headerPayload = await headers();
  const authHeader = headerPayload.get("authorization");

  if (authHeader === `Bearer ${cronSecret}`) return true;

  return false;
}

async function executeCronTask(
  convex: ConvexHttpClient,
  task: string,
): Promise<Record<string, unknown>> {
  const results: Record<string, unknown> = {};

  if (task === "daily" || task === "all") {
    try {
      await convex.mutation("crawl/tasks:runStatsAggregation" as never, {} as never);
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
