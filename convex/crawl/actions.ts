// fallow-ignore-file security-sink
"use node";

import { createHmac } from "node:crypto";
import type { NamespaceId } from "@convex-dev/rag";
import { ConvexError, v } from "convex/values";
import { UET_CRAWL_CONFIG } from "../../src/lib/constants";
import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import { internalAction } from "../_generated/server";
import { rag } from "../rag/instance";
import { isPdfVirtualUrl } from "./chunking";

// legacy processWebhookResult removed

/**
 * A-3: Sitemap pre-seeding — merges sitemap URLs into the crawl seed list.
 * Fetches standard sitemap XML, extracts <loc> URLs, and filters through include/exclude patterns.
 * Improves coverage by catching pages not explicitly listed as seed URLs.
 */
async function fetchSitemapUrls(
  sitemapUrl: string,
  includePatterns: readonly string[],
  excludePatterns: readonly string[],
  timeoutMs: number = 10000,
): Promise<string[]> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    const response = await fetch(sitemapUrl, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!response.ok) {
      console.warn(`Sitemap fetch returned ${response.status} for ${sitemapUrl}`);
      return [];
    }

    const xml = await response.text();
    const locRegex = /<loc[^>]*>([^<]+)<\/loc>/gi;
    const urls: string[] = [];
    let match: RegExpExecArray | null;
    while ((match = locRegex.exec(xml)) !== null) {
      const url = match[1]!.trim();
      urls.push(url);
    }

    // Handle sitemap index (sitemap that points to other sitemaps)
    const sitemapRegex = /<sitemap[^>]*>[\s\S]*?<loc[^>]*>([^<]+)<\/loc>[\s\S]*?<\/sitemap>/gi;
    let smMatch: RegExpExecArray | null;
    while ((smMatch = sitemapRegex.exec(xml)) !== null) {
      const childUrls = await fetchSitemapUrls(
        smMatch[1]!.trim(),
        includePatterns,
        excludePatterns,
        timeoutMs,
      );
      urls.push(...childUrls);
    }

    // Filter through include/exclude patterns
    const allowed = urls.filter((u) => {
      const include =
        includePatterns.length === 0 ||
        includePatterns.some((p) => {
          const pattern = p.replace(/\*\*/g, ".*").replace(/\*/g, "[^/]*");
          return new RegExp(`^${pattern}$`).test(u);
        });
      const exclude = excludePatterns.some((p) => {
        const pattern = p.replace(/\*\*/g, ".*").replace(/\*/g, "[^/]*");
        return new RegExp(`^${pattern}$`).test(u);
      });
      return include && !exclude;
    });

    return [...new Set(allowed)];
  } catch (err) {
    console.warn(`Sitemap fetch failed for ${sitemapUrl}:`, err);
    return [];
  }
}

function validateCrawlEnvironment() {
  const convexSiteUrl = process.env.CONVEX_SITE_URL;
  if (!convexSiteUrl) {
    throw new ConvexError(
      "CONVEX_SITE_URL environment variable is not configured. The webhook callback URL will be empty.",
    );
  }

  const crawlUrlRaw = process.env.CRAWL4AI_URL || process.env.CRAWL4AI_BASE_URL;
  if (!crawlUrlRaw) {
    throw new ConvexError(
      "CRAWL4AI_URL environment variable is not configured. Please set CRAWL4AI_URL (or CRAWL4AI_BASE_URL) in your deployment settings.",
    );
  }
  const crawlUrl = crawlUrlRaw.replace(/\/$/, "");
  const webhookUrl = `${convexSiteUrl}/api/webhook/crawl`;

  const primarySecret = process.env.CRAWL_WEBHOOK_SECRET;
  const secondarySecret = process.env.CRAWL_WEBHOOK_SECRET_NEW;
  if (!primarySecret) {
    throw new Error("CRAWL_WEBHOOK_SECRET environment variable is not configured");
  }

  // Crawl4AI v0.8.x+ uses JWT auth (opt-in, off by default) instead of CRAWL4AI_API_TOKEN.
  // Enable by setting CRAWL4AI_JWT_TOKEN env var.
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const jwtToken = process.env.CRAWL4AI_JWT_TOKEN;
  if (jwtToken) {
    headers["Authorization"] = `Bearer ${jwtToken}`;
  }

  return { convexSiteUrl, crawlUrl, webhookUrl, primarySecret, secondarySecret, headers };
}

