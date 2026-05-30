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

  // Also check query param for Vercel Cron
  const url = new URL(request.url);
  const cronKey = url.searchParams.get("cron_secret");
  if (cronKey === cronSecret) return true;

  return false;
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

    // Determine which cron task to run based on the query param
    const url = new URL(request.url);
    const task = url.searchParams.get("task") || "daily";

    const results: Record<string, unknown> = {};

    if (task === "daily" || task === "all") {
      // Aggregate daily usage stats
      try {
        await convex.mutation("crawl/tasks:aggregateDailyStats" as never, {} as never);
        results.dailyStats = { status: "ok" };
      } catch (error) {
        results.dailyStats = {
          status: "error",
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    }

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
