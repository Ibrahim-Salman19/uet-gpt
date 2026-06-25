import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { userWebhook } from "./clerk/webhook";
import { crawlWebhook, ingestWebhook, resetWebhook } from "./crawl/webhook";

const http = httpRouter();

/**
 * Returns the value for Access-Control-Allow-Origin, or null when the request
 * origin is not explicitly allow-listed.
 *
 * These routes are server-to-server webhooks (auth is enforced via tokens/HMAC),
 * so CORS is largely irrelevant. We only ever reflect an origin that is an exact
 * match in the allow-list — we never echo an arbitrary/non-allowlisted origin and
 * never emit a placeholder origin. When nothing matches we return null and the
 * caller omits the header entirely.
 */
function getCorsOrigin(request: Request): string | null {
  const reqOrigin = request.headers.get("Origin");
  const origins = [process.env.NEXT_PUBLIC_APP_URL].filter(Boolean) as string[];
  if (process.env.NODE_ENV === "development") {
    origins.push("http://localhost:3000");
  }
  if (origins.length === 0) {
    console.error("CRITICAL: No allowed origins configured. Set NEXT_PUBLIC_APP_URL env var.");
    return null;
  }
  if (reqOrigin && origins.includes(reqOrigin)) {
    return reqOrigin;
  }
  return null;
}

function corsHeaders(request: Request): Record<string, string> {
  const allowOrigin = getCorsOrigin(request);
  const headers: Record<string, string> = {
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    Vary: "Origin",
  };
  if (allowOrigin) {
    headers["Access-Control-Allow-Origin"] = allowOrigin;
  }
  return headers;
}

export function withCORS(request: Request, response: Response, restricted = false): Response {
  const headers = new Headers(response.headers);
  for (const [key, value] of Object.entries(corsHeaders(request))) {
    headers.set(key, value);
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

http.route({
  path: "/api/webhook/crawl",
  method: "POST",
  handler: crawlWebhook,
});

http.route({
  path: "/api/webhook/crawl",
  method: "OPTIONS",
  handler: httpAction(
    async (_ctx, request) =>
      new Response(null, {
        status: 204,
        headers: corsHeaders(request),
      }),
  ),
});

http.route({
  path: "/ingest",
  method: "POST",
  handler: ingestWebhook,
});

http.route({
  path: "/ingest",
  method: "OPTIONS",
  handler: httpAction(
    async (_ctx, request) =>
      new Response(null, {
        status: 204,
        headers: corsHeaders(request),
      }),
  ),
});

http.route({
  path: "/api/reset",
  method: "POST",
  handler: resetWebhook,
});

http.route({
  path: "/api/reset",
  method: "OPTIONS",
  handler: httpAction(
    async (_ctx, request) =>
      new Response(null, {
        status: 204,
        headers: corsHeaders(request),
      }),
  ),
});

http.route({
  path: "/api/webhook/clerk",
  method: "POST",
  handler: userWebhook,
});

http.route({
  path: "/api/webhook/clerk",
  method: "OPTIONS",
  handler: httpAction(
    async (_ctx, request) =>
      new Response(null, {
        status: 204,
        headers: corsHeaders(request),
      }),
  ),
});

export default http;
