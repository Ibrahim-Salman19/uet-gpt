import { v } from "convex/values";
import { internal } from "../_generated/api";
import { internalAction } from "../_generated/server";

export const checkStaleness = internalAction({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const start = Date.now();
    console.log("[STALENESS] Starting staleness check");

    const counts = await ctx.runQuery(internal.observability.internal.getStaleAndTotalCount, {
      now: Date.now(),
    });
    const totalDocs = counts.total;
    const staleCount = counts.stale;

    const stalePercentage = totalDocs > 0 ? (staleCount / totalDocs) * 100 : 0;

    console.log("[STALENESS] Check complete", {
      totalDocuments: totalDocs,
      staleDocuments: staleCount,
      stalePercentage: stalePercentage.toFixed(1) + "%",
      durationMs: Date.now() - start,
    });

    if (stalePercentage > 10) {
      console.warn("[STALENESS] High stale document ratio", {
        stalePercentage: stalePercentage.toFixed(1) + "%",
        staleCount,
        totalDocs,
      });

      await ctx.runMutation(internal.observability.internal.insertAuditLog, {
        action: "staleness.check",
        details: {
          reason: `High stale document ratio: ${stalePercentage.toFixed(1)}% (${staleCount}/${totalDocs})`,
        },
      });
    } else {
      await ctx.runMutation(internal.observability.internal.insertAuditLog, {
        action: "staleness.check",
        details: {
          reason: `Stale documents: ${staleCount}/${totalDocs} (${stalePercentage.toFixed(1)}%)`,
        },
      });
    }

    await ctx.runMutation(internal.observability.metrics.setMetricValue, {
      key: "observability_staleness_summary",
      value: JSON.stringify({
        totalDocuments: totalDocs,
        staleDocuments: staleCount,
        stalePercentage: Math.round(stalePercentage * 10) / 10,
        checkedAt: Date.now(),
      }),
    });
  },
});
