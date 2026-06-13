import { api } from "convex/_generated/api";
import { ConvexHttpClient } from "convex/browser";

let convex: ConvexHttpClient | null = null;

function getConvexClient() {
  if (!convex) {
    const url = process.env.NEXT_PUBLIC_CONVEX_URL;
    if (!url) {
      throw new Error("NEXT_PUBLIC_CONVEX_URL is not set");
    }
    convex = new ConvexHttpClient(url);
  }
  return convex;
}

/**
 * Lightweight HTTP heartbeat endpoint.
 *
 * Called by ConvexConnectionMonitor every 25s as backup to useQuery subscription.
 * Bypasses React query cache to force WebSocket activity on the Convex connection.
 *
 * Returns minimal JSON payload to minimize bandwidth.
 */
export async function GET() {
  try {
    const client = getConvexClient();
    const result = await client.query(api.health.heartbeat, {});

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store, no-cache, must-revalidate",
        "X-Heartbeat": "true",
      },
    });
  } catch (error) {
    console.error("[Heartbeat] Query failed:", error);

    return new Response(
      JSON.stringify({
        ok: false,
        error: "Heartbeat failed",
        timestamp: Date.now(),
      }),
      {
        status: 503,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store, no-cache, must-revalidate",
        },
      },
    );
  }
}

/**
 * Disable static generation - this must be dynamic
 */
export const dynamic = "force-dynamic";
export const revalidate = 0;
