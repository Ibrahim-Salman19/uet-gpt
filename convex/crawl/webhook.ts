import { internal } from "../_generated/api";
import { httpAction } from "../_generated/server";

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
  rawBody: string,
  signature: string,
  secret: string,
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
    const dataBuffer = encoder.encode(`${timestamp}.${rawBody}`);

    return await crypto.subtle.verify("HMAC", key, sigBuffer, dataBuffer);
  } catch (err) {
    console.error("Signature verification failed with crypto error:", err);
    return false;
  }
}

function normalizeContent(text: string): string {
  return (
    text
      .replace(/\r\n/g, "\n") // normalize line endings
      .replace(/[ \t]+\n/g, "\n") // trailing whitespace on lines
      .replace(/\n{3,}/g, "\n\n") // collapse excessive blank lines
      // Drop pure navigation anchor links: [Text](#anchor)
      .replace(/^\s*\[[^\]]*\]\(#[^)]*\)\s*$/gm, "")
      // Drop empty markdown tables
      .replace(/^(\s*\|\s*)+\|?\s*$/gm, "")
      .replace(/^(\s*\|?\s*---\s*)+\|?\s*$/gm, "")
      .trim()
  );
}

function isQualityChunk(text: string): boolean {
  // Must have at least 5 meaningful words to drop tiny useless fragments
  const words = text.split(/\s+/).filter((w) => w.trim().length > 1);
  if (words.length < 5) return false;

  // We intentionally do NOT use alphanumeric ratio checks here anymore.
  // Because the Trafilatura crawler now properly extracts real data tables,
  // we must protect chunks that contain dense markdown tables (which are full of `|` and `-`).
  return true;
}

export function chunkMarkdown(
  markdown: string,
  maxChunkSize: number = 3000,
  overlapSize: number = 200,
): string[] {
  const chunks: string[] = [];

  // 1. Split by double newline (Paragraphs/Sections/Tables)
  const blocks = markdown.split(/\n{2,}/);

  let currentChunk = "";
  let currentHeader = "";

  function getOverlap(text: string): string {
    if (!text || text.length <= overlapSize) return text;
    const tail = text.slice(-overlapSize);
    const splitIndex = tail.indexOf(" ");
    return splitIndex !== -1 ? tail.slice(splitIndex + 1) : tail;
  }

  function pushChunk(text: string) {
    let cleanText = text.trim();
    if (currentHeader && !cleanText.startsWith(currentHeader)) {
      cleanText = `${currentHeader}\n\n${cleanText}`;
    }
    chunks.push(cleanText);
  }

  for (const block of blocks) {
    const trimmedBlock = block.trim();
    const isBlockHeader = trimmedBlock.startsWith("#");
    if (isBlockHeader) {
      currentHeader = trimmedBlock;
    }

    if (block.length > maxChunkSize) {
      if (currentChunk) {
        pushChunk(currentChunk);
        const isHeader = block.trimStart().startsWith("#");
        currentChunk = isHeader ? "" : getOverlap(currentChunk.trim());
      }

      // If it's a markdown table, split by rows but preserve the header
      if (block.trimStart().startsWith("|")) {
        const rows = block.split("\n");
        let currentTableChunk = currentChunk ? `${currentChunk}\n\n` : "";
        const header = rows.length > 2 ? `${rows[0]}\n${rows[1]}\n` : "";
        const startIndex = rows.length > 2 ? 2 : 0;

        for (let i = startIndex; i < rows.length; i++) {
          const row = `${rows[i]}\n`;
          if (currentTableChunk.length + row.length > maxChunkSize) {
            if (currentTableChunk) pushChunk(header + currentTableChunk);
            currentTableChunk = `${getOverlap(currentTableChunk.trim())}\n${row}`;
          } else {
            currentTableChunk += row;
          }
        }
        if (currentTableChunk) {
          pushChunk(header + currentTableChunk);
          currentChunk = getOverlap(currentTableChunk.trim());
        } else {
          currentChunk = "";
        }
      } else {
        // Prose block -> Split by sentence boundary safely
        const sentences: string[] = [];
        const sentenceRegex = /[^.!?]+[.!?]+/g;
        let lastIndex = 0;
        while (true) {
          const match = sentenceRegex.exec(block);
          if (match === null) break;
          sentences.push(match[0]);
          lastIndex = sentenceRegex.lastIndex;
        }
        if (lastIndex < block.length) {
          const trailing = block.slice(lastIndex);
          if (trailing.trim()) {
            sentences.push(trailing);
          }
        }
        if (sentences.length === 0) {
          sentences.push(block);
        }

        const finalSentences: string[] = [];
        for (const s of sentences) {
          if (s.length > maxChunkSize) {
            const words = s.split(" ");
            let currentWordChunk = "";
            for (const word of words) {
              if (currentWordChunk.length + word.length + 1 > maxChunkSize) {
                if (currentWordChunk) finalSentences.push(currentWordChunk);
                currentWordChunk = word;
              } else {
                currentWordChunk += (currentWordChunk ? " " : "") + word;
              }
            }
            if (currentWordChunk) {
              finalSentences.push(currentWordChunk);
            }
          } else {
            finalSentences.push(s);
          }
        }

        let currentSentenceChunk = currentChunk ? `${currentChunk}\n\n` : "";

        for (const sentence of finalSentences) {
          if (currentSentenceChunk.length + sentence.length > maxChunkSize) {
            if (currentSentenceChunk) pushChunk(currentSentenceChunk);
            currentSentenceChunk = `${getOverlap(currentSentenceChunk.trim())} ${sentence}`;
          } else {
            currentSentenceChunk += (currentSentenceChunk ? " " : "") + sentence;
          }
        }
        if (currentSentenceChunk) {
          pushChunk(currentSentenceChunk);
          currentChunk = getOverlap(currentSentenceChunk.trim());
        } else {
          currentChunk = "";
        }
      }
    } else {
      // Normal coherent block
      const isHeader = block.trimStart().startsWith("#");
      if (currentChunk.length + block.length > maxChunkSize) {
        pushChunk(currentChunk);
        currentChunk = (isHeader ? "" : `${getOverlap(currentChunk.trim())}\n\n`) + block;
      } else {
        currentChunk += (currentChunk ? "\n\n" : "") + block;
      }
    }
  }

  if (currentChunk && currentChunk.trim().length > overlapSize) {
    pushChunk(currentChunk);
  }

  return chunks.filter((c) => isQualityChunk(c));
}

export const crawlWebhook = httpAction(async (ctx, request) => {
  try {
    const rawBody = await request.text();
    const contentLength = Number(request.headers.get("content-length") ?? rawBody.length);

    // 1. Enforce payload size limit (1MB) to prevent memory exhaustion
    if (contentLength > 1_048_576) {
      console.warn(`Webhook payload too large: ${contentLength} bytes`);
      return new Response("Payload too large", { status: 413 });
    }

    const timestamp = request.headers.get("x-crawl-timestamp");
    const signature = request.headers.get("x-crawl-signature");

    if (!timestamp || !signature) {
      console.warn("Webhook rejected: Missing signature headers");
      return new Response("Missing signature headers", { status: 400 });
    }

    // 2. Validate timestamp window to prevent replay attacks (allow up to 5 minutes)
    const ts = parseInt(timestamp, 10);
    const MAX_SKEW_MS = 5 * 60 * 1000; // 5 minutes
    if (Number.isNaN(ts) || Math.abs(Date.now() - ts) > MAX_SKEW_MS) {
      console.warn(`Webhook rejected: Timestamp expired or invalid: ${timestamp}`);
      return new Response("Request timestamp expired", { status: 400 });
    }

    // 3. Verify HMAC-SHA256 signature to prove origin
    const secret = process.env.CRAWL_WEBHOOK_SECRET;
    if (!secret) {
      console.error("CRAWL_WEBHOOK_SECRET environment variable is not set");
      return new Response("Server configuration error", { status: 500 });
    }

    const isValid = await verifySignature(timestamp, rawBody, signature, secret);
    if (!isValid) {
      console.warn("Webhook rejected: Invalid signature");
      return new Response("Invalid signature", { status: 401 });
    }

    const payload = JSON.parse(rawBody);
    console.log("Received authenticated Crawl4AI webhook:", payload);

    if (!payload || (!payload.task_id && !payload.job_id)) {
      return new Response("Invalid payload: Missing task_id", { status: 400 });
    }

    const taskId = payload.task_id || payload.job_id;
    const status = payload.status; // "completed", "failed", etc.
    const results = payload.data || payload.results || (payload.url ? [payload] : []);

    // 4. Idempotency Check: prevent duplicate injections if webhook is retried
    const existing = await ctx.runQuery(internal.crawl.mutations.getProcessedWebhook, {
      jobId: taskId,
    });
    if (existing) {
      console.log(`Webhook already processed (Idempotent): ${taskId}`);
      return new Response(JSON.stringify({ ok: true, deduped: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Mark as processed in the database
    await ctx.runMutation(internal.crawl.mutations.markWebhookProcessed, {
      jobId: taskId,
      expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days TTL
    });

    // Process pages, normalize, chunk, and queue them for ingestion
    for (const result of results) {
      const url = result.url || payload.url;
      const content = result.markdown || result.html || result.text;
      const title = result.metadata?.title || "Untitled";
      const etag = result.headers?.etag || undefined;
      const lastModified = result.headers?.["last-modified"] || undefined;

      if (!content || content.trim().length === 0) {
        console.warn(`Empty content for URL: ${url}`);
        continue;
      }

      console.log(`Processing and normalising crawled page: ${url}`);

      const normalized = normalizeContent(content);
      const contentHash = await sha256(normalized);
      const rawChunks = chunkMarkdown(normalized);

      let contextPrefix = `Document Title: ${title}\n`;
      try {
        if (process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
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

      const chunks = [];
      for (const text of rawChunks) {
        const contextualizedText = contextPrefix + text;
        chunks.push({
          text: contextualizedText,
          contentHash: await sha256(contextualizedText),
        });
      }

      // Queue the payload using the new workpool component with dynamic arguments
      const args: any = {
        url,
        title,
        contentHash,
        jobId: taskId,
        chunks,
      };
      if (etag !== undefined) args.etag = etag;
      if (lastModified !== undefined) args.lastModified = lastModified;

      await ctx.runMutation(internal.crawl.mutations.queueChunksForEmbedding, args);
    }

    // If the webhook payload indicates the entire task is complete or failed, update the job state
    if (status === "completed" || status === "failed") {
      await ctx.runMutation(internal.crawl.workflow.completeJobByTaskId, {
        taskId,
        status,
      });
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Webhook processing error:", error);
    return new Response("Internal Server Error", { status: 500 });
  }
});

export const ingestWebhook = httpAction(async (ctx, request) => {
  try {
    const rawBody = await request.text();

    // Enforce payload size limit on /ingest (4MB max)
    if (rawBody.length > 4_194_304) {
      console.warn(`/ingest payload too large: ${rawBody.length} bytes`);
      return new Response("Payload too large", { status: 413 });
    }

    const payload = JSON.parse(rawBody);

    const authHeader = request.headers.get("Authorization");
    const token = authHeader?.split(" ")[1];
    const expectedToken = process.env.CONVEX_AUTH_TOKEN;

    if (expectedToken && token !== expectedToken) {
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

    // Call upsertDocument mutation to update the document and delete old chunks/vectors if changed
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

    // Since content changed or is new, let's chunk and enqueue the new chunks
    const normalized = normalizeContent(markdown);
    const rawChunks = chunkMarkdown(normalized);

    let contextPrefix = `Document Title: ${title || url}\n`;
    try {
      if (process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
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

    const chunks = [];
    for (const text of rawChunks) {
      const contextualizedText = contextPrefix + text;
      chunks.push({
        text: contextualizedText,
        contentHash: await sha256(contextualizedText),
      });
    }

    // Call enqueueDocumentChunks to register chunk count and enqueue each in the workpool
    await ctx.runMutation(internal.crawl.mutations.enqueueDocumentChunks, {
      documentId: result.documentId,
      url,
      chunks,
    });

    return new Response(JSON.stringify({ success: true, action: result.action }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Ingest webhook error:", error);
    return new Response(JSON.stringify({ error: error.message || String(error) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