// A-3: Sitemap pre-seeding — fetch sitemap URLs and merge with seed list
async function mergeSitemapUrls(): Promise<string[]> {
  const mergedUrls: string[] = [...UET_CRAWL_CONFIG.seedUrls];
  try {
    const sitemapBase = "https://web.uettaxila.edu.pk";
    const sitemapUrls = await fetchSitemapUrls(
      `${sitemapBase}/sitemap.xml`,
      UET_CRAWL_CONFIG.includePaths,
      UET_CRAWL_CONFIG.excludePaths,
    );
    if (sitemapUrls.length > 0) {
      const existingSet = new Set(mergedUrls.map((u) => u.replace(/\/+$/, "")));
      for (const su of sitemapUrls) {
        const normalized = su.replace(/\/+$/, "");
        if (!existingSet.has(normalized)) {
          mergedUrls.push(su);
          existingSet.add(normalized);
        }
      }
      console.log(
        `Sitemap pre-seeding: +${mergedUrls.length - UET_CRAWL_CONFIG.seedUrls.length} URLs from sitemap`,
      );
    }
  } catch (sitemapErr) {
    console.warn(
      "Sitemap pre-seeding failed, falling back to configured seed URLs:",
      sitemapErr,
    );
  }
  return mergedUrls;
}

// Crash recovery: if a saved state exists, pass resume_state to BFSDeepCrawlStrategy
// so BFS progress persists across container restarts.
async function getSavedCrawlState(
  ctx: any,
  jobId: Id<"crawlJobs">,
): Promise<unknown> {
  const job = await ctx.runQuery(internal.crawl.queries.getJobById, { jobId });
  return (job as Doc<"crawlJobs"> & { crawlState?: unknown })?.crawlState ?? null;
}

// Crawl4AI v0.8.6+: POST to /crawl/job with type-params format for config objects.
// Flat params are silently ignored by Pydantic (CrawlRequest only has urls, browser_config, crawler_config).
// WebhookConfig at top level (only supported by /crawl/job, not /crawl).
// Build the payload object first so we can sign it before adding webhook_headers
function buildCrawlPayload(
  mergedUrls: string[],
  webhookUrl: string,
  lastSavedState: unknown,
): Record<string, unknown> {
  return {
    urls: mergedUrls,
    browser_config: {
      type: "BrowserConfig",
      params: { headless: true },
    },
    crawler_config: {
      type: "CrawlerRunConfig",
      params: {
        word_count_threshold: 50,
        magic: true,
        simulate_user: true,
        mean_delay: 1.0,
        delay_before_return_html: 1000,
        check_robots_txt: true,
        max_pages: UET_CRAWL_CONFIG.maxPages,
        include_patterns: [...UET_CRAWL_CONFIG.includePaths],
        exclude_patterns: [...UET_CRAWL_CONFIG.excludePaths],
        deep_crawl_strategy: {
          type: "BFSDeepCrawlStrategy",
          params: {
            max_depth: UET_CRAWL_CONFIG.maxDepth,
            max_pages: UET_CRAWL_CONFIG.maxPages,
            ...(lastSavedState ? { resume_state: lastSavedState } : {}),
          },
        },
      },
    },
    webhook_config: {
      webhook_url: webhookUrl,
      webhook_data_in_payload: true,
    },
  };
}

// Sign the body (without webhook_headers, which are unknown until after signing)
function signCrawlPayload(
  crawlPayload: Record<string, unknown>,
  primarySecret: string,
  secondarySecret: string | undefined,
): string {
  const timestamp = Date.now().toString();
  const bodyForSigning = JSON.stringify(crawlPayload);
  const secrets = [primarySecret, secondarySecret].filter(Boolean) as string[];
  const signatures = secrets
    .map((s) =>
      createHmac("sha256", s)
        .update(timestamp + "." + bodyForSigning)
        .digest("hex"),
    )
    .join(",");
  // Add the computed signature to the webhook config
  (crawlPayload.webhook_config as Record<string, unknown>).webhook_headers = {
    "x-crawl-timestamp": timestamp,
    "x-crawl-signature": signatures,
  };
  return JSON.stringify(crawlPayload);
}

