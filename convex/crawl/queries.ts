import { v } from "convex/values";
import { internalQuery, query } from "../_generated/server";

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

    // Return with document URL and text
    const chunksWithDocs = [];
    for (const chunk of results) {
      const doc = await ctx.db.get(chunk.documentId);
      if (doc) {
        chunksWithDocs.push({
          ragId: chunk.ragId,
          text: chunk.text,
          url: doc.url,
          score: 1.0, // Base BM25 score, relative to rank
        });
      }
    }
    return chunksWithDocs;
  },
});

/**
 * getDocumentCountByStatus — returns count of documents for one specific status.
 * Call multiple times with different statuses to build a full picture.
 */
export const getDocumentCountByStatus = query({
  args: { status: v.string() },
  handler: async (ctx, { status }) => {
    const docs = await ctx.db
      .query("documents")
      .withIndex("by_status", (q) => q.eq("status", status as any))
      .take(9999); // bounded, won't OOM
    return { status, count: docs.length };
  },
});

/**
 * getRecentDocs — returns the N most recently crawled documents with metadata.
 * Use this to spot-check freshness and formatting quality.
 */
export const getRecentDocs = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit }) => {
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
    return await ctx.db.query("crawlDeadLetter").take(50);
  },
});

/**
 * searchByUrl — look up any document by exact URL for spot checking.
 */
export const searchByUrl = query({
  args: { url: v.string() },
  handler: async (ctx, { url }) => {
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
    const docs = await ctx.db
      .query("documents")
      .withIndex("by_category", (q) => q.eq("category", "crawled"))
      .filter((q) => q.eq(q.field("source"), source))
      .take(limit ?? 100);
    return docs.map((d) => ({ url: d.url, title: d.title, status: d.status }));
  },
});

/**
 * getChunksForDoc — returns chunks for a given document ID.
 */
export const getChunksForDoc = query({
  args: { documentId: v.id("documents") },
  handler: async (ctx, { documentId }) => {
    const chunks = await ctx.db
      .query("crawledChunks")
      .withIndex("by_documentId", (q) => q.eq("documentId", documentId))
      .take(20);
    return chunks.map((c) => ({
      text: c.text.slice(0, 500),
      contentHash: c.contentHash,
      ragId: c.ragId,
    }));
  },
});
