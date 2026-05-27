import { httpRouter } from "convex/server";
import { crawlWebhook, ingestWebhook } from "./crawl/webhook";

const http = httpRouter();

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
