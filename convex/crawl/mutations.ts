import { v } from "convex/values";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { internalMutation, internalQuery } from "../_generated/server";
import { rag } from "../rag/instance";
import { embeddingPool } from "./workpools";

export const getProcessedWebhook = internalQuery({
  args: { jobId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("processedWebhooks")
      .withIndex("by_jobId", (q) => q.eq("jobId", args.jobId))
      .first();
  },
});

export const markWebhookProcessed = internalMutation({
  args: { jobId: v.string(), expiresAt: v.optional(v.number()) },
  handler: async (ctx, args) => {
    await ctx.db.insert("processedWebhooks", {
      jobId: args.jobId,
      processedAt: Date.now(),
      expiresAt: args.expiresAt ?? Date.now() + 7 * 24 * 60 * 60 * 1000,
    });
  },
});

export const queueChunksForEmbedding = internalMutation({
  args: {
    url: v.string(),
    title: v.string(),
    contentHash: v.string(),
    jobId: v.string(),
    etag: v.optional(v.string()),
    lastModified: v.optional(v.string()),
    chunks: v.array(
      v.object({ text: v.string(), contentHash: v.string(), parentText: v.optional(v.string()) }),
    ),
  },
  handler: async (ctx, args) => {
    const { url, title, contentHash, etag, lastModified, chunks } = args;

    // 1. Look up existing document
    const existing = await ctx.db
      .query("documents")
      .withIndex("by_url", (q) => q.eq("url", url))
      .unique();

    // Layer 1 & 2 Fast Path: Document unchanged
    if (existing && existing.contentHash === contentHash) {
      console.log(`Document unchanged (Fast Path): ${url}`);
      const patchMetadata: any = {};
      if (lastModified !== undefined) patchMetadata.lastModified = lastModified;
      if (etag !== undefined) patchMetadata.etag = etag;

      await ctx.db.patch(existing._id, {
        crawledAt: Date.now(),
        updatedAt: Date.now(),
        status: "indexed",
        ...(Object.keys(patchMetadata).length > 0 ? { metadata: patchMetadata } : {}),
      });
      return { status: "unchanged", chunksQueued: 0 };
    }

    // 2. Create/update document record
    let docId: Id<"documents">;
    if (existing) {
      const patchMetadata: any = {};
      if (lastModified !== undefined) patchMetadata.lastModified = lastModified;
      if (etag !== undefined) patchMetadata.etag = etag;

      await ctx.db.patch(existing._id, {
        contentHash,
        crawledAt: Date.now(),
        updatedAt: Date.now(),
        status: "processing",
        ...(Object.keys(patchMetadata).length > 0 ? { metadata: patchMetadata } : {}),
      });
      docId = existing._id;
    } else {
      const docMetadata: any = {};
      if (lastModified !== undefined) docMetadata.lastModified = lastModified;
      if (etag !== undefined) docMetadata.etag = etag;

      docId = await ctx.db.insert("documents", {
        url,
        title,
        source: new URL(url).hostname,
        category: "crawled",
        contentHash,
        status: "processing",
        crawledAt: Date.now(),
        updatedAt: Date.now(),
        ...(Object.keys(docMetadata).length > 0 ? { metadata: docMetadata } : {}),
      });
    }

    // 3. Diff at the chunk level
    const existingChunks = existing
      ? await ctx.db
          .query("crawledChunks")
          .withIndex("by_documentId", (q) => q.eq("documentId", existing._id))
          .collect()
      : [];

    const existingHashSet = new Set(existingChunks.map((c) => c.contentHash));
    const chunksToEmbed = chunks.filter((nc) => !existingHashSet.has(nc.contentHash));
    const chunksToDelete = existingChunks.filter(
      (ec) => !chunks.some((nc) => nc.contentHash === ec.contentHash),
    );

    // 4. Prune stale chunks
    for (const staleChunk of chunksToDelete) {
      try {
        await rag.delete(ctx, { entryId: staleChunk.ragId as any });
      } catch (err) {
        console.warn(`Failed to delete vector ${staleChunk.ragId} from RAG during re-embed:`, err);
      }
      await ctx.db.delete(staleChunk._id);
    }

    console.log(
      `Chunk Diff for ${url}: ${chunksToEmbed.length} new chunks, ${chunksToDelete.length} deleted chunks`,
    );

    // 5. Enqueue each new/changed chunk
    for (const chunk of chunksToEmbed) {
      await embeddingPool.enqueueAction(
        ctx,
        internal.crawl.actions.embedSingleChunk,
        {
          documentId: docId,
          url,
          chunkText: chunk.text,
          contentHash: chunk.contentHash,
          jobId: args.jobId,
          parentText: chunk.parentText,
        },
        {
          onComplete: internal.crawl.mutations.onChunkEmbedded,
          context: {
            documentId: docId,
            url,
            chunkText: chunk.text,
            contentHash: chunk.contentHash,
            jobId: args.jobId,
            parentText: chunk.parentText,
          },
        },
      );
    }

    // Update chunk count on document
    await ctx.db.patch(docId, {
      chunkCount: chunks.length,
      status: chunksToEmbed.length === 0 ? "indexed" : "processing",
    });

    return {
      status: "updated",
      chunksQueued: chunksToEmbed.length,
      chunksDeleted: chunksToDelete.length,
    };
  },
});

