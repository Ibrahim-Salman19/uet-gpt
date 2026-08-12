import { v } from "convex/values";
import { internal } from "../_generated/api";
import type { Doc } from "../_generated/dataModel";
import { internalMutation } from "../_generated/server";
import { rag } from "../rag/instance";
import { embeddingPool } from "./workpools";

async function deleteChunksBatch(
  ctx: any,
  batchSize: number,
): Promise<{ deleted: number; remaining: string } | null> {
  const chunks = await ctx.db.query("crawledChunks").take(batchSize);
  if (chunks.length === 0) return null;
  await Promise.all(
    chunks.map(async (chunk: any) => {
      try {
        if (chunk.ragId) {
          await rag.delete(ctx, {
            entryId: chunk.ragId as unknown as import("@convex-dev/rag").EntryId,
          });
        }
      } catch {}
      await ctx.db.delete(chunk._id);
    }),
  );
  return { deleted: chunks.length, remaining: "more" };
}

async function deleteTableBatch(
  ctx: any,
  table: string,
  batchSize: number,
): Promise<{ deleted: number; remaining: string } | null> {
  const items = await ctx.db.query(table as any).take(batchSize);
  if (items.length === 0) return null;
  await Promise.all(items.map((item: any) => ctx.db.delete(item._id)));
  return { deleted: items.length, remaining: "more" };
}

export const resetAbandonedDLQ = internalMutation({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit }) => {
    const batchSize = limit ?? 200;
    const abandoned = await ctx.db
      .query("crawlDeadLetter")
      .withIndex("by_status", (q) => q.eq("status", "abandoned"))
      .take(batchSize);

    await Promise.all(abandoned.map((dlq) => ctx.db.patch(dlq._id, { status: "pending_retry" })));
    return {
      resetCount: abandoned.length,
      remaining: abandoned.length === batchSize ? "more" : "done",
    };
  },
});

export const resetPipelineBatch = internalMutation({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit }) => {
    const batchSize = limit ?? 200;

    const result =
      (await deleteChunksBatch(ctx, batchSize)) ??
      (await deleteTableBatch(ctx, "documents", batchSize)) ??
      (await deleteTableBatch(ctx, "crawlDeadLetter", batchSize)) ??
      (await deleteTableBatch(ctx, "processedWebhooks", batchSize)) ??
      (await deleteTableBatch(ctx, "crawlJobs", batchSize)) ??
      (await deleteTableBatch(ctx, "crawlStats", batchSize));

    return result ?? { deleted: 0, remaining: "done" };
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

    await Promise.all(
      failedDocs.map((doc) =>
        ctx.db.patch(doc._id, {
          status: "pending_embed",
          updatedAt: Date.now(),
        }),
      ),
    );
    return {
      reset: failedDocs.length,
      remaining: failedDocs.length === batchSize ? "more" : "done",
    };
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

      // Phase 6.21A Part 2: only chunks that already carry a chunkKey can be
      // routed through the structural-identity contract embedSingleChunk/
      // saveEmbedding now require. A legacy row without one predates this
      // field and is skipped (same disposition as a legacy DLQ row in
      // retryDeadLetterQueue) rather than forced through with an invented key.
      const reembeddable = existingChunks.filter((c) => c.chunkKey !== undefined);
      const skippedLegacy = existingChunks.length - reembeddable.length;
      if (skippedLegacy > 0) {
        console.warn(
          `reembedPendingBatch: skipping ${skippedLegacy} legacy chunk(s) with no chunkKey ` +
            `for document ${doc._id} - re-crawl required to migrate them.`,
        );
      }

      if (reembeddable.length > 0) {
        // Phase 6.21A Part 4/5: new ingestion round for this recovery pass.
        const newGeneration = (doc.ingestionGeneration ?? 0) + 1;
        const argsArray = reembeddable.map((chunk) => ({
          documentId: doc._id,
          url: doc.url,
          chunkText: chunk.text,
          contentHash: chunk.contentHash,
          chunkKey: chunk.chunkKey!,
          ingestionGeneration: newGeneration,
          jobId: "reembed-job",
          parentId: chunk.parentId,
          headingPath: chunk.headingPath,
          namespaceId: namespaceIdStr,
        }));

        await embeddingPool.enqueueActionBatch(
          ctx,
          internal.crawl.actions.embedSingleChunk,
          argsArray,
          {
            onComplete: internal.crawl.mutations.onChunkEmbedded,
            context: { jobId: "reembed-job", ingestionGeneration: newGeneration },
          },
        );
        queued += reembeddable.length;

        await ctx.db.patch(doc._id, {
          status: "processing",
          // chunkCount must match what's actually being tracked toward
          // completion (reembeddable.length) - skipped legacy chunks will
          // never increment chunksEmbedded, so counting them here would
          // make the completion contract unsatisfiable.
          chunkCount: reembeddable.length,
          chunksEmbedded: 0,
          ingestionGeneration: newGeneration,
          updatedAt: Date.now(),
        });
      } else if (doc.chunkCount && doc.chunkCount > 0) {
        await ctx.db.patch(doc._id, {
          status: "failed",
          error: "No chunk text available for re-embedding. Re-crawl required.",
        });
      } else {
        await ctx.db.patch(doc._id, {
          status: "processing",
          chunkCount: 0,
          updatedAt: Date.now(),
        });
      }
    }

    return {
      processed: pendingDocs.length,
      chunksQueued: queued,
      remaining: pendingDocs.length === batchSize ? "more" : "done",
    };
  },
});
