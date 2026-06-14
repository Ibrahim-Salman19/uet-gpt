import { vOnCompleteArgs } from "@convex-dev/workpool";
import { v } from "convex/values";
import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { internalMutation, internalQuery } from "../_generated/server";
import { rag } from "../rag/instance";
import { isPdfVirtualUrl } from "./chunking";
import { embeddingPool } from "./workpools";

async function getAllChunksByDocumentId(
  ctx: MutationCtx,
  documentId: Id<"documents">,
): Promise<Doc<"crawledChunks">[]> {
  const chunks: Doc<"crawledChunks">[] = [];
  let cursor: string | null = null;
  let done = false;
  while (!done) {
    const page = await ctx.db
      .query("crawledChunks")
      .withIndex("by_documentId", (q) => q.eq("documentId", documentId))
      .paginate({ numItems: 500, cursor });
    chunks.push(...page.page);
    done = page.isDone;
    cursor = page.continueCursor;
  }
  return chunks;
}

function buildMetadataPatch(
  lastModified?: string,
  etag?: string,
): Record<string, string> | undefined {
  const meta: Record<string, string> = {};
  if (lastModified !== undefined) meta.lastModified = lastModified;
  if (etag !== undefined) meta.etag = etag;
  return Object.keys(meta).length > 0 ? meta : undefined;
}

type ChunkInput = {
  text: string;
  contentHash: string;
  parentText?: string;
  headingPath?: string[];
};

async function diffAndDeleteStaleChunks(
  ctx: MutationCtx,
  existingChunks: Doc<"crawledChunks">[],
  chunks: ChunkInput[],
  url: string,
): Promise<{ chunksToEmbed: ChunkInput[]; chunksToDelete: Doc<"crawledChunks">[] }> {
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

  return { chunksToEmbed, chunksToDelete };
}

async function enqueueNewChunks(
  ctx: MutationCtx,
  docId: Id<"documents">,
  url: string,
  chunksToEmbed: ChunkInput[],
  jobId: string,
): Promise<void> {
  if (chunksToEmbed.length === 0) return;

  const { namespaceId } = await rag.getOrCreateNamespace(ctx, {
    namespace: "uet-global",
  });
  const namespaceIdStr = namespaceId as unknown as string;

  const argsArray = chunksToEmbed.map((chunk) => ({
    documentId: docId,
    url,
    chunkText: chunk.text,
    contentHash: chunk.contentHash,
    jobId,
    parentText: chunk.parentText,
    headingPath: chunk.headingPath,
    namespaceId: namespaceIdStr,
  }));

  await embeddingPool.enqueueActionBatch(ctx, internal.crawl.actions.embedSingleChunk, argsArray, {
    onComplete: internal.crawl.mutations.onChunkEmbedded,
    context: { jobId },
  });
}

async function upsertDocumentForCrawl(
  ctx: MutationCtx,
  url: string,
  title: string,
  contentHash: string,
  freshnessTier: "high" | "medium" | "low" | undefined,
  lastModified: string | undefined,
  etag: string | undefined,
  existing: Doc<"documents"> | null,
): Promise<Id<"documents">> {
  if (existing) {
    const metadata = buildMetadataPatch(lastModified, etag);
    await ctx.db.patch(existing._id, {
      contentHash,
      crawledAt: Date.now(),
      updatedAt: Date.now(),
      status: "processing",
      chunksEmbedded: 0,
      ...(metadata ? { metadata } : {}),
    });
    return existing._id;
  }

  let sourceHost: string;
  try {
    sourceHost = isPdfVirtualUrl(url) ? "pdf" : new URL(url).hostname;
  } catch {
    sourceHost = "unknown";
  }
  const metadata = buildMetadataPatch(lastModified, etag);
  return await ctx.db.insert("documents", {
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
    ...(metadata ? { metadata } : {}),
  });
}

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
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("processedWebhooks")
      .withIndex("by_jobId", (q) => q.eq("jobId", args.jobId))
      .first();
    if (existing) return false;

    await ctx.db.insert("processedWebhooks", {
      jobId: args.jobId,
      processedAt: Date.now(),
      expiresAt: args.expiresAt ?? Date.now() + 30 * 24 * 60 * 60 * 1000,
    });
    return true;
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
      const metadata = buildMetadataPatch(lastModified, etag);
      await ctx.db.patch(existing._id, {
        crawledAt: Date.now(),
        updatedAt: Date.now(),
        status: "indexed",
        ...(metadata ? { metadata } : {}),
      });
      return { status: "unchanged", chunksQueued: 0 };
    }

    const docId = await upsertDocumentForCrawl(
      ctx,
      url,
      title,
      contentHash,
      freshnessTier,
      lastModified,
      etag,
      existing,
    );

    const existingChunks = existing ? await getAllChunksByDocumentId(ctx, existing._id) : [];
    const { chunksToEmbed, chunksToDelete } = await diffAndDeleteStaleChunks(
      ctx,
      existingChunks,
      chunks,
      url,
    );

    await enqueueNewChunks(ctx, docId, url, chunksToEmbed, args.jobId);

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

      // Check if all chunks are processed (either embedded or failed)
      const allDlqEntries = await ctx.db
        .query("crawlDeadLetter")
        .withIndex("by_url", (q) => q.eq("url", doc.url))
        .collect();
      const failedCount = allDlqEntries.length;

      if (doc.chunkCount !== undefined && newCount + failedCount >= doc.chunkCount) {
        if (doc.status !== "indexed") {
          updates.status = "indexed";
          updates.updatedAt = Date.now();
        }
      }
      await ctx.db.patch(args.documentId, updates);
    }
  },
});