export const saveEmbedding = internalMutation({
  args: {
    documentId: v.id("documents"),
    chunkText: v.string(),
    contentHash: v.string(),
    ragId: v.string(),
    parentText: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // 0. Deduplicate: skip if chunk already indexed for this document
    const existingChunk = await ctx.db
      .query("crawledChunks")
      .withIndex("by_documentId", (q) => q.eq("documentId", args.documentId))
      .filter((q) => q.eq(q.field("contentHash"), args.contentHash))
      .first();
    if (existingChunk) {
      console.log(`Chunk ${args.contentHash} already indexed, skipping.`);
      return;
    }

    // 1. Insert chunk metadata record linking to vector index ID
    await ctx.db.insert("crawledChunks", {
      documentId: args.documentId,
      contentHash: args.contentHash,
      text: args.chunkText,
      ragId: args.ragId,
      embeddingModel: "gemini-embedding-2",
      parentText: args.parentText,
    });

    // 2. Check if all chunks for this document are fully indexed in the database
    const doc = await ctx.db.get(args.documentId);
    if (doc) {
      const chunksCount = await ctx.db
        .query("crawledChunks")
        .withIndex("by_documentId", (q) => q.eq("documentId", args.documentId))
        .collect();

      if (doc.chunkCount !== undefined && chunksCount.length >= doc.chunkCount) {
        if (doc.status !== "indexed") {
          await ctx.db.patch(args.documentId, {
            status: "indexed",
            updatedAt: Date.now(),
          });
        }
      }
    }
  },
});

