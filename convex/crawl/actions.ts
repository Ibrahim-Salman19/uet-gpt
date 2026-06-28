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

// SECURITY (SSRF hardening): only fetch sitemaps and accept <loc> URLs on the
// university domain. An attacker who can influence sitemap contents must not be able
// to make the server fetch arbitrary internal/external hosts or follow redirects to them.
const SITEMAP_ALLOWED_DOMAIN_SUFFIX = "uettaxila.edu.pk";
// Bound recursion of nested sitemap indexes and the total number of sitemap documents
// fetched per crawl so a maliciously deep/wide sitemap tree cannot cause unbounded fetches (DoS).
const MAX_SITEMAP_DEPTH = 3;
const MAX_SITEMAPS_FETCHED = 50;
const MAX_SITEMAP_BYTES = 10_485_760; // 10 MiB response cap

function isAllowedSitemapHost(url: string): boolean {
  let host: string;
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    return false;
  }
  return (
    host === SITEMAP_ALLOWED_DOMAIN_SUFFIX || host.endsWith(`.${SITEMAP_ALLOWED_DOMAIN_SUFFIX}`)
  );
}

/**
 * A-3: Sitemap pre-seeding — merges sitemap URLs into the crawl seed list.
 * Fetches standard sitemap XML, extracts <loc> URLs, and filters through include/exclude patterns.
 * Improves coverage by catching pages not explicitly listed as seed URLs.
 *
 * SSRF-hardened: bounded recursion depth + visited-set, host allowlist on both the
 * fetched sitemap and every emitted <loc> URL, response-size cap, and redirects are
 * disabled (a redirect off-domain is treated as a failed fetch rather than followed).
 */
async function fetchSitemapUrls(
  sitemapUrl: string,
  includePatterns: readonly string[],
  excludePatterns: readonly string[],
  timeoutMs: number = 10000,
  depth: number = 0,
  visited: Set<string> = new Set(),
  fetchBudget: { count: number } = { count: 0 },
): Promise<string[]> {
  // Bound recursion, total fetches, and avoid revisiting the same sitemap.
  if (depth > MAX_SITEMAP_DEPTH) return [];
  if (fetchBudget.count >= MAX_SITEMAPS_FETCHED) return [];
  if (visited.has(sitemapUrl)) return [];
  // SECURITY: never fetch a sitemap off the allowed domain.
  if (!isAllowedSitemapHost(sitemapUrl)) {
    console.warn(`Sitemap fetch skipped (host not in allowlist): ${sitemapUrl}`);
    return [];
  }
  visited.add(sitemapUrl);
  fetchBudget.count++;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    // redirect: "error" — do NOT silently follow redirects to other (possibly internal) hosts.
    const response = await fetch(sitemapUrl, { signal: controller.signal, redirect: "error" });
    clearTimeout(timeoutId);

    if (!response.ok) {
      console.warn(`Sitemap fetch returned ${response.status} for ${sitemapUrl}`);
      return [];
    }

    // Cap response size to avoid memory exhaustion from a hostile sitemap.
    const buffer = await response.arrayBuffer();
    if (buffer.byteLength > MAX_SITEMAP_BYTES) {
      console.warn(`Sitemap too large (${buffer.byteLength} bytes) for ${sitemapUrl}`);
      return [];
    }
    const xml = new TextDecoder().decode(buffer);
    const locRegex = /<loc[^>]*>([^<]+)<\/loc>/gi;
    const urls: string[] = [];
    let match: RegExpExecArray | null;
    while ((match = locRegex.exec(xml)) !== null) {
      const url = match[1]!.trim();
      // SECURITY: only emit on-domain page URLs.
      if (isAllowedSitemapHost(url)) urls.push(url);
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
        depth + 1,
        visited,
        fetchBudget,
      );
      urls.push(...childUrls);
    }

    // Filter through include/exclude patterns
    const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const globToRegex = (pattern: string) => {
      const escaped = escapeRegExp(pattern);
      const regexPattern = escaped.replace(/\\\*\\\*/g, ".*").replace(/\\\*/g, "[^/]*");
      return new RegExp(`^${regexPattern}$`);
    };
    const allowed = urls.filter((u) => {
      const include =
        includePatterns.length === 0 || includePatterns.some((p) => globToRegex(p).test(u));
      const exclude = excludePatterns.some((p) => globToRegex(p).test(u));
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
    console.warn("Sitemap pre-seeding failed, falling back to configured seed URLs:", sitemapErr);
  }
  return mergedUrls;
}

