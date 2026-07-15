import { v } from "convex/values";
import type { Id } from "../_generated/dataModel";
import { internalMutation } from "../_generated/server";
import { rag } from "../rag/instance";

async function deleteAbandonedDLQ(
  ctx: any,
  batchSize: number,
  now: number,
  cutoff: number,
): Promise<number> {
  const abandonedDLQ = await ctx.db
    .query("crawlDeadLetter")
    .withIndex("by_status", (q: any) => q.eq("status", "abandoned"))
    .take(batchSize);

  let totalDeleted = 0;
  for (const entry of abandonedDLQ) {
    if (now - entry.lastAttemptAt > cutoff) {
      await ctx.db.delete(entry._id);
      totalDeleted++;
    }
  }
  return totalDeleted;
}

// WS-3: purge DLQ rows that no longer represent active failures. `indexed` rows
// are successfully-retried chunks that were never cleaned up on the success path
// (a chunk can succeed after its sibling failed in the same batch). They carry
// no useful state and grow the table monotonically. Also sweep stale
// `pending_retry`/`processing` rows older than the cutoff — these are chunks
// that will never be retried (the workpool already exhausted its attempts) and
// whose payload text is pure storage overhead.
async function deleteResolvedDLQ(ctx: any, batchSize: number, cutoff: number): Promise<number> {
  const now = Date.now();
  let totalDeleted = 0;

  // 1) `indexed` rows: successfully retried — delete unconditionally (capped).
  const indexed = await ctx.db
    .query("crawlDeadLetter")
    .withIndex("by_status", (q: any) => q.eq("status", "indexed"))
    .take(batchSize);
  for (const entry of indexed) {
    await ctx.db.delete(entry._id);
    totalDeleted++;
    if (totalDeleted >= batchSize) return totalDeleted;
  }

  // 2) Stale `pending_retry`/`processing` rows past the cutoff.
  for (const status of ["pending_retry", "processing"] as const) {
    const stale = await ctx.db
      .query("crawlDeadLetter")
      .withIndex("by_status", (q: any) => q.eq("status", status))
      .take(batchSize);
    for (const entry of stale) {
      if (now - entry.lastAttemptAt > cutoff) {
        await ctx.db.delete(entry._id);
        totalDeleted++;
        if (totalDeleted >= batchSize) return totalDeleted;
      }
    }
  }
  return totalDeleted;
}

// WS-3: compaction safety net. crawlDeadLetter.payload.chunkText duplicates the
// chunk body inline so DLQ retries can re-embed without a DB round-trip (bandwidth
// optimization). Once a DLQ row is resolved or abandoned, that payload is dead
// storage. This trims the payload (keeps metadata for auditing) on rows that are
// hanging around in non-active states, reclaiming storage without losing the
// audit trail of what failed.
async function trimStaleDLQPayloads(ctx: any, batchSize: number, cutoff: number): Promise<number> {
  const now = Date.now();
  let trimmed = 0;
  for (const status of ["abandoned", "indexed"] as const) {
    const rows = await ctx.db
      .query("crawlDeadLetter")
      .withIndex("by_status", (q: any) => q.eq("status", status))
      .take(batchSize);
    for (const entry of rows) {
      if (entry.payload?.chunkText && now - entry.lastAttemptAt > cutoff) {
        await ctx.db.patch(entry._id, {
          payload: { ...entry.payload, chunkText: undefined },
        });
        trimmed++;
        if (trimmed >= batchSize) return trimmed;
      }
    }
  }
  return trimmed;
}

