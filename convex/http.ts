import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { crawlWebhook, ingestWebhook, resetWebhook } from "./crawl/webhook";

const http = httpRouter();

if (!process.env.CONVEX_AUTH_TOKEN && !process.env.CRAWL_WEBHOOK_SECRET) {
  throw new Error(
    "CRITICAL: Neither CONVEX_AUTH_TOKEN nor CRAWL_WEBHOOK_SECRET is configured. Endpoints are unprotected.",
  );
}

export function withCORS(response: Response): Response {
  const headers = new Headers(response.headers);
  headers.set("Access-Control-Allow-Origin", "*");
  headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
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
    async (_ctx) =>
      new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
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
    async (_ctx) =>
      new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
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
    async (_ctx) =>
      new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
        },
      }),
  ),
});

export default http;
