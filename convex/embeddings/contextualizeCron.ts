import { v } from "convex/values";
import { internal } from "../_generated/api";
import { internalAction } from "../_generated/server";
import type { Id } from "../_generated/dataModel";

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

    let totalProcessed = 0;
    let totalFailures = 0;

    for (let i = 0; i < pendingChunkIds.length; i += BATCH_SIZE) {
      const batch = pendingChunkIds.slice(i, i + BATCH_SIZE);
      const result = (await ctx.runAction(
        internal.embeddings.contextualize.contextualizeChunks,
        { chunkIds: batch },
      )) as { processed: number; successes: number; failures: number };

      totalProcessed += result.successes ?? 0;
      totalFailures += result.failures ?? 0;

      if (i + BATCH_SIZE < pendingChunkIds.length) {
        await new Promise((resolve) => setTimeout(resolve, DELAY_MS));
      }
    }

    const currentValue = (await ctx.runQuery(
      internal.embeddings.contextualize.getContextualizeProgress,
    )) as number;
    const newValue = currentValue + totalProcessed;

    await ctx.runMutation(internal.embeddings.contextualize.upsertContextualizeProgress, {
      totalProcessed: newValue,
    });

    console.log(
      `Contextualize cron: ${totalProcessed}/${pendingChunkIds.length} chunks ` +
        `(${totalFailures} failures), cumulative: ${newValue}`,
    );

    return {
      processed: totalProcessed,
      failures: totalFailures,
      totalPending: pendingChunkIds.length,
      cumulativeProcessed: newValue,
    };
  },
});
