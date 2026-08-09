import { vOnCompleteArgs } from "@convex-dev/workpool";
import { v } from "convex/values";
import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { internalMutation, internalQuery } from "../_generated/server";
import { rag } from "../rag/instance";
import { isPdfVirtualUrl, sha256 } from "./chunking";
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
  parentContentHash?: string;
  parentId?: Id<"chunkParents">;
  headingPath?: string[];
};

type ParentInput = {
  contentHash: string;
  text: string;
};

// WS-1: upsert each distinct parent ONCE into chunkParents (dedup by
// documentId + contentHash) and resolve each child's parentContentHash → parentId.
// Returns a map from parent contentHash → chunkParents id so children can be
// built with a normalized reference instead of duplicated parentText.
async function upsertParentsAndResolve(
  ctx: MutationCtx,
  docId: Id<"documents">,
  parents: ParentInput[],
): Promise<Map<string, Id<"chunkParents">>> {
  const parentIdByHash = new Map<string, Id<"chunkParents">>();
  // Dedup parents by contentHash within this call (a doc may repeat parents).
  const distinct = new Map<string, string>(parents.map((p) => [p.contentHash, p.text]));
  for (const [contentHash, text] of distinct) {
    const existing = await ctx.db
      .query("chunkParents")
      .withIndex("by_documentId_and_contentHash", (q) =>
        q.eq("documentId", docId).eq("contentHash", contentHash),
      )
      .first();
    if (existing) {
      parentIdByHash.set(contentHash, existing._id);
    } else {
      const id = await ctx.db.insert("chunkParents", {
        documentId: docId,
        contentHash,
        text,
      });
      parentIdByHash.set(contentHash, id);
    }
  }
  return parentIdByHash;
}

// WS-1: delete chunkParents rows whose contentHash no longer appears in any
// new child for this document (i.e. the parent itself was dropped on re-crawl).
// Scoped by documentId so it stays cheap. Called after the child diff.
async function deleteStaleParents(
  ctx: MutationCtx,
  docId: Id<"documents">,
  survivingParentHashes: Set<string>,
): Promise<number> {
  let deleted = 0;
  const existingParents = await ctx.db
    .query("chunkParents")
    .withIndex("by_documentId", (q) => q.eq("documentId", docId))
    .collect();
  for (const parent of existingParents) {
    if (!survivingParentHashes.has(parent.contentHash)) {
      await ctx.db.delete(parent._id);
      deleted++;
    }
  }
  return deleted;
}