export const onChunkEmbedded = internalMutation({
  args: {
    workId: v.string(), // Satisfy Workpool signature
    result: v.any(), // Flexible to handle success/failed/canceled kinds
    error: v.optional(v.string()),
    context: v.object({
      documentId: v.id("documents"),
      url: v.string(),
      chunkText: v.string(),
      contentHash: v.string(),
      jobId: v.string(),
      parentText: v.optional(v.string()),
    }),
  },
  handler: async (ctx, args) => {
    const { documentId, url, chunkText, contentHash, jobId, parentText } = args.context;
    const MAX_RETRIES = 5;

    const result = args.result;
    if (
      result &&
      result.kind === "success" &&
      result.returnValue?.success &&
      result.returnValue.ragId
    ) {
      // 0. Deduplicate: skip if chunk already indexed for this document
      const existingChunk = await ctx.db
        .query("crawledChunks")
        .withIndex("by_documentId", (q) => q.eq("documentId", documentId))
        .filter((q) => q.eq(q.field("contentHash"), contentHash))
        .first();
      if (!existingChunk) {
        // 1. Save successfully embedded chunk to the database
        await ctx.db.insert("crawledChunks", {
          documentId,
          contentHash,
          text: chunkText,
          ragId: result.returnValue.ragId,
          embeddingModel: "gemini-embedding-2",
          parentText,
        });
      }

      // 2. Resolve/Clean up DLQ entry since chunk was successfully processed
      const dlqEntry = await ctx.db
        .query("crawlDeadLetter")
        .withIndex("by_jobId_and_url", (q) => q.eq("jobId", jobId).eq("url", url))
        .first();
      if (dlqEntry) {
        await ctx.db.delete(dlqEntry._id);
      }

      // 3. Check if all chunks for this document are fully indexed in the database
      const doc = await ctx.db.get(documentId);
      if (doc) {
        const chunksCount = await ctx.db
          .query("crawledChunks")
          .withIndex("by_documentId", (q) => q.eq("documentId", documentId))
          .collect();

        if (doc.chunkCount !== undefined && chunksCount.length >= doc.chunkCount) {
          if (doc.status !== "indexed") {
            await ctx.db.patch(documentId, {
              status: "indexed",
              updatedAt: Date.now(),
            });
          }
        }
      }
    } else {
      // Embedding failed, was skipped, or canceled
      let errorMsg = args.error || "Unknown embedding error";
      const isSkipped = result && result.kind === "success" && result.returnValue?.skipped;

      if (isSkipped) {
        errorMsg = "Skipped malformed content";
      } else if (result && result.kind === "failed") {
        errorMsg = result.error;
      } else if (result && result.kind === "canceled") {
        errorMsg = "Job canceled";
      }

      console.warn(`Embedding failed/skipped for chunk on URL ${url}: ${errorMsg}`);

      // Handle DLQ update / retry count tracking
      if (!isSkipped) {
        const dlqEntry = await ctx.db
          .query("crawlDeadLetter")
          .withIndex("by_jobId_and_url", (q) => q.eq("jobId", jobId).eq("url", url))
          .first();

        if (dlqEntry) {
          const newFailureCount = (dlqEntry.failureCount ?? 0) + 1;
          const newStatus = newFailureCount >= MAX_RETRIES ? "abandoned" : "pending_retry";
          await ctx.db.patch(dlqEntry._id, {
            status: newStatus,
            failureCount: newFailureCount,
            lastAttemptAt: Date.now(),
            failureReason: errorMsg,
          });
        } else {
          await ctx.db.insert("crawlDeadLetter", {
            url,
            jobId,
            failureReason: errorMsg,
            failureCount: 1,
            lastAttemptAt: Date.now(),
            payload: args.context,
            status: "pending_retry",
          });
        }
      }

      // Update document state to failed
      const doc = await ctx.db.get(documentId);
      if (doc && doc.status !== "failed") {
        await ctx.db.patch(documentId, {
          status: "failed",
          error: errorMsg,
          updatedAt: Date.now(),
        });
      }
    }
  },
});

export const retryDeadLetterQueue = internalMutation({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit }) => {
    const batchSize = limit ?? 20;
    const pendingDLQ = await ctx.db
      .query("crawlDeadLetter")
      .withIndex("by_status", (q) => q.eq("status", "pending_retry"))
      .take(batchSize);

    console.log(`Reprocessing ${pendingDLQ.length} Dead Letter Queue entries...`);

    for (const dlq of pendingDLQ) {
      const payload = dlq.payload;

      // Mark the entry as active "processing" during re-enqueue
      await ctx.db.patch(dlq._id, {
        status: "processing",
        lastAttemptAt: Date.now(),
      });

      // Attempt to re-enqueue chunk into workpool
      await embeddingPool.enqueueAction(
        ctx,
        internal.crawl.actions.embedSingleChunk,
        {
          documentId: payload.documentId,
          url: payload.url,
          chunkText: payload.chunkText,
          contentHash: payload.contentHash,
          jobId: payload.jobId,
        },
        {
          onComplete: internal.crawl.mutations.onChunkEmbedded,
          context: payload,
        },
      );
    }

    return {
      reprocessed: pendingDLQ.length,
      remaining: pendingDLQ.length === batchSize ? "more" : "done",
    };
  },
});

