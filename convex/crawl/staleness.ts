import { v } from "convex/values";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { internalMutation, type MutationCtx } from "../_generated/server";
import { rag } from "../rag/instance";
import {
  classifyFreshness,
  RETRIEVAL_ELIGIBLE_STATUSES,
  SWEEP_BATCH_SIZE,
} from "../shared/freshnessPolicy";

export const markStaleDocuments = internalMutation({
  args: { crawlSessionId: v.string(), limit: v.optional(v.number()) },
  handler: async (ctx, { crawlSessionId, limit }) => {
    const batchSize = limit ?? 500;
    const statuses = ["active", "pending_embed", "processing", "indexed"] as const;
    let marked = 0;
    let hasMore = false;

    for (const status of statuses) {
      const docs = await ctx.db
        .query("documents")
        .withIndex("by_status", (q) => q.eq("status", status))
        .take(batchSize);

      if (docs.length >= batchSize) hasMore = true;

      const results = await Promise.all(
        docs.map(async (doc) => {
          if (doc.crawlSessionId !== crawlSessionId) {
            await ctx.db.patch(doc._id, { status: "stale" });
            return 1;
          }
          return 0;
        }),
      );
      marked += results.reduce<number>((a, b) => a + b, 0);
    }
    return { marked, remaining: hasMore ? "more" : "done" };
  },
});

async function deleteDocAndChunks(ctx: MutationCtx, doc: { _id: Id<"documents"> }): Promise<void> {
  const chunks = await ctx.db
    .query("crawledChunks")
    .withIndex("by_documentId", (q) => q.eq("documentId", doc._id))
    .take(200);
  for (const chunk of chunks) {
    try {
      if (chunk.ragId) {
        await rag.delete(ctx, {
          entryId: chunk.ragId as unknown as import("@convex-dev/rag").EntryId,
        });
      }
      await ctx.db.delete(chunk._id);
    } catch (err) {
      console.warn(`Failed to delete vector ${chunk.ragId} from RAG during purge:`, err);
    }
  }
  await ctx.db.delete(doc._id);
}

export const purgeStaleDocuments = internalMutation({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit }) => {
    const batchSize = limit ?? 100;
    let purged = 0;

    const staleDocs = await ctx.db
      .query("documents")
      .withIndex("by_status", (q) => q.eq("status", "stale"))
      .take(batchSize);

    for (const doc of staleDocs) {
      await deleteDocAndChunks(ctx, doc);
      purged++;
    }

    // Purge isStale-flagged docs across EVERY status that flagExpiredDocuments flags
    // (currently "indexed" and "active"). Previously only "indexed" was purged, so
    // expired "active" docs (ingested via the upsertDocument path) were flagged but
    // never deleted, leaking their chunks/vectors. Keep these in sync via FLAGGED_STATUSES.
    const FLAGGED_STATUSES = ["indexed", "active"] as const;
    for (const status of FLAGGED_STATUSES) {
      if (purged >= batchSize) break;
      const remainingBudget = batchSize - purged;
      const isStaleDocs = await ctx.db
        .query("documents")
        .withIndex("by_status_and_isStale", (q) => q.eq("status", status).eq("isStale", true))
        .take(remainingBudget);

      for (const doc of isStaleDocs) {
        if (!doc.isStale) continue;

        await deleteDocAndChunks(ctx, doc);
        purged++;
      }
    }

    return { purged, remaining: purged >= batchSize ? "more" : "done" };
  },
});

