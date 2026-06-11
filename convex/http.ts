import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { userWebhook } from "./clerk/webhook";
import { crawlWebhook, ingestWebhook, resetWebhook } from "./crawl/webhook";

const http = httpRouter();

if (!process.env.CONVEX_AUTH_TOKEN && !process.env.CRAWL_WEBHOOK_SECRET) {
  throw new Error(
    "CRITICAL: Neither CONVEX_AUTH_TOKEN nor CRAWL_WEBHOOK_SECRET is configured. Endpoints are unprotected.",
  );
}

function getAllowedOrigins(): string {
  const origins = [process.env.NEXT_PUBLIC_APP_URL].filter(Boolean);
  if (process.env.NODE_ENV === "development") {
    origins.push("http://localhost:3000");
  }
  return origins.length > 0 ? origins.join(", ") : "*";
}

export function withCORS(response: Response, restricted = false): Response {
  const headers = new Headers(response.headers);
  headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (restricted) {
    headers.set("Access-Control-Allow-Origin", getAllowedOrigins());
  } else {
    headers.set("Access-Control-Allow-Origin", "*");
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
          "Access-Control-Allow-Origin": getAllowedOrigins(),
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
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
    async (_ctx) =>
      new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": getAllowedOrigins(),
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
        },
      }),
  ),
});

export default http;
