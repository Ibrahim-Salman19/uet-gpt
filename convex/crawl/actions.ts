"use node";

import { createHmac } from "node:crypto";
import { ConvexError, v } from "convex/values";
import { UET_CRAWL_CONFIG } from "../../src/lib/constants";
import { internal } from "../_generated/api";
import { internalAction } from "../_generated/server";

// legacy processWebhookResult removed

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
      const crawlUrlRaw = process.env.CRAWL4AI_URL;
      if (!crawlUrlRaw) {
        throw new ConvexError(
          "CRAWL4AI_URL environment variable is not configured. Please set CRAWL4AI_URL in your deployment settings.",
        );
      }
      const crawlUrl = crawlUrlRaw.replace(/\/$/, "");
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
          urls: UET_CRAWL_CONFIG.seedUrls,
          max_pages: UET_CRAWL_CONFIG.maxPages,
          max_depth: UET_CRAWL_CONFIG.maxDepth,
          include_patterns: UET_CRAWL_CONFIG.includePaths,
          exclude_patterns: UET_CRAWL_CONFIG.excludePaths,
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
        sourceHost = args.url.startsWith("pdf://") ? "pdf" : new URL(args.url).hostname;
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