export const upsertDocument = internalMutation({
  args: {
    url: v.string(),
    markdown: v.string(),
    contentHash: v.string(),
    crawlSessionId: v.string(),
    title: v.optional(v.string()),
    sourceType: v.string(), // "pdf" or "html"
    freshnessTier: v.optional(v.union(v.literal("high"), v.literal("medium"), v.literal("low"))),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("documents")
      .withIndex("by_url", (q) => q.eq("url", args.url))
      .first();

    if (existing) {
      if (existing.contentHash === args.contentHash) {
        // Content unchanged - just mark it as seen this session
        await ctx.db.patch(existing._id, {
          crawlSessionId: args.crawlSessionId,
          status: "active",
          updatedAt: Date.now(),
          freshnessTier: args.freshnessTier,
          metadata: { ...existing.metadata, sourceType: args.sourceType },
        });
        return { action: "skipped", documentId: existing._id };
      }

      // Content changed - delete old chunks and vectors, then re-queue
      const oldChunks = await ctx.db
        .query("crawledChunks")
        .withIndex("by_documentId", (q) => q.eq("documentId", existing._id))
        .collect();
      for (const chunk of oldChunks) {
        try {
          await rag.delete(ctx, { entryId: chunk.ragId as any });
        } catch (err) {
          console.warn(
            `Failed to delete vector ${chunk.ragId} from RAG during content update:`,
            err,
          );
        }
        await ctx.db.delete(chunk._id);
      }

      await ctx.db.patch(existing._id, {
        contentHash: args.contentHash,
        crawlSessionId: args.crawlSessionId,
        title: args.title,
        status: "pending_embed",
        updatedAt: Date.now(),
        freshnessTier: args.freshnessTier,
        metadata: { ...existing.metadata, sourceType: args.sourceType },
      });
      return { action: "updated", documentId: existing._id };
    }

    const id = await ctx.db.insert("documents", {
      url: args.url,
      source: new URL(args.url).hostname,
      category: "crawled",
      contentHash: args.contentHash,
      crawlSessionId: args.crawlSessionId,
      title: args.title ?? args.url,
      status: "pending_embed",
      crawledAt: Date.now(),
      updatedAt: Date.now(),
      freshnessTier: args.freshnessTier,
      metadata: { sourceType: args.sourceType },
    });
    return { action: "inserted", documentId: id };
  },
});

export const enqueueDocumentChunks = internalMutation({
  args: {
    documentId: v.id("documents"),
    url: v.string(),
    chunks: v.array(
      v.object({ text: v.string(), contentHash: v.string(), parentText: v.optional(v.string()) }),
    ),
  },
  handler: async (ctx, args) => {
    const { documentId, url, chunks } = args;

    // Enqueue each chunk in the workpool
    for (const chunk of chunks) {
      await embeddingPool.enqueueAction(
        ctx,
        internal.crawl.actions.embedSingleChunk,
        {
          documentId: documentId,
          url: url,
          chunkText: chunk.text,
          contentHash: chunk.contentHash,
          jobId: "ingest-job",
          parentText: chunk.parentText,
        },
        {
          onComplete: internal.crawl.mutations.onChunkEmbedded,
          context: {
            documentId: documentId,
            url: url,
            chunkText: chunk.text,
            contentHash: chunk.contentHash,
            jobId: "ingest-job",
            parentText: chunk.parentText,
          },
        },
      );
    }

    // Set chunk count on document
    await ctx.db.patch(documentId, {
      chunkCount: chunks.length,
      status: chunks.length === 0 ? "indexed" : "processing",
    });
  },
});