// WS-3: orphaned-chunk compaction. A crawledChunks row can be orphaned from its
// parent document if a delete raced with an embed completion (the TOCTOU window
// now closed in saveEmbedding, but legacy orphans may exist). Orphans are never
// retrieved (retrieval joins chunk → document) yet occupy storage + a paid RAG
// vector. Detect via a missing documentId and remove the chunk + its vector.
// Batch-capped; runs weekly.
async function compactOrphanedChunks(ctx: any, batchSize: number): Promise<number> {
  // Detect orphaned chunks: a chunkParents row whose `documentId` no longer
  // resolves (the document was deleted, e.g. via a re-crawl that replaced it,
  // or the TOCTOU window that existed before the saveEmbedding fix). chunkParents
  // is far smaller than crawledChunks, so iterating it and probing doc existence
  // is cheaper than scanning chunks. For each orphaned parent, cascade-delete its
  // children + their RAG vectors, then the parent itself. Batch-capped; the cron
  // re-runs weekly until the `remaining` flag clears. .take() reads in table order
  // (creation order) — acceptable since we only act on genuinely missing docs.
  let deleted = 0;
  const parents = await ctx.db.query("chunkParents").take(batchSize);
  for (const parent of parents) {
    const doc = await ctx.db.get(parent.documentId as Id<"documents">);
    if (!doc) {
      const children = await ctx.db
        .query("crawledChunks")
        .withIndex("by_documentId", (q: any) => q.eq("documentId", parent.documentId))
        .take(batchSize);
      for (const child of children) {
        try {
          await rag.delete(ctx, {
            entryId: child.ragId as unknown as import("@convex-dev/rag").EntryId,
          });
        } catch (err) {
          console.warn(`Failed to delete orphan vector ${child.ragId}:`, err);
        }
        await ctx.db.delete(child._id);
        deleted++;
      }
      await ctx.db.delete(parent._id);
    }
  }
  return deleted;
}

async function deleteOldJobsByStatus(
  ctx: any,
  batchSize: number,
  now: number,
  cutoff: number,
): Promise<number> {
  const jobStatuses = ["completed", "failed", "cancelled"] as const;
  let totalDeleted = 0;
  for (const status of jobStatuses) {
    const jobs = await ctx.db
      .query("crawlJobs")
      .withIndex("by_status", (q: any) => q.eq("status", status))
      .take(batchSize);

    for (const job of jobs) {
      // Stop as soon as we have deleted a full batch, even mid-status, so a single
      // status iteration can never exceed batchSize deletions.
      if (totalDeleted >= batchSize) return totalDeleted;

      // Require a real timestamp before considering a job old enough to delete.
      // Previously, when both completedAt and _creationTime were missing, ageMs
      // fell back to 0 and `now - 0 > cutoff` force-deleted the job.
      const ageMs = job.completedAt ?? job._creationTime;
      if (typeof ageMs === "number" && now - ageMs > cutoff) {
        await ctx.db.delete(job._id);
        totalDeleted++;
      }
    }

    if (totalDeleted >= batchSize) break;
  }
  return totalDeleted;
}

export const cleanupOldRecords = internalMutation({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit }) => {
    const batchSize = limit ?? 100;
    const now = Date.now();
    const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
    const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

    // WS-3: resolve/expire DLQ rows FIRST — this is the biggest storage win
    // (indexed/succeeded rows were previously never purged).
    let totalDeleted = await deleteResolvedDLQ(ctx, batchSize, SEVEN_DAYS_MS);
    totalDeleted += await deleteAbandonedDLQ(ctx, batchSize, now, SEVEN_DAYS_MS);

    if (totalDeleted < batchSize) {
      const remaining = batchSize - totalDeleted;
      totalDeleted += await deleteOldJobsByStatus(ctx, remaining, now, THIRTY_DAYS_MS);
    }

    return {
      deleted: totalDeleted,
      remaining: totalDeleted >= batchSize ? "more" : "done",
    };
  },
});

// WS-3: weekly orphan-chunk compaction. Separate from cleanupOldRecords so its
// budget is independent of the DLQ/job purge and runs on its own cadence.
export const compactOrphans = internalMutation({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit }) => {
    const batchSize = limit ?? 200;
    const deleted = await compactOrphanedChunks(ctx, batchSize);
    return { deleted, remaining: deleted >= batchSize ? "more" : "done" };
  },
});

// WS-3: trim dead chunkText payloads from resolved/abandoned DLQ rows so they
// stop occupying storage while keeping the failure audit trail. Runs weekly.
export const trimDlqPayloads = internalMutation({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit }) => {
    const batchSize = limit ?? 200;
    const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
    const trimmed = await trimStaleDLQPayloads(ctx, batchSize, SEVEN_DAYS_MS);
    return { trimmed, remaining: trimmed >= batchSize ? "more" : "done" };
  },
});
