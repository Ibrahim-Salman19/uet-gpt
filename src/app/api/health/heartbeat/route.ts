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
const HEARTBEAT_TIMEOUT_MS = 5000;

export async function GET() {
  try {
    const client = getConvexClient();
    // Bound the query so a hung Convex connection cannot pin the handler up to
    // the platform timeout. Differentiate timeout from generic failures below.
    const result = await Promise.race([
      client.query(api.health.heartbeat, {}),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Heartbeat timed out")), HEARTBEAT_TIMEOUT_MS),
      ),
    ]);

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

    const isTimeout = error instanceof Error && error.message === "Heartbeat timed out";

    return new Response(
      JSON.stringify({
        ok: false,
        error: isTimeout ? "Heartbeat timed out" : "Heartbeat failed",
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