export const deduplicateDocuments = internalMutation({
  args: {},
  handler: async (ctx) => {
    // Process in pages of 200 to stay well under the 16MB read limit
    const seenUrls = new Map<string, string>(); // url -> keep _id
    let deleted = 0;
    let cursor = null as string | null;

    while (true) {
      const page = await ctx.db.query("documents").paginate({
        numItems: 200,
        cursor,
      });

      for (const doc of page.page) {
        const existing = seenUrls.get(doc.url);
        if (!existing) {
          seenUrls.set(doc.url, doc._id);
        } else {
          // Duplicate found - delete this one (keep the first seen which is older)
          const chunks = await ctx.db
            .query("crawledChunks")
            .withIndex("by_documentId", (q) => q.eq("documentId", doc._id))
            .collect();
          for (const chunk of chunks) {
            try {
              await rag.delete(ctx, { entryId: chunk.ragId as any });
            } catch (err) {
              console.warn(`Failed to delete vector ${chunk.ragId} from RAG during dedup:`, err);
            }
            await ctx.db.delete(chunk._id);
          }
          await ctx.db.delete(doc._id);
          deleted++;
        }
      }

      if (page.isDone) break;
      cursor = page.continueCursor;
    }

    return { deleted };
  },
});

/**
 * markStaleDocuments — batched, 16MB-safe.
 * Marks up to `limit` active documents whose session doesn't match the current crawl as stale.
 * Call in a loop until { remaining: 'done' } is returned.
 */
export const markStaleDocuments = internalMutation({
  args: { crawlSessionId: v.string(), limit: v.optional(v.number()) },
  handler: async (ctx, { crawlSessionId, limit }) => {
    const batchSize = limit ?? 500;
    const active = await ctx.db
      .query("documents")
      .withIndex("by_status", (q) => q.eq("status", "active"))
      .take(batchSize);

    let marked = 0;
    for (const doc of active) {
      if (doc.crawlSessionId !== crawlSessionId) {
        await ctx.db.patch(doc._id, { status: "stale" });
        marked++;
      }
    }
    return { marked, remaining: active.length === batchSize ? "more" : "done" };
  },
});

/**
 * purgeStaleDocuments — batched, 16MB-safe.
 * Deletes up to `limit` stale documents with their chunks and vector entries.
 * Call in a loop until { remaining: 'done' } is returned.
 */
export const purgeStaleDocuments = internalMutation({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit }) => {
    const batchSize = limit ?? 100; // smaller batch — each doc may have many chunks
    const stale = await ctx.db
      .query("documents")
      .withIndex("by_status", (q) => q.eq("status", "stale"))
      .take(batchSize);

    let purged = 0;
    for (const doc of stale) {
      const chunks = await ctx.db
        .query("crawledChunks")
        .withIndex("by_documentId", (q) => q.eq("documentId", doc._id))
        .collect();
      for (const chunk of chunks) {
        try {
          await rag.delete(ctx, { entryId: chunk.ragId as any });
        } catch (err) {
          console.warn(`Failed to delete vector ${chunk.ragId} from RAG during purge:`, err);
        }
        await ctx.db.delete(chunk._id);
      }
      await ctx.db.delete(doc._id);
      purged++;
    }
    return { purged, remaining: stale.length === batchSize ? "more" : "done" };
  },
});

export const resetAbandonedDLQ = internalMutation({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit }) => {
    const batchSize = limit ?? 200;
    const abandoned = await ctx.db
      .query("crawlDeadLetter")
      .withIndex("by_status", (q) => q.eq("status", "abandoned"))
      .take(batchSize);

    let resetCount = 0;
    for (const dlq of abandoned) {
      await ctx.db.patch(dlq._id, { status: "pending_retry" });
      resetCount++;
    }
    return { resetCount, remaining: abandoned.length === batchSize ? "more" : "done" };
  },
});

/**
 * resetFailedDocuments - resets up to `limit` failed documents back to pending_embed
 * so they get re-queued for embedding on the next retry cycle.
 * Call repeatedly until it returns { remaining: 'done' }.
 */