async function getDLQEntry(ctx: MutationCtx, jobId: string, url: string) {
  return await ctx.db
    .query("crawlDeadLetter")
    .withIndex("by_jobId_and_url", (q) => q.eq("jobId", jobId).eq("url", url))
    .first();
}

async function clearDLQEntry(ctx: MutationCtx, jobId: string, url: string) {
  const dlqEntry = await getDLQEntry(ctx, jobId, url);
  if (dlqEntry) {
    await ctx.db.delete(dlqEntry._id);
  }
}

function getEmbeddingErrorDetails(
  result: { kind: string; error?: string },
  returnValue: { skipped?: boolean } | null,
): { errorMsg: string; isSkipped: boolean } {
  if (result.kind === "success" && returnValue?.skipped) {
    return { errorMsg: "Skipped malformed content", isSkipped: true };
  }
  if (result.kind === "failed") {
    return { errorMsg: result.error ?? "Unknown embedding error", isSkipped: false };
  }
  if (result.kind === "canceled") {
    return { errorMsg: "Job canceled", isSkipped: false };
  }
  return { errorMsg: "Unknown embedding error", isSkipped: false };
}

async function updateOrCreateDLQEntry(
  ctx: MutationCtx,
  jobId: string,
  url: string,
  documentId: Id<"documents">,
  contentHash: string | undefined,
  errorMsg: string,
  chunkText?: string,
) {
  const MAX_RETRIES = 5;
  const dlqEntry = await getDLQEntry(ctx, jobId, url);

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
      payload: { documentId, url, contentHash, jobId, chunkText },
      status: "pending_retry",
    });
  }
}

async function checkDocumentForFailure(
  ctx: MutationCtx,
  documentId: Id<"documents">,
  url: string,
  _jobId: string,
  errorMsg: string,
) {
  const doc = await ctx.db.get(documentId);
  if (doc && doc.status !== "failed") {
    const chunkCount = doc.chunkCount ?? 1;
    if (chunkCount <= 1) {
      await ctx.db.patch(documentId, {
        status: "failed",
        error: errorMsg,
        updatedAt: Date.now(),
      });
    } else {
      // Query ALL DLQ entries for this URL (across all batches), not just this jobId
      const allDlqEntries = await ctx.db
        .query("crawlDeadLetter")
        .withIndex("by_url", (q) => q.eq("url", url))
        .collect();
      const failedCount = allDlqEntries.length;
      const embeddedCount = doc.chunksEmbedded || 0;

      if (failedCount + embeddedCount >= chunkCount) {
        if (embeddedCount === 0) {
          await ctx.db.patch(documentId, {
            status: "failed",
            error: `All ${chunkCount} chunks failed. Last error: ${errorMsg}`,
            updatedAt: Date.now(),
          });
        } else {
          await ctx.db.patch(documentId, {
            status: "indexed",
            error: `Completed with ${failedCount} failed chunks. Last error: ${errorMsg}`,
            updatedAt: Date.now(),
          });
        }
      } else {
        console.warn(
          `Chunk ${failedCount}/${chunkCount} failed for ${url} — document stays in processing`,
        );
      }
    }
  }
}