// Crash recovery: if a saved state exists, pass resume_state to BFSDeepCrawlStrategy
// so BFS progress persists across container restarts.
async function getSavedCrawlState(ctx: any, jobId: Id<"crawlJobs">): Promise<unknown> {
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
        word_count_threshold: 10, // Lowered from 50 to preserve small tables and bullet points
        magic: true,
        simulate_user: true,
        mean_delay: 1.0,
        delay_before_return_html: 1000,
        check_robots_txt: true,
        max_pages: UET_CRAWL_CONFIG.maxPages,
        include_patterns: [...UET_CRAWL_CONFIG.includePaths],
        exclude_patterns: [...UET_CRAWL_CONFIG.excludePaths],
        excluded_tags: ["nav", "aside", "footer", "header", "form", "iframe", "style", "script", "noscript"],
        table_score_threshold: 1, // Set to 1 to extract even smaller tables
        remove_overlay_elements: true,
        process_iframes: false,
        exclude_external_images: true, // 2026 SOTA: Network-level resource drop to block tracking pixels and irrelevant styling
        exclude_social_media_links: true, // 2026 SOTA: Shed boilerplate out-links
        markdown_generator: {
          type: "DefaultMarkdownGenerator",
          params: {
            content_filter: {
              type: "PruningContentFilter",
              params: {
                threshold: 0.45,
                threshold_type: "dynamic",
                min_word_threshold: 10
              }
            },
            options: {
              body_width: 0, // Prevents wrapping table cells, preserving table layout in markdown
              ignore_links: false,
              ignore_images: false,
              content_source: "fit_html"
            }
          }
        },
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

function signCrawlPayload(
  crawlPayload: Record<string, unknown>,
  primarySecret: string,
  secondarySecret: string | undefined,
): string {
  const timestamp = Date.now().toString();

  // SECURITY: the HMAC must bind the EXACT transmitted body (not a constant string),
  // so the receiver — which verifies over `timestamp + "." + rawBody` — actually
  // authenticates the payload and rejects any tampering. We set only the timestamp
  // header, serialize the body, then sign `timestamp + "." + body` over that exact
  // string. The signature is sent as a separate transport header (NOT inside the
  // signed body) so the receiver verifies over the same bytes it received.
  (crawlPayload.webhook_config as Record<string, unknown>).webhook_headers = {
    "x-crawl-timestamp": timestamp,
  };
  const signedBody = JSON.stringify(crawlPayload);

  const secrets = [primarySecret, secondarySecret].filter(Boolean) as string[];
  // Emit one signature per secret, comma-separated, so the receiver can try each
  // candidate during key rotation. Each signature is a self-contained hex MAC.
  const signatures = secrets
    .map((s) =>
      createHmac("sha256", s)
        .update(timestamp + "." + signedBody)
        .digest("hex"),
    )
    .join(",");

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
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30_000); // 30s timeout

  try {
    const response = await fetch(`${crawlUrl}/crawl/job`, {
      method: "POST",
      headers,
      body,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Crawl4AI API error (${response.status}): ${errorText}`);
    }

    const data = (await response.json()) as { task_id?: string; job_id?: string };

    if (!data.task_id && !data.job_id) {
      throw new Error("Invalid response format from Crawl4AI - no job ID returned");
    }

    return data.task_id || data.job_id!;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error("Crawl4AI API request timed out after 30 seconds");
    }
    throw error;
  }
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
  returns: v.any(),
  handler: async (ctx, args) => {
    try {
      // Safe source extraction — handles both https:// and pdf:// virtual URLs
      let sourceHost: string;
      try {
        sourceHost = isPdfVirtualUrl(args.url) ? "pdf" : new URL(args.url).hostname;
      } catch {
        sourceHost = "unknown";
      }

      // Check for existing chunk to prevent orphaned vectors on retries
      const existing: any = await ctx.runQuery(internal.crawl.queries.getChunkByHash, {
        documentId: args.documentId,
        contentHash: args.contentHash,
      });
      if (existing) {
        return {
          success: true,
          ragId: existing.ragId,
          contentHash: args.contentHash,
          documentId: args.documentId,
          url: args.url,
          // Echo this chunk's own jobId so the onComplete handler routes DLQ
          // updates by the chunk's real job rather than a batch-level jobId
          // (DLQ retries batch entries from many jobs under one enqueue).
          jobId: args.jobId,
        };
      }

      // Contextual retrieval: embed the chunk WITH its section breadcrumb so the vector
      // captures context the raw chunk may lack (e.g. "It is Rs. 38,000" under
      // "Admissions > Fee Structure > BS"). Only the embedded/stored vector text is
      // contextualized; the raw chunkText is saved separately below for display + BM25.
      const contextPrefix =
        args.headingPath && args.headingPath.length > 0
          ? `Section: ${args.headingPath.join(" > ")}\n\n`
          : "";
      const result = await rag.add(ctx, {
        namespaceId: args.namespaceId as unknown as NamespaceId,
        text: contextPrefix + args.chunkText,
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
        jobId: args.jobId,
        parentText: args.parentText,
        headingPath: args.headingPath,
      });

      // Durably schedule contextualization instead of firing a non-awaited
      // ctx.runAction (a floating promise can be cut off when this action returns,
      // silently dropping the work). runAfter(0) commits the scheduled job so it
      // runs independently with its own error handling; the daily contextualizeCron
      // remains the backstop.
      await ctx.scheduler.runAfter(0, internal.embeddings.contextualize.contextualizeNewChunk, {
        documentId: args.documentId,
        contentHash: args.contentHash,
      });

      return {
        success: true,
        ragId: result.entryId,
        contentHash: args.contentHash,
        documentId: args.documentId,
        url: args.url,
        jobId: args.jobId,
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
          chunkText: args.chunkText,
          jobId: args.jobId,
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
