import { v } from "convex/values";
import { internal } from "../_generated/api";
import { internalAction } from "../_generated/server";

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)] ?? 0;
}

export const aggregateMetrics = internalAction({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const start = Date.now();

    const settings = await ctx.runQuery(internal.observability.internal.getSettingsBySection, {
      section: "observability",
    });

    const settingsMap = new Map<string, unknown>();
    for (const s of settings) {
      settingsMap.set(s.key, s.value);
    }

    const queriesTotal = (settingsMap.get("observability_queries_total") as number) ?? 0;
    const cacheHits = (settingsMap.get("observability_cache_hits_total") as number) ?? 0;
    const cacheMisses = (settingsMap.get("observability_cache_misses_total") as number) ?? 0;
    const errorsTotal = (settingsMap.get("observability_errors_total") as number) ?? 0;
    const embeddingsTotal = (settingsMap.get("observability_embeddings_total") as number) ?? 0;

    const latencySamplesRaw = settingsMap.get("observability_latency_samples");
    let p50 = 0;
    let p95 = 0;
    let p99 = 0;
    if (typeof latencySamplesRaw === "string") {
      try {
        const samples: number[] = JSON.parse(latencySamplesRaw) as number[];
        const sorted = samples.slice().sort((a, b) => a - b);
        p50 = percentile(sorted, 50);
        p95 = percentile(sorted, 95);
        p99 = percentile(sorted, 99);
      } catch {
        console.warn("[METRICS] Failed to parse latency samples");
      }
    }

    const totalCache = cacheHits + cacheMisses;
    const cacheHitRate = totalCache > 0 ? cacheHits / totalCache : 0;

    console.log("[METRICS] Aggregation complete", {
      queriesTotal,
      cacheHits,
      cacheMisses,
      cacheHitRate: cacheHitRate.toFixed(3),
      errorsTotal,
      embeddingsTotal,
      latencyMs: { p50, p95, p99 },
      aggregationDurationMs: Date.now() - start,
    });

    const summary = {
      queriesTotal,
      cacheHitRate: Math.round(cacheHitRate * 1000) / 1000,
      errorsTotal,
      embeddingsTotal,
      latencyMs: { p50, p95, p99 },
      timestamp: Date.now(),
    };

    await ctx.runMutation(internal.observability.metrics.setMetricValue, {
      key: "observability_aggregated_summary",
      value: JSON.stringify(summary),
    });

    await ctx.runMutation(internal.observability.metrics.setMetricValue, {
      key: "observability_aggregated_at",
      value: Date.now(),
    });

    await ctx.runMutation(internal.observability.internal.insertAuditLog, {
      action: "metrics.summary",
      details: { reason: JSON.stringify(summary) },
    });

    const errorRate = queriesTotal > 0 ? errorsTotal / queriesTotal : 0;
    if (errorRate > 0.1) {
      console.error("[METRICS] High error rate detected", {
        errorRate: errorRate.toFixed(3),
        errorsTotal,
        queriesTotal,
      });

      await ctx.runMutation(internal.observability.internal.insertAuditLog, {
        action: "metrics.errors",
        details: {
          reason: `High error rate: ${(errorRate * 100).toFixed(1)}% (${errorsTotal}/${queriesTotal})`,
        },
      });
    }

    if (cacheHitRate < 0.3 && totalCache > 10) {
      console.warn("[METRICS] Low cache hit rate", {
        cacheHitRate: cacheHitRate.toFixed(3),
        cacheHits,
        cacheMisses,
      });

      await ctx.runMutation(internal.observability.internal.insertAuditLog, {
        action: "metrics.performance",
        details: {
          reason: `Low cache hit rate: ${(cacheHitRate * 100).toFixed(1)}%`,
        },
      });
    }
  },
});