export const resetFailedDocuments = internalMutation({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit }) => {
    const batchSize = limit ?? 200;
    const failedDocs = await ctx.db
      .query("documents")
      .withIndex("by_status", (q) => q.eq("status", "failed"))
      .take(batchSize);

    let reset = 0;
    for (const doc of failedDocs) {
      await ctx.db.patch(doc._id, {
        status: "pending_embed",
        updatedAt: Date.now(),
      });
      reset++;
    }
    return { reset, remaining: failedDocs.length === batchSize ? "more" : "done" };
  },
});

/**
 * reembedPendingBatch - re-enqueues chunks for up to `limit` pending_embed documents.
 * For each document, reads existing chunks from crawledChunks table and re-queues them.
 * Call repeatedly until it returns { remaining: 'done' }.
 */
export const reembedPendingBatch = internalMutation({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit }) => {
    const batchSize = limit ?? 10;
    const pendingDocs = await ctx.db
      .query("documents")
      .withIndex("by_status", (q) => q.eq("status", "pending_embed"))
      .take(batchSize);

    let queued = 0;
    for (const doc of pendingDocs) {
      // Get existing stored chunks for this document
      const existingChunks = await ctx.db
        .query("crawledChunks")
        .withIndex("by_documentId", (q) => q.eq("documentId", doc._id))
        .collect();

      if (existingChunks.length > 0) {
        // Re-enqueue existing chunks for re-embedding
        for (const chunk of existingChunks) {
          await embeddingPool.enqueueAction(
            ctx,
            internal.crawl.actions.embedSingleChunk,
            {
              documentId: doc._id,
              url: doc.url,
              chunkText: chunk.text,
              contentHash: chunk.contentHash,
              jobId: "reembed-job",
            },
            {
              onComplete: internal.crawl.mutations.onChunkEmbedded,
              context: {
                documentId: doc._id,
                url: doc.url,
                chunkText: chunk.text,
                contentHash: chunk.contentHash,
                jobId: "reembed-job",
              },
            },
          );
        }
        queued += existingChunks.length;
      } else if (doc.chunkCount && doc.chunkCount > 0) {
        // No stored chunks but doc says it has chunks - the markdown needs re-ingestion
        // Mark as failed so it gets picked up by next crawl run
        await ctx.db.patch(doc._id, {
          status: "failed",
          error: "No chunk text available for re-embedding. Re-crawl required.",
        });
        continue;
      }

      // Update document status to processing
      await ctx.db.patch(doc._id, {
        status: "processing",
        chunkCount: existingChunks.length,
        updatedAt: Date.now(),
      });
    }

    return {
      processed: pendingDocs.length,
      chunksQueued: queued,
      remaining: pendingDocs.length === batchSize ? "more" : "done",
    };
  },
});

export const flagExpiredDocuments = internalMutation({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit }) => {
    const batchSize = limit ?? 200;
    const now = Date.now();
    const DAY_MS = 24 * 60 * 60 * 1000;

    const TTLS = {
      high: 30 * DAY_MS,
      medium: 90 * DAY_MS,
      low: 180 * DAY_MS,
    };

    // Check both "indexed" (from Crawl4AI pipeline) and "active" (from /ingest pipeline)
    const indexedDocs = await ctx.db
      .query("documents")
      .withIndex("by_status", (q) => q.eq("status", "indexed"))
      .take(batchSize);

    const activeDocs = await ctx.db
      .query("documents")
      .withIndex("by_status", (q) => q.eq("status", "active"))
      .take(batchSize);

    const candidates = [...indexedDocs, ...activeDocs];

    let flagged = 0;
    for (const doc of candidates) {
      if (doc.isStale) continue;

      const tier = doc.freshnessTier || "low";
      const ttl = TTLS[tier as keyof typeof TTLS] || TTLS.low;

      if (now - doc.crawledAt > ttl) {
        await ctx.db.patch(doc._id, { isStale: true });
        flagged++;
      }
    }

    return { flagged, remaining: candidates.length === batchSize ? "more" : "done" };
  },
});
