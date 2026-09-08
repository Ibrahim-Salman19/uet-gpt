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

    const settingsList = await ctx.runQuery(internal.observability.internal.getSettingsBySection, {
      section: "observability",
    });
    const sweepRaw = (settingsList as Array<{ key: string; value: any }>).find((s) => s.key === "observability_staleness_sweep")?.value;

    let sweepState = {
      lastSweepStartedAt: null as number | null,
      lastSweepCompletedAt: null as number | null,
      sweepComplete: false,
      documentsExamined: 0,
      documentsFlagged: 0,
      documentsCleared: 0,
      cursorRemaining: false,
      errors: 0,
    };

    if (typeof sweepRaw === "string") {
      try {
        const parsed = JSON.parse(sweepRaw);
        sweepState = {
          lastSweepStartedAt: parsed.lastSweepStartedAt ?? null,
          lastSweepCompletedAt: parsed.lastSweepCompletedAt ?? null,
          sweepComplete: parsed.sweepComplete ?? false,
          documentsExamined: parsed.documentsExamined ?? 0,
          documentsFlagged: parsed.documentsFlagged ?? 0,
          documentsCleared: parsed.documentsCleared ?? 0,
          cursorRemaining: parsed.cursorRemaining ?? false,
          errors: parsed.errors ?? 0,
        };
      } catch {
        console.warn("[STALENESS] Failed to parse sweep metrics setting");
      }
    }

    if (!sweepState.sweepComplete) {
      console.warn("[STALENESS] Observability report generated during PARTIAL sweep", sweepState);
    }

    console.log("[STALENESS] Check complete", {
      totalDocuments: totalDocs,
      staleDocuments: staleCount,
      stalePercentage: stalePercentage.toFixed(1) + "%",
      sweepState,
      durationMs: Date.now() - start,
    });

    const partialText = sweepState.sweepComplete ? "" : " (PARTIAL SWEEP)";
    if (stalePercentage > 10) {
      console.warn("[STALENESS] High stale document ratio", {
        stalePercentage: stalePercentage.toFixed(1) + "%",
        staleCount,
        totalDocs,
      });

      await ctx.runMutation(internal.observability.internal.insertAuditLog, {
        action: "staleness.check",
        details: {
          reason: `High stale document ratio${partialText}: ${stalePercentage.toFixed(1)}% (${staleCount}/${totalDocs})`,
        },
      });
    } else {
      await ctx.runMutation(internal.observability.internal.insertAuditLog, {
        action: "staleness.check",
        details: {
          reason: `Stale documents${partialText}: ${staleCount}/${totalDocs} (${stalePercentage.toFixed(1)}%)`,
        },
      });
    }

    await ctx.runMutation(internal.observability.metrics.setMetricValue, {
      key: "observability_staleness_summary",
      value: JSON.stringify({
        totalDocuments: totalDocs,
        staleDocuments: staleCount,
        stalePercentage: Math.round(stalePercentage * 10) / 10,
        lastSweepStartedAt: sweepState.lastSweepStartedAt,
        lastSweepCompletedAt: sweepState.lastSweepCompletedAt,
        sweepComplete: sweepState.sweepComplete,
        documentsExamined: sweepState.documentsExamined,
        documentsFlagged: sweepState.documentsFlagged,
        documentsCleared: sweepState.documentsCleared,
        cursorRemaining: sweepState.cursorRemaining,
        errors: sweepState.errors,
        checkedAt: Date.now(),
      }),
    });
  },
});
