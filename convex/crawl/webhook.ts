import { internal } from "../_generated/api";
import type { Doc } from "../_generated/dataModel";
import { httpAction } from "../_generated/server";
import {
  assignFreshnessTier,
  canonicalizeUrl,
  chunkMarkdown,
  guardChunkSize,
  isPdfVirtualUrl,
  normalizeContent,
} from "./chunking";

function hexToBuffer(hex: string): ArrayBuffer {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substring(i * 2, i * 2 + 2), 16);
  }
  return bytes.buffer;
}

async function sha256(text: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
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

export const crawlWebhook = httpAction(async (ctx, request) => {
  let taskId: string | undefined;
  try {
    const isStateChange = new URL(request.url).searchParams.get("type") === "state";
    if (isStateChange) {
      console.log("State change notification received — acknowledging without processing.");
      return new Response(JSON.stringify({ ok: true, state: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    const contentLengthHeader = request.headers.get("content-length");
    if (contentLengthHeader && Number(contentLengthHeader) > 10_485_760) {
      console.warn(`Webhook payload too large: ${contentLengthHeader} bytes`);
      return new Response("Payload too large", { status: 413 });
    }
    const rawBody = await request.text();

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

    const payload = JSON.parse(rawBody);
    console.log(
      "Webhook received",
      JSON.stringify({ taskId: payload.task_id, jobId: payload.job_id, url: payload.url }),
    );
    taskId = payload.task_id || payload.job_id;
    const status = payload.status;
    const results = payload.data?.results || payload.results || (payload.url ? [payload] : []);

    const existing = await ctx.runQuery(internal.crawl.mutations.getProcessedWebhook, {
      jobId: taskId!,
    });
    if (existing) {
      console.log(`Webhook already processed (Idempotent): ${taskId}`);
      return new Response(JSON.stringify({ ok: true, deduped: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    await ctx.runMutation(internal.crawl.mutations.markWebhookProcessed, {
      jobId: taskId!,
      expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000,
    });

    let successfulPages = 0;
    let failedPages = 0;
    let skippedPages = 0;

    for (const result of results) {
      try {
        const url = result.url || payload.url;
        const canonicalUrl = canonicalizeUrl(url);
        const isPdf = url.toLowerCase().endsWith(".pdf") || result.media_type === "pdf";
        const content = result.markdown || result.html || result.text;
        const title = result.metadata?.title || "Untitled";
        const etag = result.headers?.etag || undefined;
        const lastModified = result.headers?.["last-modified"] || undefined;

        if (isPdf && (!content || content.trim().length === 0)) {
          console.log(`PDF skipped (no extractable content): ${url}`);
          skippedPages++;
          continue;
        }

        if (!content || content.trim().length === 0) {
          console.warn(`Empty content for URL: ${url}`);
          skippedPages++;
          continue;
        }

        console.log(`Processing and normalising crawled page: ${url}`);

        const normalized = normalizeContent(content);
        const contentHash = await sha256(normalized);

        let contextPrefix = `Document Title: ${title}\n`;
        if (!isPdfVirtualUrl(canonicalUrl)) {
          try {
            const parsedUrl = new URL(canonicalUrl);
            if (parsedUrl.pathname && parsedUrl.pathname !== "/") {
              contextPrefix += `URL Path: ${parsedUrl.pathname}\n`;
            }
          } catch {}
        }
        try {
          if (process.env.GOOGLE_GENERATIVE_AI_API_KEY && normalized.split(/\s+/).length > 500) {
            const { generateText } = await import("ai");
            const { google } = await import("@ai-sdk/google");

            const { text } = await generateText({
              model: google("gemini-2.5-flash"),
              prompt: `Write a 1-sentence summary of this document to provide context for vector search chunks. Document text:\n\n${normalized.slice(0, 2000)}`,
            });
            contextPrefix += `Context: ${text.trim()}\n\n`;
          }
        } catch (err) {
          console.warn(`Failed to generate contextual embedding summary for ${url}`, err);
          contextPrefix += "\n";
        }

        const parentChunks = chunkMarkdown(normalized, 3000, 300);
        const chunks = [];

        for (const parentChunk of parentChunks) {
          const childChunks = chunkMarkdown(parentChunk.text, 800, 100, parentChunk.headingPath);
          for (const childChunk of childChunks) {
            const baseText = contextPrefix + childChunk.text;
            const guardedParts = guardChunkSize(baseText);
            for (const part of guardedParts) {
              chunks.push({
                text: part,
                contentHash: await sha256(part),
                parentText: parentChunk.text,
                headingPath: childChunk.headingPath,
              });
            }
          }
        }

        const freshnessTier = assignFreshnessTier(canonicalUrl);
        const args: {
          url: string;
          title: string;
          contentHash: string;
          freshnessTier: "high" | "medium" | "low";
          jobId: string;
          chunks: {
            text: string;
            contentHash: string;
            parentText?: string;
            headingPath?: string[];
          }[];
          etag?: string;
          lastModified?: string;
        } = {
          url: canonicalUrl,
          title,
          contentHash,
          freshnessTier,
          jobId: taskId!,
          chunks,
        };
        if (etag !== undefined) args.etag = etag;
        if (lastModified !== undefined) args.lastModified = lastModified;

        await ctx.runMutation(internal.crawl.mutations.queueChunksForEmbedding, args);
        successfulPages++;
      } catch (err) {
        console.error(`Failed to process page ${result.url || "unknown URL"}:`, err);
        failedPages++;
      }
    }

    if (status === "completed" && failedPages > 0) {
      const failureRate = failedPages / (successfulPages + failedPages + skippedPages);
      if (failureRate > 0.05) {
        console.warn(
          `[ALERT] Crawl ${taskId} completed with ${failedPages} failed pages ` +
            `(${(failureRate * 100).toFixed(1)}% failure rate)`,
        );
      }
      if (failedPages > 0) {
        console.warn(
          `[ALERT] Crawl ${taskId}: ${failedPages} pages failed, ` +
            `${skippedPages} skipped, ${successfulPages} successful`,
        );
      }
    }

    if (status === "completed" || status === "failed") {
      type WebhookResult = { markdown?: string; html?: string; text?: string };
      const totalChunks = results.reduce((sum: number, r: WebhookResult) => {
        const content = r.markdown || r.html || r.text || "";
        return sum + Math.ceil(content.length / 3000);
      }, 0);
      const totalTokens = results.reduce((sum: number, r: WebhookResult) => {
        const content = r.markdown || r.html || r.text || "";
        return sum + Math.ceil(content.length / 4);
      }, 0);
      const bytesProcessed = results.reduce((sum: number, r: WebhookResult) => {
        const content = r.markdown || r.html || r.text || "";
        return sum + new TextEncoder().encode(content).length;
      }, 0);

      await ctx.runMutation(internal.crawl.workflow.completeJobByTaskId, {
        taskId: taskId!,
        status,
        stats: {
          totalPages: successfulPages + failedPages + skippedPages,
          successfulPages,
          failedPages,
          skippedPages,
          totalChunks,
          totalTokens,
          bytesProcessed,
        },
      });
    }

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

export const ingestWebhook = httpAction(async (ctx, request) => {
  try {
    const rawBody = await request.text();

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

    const { url, markdown, contentHash, crawlSessionId, title, sourceType, freshnessTier } =
      payload;

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

    const result = await ctx.runMutation(internal.crawl.mutations.upsertDocument, {
      url,
      markdown,
      contentHash,
      crawlSessionId,
      title: title || undefined,
      sourceType,
      freshnessTier,
    });

    if (result.action === "skipped") {
      return new Response(JSON.stringify({ success: true, action: "skipped" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    const normalized = normalizeContent(markdown);

    let contextPrefix = `Document Title: ${title || url}\n`;
    if (!isPdfVirtualUrl(url)) {
      try {
        const parsedUrl = new URL(url);
        if (parsedUrl.pathname && parsedUrl.pathname !== "/") {
          contextPrefix += `URL Path: ${parsedUrl.pathname}\n`;
        }
      } catch {}
    }
    try {
      if (process.env.GOOGLE_GENERATIVE_AI_API_KEY && normalized.split(/\s+/).length > 500) {
        const { generateText } = await import("ai");
        const { google } = await import("@ai-sdk/google");

        const { text } = await generateText({
          model: google("gemini-2.5-flash"),
          prompt: `Write a 1-sentence summary of this document to provide context for vector search chunks. Document text:\n\n${normalized.slice(0, 2000)}`,
        });
        contextPrefix += `Context: ${text.trim()}\n\n`;
      }
    } catch (err) {
      console.warn(`Failed to generate contextual embedding summary for ${url}`, err);
      contextPrefix += "\n";
    }

    const parentChunks = chunkMarkdown(normalized, 3000, 300);
    const chunks = [];

    for (const parentChunk of parentChunks) {
      const childChunks = chunkMarkdown(parentChunk.text, 800, 100, parentChunk.headingPath);
      for (const childChunk of childChunks) {
        const baseText = contextPrefix + childChunk.text;
        const guardedParts = guardChunkSize(baseText);
        for (const part of guardedParts) {
          chunks.push({
            text: part,
            contentHash: await sha256(part),
            parentText: parentChunk.text,
            headingPath: childChunk.headingPath,
          });
        }
      }
    }

    await ctx.runMutation(internal.crawl.mutations.enqueueDocumentChunks, {
      documentId: result.documentId,
      url,
      chunks,
    });

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
