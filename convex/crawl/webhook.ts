import { internal } from "../_generated/api";
import { httpAction } from "../_generated/server";
import {
  assignFreshnessTier,
  buildContextPrefix,
  canonicalizeUrl,
  generateChunks,
  generateContextSummary,
  isPdfVirtualUrl,
  normalizeContent,
  sha256,
} from "./chunking";

function hexToBuffer(hex: string): ArrayBuffer {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substring(i * 2, i * 2 + 2), 16);
  }
  return bytes.buffer;
}

async function verifySignature(
  timestamp: string,
  signature: string,
  secret: string,
  body: string,
): Promise<boolean> {
  try {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"],
    );

    const sigBuffer = hexToBuffer(signature);
    const dataBuffer = encoder.encode(timestamp + "." + body);

    return await crypto.subtle.verify("HMAC", key, sigBuffer, dataBuffer);
  } catch (err) {
    console.error("Signature verification failed with crypto error:", err);
    return false;
  }
}

type WebhookResult = { markdown?: string; html?: string; text?: string };

function computeStats(results: WebhookResult[]) {
  let totalChunks = 0;
  let totalTokens = 0;
  let bytesProcessed = 0;
  for (const r of results) {
    const content = r.markdown || r.html || r.text || "";
    totalChunks += Math.ceil(content.length / 3000);
    totalTokens += Math.ceil(content.length / 4);
    bytesProcessed += new TextEncoder().encode(content).length;
  }
  return { totalChunks, totalTokens, bytesProcessed };
}

function logCompletionAlert(taskId: string, successfulPages: number, failedPages: number, skippedPages: number) {
  if (failedPages === 0) return;
  const failureRate = failedPages / (successfulPages + failedPages + skippedPages);
  if (failureRate > 0.05) {
    console.warn(
      `[ALERT] Crawl ${taskId} completed with ${failedPages} failed pages ` +
        `(${(failureRate * 100).toFixed(1)}% failure rate)`,
    );
  }
  console.warn(
    `[ALERT] Crawl ${taskId}: ${failedPages} pages failed, ` +
      `${skippedPages} skipped, ${successfulPages} successful`,
  );
}