async function handleEmbeddingFailure(
  ctx: MutationCtx,
  jobId: string,
  url: string,
  documentId: Id<"documents">,
  result: { kind: string; error?: string },
  returnValue: { contentHash?: string; skipped?: boolean; chunkText?: string } | null,
) {
  const { errorMsg, isSkipped } = getEmbeddingErrorDetails(result, returnValue);

  console.warn(`Embedding failed/skipped for chunk on URL ${url}: ${errorMsg}`);

  if (!isSkipped) {
    await updateOrCreateDLQEntry(
      ctx,
      jobId,
      url,
      documentId,
      returnValue?.contentHash,
      errorMsg,
      returnValue?.chunkText,
    );
  }

  await checkDocumentForFailure(ctx, documentId, url, jobId, errorMsg);
}

async function routeChunkResult(
  ctx: MutationCtx,
  jobId: string,
  result: { kind: string; returnValue?: Record<string, unknown>; error?: string },
) {
  const returnValue = result.kind === "success" ? result.returnValue : null;
  const url = returnValue?.url as string | undefined;
  const documentId = returnValue?.documentId as Id<"documents"> | undefined;

  if (result.kind === "success" && returnValue?.success && returnValue.ragId && url) {
    await clearDLQEntry(ctx, jobId, url);
  } else if (url && documentId) {
    await handleEmbeddingFailure(ctx, jobId, url, documentId, result, (returnValue || null) as any);
  }
}

export const onChunkEmbedded = internalMutation({
  args: vOnCompleteArgs(
    v.object({
      jobId: v.string(),
    }),
  ),
  handler: async (ctx, args) => {
    await routeChunkResult(ctx, args.context.jobId, args.result);
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

    const invalidDLQ: (typeof pendingDLQ)[number][] = [];
    const validDLQ = pendingDLQ.filter((dlq) => {
      if (!dlq.payload?.chunkText) {
        console.warn(`Skipping DLQ entry ${dlq._id} — no chunk text available for retry.`);
        invalidDLQ.push(dlq);
        return false;
      }
      return true;
    });

    for (const dlq of invalidDLQ) {
      await ctx.db.patch(dlq._id, {
        status: "abandoned",
        failureReason: "No chunk text payload for retry (context was minimized to save bandwidth).",
        lastAttemptAt: Date.now(),
      });
    }

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

function classifyDocument(url: string, title: string): "faculty" | "staff" | "admin" | null {
  const FACULTY_PATTERNS = ["faculty", "professor", "dr.", "prof."];
  const STAFF_PATTERNS = ["staff"];
  const ADMIN_PATTERNS = ["admin", "head", "registrar", "chancellor"];
  const text = `${url} ${title}`.toLowerCase();
  if (FACULTY_PATTERNS.some((p) => text.includes(p))) return "faculty";
  if (STAFF_PATTERNS.some((p) => text.includes(p))) return "staff";
  if (ADMIN_PATTERNS.some((p) => text.includes(p))) return "admin";
  return null;
}

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
    if (!isPdfVirtualUrl(args.url)) {
      new URL(args.url); // validate URL, throws TypeError if invalid
    }

    const existing = await ctx.db
      .query("documents")
      .withIndex("by_url", (q) => q.eq("url", args.url))
      .first();

    const title = args.title ?? args.url;
    const personType = classifyDocument(args.url, title) ?? undefined;

    if (existing) {
      if (existing.contentHash === args.contentHash) {
        await ctx.db.patch(existing._id, {
          crawlSessionId: args.crawlSessionId,
          status: "active",
          updatedAt: Date.now(),
          freshnessTier: args.freshnessTier,
          metadata: { ...existing.metadata, sourceType: args.sourceType },
          personType,
        });
        return { action: "skipped", documentId: existing._id };
      }

      const oldChunks = await getAllChunksByDocumentId(ctx, existing._id);
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
        personType,
      });
      return { action: "updated", documentId: existing._id };
    }

    let source = "unknown";
    if (isPdfVirtualUrl(args.url)) {
      source = "pdf";
    } else {
      try {
        source = new URL(args.url).hostname;
      } catch {
        source = "unknown";
      }
    }

    const id = await ctx.db.insert("documents", {
      url: args.url,
      source,
      category: "crawled",
      contentHash: args.contentHash,
      crawlSessionId: args.crawlSessionId,
      title: title,
      status: "pending_embed",
      crawledAt: Date.now(),
      updatedAt: Date.now(),
      freshnessTier: args.freshnessTier,
      metadata: { sourceType: args.sourceType },
      personType,
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