async function diffAndDeleteStaleChunks(
  ctx: MutationCtx,
  existingChunks: Doc<"crawledChunks">[],
  chunks: ChunkInput[],
  url: string,
): Promise<{ chunksToEmbed: ChunkInput[]; chunksToDelete: Doc<"crawledChunks">[] }> {
  const existingHashSet = new Set(existingChunks.map((c) => c.contentHash));
  const newHashSet = new Set(chunks.map((c) => c.contentHash));
  const chunksToEmbed = chunks.filter((nc) => !existingHashSet.has(nc.contentHash));
  // O(n) lookup via the newHashSet instead of the previous O(n×m) `.some()` scan;
  // matters on documents with many chunks during a re-crawl diff.
  const chunksToDelete = existingChunks.filter((ec) => !newHashSet.has(ec.contentHash));

  await Promise.all(
    chunksToDelete.map(async (staleChunk) => {
      try {
        await rag.delete(ctx, {
          entryId: staleChunk.ragId as unknown as import("@convex-dev/rag").EntryId,
        });
        await ctx.db.delete(staleChunk._id);
      } catch (err) {
        console.warn(`Failed to delete vector ${staleChunk.ragId} from RAG during re-embed:`, err);
      }
    }),
  );

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
    parentId: chunk.parentId,
    headingPath: chunk.headingPath,
    namespaceId: namespaceIdStr,
  }));

  await embeddingPool.enqueueActionBatch(ctx, internal.crawl.actions.embedSingleChunk, argsArray, {
    onComplete: internal.crawl.mutations.onChunkEmbedded,
    context: { jobId, documentId: docId, url },
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
    const metadataPatch = buildMetadataPatch(lastModified, etag);
    await ctx.db.patch(existing._id, {
      contentHash,
      crawledAt: Date.now(),
      updatedAt: Date.now(),
      status: "processing",
      chunksEmbedded: 0,
      ...(metadataPatch ? { metadata: { ...existing.metadata, ...metadataPatch } } : {}),
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

/**
 * Compensating action for the webhook dedup marker. If processing fails after the
 * `processedWebhooks` row was inserted, we delete that row so the crawler's retried
 * (at-least-once) delivery is reprocessed instead of being silently swallowed as a
 * duplicate. Per-document/per-chunk content-hash idempotency makes reprocessing safe.
 */
export const unmarkWebhookProcessed = internalMutation({
  args: { jobId: v.string() },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("processedWebhooks")
      .withIndex("by_jobId", (q) => q.eq("jobId", args.jobId))
      .first();
    if (!existing) return false;
    await ctx.db.delete(existing._id);
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
    // WS-1: generateChunks now returns parents (stored once) + children (carry
    // parentContentHash). The mutation resolves parentContentHash → parentId.
    parents: v.array(
      v.object({
        contentHash: v.string(),
        text: v.string(),
      }),
    ),
    children: v.array(
      v.object({
        text: v.string(),
        contentHash: v.string(),
        parentContentHash: v.string(),
        headingPath: v.optional(v.array(v.string())),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const { url, title, contentHash, freshnessTier, etag, lastModified, parents, children } = args;

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

    // WS-1: upsert each parent ONCE, resolve parentContentHash → parentId.
    const parentIdByHash = await upsertParentsAndResolve(ctx, docId, parents);
    const resolvedChildren: ChunkInput[] = children.map((c) => ({
      text: c.text,
      contentHash: c.contentHash,
      parentContentHash: c.parentContentHash,
      parentId: parentIdByHash.get(c.parentContentHash),
      headingPath: c.headingPath,
    }));

    const existingChunks = existing ? await getAllChunksByDocumentId(ctx, existing._id) : [];
    const { chunksToEmbed, chunksToDelete } = await diffAndDeleteStaleChunks(
      ctx,
      existingChunks,
      resolvedChildren,
      url,
    );

    await enqueueNewChunks(ctx, docId, url, chunksToEmbed, args.jobId);

    // WS-1: drop parents whose contentHash no longer appears among surviving children.
    const survivingParentHashes = new Set(
      resolvedChildren.map((c) => c.parentContentHash).filter((h): h is string => !!h),
    );
    await deleteStaleParents(ctx, docId, survivingParentHashes);

    await ctx.db.patch(docId, {
      chunkCount: children.length,
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
    jobId: v.optional(v.string()),
    parentId: v.optional(v.id("chunkParents")),
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

    // TOCTOU guard: a concurrent retry of this same chunk may have already won
    // the rag.add() race in actions.ts (embedSingleChunk) and created a SECOND
    // vector with the SAME ragId before this mutation committed. If a row for
    // this ragId already exists, this run lost the race - delete the duplicate
    // vector we just created in rag.add() so it doesn't linger as an orphan
    // (paid storage, never queried). This makes saveEmbedding idempotent across
    // the action/mutation boundary regardless of retry interleaving.
    const existingByRagId = await ctx.db
      .query("crawledChunks")
      .withIndex("by_ragId", (q) => q.eq("ragId", args.ragId))
      .first();
    if (existingByRagId) {
      console.warn(
        `Duplicate vector detected for ragId ${args.ragId} (contentHash ${args.contentHash}); ` +
          "deleting the duplicate vector created by this retry to prevent an orphan.",
      );
      try {
        await rag.delete(ctx, {
          entryId: args.ragId as unknown as import("@convex-dev/rag").EntryId,
        });
      } catch (err) {
        console.warn(`Failed to delete duplicate vector ${args.ragId}:`, err);
      }
      return;
    }

    await ctx.db.insert("crawledChunks", {
      documentId: args.documentId,
      contentHash: args.contentHash,
      text: args.chunkText,
      ragId: args.ragId,
      embeddingModel: "gemini-embedding-2",
      parentId: args.parentId,
      headingPath: args.headingPath,
    });

    const doc = await ctx.db.get(args.documentId);
    if (doc) {
      const newCount = (doc.chunksEmbedded || 0) + 1;
      const updates: Partial<Doc<"documents">> = { chunksEmbedded: newCount };

      // Check if all chunks are processed (either embedded or failed). Count failed
      // chunks scoped to THIS job + URL so stale rows from earlier re-crawls do not
      // inflate the count and prematurely mark the doc indexed.
      const chunkCount = doc.chunkCount ?? 1;
      const failedCount = args.jobId ? await countFailedChunks(ctx, args.jobId, doc.url) : 0;

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

async function getDLQEntriesForUrl(ctx: MutationCtx, jobId: string, url: string) {
  return await ctx.db
    .query("crawlDeadLetter")
    .withIndex("by_jobId_and_url", (q) => q.eq("jobId", jobId).eq("url", url))
    .collect();
}

/**
 * Resolve a single chunk's DLQ row for (jobId, url, contentHash). DLQ rows are kept
 * one-per-failed-chunk so completion accounting can count DISTINCT failed chunks; we
 * therefore match on contentHash when available rather than collapsing all chunks of
 * a URL into one row.
 */
async function getDLQEntry(ctx: MutationCtx, jobId: string, url: string, contentHash?: string) {
  const entries = await getDLQEntriesForUrl(ctx, jobId, url);
  if (contentHash !== undefined) {
    return entries.find((e) => e.payload?.contentHash === contentHash) ?? null;
  }
  return entries[0] ?? null;
}

async function clearDLQEntry(ctx: MutationCtx, jobId: string, url: string, contentHash?: string) {
  // Clear only the row for the specific chunk that just succeeded when we know its
  // contentHash; otherwise (legacy callers) clear every row for the (jobId, url).
  if (contentHash !== undefined) {
    const dlqEntry = await getDLQEntry(ctx, jobId, url, contentHash);
    if (dlqEntry) await ctx.db.delete(dlqEntry._id);
    return;
  }
  const entries = await getDLQEntriesForUrl(ctx, jobId, url);
  for (const entry of entries) {
    await ctx.db.delete(entry._id);
  }
}

const ACTIVE_DLQ_STATUSES = new Set(["pending_retry", "processing", "abandoned"]);

/**
 * Count DISTINCT failed chunks for the current job + URL. Each failed chunk has its
 * own DLQ row (keyed by contentHash), so the number of active rows equals the number
 * of distinct chunks that have failed for this document in this job. Scoping to jobId
 * avoids conflating stale rows from earlier re-crawls of the same URL.
 */
async function countFailedChunks(ctx: MutationCtx, jobId: string, url: string): Promise<number> {
  const entries = await getDLQEntriesForUrl(ctx, jobId, url);
  const failedHashes = new Set<string>();
  let unhashed = 0;
  for (const entry of entries) {
    if (!ACTIVE_DLQ_STATUSES.has(entry.status)) continue;
    const hash = entry.payload?.contentHash;
    if (hash) failedHashes.add(hash);
    else unhashed++;
  }
  return failedHashes.size + unhashed;
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
  // One DLQ row per failed chunk (jobId, url, contentHash) so completion accounting
  // can count distinct failed chunks rather than collapsing all chunks of a URL.
  const dlqEntry = await getDLQEntry(ctx, jobId, url, contentHash);

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
  jobId: string,
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
      // Count DISTINCT failed chunks scoped to THIS job + URL (one DLQ row per
      // failed chunk). Using by_url across all jobs/statuses previously both
      // under-counted multi-chunk failures and over-counted stale re-crawl rows.
      const failedCount = await countFailedChunks(ctx, jobId, url);
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
          `Chunk ${failedCount}/${chunkCount} failed for ${url} - document stays in processing`,
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
  context: { jobId: string; url?: string; documentId?: string },
  result: { kind: string; returnValue?: Record<string, unknown>; error?: string },
) {
  const returnValue = result.kind === "success" ? result.returnValue : null;
  const url = returnValue?.url as string | undefined ?? context.url;
  const documentId =
    (returnValue?.documentId as Id<"documents"> | undefined) ??
    (context.documentId as Id<"documents"> | undefined);
  const contentHash = returnValue?.contentHash as string | undefined;
  // Prefer the jobId the chunk itself reports. The DLQ-retry path enqueues a batch of
  // entries that may belong to MANY different jobs under a single onComplete context
  // jobId; routing DLQ updates by the batch-level context jobId would clear/insert rows
  // under the wrong (jobId, url), corrupting failure accounting. Fall back to the context
  // jobId only when the chunk did not report one (e.g. a hard failure with no returnValue).
  const chunkJobId = (returnValue?.jobId as string | undefined) ?? context.jobId;

  if (result.kind === "success" && returnValue?.success && returnValue.ragId && url) {
    // Clear only the specific chunk's DLQ row that just succeeded (per-chunk rows).
    await clearDLQEntry(ctx, chunkJobId, url, contentHash);
  } else if (url && documentId) {
    await handleEmbeddingFailure(
      ctx,
      chunkJobId,
      url,
      documentId,
      result,
      (returnValue || null) as any,
    );
  }
}

export const onChunkEmbedded = internalMutation({
  args: vOnCompleteArgs(
    v.object({
      jobId: v.string(),
      url: v.optional(v.string()),
      documentId: v.optional(v.string()),
    }),
  ),
  handler: async (ctx, args) => {
    await routeChunkResult(ctx, args.context, args.result);
  },
});

export const resetStuckDLQEntries = internalMutation({
  args: { timeoutMs: v.optional(v.number()) },
  handler: async (ctx, { timeoutMs }) => {
    const timeout = timeoutMs ?? 30 * 60 * 1000; // 30 minutes default
    const cutoff = Date.now() - timeout;

    const stuckEntries = await ctx.db
      .query("crawlDeadLetter")
      .withIndex("by_status", (q) => q.eq("status", "processing"))
      .take(100);

    let reset = 0;
    for (const entry of stuckEntries) {
      if ((entry.lastAttemptAt ?? 0) < cutoff) {
        await ctx.db.patch(entry._id, {
          status: "pending_retry",
          lastAttemptAt: Date.now(),
        });
        reset++;
      }
    }
    return { reset };
  },
});

export const retryDeadLetterQueue = internalMutation({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit }) => {
    const batchSize = limit ?? 20;

    // Idempotency is enforced PER ENTRY, not globally: we only ever fetch
    // "pending_retry" rows below and atomically flip each to "processing" within this
    // transaction before enqueuing. Convex mutations are serializable, so a concurrent
    // run cannot re-grab the same rows. We therefore do NOT gate the whole queue on the
    // existence of any single "processing" row - one permanently-stuck entry would
    // otherwise stall recovery of every other failed chunk for up to 30 minutes
    // (resetStuckDLQEntries still recovers genuinely stuck "processing" rows on its own
    // cron cycle).
    const pendingDLQ = await ctx.db
      .query("crawlDeadLetter")
      .withIndex("by_status", (q) => q.eq("status", "pending_retry"))
      .take(batchSize);

    const invalidDLQ: (typeof pendingDLQ)[number][] = [];
    const validDLQ = pendingDLQ.filter((dlq) => {
      if (!dlq.payload?.chunkText) {
        console.warn(`Skipping DLQ entry ${dlq._id} - no chunk text available for retry.`);
        invalidDLQ.push(dlq);
        return false;
      }
      return true;
    });

    await Promise.all(
      invalidDLQ.map((dlq) =>
        ctx.db.patch(dlq._id, {
          status: "abandoned",
          failureReason:
            "No chunk text payload for retry (context was minimized to save bandwidth).",
          lastAttemptAt: Date.now(),
        }),
      ),
    );

    if (validDLQ.length > 0) {
      await Promise.all(
        validDLQ.map((dlq) =>
          ctx.db.patch(dlq._id, {
            status: "processing",
            lastAttemptAt: Date.now(),
          }),
        ),
      );

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
      // Report only entries actually re-enqueued (not abandoned/invalid ones) so the
      // metric reflects real reprocessing. The pagination flag is based on whether the
      // fetched batch was full (more pending rows may remain), independent of how many
      // were valid.
      reprocessed: validDLQ.length,
      abandoned: invalidDLQ.length,
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
      const BATCH_SIZE = 50;
      for (let i = 0; i < oldChunks.length; i += BATCH_SIZE) {
        const batch = oldChunks.slice(i, i + BATCH_SIZE);
        await Promise.all(
          batch.map(async (chunk) => {
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
          }),
        );
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
    parents: v.array(
      v.object({
        contentHash: v.string(),
        text: v.string(),
      }),
    ),
    children: v.array(
      v.object({
        text: v.string(),
        contentHash: v.string(),
        parentContentHash: v.string(),
        headingPath: v.optional(v.array(v.string())),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const { documentId, url, parents, children } = args;

    // WS-1: upsert parents once + resolve parentId for each child.
    const parentIdByHash = await upsertParentsAndResolve(ctx, documentId, parents);

    if (children.length > 0) {
      const { namespaceId } = await rag.getOrCreateNamespace(ctx, {
        namespace: "uet-global",
      });
      const namespaceIdStr = namespaceId as unknown as string;

      const argsArray = children.map((chunk) => ({
        documentId,
        url,
        chunkText: chunk.text,
        contentHash: chunk.contentHash,
        jobId: "ingest-job",
        parentId: parentIdByHash.get(chunk.parentContentHash),
        headingPath: chunk.headingPath,
        namespaceId: namespaceIdStr,
      }));

      await embeddingPool.enqueueActionBatch(
        ctx,
        internal.crawl.actions.embedSingleChunk,
        argsArray,
        {
          onComplete: internal.crawl.mutations.onChunkEmbedded,
          context: { jobId: "ingest-job", documentId: documentId as unknown as string, url },
        },
      );
    }

    await ctx.db.patch(documentId, {
      chunkCount: children.length,
      status: children.length === 0 ? "indexed" : "processing",
    });
  },
});

/**
 * WS-1f migration: normalize legacy crawledChunks.parentText into the
 * chunkParents table, then clear the duplicated inline parentText to reclaim
 * storage. Run ONCE manually after deploy (admin-triggered); repeat-safe.
 *
 * For each chunk that still carries inline `parentText` (pre-WS-1 rows) and has
 * no `parentId` yet: hash the parent text, upsert into chunkParents (dedup by
 * documentId + contentHash so siblings share one row), set the chunk's parentId,
 * then clear parentText. Bounded per call via `limit` (default 500); the caller
 * re-invokes until `remaining === "done"`.
 *
 * This is the ONLY way to reclaim the already-stored parentText duplication -
 * new writes already use parentId (WS-1), but existing rows keep their inline
 * copy until this runs. Retrieval is unchanged throughout (doc_queries.ts
 * resolves parentText via parentId when present, falling back to the inline
 * field), so this can run lazily without a maintenance window.
 */
export const migrateParentTextToTable = internalMutation({
  args: { limit: v.optional(v.number()) },
  returns: v.object({
    migrated: v.number(),
    remaining: v.string(),
  }),
  handler: async (ctx, args) => {
    const limit = args.limit ?? 500;
    // Chunks that still have inline parentText and no parentId reference yet.
    // There is no index on parentText (it's an optional string field), so this
    // scans via the table order; bounded by `limit`. Re-running picks up the
    // next batch until none remain.
    const chunks = await ctx.db
      .query("crawledChunks")
      .filter((q) =>
        q.and(q.eq(q.field("parentId"), undefined), q.neq(q.field("parentText"), undefined)),
      )
      .take(limit);

    let migrated = 0;
    for (const chunk of chunks) {
      const parentText = chunk.parentText;
      if (!parentText) continue;
      const contentHash = await sha256(parentText);
      const existing = await ctx.db
        .query("chunkParents")
        .withIndex("by_documentId_and_contentHash", (q) =>
          q.eq("documentId", chunk.documentId).eq("contentHash", contentHash),
        )
        .first();
      const parentId = existing
        ? existing._id
        : await ctx.db.insert("chunkParents", {
            documentId: chunk.documentId,
            contentHash,
            text: parentText,
          });
      // Set parentId then clear the inline copy in one patch - reclaims the
      // duplicated storage immediately for this row.
      await ctx.db.patch(chunk._id, { parentId, parentText: undefined });
      migrated++;
    }

    return {
      migrated,
      remaining: chunks.length === limit ? "more" : "done",
    };
  },
});
