import { httpRouter } from "convex/server";
import { crawlWebhook, ingestWebhook } from "./crawl/webhook";

const http = httpRouter();

if (!process.env.CONVEX_AUTH_TOKEN && !process.env.CRAWL_WEBHOOK_SECRET) {
  throw new Error(
    "CRITICAL: Neither CONVEX_AUTH_TOKEN nor CRAWL_WEBHOOK_SECRET is configured. Endpoints are unprotected.",
  );
}

const _CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

http.route({
  path: "/api/webhook/crawl",
  method: "POST",
  handler: crawlWebhook,
});

http.route({
  path: "/ingest",
  method: "POST",
  handler: ingestWebhook,
});

export default http;
