import { v } from "convex/values";
import { mutation, query } from "../_generated/server";
import { requireAdmin } from "../auth";
import { rag } from "../rag/instance";

const RECONCILIATION_PAGE_SIZE = 200;
const GC_PAGE_SIZE = 200;
// How long an entry must sit UNTRACKED_READY/UNTRACKED_REPLACED before GC
// will consider it provably orphaned rather than merely a normal entry that
// hasn't finished settling yet (onComplete scheduling delay, or an admin
// running GC while a crawl is actively in flight).
const ORPHAN_GRACE_PERIOD_MS = 15 * 60 * 1000;

/**
 * Phase 6.11-6.20 / 6.21A Part 2: bounded, paginated, AUDIT-ONLY
 * cross-reference between crawledChunks (our own ledger of what SHOULD be
 * retrievable) and the RAG component's own entries in the "uet-global"
 * namespace (what ACTUALLY exists there). This tool never deletes or
 * mutates anything, in either direction - the original governing mandate is
 * explicit: dry-run only, no auto-delete, never touch RAG component
 * internal tables directly. Findings are for a human (or a separate,
 * explicitly-approved cleanup action) to act on.
 *
 * One call audits ONE page of RAG entries (bounded by `limit`, default and
 * max RECONCILIATION_PAGE_SIZE) against crawledChunks' by_ragId index. The
 * caller re-invokes with the returned `continueCursor` until `isDone`.
 * Categories:
 *   TRACKED_READY          - a crawledChunks row references this ragId, and
 *                            the RAG entry is "ready" (the healthy case).
 *   TRACKED_PENDING        - referenced, but the RAG entry is still
 *                            "pending" (embedding in flight - expected
 *                            transient state, not itself a problem).
 *   TRACKED_REPLACED_STALE - referenced, but the RAG entry's OWN status is
 *                            "replaced" - our crawledChunks row still points
 *                            at a ragId the RAG component itself superseded.
 *                            Indicates a saveEmbedding write that didn't
 *                            land as expected; worth investigating.
 *   UNTRACKED_READY        - a "ready" RAG entry with NO crawledChunks row
 *                            pointing at it. A leaked/orphaned entry - paid
 *                            storage, never reachable by retrieval.
 *   UNTRACKED_PENDING      - a "pending" entry with no crawledChunks row.
 *                            Usually a normal transient unless persistently
 *                            reported across repeated audits.
 *   UNTRACKED_REPLACED     - a "replaced" entry with no crawledChunks row.
 *                            Expected in small, transient volume: this is
 *                            exactly what saveEmbedding's replacedEntry
 *                            cleanup (rag.deleteAsync) should remove soon
 *                            after being reported here. Persistent, growing
 *                            volume indicates that cleanup path is failing.
 */