/**
 * flagExpiredDocuments — resumable, cursor-based staleness sweep.
 *
 * Amendment #2 of the staleness-MVP verdict. The previous implementation used
 * `.withIndex("by_status_and_isStale").take(batchSize)`, which re-reads the
 * SAME first N rows on every invocation (the index order is stable, and
 * flagging a row removes it from the `isStale:false` set but the next batch
 * starts from the beginning again). That can permanently leave later
 * documents unexamined.
 *
 * Execution model (per amendment #2):
 *   - Daily cron (03:30 UTC, see crons.ts) starts a new sweep by calling this
 *     mutation with no cursor. The cron is bounded: this handler processes ONE
 *     paginated batch and then schedules the next via ctx.scheduler.runAfter,
 *     so no single invocation runs an unbounded corpus scan (Convex skips
 *     overlapping crons; a bounded batch avoids that risk).
 *   - Each batch paginates the documents table with `.paginate({numItems,
 *     cursor})`, which advances a stable cursor regardless of in-flight writes.
 *   - Per-doc classification uses classifyFreshness from the shared policy
 *     module — NEVER a local TTL copy. Only eligible-status docs (active/
 *     indexed) that classify as "aged" and are not already flagged get
 *     `isStale: true`.
 *   - Counters accumulate across batches via the `cumulative` arg.
 *   - The sweep is idempotent: re-running on already-flagged docs increments
 *     `alreadyStale`, never re-patches.
 *   - dryRun: counts only, zero writes — for the Gate 4 production dry run.
 *
 * Amendment #7: this flagger NEVER writes isStale:false. Only the ingestion
 * path (crawl/mutations.ts) clears staleness on a successful recrawl. The age
 * flagger does not reactivate documents.
 *
 * Continuation: when `!pageResult.isDone`, schedules the next batch at
 * runAfter(0, ...) carrying the continuation cursor + cumulative counters +
 * sweepId/startedAt so the whole sweep is correlated. Returns a structured
 * result the observability cron (04:00 UTC) can read for sweep-state reporting.
 */