async function sendCrawlRequest(
  crawlUrl: string,
  body: string,
  headers: Record<string, string>,
): Promise<string> {
  const response = await fetch(`${crawlUrl}/crawl/job`, {
    method: "POST",
    headers,
    body,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Crawl4AI API error (${response.status}): ${errorText}`);
  }

  const data = (await response.json()) as { task_id?: string; job_id?: string };

  if (!data.task_id && !data.job_id) {
    throw new Error("Invalid response format from Crawl4AI - no job ID returned");
  }

  return data.task_id || data.job_id!;
}

async function updateCrawlJobState(
  ctx: any,
  jobId: Id<"crawlJobs">,
  providerJobId: string,
): Promise<void> {
  await ctx.runMutation(internal.crawl.workflow.updateJobState, {
    jobId,
    providerJobId,
  });
}

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
      const env = validateCrawlEnvironment();
      const mergedUrls = await mergeSitemapUrls();
      const lastSavedState = await getSavedCrawlState(ctx, args.jobId);
      const crawlPayload = buildCrawlPayload(mergedUrls, env.webhookUrl, lastSavedState);
      const body = signCrawlPayload(crawlPayload, env.primarySecret, env.secondarySecret);
      const providerJobId = await sendCrawlRequest(env.crawlUrl, body, env.headers);
      await updateCrawlJobState(ctx, args.jobId, providerJobId);
    } catch (error) {
      console.error(`Crawl initialization failed for job ${args.jobId}:`, error);

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
    parentText: v.optional(v.string()),
    headingPath: v.optional(v.array(v.string())),
    namespaceId: v.string(),
  },
  handler: async (ctx, args) => {
    try {
      // Safe source extraction — handles both https:// and pdf:// virtual URLs
      let sourceHost: string;
      try {
        sourceHost = isPdfVirtualUrl(args.url) ? "pdf" : new URL(args.url).hostname;
      } catch {
        sourceHost = "unknown";
      }

      const result = await rag.add(ctx, {
        namespaceId: args.namespaceId as unknown as NamespaceId,
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
        parentText: args.parentText,
        headingPath: args.headingPath,
      });

      ctx.runAction(internal.embeddings.contextualize.contextualizeNewChunk, {
        documentId: args.documentId,
        contentHash: args.contentHash,
      }).catch((err: unknown) => {
        console.warn("Immediate contextualization failed:", err);
      });

      return {
        success: true,
        ragId: result.entryId,
        contentHash: args.contentHash,
        documentId: args.documentId,
        url: args.url,
      };
    } catch (error: unknown) {
      const err = error as { status?: number; message?: string };
      if (err?.status === 400 || err?.message?.includes("400")) {
        console.error(
          `[EMBED] Malformed chunk skipped for URL ${args.url}: ${err.message || error}`,
        );
        return {
          success: false,
          skipped: true,
          contentHash: args.contentHash,
          documentId: args.documentId,
          url: args.url,
        };
      }

      // Let other rate-limiting or network errors bubble up to workpool retries
      throw error;
    }
  },
});

export const resetPipelineAction = internalAction({
  args: {},
  handler: async (ctx) => {
    let isDone = false;
    while (!isDone) {
      const result = await ctx.runMutation(internal.crawl.reset_ops.resetPipelineBatch, {
        limit: 200,
      });
      if (result.remaining === "done") {
        isDone = true;
      }
    }
  },
});

export const runDeduplication = internalAction({
  args: {},
  handler: async (ctx) => {
    const seenUrls = new Set<string>();
    let deletedCount = 0;
    let cursor = null as string | null;
    let isDone = false;

    while (!isDone) {
      const page = (await ctx.runQuery(internal.crawl.deduplication.findDuplicatesBatch, {
        cursor,
      })) as { page: Doc<"documents">[]; continueCursor: string; isDone: boolean };

      const duplicatesToDelete: Id<"documents">[] = [];
      for (const doc of page.page) {
        if (!seenUrls.has(doc.url)) {
          seenUrls.add(doc.url);
        } else {
          duplicatesToDelete.push(doc._id);
        }
      }

      if (duplicatesToDelete.length > 0) {
        const result = await ctx.runMutation(
          internal.crawl.deduplication.deleteDuplicateDocuments,
          { documentIds: duplicatesToDelete },
        );
        deletedCount += result.deleted;
      }

      isDone = page.isDone;
      cursor = page.continueCursor;
    }
    return { deleted: deletedCount };
  },
});