function handleStateChange(request: Request): Response | null {
  const isStateChange = new URL(request.url).searchParams.get("type") === "state";
  if (isStateChange) {
    console.log("State change notification received — acknowledging without processing.");
    return new Response(JSON.stringify({ ok: true, state: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }
  return null;
}

function checkPayloadSize(request: Request): Response | null {
  const contentLengthHeader = request.headers.get("content-length");
  if (contentLengthHeader && Number(contentLengthHeader) > 10_485_760) {
    console.warn(`Webhook payload too large: ${contentLengthHeader} bytes`);
    return new Response("Payload too large", { status: 413 });
  }
  return null;
}

function verifyWebhookHeaders(
  request: Request,
): { timestamp: string; signature: string } | Response {
  const timestamp = request.headers.get("x-crawl-timestamp");
  const signature = request.headers.get("x-crawl-signature");

  if (!timestamp || !signature) {
    console.warn("Webhook rejected: Missing signature headers");
    return new Response("Missing signature headers", { status: 400 });
  }

  const ts = parseInt(timestamp, 10);
  const MAX_SKEW_MS = 5 * 60 * 1000;
  if (Number.isNaN(ts) || Math.abs(Date.now() - ts) > MAX_SKEW_MS) {
    console.warn(`Webhook rejected: Timestamp expired or invalid: ${timestamp}`);
    return new Response("Request timestamp expired", { status: 400 });
  }

  return { timestamp, signature };
}

async function validateWebhookSignature(
  rawBody: string,
  timestamp: string,
  signature: string,
): Promise<Response | null> {
  const primarySecret = process.env.CRAWL_WEBHOOK_SECRET;
  const secondarySecret = process.env.CRAWL_WEBHOOK_SECRET_NEW;
  if (!primarySecret) {
    console.error("CRAWL_WEBHOOK_SECRET environment variable is not set");
    return new Response("Server configuration error", { status: 500 });
  }

  let isValid = await verifySignature(timestamp, signature, primarySecret, rawBody);
  if (!isValid && secondarySecret) {
    isValid = await verifySignature(timestamp, signature, secondarySecret, rawBody);
  }
  if (!isValid) {
    console.warn("Webhook rejected: Invalid signature");
    return new Response("Invalid signature", { status: 401 });
  }
  return null;
}

function extractWebhookPayload(
  rawBody: string,
): { taskId: string; status: string; results: any[]; url: string | undefined } {
  const payload = JSON.parse(rawBody);
  console.log(
    "Webhook received",
    JSON.stringify({ taskId: payload.task_id, jobId: payload.job_id, url: payload.url }),
  );
  const taskId = payload.task_id || payload.job_id;
  const status = payload.status;
  const results = payload.data?.results || payload.results || (payload.url ? [payload] : []);
  return { taskId, status, results, url: payload.url };
}

async function checkIdempotency(
  ctx: any,
  taskId: string,
): Promise<boolean> {
  const existing = await ctx.runQuery(internal.crawl.mutations.getProcessedWebhook, {
    jobId: taskId,
  });
  return !!existing;
}

async function markJobProcessed(ctx: any, taskId: string): Promise<void> {
  await ctx.runMutation(internal.crawl.mutations.markWebhookProcessed, {
    jobId: taskId,
    expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000,
  });
}

function extractPageInfo(
  result: any,
  payloadUrl: string | undefined,
): { url: string; canonicalUrl: string; isPdf: boolean; content: string; title: string; etag: string | undefined; lastModified: string | undefined } {
  const url = result.url || payloadUrl;
  const canonicalUrl = canonicalizeUrl(url);
  const isPdf = url.toLowerCase().endsWith(".pdf") || result.media_type === "pdf";
  const content = result.markdown || result.html || result.text;
  const title = result.metadata?.title || "Untitled";
  const etag = result.headers?.etag || undefined;
  const lastModified = result.headers?.["last-modified"] || undefined;
  return { url, canonicalUrl, isPdf, content, title, etag, lastModified };
}

async function validatePageContent(content: string, url: string, isPdf: boolean): Promise<boolean> {
  if (isPdf && (!content || content.trim().length === 0)) {
    console.log(`PDF skipped (no extractable content): ${url}`);
    return true;
  }

  if (!content || content.trim().length === 0) {
    console.warn(`Empty content for URL: ${url}`);
    return true;
  }

  return false;
}

async function processSinglePage(
  result: any,
  payloadUrl: string | undefined,
  taskId: string,
  ctx: any,
): Promise<"success" | "skip" | "fail"> {
  try {
    const info = extractPageInfo(result, payloadUrl);
    if (await validatePageContent(info.content, info.url, info.isPdf)) return "skip";

    console.log(`Processing and normalising crawled page: ${info.url}`);

    const normalized = normalizeContent(info.content);
    const contentHash = await sha256(normalized);

    let contextPrefix = buildContextPrefix(info.title, info.canonicalUrl, isPdfVirtualUrl(info.canonicalUrl));
    const summary = await generateContextSummary(normalized);
    if (summary) contextPrefix += `Context: ${summary}\n\n`;

    const chunks = await generateChunks(normalized, contextPrefix);

    const freshnessTier = assignFreshnessTier(info.canonicalUrl);
    await ctx.runMutation(internal.crawl.mutations.queueChunksForEmbedding, {
      url: info.canonicalUrl,
      title: info.title,
      contentHash,
      freshnessTier,
      jobId: taskId,
      chunks,
      ...(info.etag !== undefined && { etag: info.etag }),
      ...(info.lastModified !== undefined && { lastModified: info.lastModified }),
    });
    return "success";
  } catch (err) {
    console.error(`Failed to process page ${result.url || "unknown URL"}:`, err);
    return "fail";
  }
}

async function finalizeJob(
  ctx: any,
  status: string,
  taskId: string,
  successfulPages: number,
  failedPages: number,
  skippedPages: number,
  results: any[],
): Promise<void> {
  if (status === "completed") {
    logCompletionAlert(taskId, successfulPages, failedPages, skippedPages);
  }

  if (status === "completed" || status === "failed") {
    const stats = computeStats(results);
    await ctx.runMutation(internal.crawl.workflow.completeJobByTaskId, {
      taskId,
      status,
      stats: {
        totalPages: successfulPages + failedPages + skippedPages,
        successfulPages,
        failedPages,
        skippedPages,
        ...stats,
      },
    });
  }
}

export const crawlWebhook = httpAction(async (ctx, request) => {
  let taskId: string | undefined;
  try {
    const stateResp = handleStateChange(request);
    if (stateResp) return stateResp;

    const sizeResp = checkPayloadSize(request);
    if (sizeResp) return sizeResp;

    const rawBody = await request.text();

    const hmacInfo = verifyWebhookHeaders(request);
    if (hmacInfo instanceof Response) return hmacInfo;

    const sigResp = await validateWebhookSignature(rawBody, hmacInfo.timestamp, hmacInfo.signature);
    if (sigResp) return sigResp;

    const { taskId: id, status, results, url } = extractWebhookPayload(rawBody);
    taskId = id;

    const isDuplicate = await checkIdempotency(ctx, taskId);
    if (isDuplicate) {
      console.log(`Webhook already processed (Idempotent): ${taskId}`);
      return new Response(JSON.stringify({ ok: true, deduped: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    await markJobProcessed(ctx, taskId);

    let successfulPages = 0;
    let failedPages = 0;
    let skippedPages = 0;

    for (const result of results) {
      const outcome = await processSinglePage(result, url, taskId, ctx);
      if (outcome === "success") successfulPages++;
      else if (outcome === "fail") failedPages++;
      else skippedPages++;
    }

    await finalizeJob(ctx, status, taskId, successfulPages, failedPages, skippedPages, results);

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error(`Webhook processing error for task ${taskId}:`, error);
    return new Response("Internal Server Error", { status: 500 });
  }
});

export const resetWebhook = httpAction(async (ctx, request) => {
  try {
    const authHeader = request.headers.get("Authorization");
    const token = authHeader?.split(" ")[1];
    const expectedToken = process.env.CONVEX_AUTH_TOKEN;
    if (!expectedToken) {
      return new Response("Server configuration error", { status: 500 });
    }
    if (token !== expectedToken) {
      return new Response("Unauthorized", { status: 401 });
    }
    await ctx.runAction(internal.crawl.actions.resetPipelineAction);
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("Reset error:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});

type IngestPayload = {
  url: string;
  markdown: string;
  contentHash: string;
  crawlSessionId: string;
  title?: string;
  sourceType: string;
  freshnessTier?: string;
};

async function parseAndValidateIngestRequest(
  rawBody: string,
  request: Request,
): Promise<IngestPayload | Response> {
  if (rawBody.length > 4_194_304) {
    console.warn(`/ingest payload too large: ${rawBody.length} bytes`);
    return new Response("Payload too large", { status: 413 });
  }

  const payload = JSON.parse(rawBody);

  const authHeader = request.headers.get("Authorization");
  const token = authHeader?.split(" ")[1];
  const expectedToken = process.env.CONVEX_AUTH_TOKEN;

  if (!expectedToken) {
    console.error("/ingest misconfigured: CONVEX_AUTH_TOKEN not set — rejecting all requests");
    return new Response("Server configuration error", { status: 500 });
  }

  if (token !== expectedToken) {
    console.warn("Unauthorized /ingest request");
    return new Response("Unauthorized", { status: 401 });
  }

  const { url, markdown, contentHash, crawlSessionId, title, sourceType, freshnessTier } = payload;

  if (!url || !markdown || !contentHash || !crawlSessionId || !sourceType) {
    return new Response(
      "Missing required fields (url, markdown, contentHash, crawlSessionId, sourceType)",
      { status: 400 },
    );
  }

  const ALLOWED_DOMAIN_SUFFIX = "uettaxila.edu.pk";
  if (!isPdfVirtualUrl(url)) {
    let parsedHost: string;
    try {
      parsedHost = new URL(url).hostname.toLowerCase();
    } catch {
      console.warn(`Ingest rejected: malformed URL "${url}"`);
      return new Response("Invalid URL", { status: 400 });
    }
    if (!parsedHost.endsWith(ALLOWED_DOMAIN_SUFFIX)) {
      console.warn(`Ingest rejected: domain not in allowlist "${parsedHost}"`);
      return new Response("URL domain not permitted", { status: 403 });
    }
  }

  return { url, markdown, contentHash, crawlSessionId, title, sourceType, freshnessTier };
}

async function processIngestContent(
  ctx: any,
  result: { action: string; documentId: any },
  url: string,
  title: string | undefined,
  markdown: string,
): Promise<void> {
  const normalized = normalizeContent(markdown);

  let contextPrefix = buildContextPrefix(title || url, url, isPdfVirtualUrl(url));
  const summary = await generateContextSummary(normalized);
  if (summary) contextPrefix += `Context: ${summary}\n\n`;

  const chunks = await generateChunks(normalized, contextPrefix);

  await ctx.runMutation(internal.crawl.mutations.enqueueDocumentChunks, {
    documentId: result.documentId,
    url,
    chunks,
  });
}

export const ingestWebhook = httpAction(async (ctx, request) => {
  try {
    const rawBody = await request.text();
    const payload = await parseAndValidateIngestRequest(rawBody, request);
    if (payload instanceof Response) return payload;

    const result = await ctx.runMutation(internal.crawl.mutations.upsertDocument, {
      url: payload.url,
      markdown: payload.markdown,
      contentHash: payload.contentHash,
      crawlSessionId: payload.crawlSessionId,
      title: payload.title || undefined,
      sourceType: payload.sourceType,
      freshnessTier: payload.freshnessTier as "high" | "medium" | "low" | undefined,
    });

    if (result.action === "skipped") {
      return new Response(JSON.stringify({ success: true, action: "skipped" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    await processIngestContent(ctx, result, payload.url, payload.title, payload.markdown);

    return new Response(JSON.stringify({ success: true, action: result.action }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("Ingest webhook error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
});
