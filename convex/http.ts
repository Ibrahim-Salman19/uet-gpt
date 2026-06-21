import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { userWebhook } from "./clerk/webhook";
import { crawlWebhook, ingestWebhook, resetWebhook } from "./crawl/webhook";

const http = httpRouter();

function getCorsOrigin(request: Request): string {
  const reqOrigin = request.headers.get("Origin");
  const origins = [process.env.NEXT_PUBLIC_APP_URL].filter(Boolean) as string[];
  if (process.env.NODE_ENV === "development") {
    origins.push("http://localhost:3000");
  }
  if (reqOrigin && origins.includes(reqOrigin)) {
    return reqOrigin;
  }
  if (!origins[0]) {
    console.error("CRITICAL: No allowed origins configured. Set NEXT_PUBLIC_APP_URL env var.");
    return "https://localhost";
  }
  return origins[0];
}

export function withCORS(request: Request, response: Response, restricted = false): Response {
  const headers = new Headers(response.headers);
  headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
  headers.set("Access-Control-Allow-Origin", getCorsOrigin(request));
  headers.set("Vary", "Origin");
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
        headers: {
          "Access-Control-Allow-Origin": getCorsOrigin(request),
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
          Vary: "Origin",
        },
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
        headers: {
          "Access-Control-Allow-Origin": getCorsOrigin(request),
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
          Vary: "Origin",
        },
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
        headers: {
          "Access-Control-Allow-Origin": getCorsOrigin(request),
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
          Vary: "Origin",
        },
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
        headers: {
          "Access-Control-Allow-Origin": getCorsOrigin(request),
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
          Vary: "Origin",
        },
      }),
  ),
});

export default http;
