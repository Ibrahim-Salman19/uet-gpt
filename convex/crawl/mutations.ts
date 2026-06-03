import { vOnCompleteArgs } from "@convex-dev/workpool";
import { v } from "convex/values";
import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import { internalMutation, internalQuery } from "../_generated/server";
import { rag } from "../rag/instance";
import { isPdfVirtualUrl } from "./chunking";
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
      expiresAt: args.expiresAt ?? Date.now() + 30 * 24 * 60 * 60 * 1000,
    });
  },
});

export const queueChunksForEmbedding = internalMutation({
  args: {
    url: v.string(),
    title: v.string(),
    contentHash: v.string(),
    freshnessTier: v.optional(v.union(v.literal("high"), v.literal("medium"), v.literal("low"))),
    jobId: v.string(),
    etag: v.optional(v.string()),
    lastModified: v.optional(v.string()),
    chunks: v.array(
      v.object({
        text: v.string(),
        contentHash: v.string(),
        parentText: v.optional(v.string()),
        headingPath: v.optional(v.array(v.string())),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const { url, title, contentHash, freshnessTier, etag, lastModified, chunks } = args;

    const existing = await ctx.db
      .query("documents")
      .withIndex("by_url", (q) => q.eq("url", url))
      .unique();

    if (existing && existing.contentHash === contentHash) {
      console.log(`Document unchanged (Fast Path): ${url}`);
      const patchMetadata: Record<string, string> = {};
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

    let docId: Id<"documents">;
    if (existing) {
      const patchMetadata: Record<string, string> = {};
      if (lastModified !== undefined) patchMetadata.lastModified = lastModified;
      if (etag !== undefined) patchMetadata.etag = etag;

      await ctx.db.patch(existing._id, {
        contentHash,
        crawledAt: Date.now(),
        updatedAt: Date.now(),
        status: "processing",
        chunksEmbedded: 0,
        ...(Object.keys(patchMetadata).length > 0 ? { metadata: patchMetadata } : {}),
      });
      docId = existing._id;
    } else {
      const docMetadata: Record<string, string> = {};
      if (lastModified !== undefined) docMetadata.lastModified = lastModified;
      if (etag !== undefined) docMetadata.etag = etag;

      let sourceHost: string;
      try {
        sourceHost = isPdfVirtualUrl(url) ? "pdf" : new URL(url).hostname;
      } catch {
        sourceHost = "unknown";
      }
      docId = await ctx.db.insert("documents", {
        url,
        title,
        source: sourceHost,
        category: "crawled",
        contentHash,
        freshnessTier,
        status: "processing",
        chunksEmbedded: 0,
        crawledAt: Date.now(),
        updatedAt: Date.now(),
        ...(Object.keys(docMetadata).length > 0 ? { metadata: docMetadata } : {}),
      });
    }

    const existingChunks: Doc<"crawledChunks">[] = [];
    if (existing) {
      let paginationCursor: string | null = null;
      let paginationDone = false;
      while (!paginationDone) {
        const page = await ctx.db
          .query("crawledChunks")
          .withIndex("by_documentId", (q) => q.eq("documentId", existing._id))
          .paginate({ numItems: 500, cursor: paginationCursor });
        existingChunks.push(...page.page);
        paginationDone = page.isDone;
        paginationCursor = page.continueCursor;
      }
    }

    const existingHashSet = new Set(existingChunks.map((c) => c.contentHash));
    const chunksToEmbed = chunks.filter((nc) => !existingHashSet.has(nc.contentHash));
    const chunksToDelete = existingChunks.filter(
      (ec) => !chunks.some((nc) => nc.contentHash === ec.contentHash),
    );

    for (const staleChunk of chunksToDelete) {
      try {
        await rag.delete(ctx, {
          entryId: staleChunk.ragId as unknown as import("@convex-dev/rag").EntryId,
        });
        await ctx.db.delete(staleChunk._id);
      } catch (err) {
        console.warn(`Failed to delete vector ${staleChunk.ragId} from RAG during re-embed:`, err);
      }
    }

    console.log(
      `Chunk Diff for ${url}: ${chunksToEmbed.length} new chunks, ${chunksToDelete.length} deleted chunks`,
    );

    if (chunksToEmbed.length > 0) {
      const { namespaceId } = await rag.getOrCreateNamespace(ctx, {
        namespace: "uet-global",
      });
      const namespaceIdStr = namespaceId as unknown as string;

      const argsArray = chunksToEmbed.map((chunk) => ({
        documentId: docId,
        url,
        chunkText: chunk.text,
        contentHash: chunk.contentHash,
        jobId: args.jobId,
        parentText: chunk.parentText,
        headingPath: chunk.headingPath,
        namespaceId: namespaceIdStr,
      }));

      await embeddingPool.enqueueActionBatch(
        ctx,
        internal.crawl.actions.embedSingleChunk,
        argsArray,
        {
          onComplete: internal.crawl.mutations.onChunkEmbedded,
          context: { jobId: args.jobId },
        },
      );
    }

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
    headingPath: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const existingChunk = await ctx.db
      .query("crawledChunks")
      .withIndex("by_documentId_and_contentHash", (q) =>
        q.eq("documentId", args.documentId).eq("contentHash", args.contentHash),
      )
      .first();
    if (existingChunk) {
      console.log(`Chunk ${args.contentHash} already indexed, skipping.`);
      return;
    }

    await ctx.db.insert("crawledChunks", {
      documentId: args.documentId,
      contentHash: args.contentHash,
      text: args.chunkText,
      ragId: args.ragId,
      embeddingModel: "gemini-embedding-2",
      parentText: args.parentText,
      headingPath: args.headingPath,
    });

    const doc = await ctx.db.get(args.documentId);
    if (doc) {
      const newCount = (doc.chunksEmbedded || 0) + 1;
      const updates: Partial<Doc<"documents">> = { chunksEmbedded: newCount };
      if (doc.chunkCount !== undefined && newCount >= doc.chunkCount) {
        if (doc.status !== "indexed") {
          updates.status = "indexed";
          updates.updatedAt = Date.now();
        }
      }
      await ctx.db.patch(args.documentId, updates);
    }
  },
});

export const onChunkEmbedded = internalMutation({
  args: vOnCompleteArgs(
    v.object({
      jobId: v.string(),
    }),
  ),
  handler: async (ctx, args) => {
    const { jobId } = args.context;
    const MAX_RETRIES = 5;

    const result = args.result;
    const returnValue = result.kind === "success" ? result.returnValue : null;
    const url = returnValue?.url as string | undefined;
    const contentHash = returnValue?.contentHash as string | undefined;
    const documentId = returnValue?.documentId as Id<"documents"> | undefined;

    if (result.kind === "success" && returnValue?.success && returnValue.ragId && url) {
      const dlqEntry = await ctx.db
        .query("crawlDeadLetter")
        .withIndex("by_jobId_and_url", (q) => q.eq("jobId", jobId).eq("url", url))
        .first();
      if (dlqEntry) {
        await ctx.db.delete(dlqEntry._id);
      }
    } else if (url && documentId) {
      let errorMsg = "Unknown embedding error";
      const isSkipped = result.kind === "success" && returnValue?.skipped;

      if (isSkipped) {
        errorMsg = "Skipped malformed content";
      } else if (result.kind === "failed") {
        errorMsg = result.error;
      } else if (result.kind === "canceled") {
        errorMsg = "Job canceled";
      }

      console.warn(`Embedding failed/skipped for chunk on URL ${url}: ${errorMsg}`);

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
            payload: { documentId, url, contentHash, jobId },
            status: "pending_retry",
          });
        }
      }

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

    const validDLQ = pendingDLQ.filter((dlq) => {
      if (!dlq.payload?.chunkText) {
        console.warn(`Skipping DLQ entry ${dlq._id} — no chunk text available for retry.`);
        ctx.db.patch(dlq._id, {
          status: "abandoned",
          failureReason:
            "No chunk text payload for retry (context was minimized to save bandwidth).",
          lastAttemptAt: Date.now(),
        });
        return false;
      }
      return true;
    });

    if (validDLQ.length > 0) {
      for (const dlq of validDLQ) {
        await ctx.db.patch(dlq._id, {
          status: "processing",
          lastAttemptAt: Date.now(),
        });
      }

      const { namespaceId } = await rag.getOrCreateNamespace(ctx, {
        namespace: "uet-global",
      });
      const namespaceIdStr = namespaceId as unknown as string;

      const argsArray = validDLQ.map((dlq) => ({
        documentId: dlq.payload.documentId,
        url: dlq.payload.url,
        chunkText: dlq.payload.chunkText,
        contentHash: dlq.payload.contentHash,
        jobId: dlq.payload.jobId,
        namespaceId: namespaceIdStr,
      }));

      await embeddingPool.enqueueActionBatch(
        ctx,
        internal.crawl.actions.embedSingleChunk,
        argsArray,
        {
          onComplete: internal.crawl.mutations.onChunkEmbedded,
          context: { jobId: validDLQ[0]!.payload.jobId },
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
    sourceType: v.string(),
    freshnessTier: v.optional(v.union(v.literal("high"), v.literal("medium"), v.literal("low"))),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("documents")
      .withIndex("by_url", (q) => q.eq("url", args.url))
      .first();

    if (existing) {
      if (existing.contentHash === args.contentHash) {
        await ctx.db.patch(existing._id, {
          crawlSessionId: args.crawlSessionId,
          status: "active",
          updatedAt: Date.now(),
          freshnessTier: args.freshnessTier,
          metadata: { ...existing.metadata, sourceType: args.sourceType },
        });
        return { action: "skipped", documentId: existing._id };
      }

      const oldChunks: Doc<"crawledChunks">[] = [];
      let paginationCursor: string | null = null;
      let paginationDone = false;
      while (!paginationDone) {
        const page = await ctx.db
          .query("crawledChunks")
          .withIndex("by_documentId", (q) => q.eq("documentId", existing._id))
          .paginate({ numItems: 500, cursor: paginationCursor });
        oldChunks.push(...page.page);
        paginationDone = page.isDone;
        paginationCursor = page.continueCursor;
      }
      for (const chunk of oldChunks) {
        try {
          await rag.delete(ctx, {
            entryId: chunk.ragId as unknown as import("@convex-dev/rag").EntryId,
          });
          await ctx.db.delete(chunk._id);
        } catch (err) {
          console.warn(
            `Failed to delete vector ${chunk.ragId} from RAG during content update:`,
            err,
          );
        }
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
      source: isPdfVirtualUrl(args.url) ? "pdf" : new URL(args.url).hostname,
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
      v.object({
        text: v.string(),
        contentHash: v.string(),
        parentText: v.optional(v.string()),
        headingPath: v.optional(v.array(v.string())),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const { documentId, url, chunks } = args;

    if (chunks.length > 0) {
      const { namespaceId } = await rag.getOrCreateNamespace(ctx, {
        namespace: "uet-global",
      });
      const namespaceIdStr = namespaceId as unknown as string;

      const argsArray = chunks.map((chunk) => ({
        documentId,
        url,
        chunkText: chunk.text,
        contentHash: chunk.contentHash,
        jobId: "ingest-job",
        parentText: chunk.parentText,
        headingPath: chunk.headingPath,
        namespaceId: namespaceIdStr,
      }));

      await embeddingPool.enqueueActionBatch(
        ctx,
        internal.crawl.actions.embedSingleChunk,
        argsArray,
        {
          onComplete: internal.crawl.mutations.onChunkEmbedded,
          context: { jobId: "ingest-job" },
        },
      );
    }

    await ctx.db.patch(documentId, {
      chunkCount: chunks.length,
      status: chunks.length === 0 ? "indexed" : "processing",
    });
  },
});