export const flagExpiredDocuments = internalMutation({
  args: {
    // Max rows to examine in THIS batch. Defaults to SWEEP_BATCH_SIZE (100).
    limit: v.optional(v.number()),
    // dryRun: classify + count but perform ZERO ctx.db.patch writes.
    dryRun: v.optional(v.boolean()),
    // Continuation cursor from the previous batch's paginate(). Undefined on
    // the first batch of a new sweep.
    cursor: v.optional(v.string()),
    // Correlation id for the whole sweep. A new sweep mints one if absent.
    sweepId: v.optional(v.string()),
    // Epoch-ms when the sweep started (first batch). Carried across batches.
    startedAt: v.optional(v.number()),
    // Accumulated counters across prior batches of this sweep.
    cumulative: v.optional(
      v.object({
        examined: v.number(),
        flagged: v.number(),
        alreadyStale: v.number(),
        skipped: v.number(),
      }),
    ),
  },
  returns: v.object({
    sweepId: v.string(),
    examined: v.number(),
    flagged: v.number(),
    alreadyStale: v.number(),
    skipped: v.number(),
    nextCursor: v.union(v.string(), v.null()),
    complete: v.boolean(),
    dryRun: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const batchSize = Math.min(Math.max(1, args.limit ?? SWEEP_BATCH_SIZE), SWEEP_BATCH_SIZE);
    const isDryRun = args.dryRun === true;
    const now = Date.now();

    // Resolve sweep state. A missing sweepId means a fresh sweep started by
    // the cron (or a manual one-off invocation).
    const sweepId = args.sweepId ?? `sweep-${now}`;
    const startedAt = args.startedAt ?? now;
    const cumulative = args.cumulative ?? { examined: 0, flagged: 0, alreadyStale: 0, skipped: 0 };

    // Paginate the documents table. Stable cursor advance is the fix for the
    // re-examine-first-N-forever bug. We do NOT filter by status at the index
    // level here because (a) classification must run on every row to keep
    // counters honest and (b) the index `by_status_and_isStale` is reserved
    // for the purge path. Pagination cost is one read per row examined.
    const pageResult = await ctx.db
      .query("documents")
      .paginate({ numItems: batchSize, cursor: args.cursor ?? null });

    let flagged = 0;
    let alreadyStale = 0;
    let skipped = 0;

    for (const doc of pageResult.page) {
      // Only eligible-status docs are candidates for age flagging. Other
      // statuses (stale/failed/pending/processing/pending_embed) are skipped
      // — they are either already invalidated or not yet ready.
      const isEligibleStatus = (RETRIEVAL_ELIGIBLE_STATUSES as readonly string[]).includes(
        doc.status ?? "",
      );
      if (!isEligibleStatus) {
        skipped++;
        continue;
      }

      // Already flagged? Idempotent — count, do not re-patch.
      if (doc.isStale === true) {
        alreadyStale++;
        continue;
      }

      const decision = classifyFreshness({
        status: doc.status,
        isStale: doc.isStale,
        crawledAt: doc.crawledAt,
        freshnessTier: doc.freshnessTier,
        now,
      });

      if (decision.state === "aged") {
        if (!isDryRun) {
          await ctx.db.patch(doc._id, { isStale: true });
        }
        flagged++;
      } else {
        skipped++;
      }
    }

    const examined = pageResult.page.length;
    const totals = {
      examined: cumulative.examined + examined,
      flagged: cumulative.flagged + flagged,
      alreadyStale: cumulative.alreadyStale + alreadyStale,
      skipped: cumulative.skipped + skipped,
    };

    const isComplete = pageResult.isDone;
    const nextCursor = isComplete ? null : pageResult.continueCursor;

    // Schedule the next batch if more rows remain. runAfter(0) runs promptly
    // while staying outside the cron's overlap window. Carries sweep state.
    if (!isComplete) {
      ctx.scheduler.runAfter(0, internal.crawl.staleness.flagExpiredDocuments, {
        limit: batchSize,
        dryRun: isDryRun,
        cursor: pageResult.continueCursor,
        sweepId,
        startedAt,
        cumulative: totals,
      });
    }

    if (!isDryRun && totals.flagged > 0) {
      console.log("[STALENESS] flagExpiredDocuments batch", {
        sweepId,
        startedAt,
        examined: totals.examined,
        flagged: totals.flagged,
        alreadyStale: totals.alreadyStale,
        skipped: totals.skipped,
        complete: isComplete,
      });
    }

    if (!isDryRun) {
      const existingList = await ctx.db
        .query("appSettings")
        .withIndex("by_key", (q) => q.eq("key", "observability_staleness_sweep"))
        .collect();
      const sweepMetricValue = JSON.stringify({
        sweepId,
        lastSweepStartedAt: startedAt,
        lastSweepCompletedAt: isComplete ? Date.now() : null,
        sweepComplete: isComplete,
        documentsExamined: totals.examined,
        documentsFlagged: totals.flagged,
        documentsCleared: 0,
        cursorRemaining: nextCursor !== null,
        errors: 0,
      });
      const firstExisting = existingList[0];
      if (firstExisting) {
        await ctx.db.patch(firstExisting._id, { value: sweepMetricValue, updatedAt: Date.now() });
      } else {
        await ctx.db.insert("appSettings", {
          key: "observability_staleness_sweep",
          value: sweepMetricValue,
          section: "observability",
          updatedAt: Date.now(),
        });
      }
    }

    return {
      sweepId,
      examined: totals.examined,
      flagged: totals.flagged,
      alreadyStale: totals.alreadyStale,
      skipped: totals.skipped,
      nextCursor,
      complete: isComplete,
      dryRun: isDryRun,
    };
  },
});

/**
 * Sets documents.lifecycleStatus on one document. Search skips any document whose
 * lifecycleStatus is set and not "active" (isRetrievalEligibleLifecycle), so this
 * retires a superseded edition without deleting its chunks or vectors. Undo by
 * setting "active". Returns the previous value.
 */
export const setDocumentLifecycleStatus = internalMutation({
  args: {
    documentId: v.id("documents"),
    lifecycleStatus: v.union(
      v.literal("active"),
      v.literal("superseded"),
      v.literal("withdrawn"),
      v.literal("explicitly_stale"),
      v.literal("quarantined"),
      v.literal("deleted"),
    ),
    // Guards against flagging the wrong id: the call fails unless the document URL ends with this.
    expectUrlSuffix: v.string(),
  },
  returns: v.object({ url: v.string(), previous: v.union(v.string(), v.null()) }),
  handler: async (ctx, args) => {
    const doc = await ctx.db.get(args.documentId);
    if (!doc) throw new Error(`document ${args.documentId} not found`);
    if (!doc.url.endsWith(args.expectUrlSuffix)) {
      throw new Error(`document ${args.documentId} is ${doc.url}, not *${args.expectUrlSuffix}`);
    }
    await ctx.db.patch(args.documentId, { lifecycleStatus: args.lifecycleStatus });
    return { url: doc.url, previous: doc.lifecycleStatus ?? null };
  },
});
