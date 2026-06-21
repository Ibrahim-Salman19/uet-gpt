import { v } from "convex/values";
import { internalQuery, query } from "../_generated/server";
import { requireAdmin } from "../auth";

/**
 * fullTextSearch — internal query for BM25 exact match on chunks.
 */
export const fullTextSearch = internalQuery({
  args: { query: v.string(), limit: v.number() },
  handler: async (ctx, args) => {
    const results = await ctx.db
      .query("crawledChunks")
      .withSearchIndex("search_text", (q) => q.search("text", args.query))
      .take(args.limit);

    const docIds = [...new Set(results.map((c) => c.documentId))];
    const docs = await Promise.all(docIds.map((id) => ctx.db.get(id)));
    const docMap = new Map(
      docs.filter((d): d is NonNullable<typeof d> => d !== null).map((d) => [d._id, d]),
    );

    const chunksWithDocs = results
      .map((chunk) => {
        const doc = docMap.get(chunk.documentId);
        if (!doc) return null;
        return {
          ragId: chunk.ragId,
          text: chunk.text,
          url: doc.url,
          score: 1.0,
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);
    return chunksWithDocs;
  },
});

export const getChunkByHash = internalQuery({
  args: { documentId: v.id("documents"), contentHash: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("crawledChunks")
      .withIndex("by_documentId_and_contentHash", (q) =>
        q.eq("documentId", args.documentId).eq("contentHash", args.contentHash),
      )
      .first();
  },
});

/**
 * getDocumentCountByStatus — returns count of documents for one specific status.
 * Call multiple times with different statuses to build a full picture.
 */
export const getDocumentCountByStatus = query({
  args: { status: v.string() },
  handler: async (ctx, { status }) => {
    await requireAdmin(ctx);
    let count = 0;
    let cursor: string | null = null;
    let done = false;
    while (!done) {
      const page = await ctx.db
        .query("documents")
        .withIndex("by_status", (q) =>
          q.eq(
            "status",
            status as
              | "pending"
              | "processing"
              | "indexed"
              | "failed"
              | "stale"
              | "active"
              | "pending_embed",
          ),
        )
        .paginate({ numItems: 100, cursor });
      count += page.page.length;
      done = page.isDone;
      cursor = page.continueCursor;
    }
    return { status, count };
  },
});

/**
 * getRecentDocs — returns the N most recently crawled documents with metadata.
 * Use this to spot-check freshness and formatting quality.
 */
export const getRecentDocs = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit }) => {
    await requireAdmin(ctx);
    const docs = await ctx.db
      .query("documents")
      .withIndex("by_crawledAt")
      .order("desc")
      .take(limit ?? 20);
    return docs.map((d) => ({
      url: d.url,
      title: d.title,
      status: d.status,
      chunkCount: d.chunkCount ?? 0,
      source: d.source,
      crawledAt: new Date(d.crawledAt).toISOString(),
    }));
  },
});

/**
 * getDLQSample — returns dead-letter items for review/retry.
 */
export const getDLQSample = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    return await ctx.db
      .query("crawlDeadLetter")
      .withIndex("by_status", (q) => q.eq("status", "pending_retry"))
      .take(50);
  },
});

/**
 * searchByUrl — look up any document by exact URL for spot checking.
 */
export const searchByUrl = query({
  args: { url: v.string() },
  handler: async (ctx, { url }) => {
    await requireAdmin(ctx);
    const doc = await ctx.db
      .query("documents")
      .withIndex("by_url", (q) => q.eq("url", url))
      .first();
    if (!doc) return null;

    const chunks = await ctx.db
      .query("crawledChunks")
      .withIndex("by_documentId", (q) => q.eq("documentId", doc._id))
      .take(5);

    return {
      document: {
        url: doc.url,
        title: doc.title,
        status: doc.status,
        contentHash: doc.contentHash,
        chunkCount: doc.chunkCount,
        source: doc.source,
        crawledAt: new Date(doc.crawledAt).toISOString(),
      },
      chunkSample: chunks.map((c) => ({
        text: c.text.slice(0, 300) + (c.text.length > 300 ? "..." : ""),
        ragId: c.ragId,
        headingPath: c.headingPath,
      })),
    };
  },
});

/**
 * getFailedDocs — lists documents stuck in failed status.
 */
export const getFailedDocs = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    return await ctx.db
      .query("documents")
      .withIndex("by_status", (q) => q.eq("status", "failed"))
      .take(50)
      .then((docs) => docs.map((d) => ({ url: d.url, title: d.title, error: d.error })));
  },
});

/**
 * getPendingEmbedDocs — lists documents waiting to be embedded.
 */
export const getPendingEmbedDocs = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    return await ctx.db
      .query("documents")
      .withIndex("by_status", (q) => q.eq("status", "pending_embed"))
      .take(50)
      .then((docs) => docs.map((d) => ({ url: d.url, status: d.status })));
  },
});

/**
 * getDocsBySource — returns documents from a specific domain, bounded.
 */
export const getDocsBySource = query({
  args: { source: v.string(), limit: v.optional(v.number()) },
  handler: async (ctx, { source, limit }) => {
    await requireAdmin(ctx);
    const docs = await ctx.db
      .query("documents")
      .withIndex("by_source_category", (q) => q.eq("source", source).eq("category", "crawled"))
      .take(limit ?? 100);
    return docs.map((d) => ({ url: d.url, title: d.title, status: d.status }));
  },
});

/**
 * getJobById — returns a crawl job by its internal ID (for crash recovery / resume).
 */
export const getJobById = internalQuery({
  args: { jobId: v.id("crawlJobs") },
  handler: async (ctx, { jobId }) => {
    return await ctx.db.get(jobId);
  },
});

/**
 * getChunksForDoc — returns chunks for a given document ID.
 */
export const getChunksForDoc = query({
  args: { documentId: v.id("documents") },
  handler: async (ctx, { documentId }) => {
    await requireAdmin(ctx);
    const chunks = await ctx.db
      .query("crawledChunks")
      .withIndex("by_documentId", (q) => q.eq("documentId", documentId))
      .take(20);
    return chunks.map((c) => ({
      text: c.text.slice(0, 500),
      contentHash: c.contentHash,
      ragId: c.ragId,
      headingPath: c.headingPath,
    }));
  },
});

export const getChunksWithHeadings = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const chunks = await ctx.db.query("crawledChunks").take(20);
    return chunks
      .filter((c) => c.headingPath && c.headingPath.length > 0)
      .slice(0, 10)
      .map((c) => ({
        ragId: c.ragId,
        headingPath: c.headingPath,
        text: c.text.slice(0, 200),
      }));
  },
});
