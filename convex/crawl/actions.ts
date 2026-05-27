"use node";

import { createHash, createHmac } from "node:crypto";
import { ConvexError, v } from "convex/values";
import { internal } from "../_generated/api";
import { action, internalAction } from "../_generated/server";

const SEED_URLS = [
  "https://web.uettaxila.edu.pk/",
  "https://web.uettaxila.edu.pk/admissions/",
  "https://web.uettaxila.edu.pk/academics/",
  "https://web.uettaxila.edu.pk/departments/",
  "https://web.uettaxila.edu.pk/programs/",
  "https://web.uettaxila.edu.pk/about/",
];

function sha256(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

function normalizeContent(text: string): string {
  return text
    .replace(/\r\n/g, "\n") // normalize line endings
    .replace(/\s+\n/g, "\n") // trailing whitespace
    .replace(/\n{3,}/g, "\n\n") // collapse excessive blank lines
    .trim();
}

function chunkMarkdown(markdown: string, maxChunkSize: number = 3000): string[] {
  const CHUNK_OVERLAP_CHARS = 300;
  const lines = markdown.split("\n");
  const chunks: string[] = [];

  const headers: Record<number, string> = { 1: "", 2: "", 3: "", 4: "", 5: "", 6: "" };
  let current: string[] = [];
  let inTable = false;

  const flush = () => {
    const text = current.join("\n").trim();
    if (text.length >= 40) {
      chunks.push(text);
    }
    current = [];
  };

  for (const line of lines) {
    const headerMatch = line.match(/^(#{1,6})\s+(.*)/);
    if (headerMatch && headerMatch[1]) {
      flush();
      const level = headerMatch[1].length;
      headers[level] = line.trim();
      for (let l = level + 1; l <= 6; l++) headers[l] = "";
      current.push(line);
      continue;
    }

    const isTableLine = line.trimStart().startsWith("|");
    if (isTableLine && !inTable) inTable = true;
    if (!isTableLine && inTable && line.trim() !== "") inTable = false;

    current.push(line);

    if (!inTable && current.join("\n").length > maxChunkSize) {
      const textToFlush = current.join("\n").trim();
      flush();
      const breadcrumbLines = [
        headers[1], headers[2], headers[3], 
        headers[4], headers[5], headers[6]
      ].filter(Boolean) as string[];
      
      if (breadcrumbLines.length > 0) {
        current = [...breadcrumbLines, ""];
      }
      
      if (textToFlush.length > CHUNK_OVERLAP_CHARS) {
        let overlap = textToFlush.slice(-CHUNK_OVERLAP_CHARS);
        const firstSpace = overlap.indexOf(" ");
        if (firstSpace !== -1 && firstSpace < 50) {
          overlap = overlap.slice(firstSpace + 1);
        }
        current.push(overlap);
      } else {
        current.push(textToFlush);
      }
    }
  }

  flush();
  return chunks;
}

export const processWebhookResult = action({
  args: {
    url: v.string(),
    title: v.string(),
    content: v.string(),
  },
  returns: v.object({
    success: v.boolean(),
    entryId: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    if (!args.content || args.content.trim().length === 0) {
      throw new ConvexError("Content is empty");
    }

    const normalized = normalizeContent(args.content);
    const contentHash = sha256(normalized);
    const rawChunks = chunkMarkdown(normalized);
    const chunks = rawChunks.map((text) => ({
      text,
      contentHash: sha256(text),
    }));

    await ctx.runMutation(internal.crawl.mutations.queueChunksForEmbedding, {
      url: args.url,
      title: args.title,
      contentHash,
      jobId: "legacy-job",
      chunks,
    });

    return {
      success: true,
      entryId: "legacy-compat",
    };
  },
});

export const executeCrawlJob = internalAction({
  args: {
    jobId: v.id("crawlJobs"),
  },
  handler: async (ctx, args) => {
    // Set to running
    await ctx.runMutation(internal.crawl.workflow.updateJobState, {
      jobId: args.jobId,
      status: "running",
    });

    try {
      const crawlUrl = (process.env.CRAWL4AI_URL || "http://localhost:11235").replace(/\/$/, "");
      const webhookUrl = `${process.env.CONVEX_SITE_URL}/api/webhook/crawl`;

      const secret = process.env.CRAWL_WEBHOOK_SECRET;
      if (!secret) {
        throw new Error("CRAWL_WEBHOOK_SECRET environment variable is not configured");
      }

      const timestamp = Date.now().toString();
      const signature = createHmac("sha256", secret).update(timestamp).digest("hex");

      const response = await fetch(`${crawlUrl}/crawl`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          urls: SEED_URLS,
          max_pages: 500,
          max_depth: 5,
          include_patterns: ["https://web.uettaxila.edu.pk/**"],
          exclude_patterns: ["*.pdf", "*.jpg", "*.png", "*/edit", "*/delete"],
          extract_blocks: true,
          word_count_threshold: 50,
          check_robots_txt: true,
          flatten_shadow_dom: true,
          magic: true,
          simulate_user: true,
          webhook_config: {
            webhook_url: webhookUrl,
            webhook_data_in_payload: true,
            webhook_headers: {
              "x-crawl-timestamp": timestamp,
              "x-crawl-signature": signature,
            },
          },
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Crawl4AI API error (${response.status}): ${errorText}`);
      }

      const data = (await response.json()) as any;

      if (!data.task_id && !data.job_id) {
        throw new Error("Invalid response format from Crawl4AI - no job ID returned");
      }

      const providerJobId = data.task_id || data.job_id;

      // Update job with provider task id
      await ctx.runMutation(internal.crawl.workflow.updateJobState, {
        jobId: args.jobId,
        providerJobId,
      });
    } catch (error) {
      console.error("Crawl initialization failed:", error);

      // Update status to failed
      await ctx.runMutation(internal.crawl.workflow.updateJobState, {
        jobId: args.jobId,
        status: "failed",
        error: error instanceof Error ? error.message : "Unknown error",
      });
      throw error;
    }
  },
});

export const embedSingleChunk = internalAction({
  args: {
    documentId: v.id("documents"),
    url: v.string(),
    chunkText: v.string(),
    contentHash: v.string(),
    jobId: v.string(),
  },
  handler: async (ctx, args) => {
    const { rag } = await import("../rag/instance.js");
    try {
      // Safe source extraction — handles both https:// and pdf:// virtual URLs
      let sourceHost: string;
      try {
        sourceHost = args.url.startsWith("pdf://")
          ? "pdf"
          : new URL(args.url).hostname;
      } catch {
        sourceHost = "unknown";
      }

      const result = await rag.add(ctx, {
        namespace: "uet-global",
        text: args.chunkText,
        filterValues: [
          { name: "category", value: "crawled" },
          { name: "source", value: sourceHost },
        ],
      });

      await ctx.runMutation(internal.crawl.mutations.saveEmbedding, {
        documentId: args.documentId,
        chunkText: args.chunkText,
        contentHash: args.contentHash,
        ragId: result.entryId,
      });

      return { success: true, ragId: result.entryId };
    } catch (error: any) {
      // Catch malformed inputs (e.g. content too long) and skip retrying
      if (error?.status === 400 || error?.message?.includes("400")) {
        console.error(
          `[EMBED] Malformed chunk skipped for URL ${args.url}: ${error.message || error}`,
        );
        return { success: false, skipped: true };
      }

      // Let other rate-limiting or network errors bubble up to workpool retries
      throw error;
    }
  },
});