export const auditRagReconciliation = query({
  args: {
    cursor: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  returns: v.object({
    counts: v.object({
      TRACKED_READY: v.number(),
      TRACKED_PENDING: v.number(),
      TRACKED_REPLACED_STALE: v.number(),
      UNTRACKED_READY: v.number(),
      UNTRACKED_PENDING: v.number(),
      UNTRACKED_REPLACED: v.number(),
    }),
    entriesAudited: v.number(),
    sampleUntrackedReady: v.array(v.object({ entryId: v.string(), key: v.optional(v.string()) })),
    isDone: v.boolean(),
    continueCursor: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const limit = Math.min(args.limit ?? RECONCILIATION_PAGE_SIZE, RECONCILIATION_PAGE_SIZE);

    const counts = {
      TRACKED_READY: 0,
      TRACKED_PENDING: 0,
      TRACKED_REPLACED_STALE: 0,
      UNTRACKED_READY: 0,
      UNTRACKED_PENDING: 0,
      UNTRACKED_REPLACED: 0,
    };
    const sampleUntrackedReady: { entryId: string; key: string | undefined }[] = [];

    // Read-only namespace lookup (never creates one) - a namespace that
    // doesn't exist yet (nothing has ever been ingested) is a trivially
    // clean audit, not an error.
    const namespace = await rag.getNamespace(ctx, { namespace: "uet-global" });
    if (!namespace) {
      return {
        counts,
        entriesAudited: 0,
        sampleUntrackedReady,
        isDone: true,
        continueCursor: undefined,
      };
    }

    const page = await rag.list(ctx, {
      namespaceId: namespace.namespaceId,
      paginationOpts: { numItems: limit, cursor: args.cursor ?? null },
    });

    for (const entry of page.page) {
      const entryIdStr = entry.entryId as unknown as string;
      const tracked = await ctx.db
        .query("crawledChunks")
        .withIndex("by_ragId", (q) => q.eq("ragId", entryIdStr))
        .first();

      if (tracked) {
        if (entry.status === "ready") counts.TRACKED_READY++;
        else if (entry.status === "pending") counts.TRACKED_PENDING++;
        else counts.TRACKED_REPLACED_STALE++;
      } else if (entry.status === "ready") {
        counts.UNTRACKED_READY++;
        if (sampleUntrackedReady.length < 20) {
          sampleUntrackedReady.push({ entryId: entryIdStr, key: entry.key });
        }
      } else if (entry.status === "pending") {
        counts.UNTRACKED_PENDING++;
      } else {
        counts.UNTRACKED_REPLACED++;
      }
    }

    return {
      counts,
      entriesAudited: page.page.length,
      sampleUntrackedReady,
      isDone: page.isDone,
      continueCursor: page.isDone ? undefined : page.continueCursor,
    };
  },
});

/**
 * Bounded garbage collection, distinct from the audit-only function above
 * (which never deletes anything). Defense in depth behind onRagEntryComplete
 * (crawl/mutations.ts) - which structurally eliminates most orphan windows
 * for entries it manages - for whatever it cannot: unexpected
 * component/runtime failure, historical pre-remediation data, manual data
 * corruption, or a future bug.
 *
 * Deletes ONLY entries satisfying a provable orphan predicate:
 *   - UNTRACKED_READY (no crawledChunks row references it) with an
 *     app-controlled metadata.createdAtMs (set by embedSingleChunk -
 *     rag.list()'s public Entry shape exposes no creation timestamp of its
 *     own) older than ORPHAN_GRACE_PERIOD_MS, AND, as an extra confirmation
 *     rather than a substitute for "untracked", NOT still the current
 *     generation for its identified document (an entry naming a document
 *     still on that exact generation is more likely mid-flight than
 *     orphaned, even past the grace period - skipped defensively either
 *     way); or
 *   - UNTRACKED_REPLACED older than ORPHAN_GRACE_PERIOD_MS (replaced
 *     entries carry their own replacedAt, so no metadata is needed for this
 *     one's age check).
 * A TRACKED_REPLACED_STALE entry (crawledChunks still points at a ragId RAG
 * itself marked "replaced") is NEVER touched by GC - deleting the RAG side
 * without also correcting the crawledChunks pointer would leave a dangling
 * reference, and that correction is a different, riskier operation outside
 * this function's scope; it stays a signal for a human via the audit above.
 * An entry with no createdAtMs at all (legacy, or seeded outside
 * embedSingleChunk's convention, e.g. rag/testing.ts) is never deleted -
 * its age cannot be proven - and is counted in skippedNoAgeInfo instead.
 *
 * Uses ONLY the public rag.list()/rag.deleteAsync() client API - never
 * mutates RAG component internal tables directly. dryRun defaults to true;
 * deletion requires an explicit dryRun: false. Intended for manual/explicit
 * invocation; cron automation is a deliberately separate, later step.
 */
export const gcOrphanedRagEntries = mutation({
  args: {
    cursor: v.optional(v.string()),
    limit: v.optional(v.number()),
    dryRun: v.optional(v.boolean()),
  },
  returns: v.object({
    dryRun: v.boolean(),
    deletedOrWouldDelete: v.array(
      v.object({ entryId: v.string(), key: v.optional(v.string()), reason: v.string() }),
    ),
    skippedNoAgeInfo: v.number(),
    skippedStillCurrentGeneration: v.number(),
    entriesAudited: v.number(),
    isDone: v.boolean(),
    continueCursor: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const dryRun = args.dryRun ?? true;
    const limit = Math.min(args.limit ?? GC_PAGE_SIZE, GC_PAGE_SIZE);
    const now = Date.now();

    const deletedOrWouldDelete: { entryId: string; key: string | undefined; reason: string }[] = [];
    let skippedNoAgeInfo = 0;
    let skippedStillCurrentGeneration = 0;

    const namespace = await rag.getNamespace(ctx, { namespace: "uet-global" });
    if (!namespace) {
      return {
        dryRun,
        deletedOrWouldDelete,
        skippedNoAgeInfo,
        skippedStillCurrentGeneration,
        entriesAudited: 0,
        isDone: true,
        continueCursor: undefined,
      };
    }

    const page = await rag.list(ctx, {
      namespaceId: namespace.namespaceId,
      paginationOpts: { numItems: limit, cursor: args.cursor ?? null },
    });

    for (const entry of page.page) {
      if (entry.status === "pending") continue;
      const entryIdStr = entry.entryId as unknown as string;

      const tracked = await ctx.db
        .query("crawledChunks")
        .withIndex("by_ragId", (q) => q.eq("ragId", entryIdStr))
        .first();
      if (tracked) continue; // TRACKED_* of any status - never GC's concern

      if (entry.status === "replaced") {
        if (now - entry.replacedAt > ORPHAN_GRACE_PERIOD_MS) {
          deletedOrWouldDelete.push({
            entryId: entryIdStr,
            key: entry.key,
            reason: "untracked-replaced-past-grace-period",
          });
          if (!dryRun) await rag.deleteAsync(ctx, { entryId: entry.entryId });
        }
        continue;
      }

      // status === "ready" and untracked from here.
      const metadata = (entry.metadata ?? {}) as {
        documentId?: string;
        ingestionGeneration?: number;
        createdAtMs?: number;
      };
      if (typeof metadata.createdAtMs !== "number") {
        skippedNoAgeInfo++;
        continue;
      }
      if (now - metadata.createdAtMs <= ORPHAN_GRACE_PERIOD_MS) continue;

      if (metadata.documentId && typeof metadata.ingestionGeneration === "number") {
        const doc = await ctx.db.get(metadata.documentId as unknown as import("../_generated/dataModel").Id<"documents">);
        if (doc && doc.ingestionGeneration === metadata.ingestionGeneration) {
          skippedStillCurrentGeneration++;
          continue;
        }
      }

      deletedOrWouldDelete.push({
        entryId: entryIdStr,
        key: entry.key,
        reason: "untracked-ready-past-grace-period",
      });
      if (!dryRun) await rag.deleteAsync(ctx, { entryId: entry.entryId });
    }

    return {
      dryRun,
      deletedOrWouldDelete,
      skippedNoAgeInfo,
      skippedStillCurrentGeneration,
      entriesAudited: page.page.length,
      isDone: page.isDone,
      continueCursor: page.isDone ? undefined : page.continueCursor,
    };
  },
});

/**
 * Bounded GC for the pendingChunkText staging table (see the table's own
 * doc comment in schema.ts and onRagEntryComplete in crawl/mutations.ts).
 * Rows here are deliberately NOT deleted synchronously by any commit path
 * (retry-storm race, Part 15): ragVersionKey is shared by every concurrent
 * attempt at one (position, generation), and RAG's own same-key promotion
 * chain can produce several successive "ready" entries that each
 * independently need the SAME staged row to run their own commit -
 * deleting it after the first one strands every later chain link. This
 * function is therefore the ONLY thing that ever removes these rows, and it
 * only does so once ORPHAN_GRACE_PERIOD_MS has passed since _creationTime -
 * well beyond any realistic window for a legitimate concurrent attempt
 * (Workpool's own retry backoff for this action tops out at a few minutes
 * total; a same-generation promotion chain settles in seconds, not
 * minutes). dryRun defaults to true, matching gcOrphanedRagEntries above.
 */
export const gcOrphanedPendingChunkText = mutation({
  args: {
    cursor: v.optional(v.string()),
    limit: v.optional(v.number()),
    dryRun: v.optional(v.boolean()),
  },
  returns: v.object({
    dryRun: v.boolean(),
    deletedOrWouldDelete: v.number(),
    rowsAudited: v.number(),
    isDone: v.boolean(),
    continueCursor: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const dryRun = args.dryRun ?? true;
    const limit = Math.min(args.limit ?? GC_PAGE_SIZE, GC_PAGE_SIZE);
    const now = Date.now();

    const page = await ctx.db.query("pendingChunkText").paginate({
      numItems: limit,
      cursor: args.cursor ?? null,
    });

    let deletedOrWouldDelete = 0;
    for (const row of page.page) {
      if (now - row._creationTime <= ORPHAN_GRACE_PERIOD_MS) continue;
      deletedOrWouldDelete++;
      if (!dryRun) await ctx.db.delete(row._id);
    }

    return {
      dryRun,
      deletedOrWouldDelete,
      rowsAudited: page.page.length,
      isDone: page.isDone,
      continueCursor: page.isDone ? undefined : page.continueCursor,
    };
  },
});
