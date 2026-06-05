import { v } from "convex/values";
import { internal } from "../_generated/api";
import type { Doc } from "../_generated/dataModel";
import { internalMutation } from "../_generated/server";
import { rag } from "../rag/instance";
import { embeddingPool } from "./workpools";

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

export const resetPipelineBatch = internalMutation({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit }) => {
    const batchSize = limit ?? 200;
    let deleted = 0;

    const chunks = await ctx.db.query("crawledChunks").withIndex("by_documentId").take(batchSize);
    if (chunks.length > 0) {
      for (const chunk of chunks) {
        try {
          if (chunk.ragId) {
            await rag.delete(ctx, {
              entryId: chunk.ragId as unknown as import("@convex-dev/rag").EntryId,
            });
          }
        } catch {}
        await ctx.db.delete(chunk._id);
        deleted++;
      }
      return { deleted, remaining: "more" };
    }

    const docs = await ctx.db.query("documents").withIndex("by_crawledAt").take(batchSize);
    if (docs.length > 0) {
      for (const doc of docs) {
        await ctx.db.delete(doc._id);
        deleted++;
      }
      return { deleted, remaining: "more" };
    }

    const dlq = await ctx.db.query("crawlDeadLetter").withIndex("by_status").take(batchSize);
    if (dlq.length > 0) {
      for (const entry of dlq) {
        await ctx.db.delete(entry._id);
        deleted++;
      }
      return { deleted, remaining: "more" };
    }

    const webhooks = await ctx.db
      .query("processedWebhooks")
      .withIndex("by_expiresAt")
      .take(batchSize);
    if (webhooks.length > 0) {
      for (const webhook of webhooks) {
        await ctx.db.delete(webhook._id);
        deleted++;
      }
      return { deleted, remaining: "more" };
    }

    const jobs = await ctx.db.query("crawlJobs").withIndex("by_startedAt").take(batchSize);
    if (jobs.length > 0) {
      for (const job of jobs) {
        await ctx.db.delete(job._id);
        deleted++;
      }
      return { deleted, remaining: "more" };
    }

    const stats = await ctx.db.query("crawlStats").take(batchSize);
    if (stats.length > 0) {
      for (const stat of stats) {
        await ctx.db.delete(stat._id);
        deleted++;
      }
      return { deleted, remaining: "more" };
    }

    return { deleted, remaining: "done" };
  },
});

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

export const reembedPendingBatch = internalMutation({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit }) => {
    const batchSize = limit ?? 10;
    const pendingDocs = await ctx.db
      .query("documents")
      .withIndex("by_status", (q) => q.eq("status", "pending_embed"))
      .take(batchSize);

    let queued = 0;

    const { namespaceId } = await rag.getOrCreateNamespace(ctx, {
      namespace: "uet-global",
    });
    const namespaceIdStr = namespaceId as unknown as string;

    for (const doc of pendingDocs) {
      const existingChunks: Doc<"crawledChunks">[] = [];
      let paginationCursor: string | null = null;
      let paginationDone = false;
      while (!paginationDone) {
        const page = await ctx.db
          .query("crawledChunks")
          .withIndex("by_documentId", (q) => q.eq("documentId", doc._id))
          .paginate({ numItems: 500, cursor: paginationCursor });
        existingChunks.push(...page.page);
        paginationDone = page.isDone;
        paginationCursor = page.continueCursor;
      }

      if (existingChunks.length > 0) {
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
              namespaceId: namespaceIdStr,
            },
            {
              onComplete: internal.crawl.mutations.onChunkEmbedded,
              context: { jobId: "reembed-job" },
            },
          );
        }
        queued += existingChunks.length;
      } else if (doc.chunkCount && doc.chunkCount > 0) {
        await ctx.db.patch(doc._id, {
          status: "failed",
          error: "No chunk text available for re-embedding. Re-crawl required.",
        });
        continue;
      }

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
