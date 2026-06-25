import { v } from "convex/values";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { internalAction } from "../_generated/server";

const BATCH_SIZE = 5;
const DAILY_LIMIT = 10;
const DELAY_MS = 10_000;

export const contextualizeCron = internalAction({
  args: {},
  handler: async (ctx) => {
    const pendingChunkIds = (await ctx.runQuery(
      internal.embeddings.contextualize.getChunksPendingContext,
      { limit: DAILY_LIMIT },
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
    };
  },
});
