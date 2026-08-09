import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { internalAction } from "../_generated/server";

const BATCH_SIZE = 5;
const DEFAULT_DAILY_LIMIT = 10;
const DELAY_MS = 10_000;

// ── Model-recovery backlog controls ───────────────────────────────────────────
// Track B restores the Gemini contextualization path that has been failing
// since 2026-06-01. The moment it works again, this daily cron would begin
// draining the queued backlog automatically — potentially exhausting the
// remaining Convex bandwidth (~700MB/4-day envelope, see plan §5). These two
// env-gated controls make that behavior EXPLICIT and bounded:
//
//   AUTO_BACKFILL_AFTER_MODEL_RECOVERY (default "true" — historical behavior):
//     "false" → the cron becomes a no-op: it logs and returns WITHOUT querying
//     or scheduling anything. The gate is at the entry point, so the scheduler
//     cannot bypass it. Set to "false" until a measured 5–10 doc pilot has
//     extrapolated real DB I/O post-monthly-reset.
//
//   MAX_DOCUMENTS_PER_RECOVERY_BATCH (default = DEFAULT_DAILY_LIMIT):
//     When backfill IS allowed, caps how many chunks a single cron run will
//     pull. Clamp to [1, DEFAULT_DAILY_LIMIT] so a misconfiguration cannot
//     widen the blast radius beyond the historical ceiling.
//
// Both are read here (not in a shared module) so the control is colocated with
// the only scheduling site — there is no other code path that fans out
// contextualizeChunks batches, so this gate cannot be routed around.
function readRecoveryControls(): { allowBackfill: boolean; dailyLimit: number } {
  const raw = process.env.AUTO_BACKFILL_AFTER_MODEL_RECOVERY;
  // Treat the var as opt-OUT: any value other than the literal "false" preserves
  // the original behavior, so merely setting the env name without a value cannot
  // accidentally suppress ingestion.
  const allowBackfill = raw?.toLowerCase() !== "false";

  const capRaw = Number.parseInt(process.env.MAX_DOCUMENTS_PER_RECOVERY_BATCH ?? "", 10);
  const dailyLimit =
    Number.isFinite(capRaw) && capRaw >= 1
      ? Math.min(capRaw, DEFAULT_DAILY_LIMIT)
      : DEFAULT_DAILY_LIMIT;

  return { allowBackfill, dailyLimit };
}

export const contextualizeCron = internalAction({
  args: {},
  handler: async (ctx) => {
    const { allowBackfill, dailyLimit } = readRecoveryControls();

    if (!allowBackfill) {
      console.log(
        "Contextualize cron: SKIPPED — AUTO_BACKFILL_AFTER_MODEL_RECOVERY=false " +
          "(Track B model-recovery backlog hold). No query, no scheduling.",
      );
      return { processed: 0, scheduledBatches: 0, totalPending: 0, backfillHeld: true };
    }

    const pendingChunkIds = (await ctx.runQuery(
      internal.embeddings.contextualize.getChunksPendingContext,
      { limit: dailyLimit },
    )) as Id<"crawledChunks">[];

    if (pendingChunkIds.length === 0) {
      console.log("Contextualize cron: no pending chunks found");
      return { processed: 0, totalPending: 0 };
    }

    // Fan out: schedule each batch via the scheduler instead of holding this
    // action open on wall-clock sleeps. The cron body returns immediately and
    // batches are spaced by DELAY_MS. Each scheduled contextualizeChunks run
    // self-reports its progress, so no aggregation is needed here.
    let scheduledBatches = 0;
    for (let i = 0; i < pendingChunkIds.length; i += BATCH_SIZE) {
      const batch = pendingChunkIds.slice(i, i + BATCH_SIZE);
      await ctx.scheduler.runAfter(
        scheduledBatches * DELAY_MS,
        internal.embeddings.contextualize.contextualizeChunks,
        { chunkIds: batch },
      );
      scheduledBatches++;
    }

    console.log(
      `Contextualize cron: scheduled ${scheduledBatches} batch(es) for ` +
        `${pendingChunkIds.length} pending chunks`,
    );

    return {
      processed: 0,
      scheduledBatches,
      totalPending: pendingChunkIds.length,
      backfillHeld: false,
      dailyLimit,
    };
  },
});
