import { v } from "convex/values";
import { query } from "../_generated/server";
import { isAdmin } from "../auth";

export const getObservabilityData = query({
  args: { now: v.optional(v.number()) },
  returns: v.object({
    metrics: v.object({
      queriesTotal: v.number(),
      cacheHitsTotal: v.number(),
      cacheMissesTotal: v.number(),
      errorsTotal: v.number(),
      embeddingsTotal: v.number(),
      cacheHitRate: v.number(),
      aggregatedSummary: v.optional(v.string()),
      aggregatedAt: v.optional(v.number()),
    }),
    latency: v.object({
      p50: v.number(),
      p95: v.number(),
      p99: v.number(),
      sampleCount: v.number(),
    }),
    staleness: v.object({
      totalDocuments: v.number(),
      staleDocuments: v.number(),
      stalePercentage: v.number(),
    }),
    errors24h: v.array(
      v.object({
        timestamp: v.number(),
        function_: v.string(),
      }),
    ),
  }),
  handler: async (ctx, args) => {
    const admin = await isAdmin(ctx);
    if (!admin) {
      return {
        metrics: {
          queriesTotal: 0,
          cacheHitsTotal: 0,
          cacheMissesTotal: 0,
          errorsTotal: 0,
          embeddingsTotal: 0,
          cacheHitRate: 0,
        },
        latency: { p50: 0, p95: 0, p99: 0, sampleCount: 0 },
        staleness: { totalDocuments: 0, staleDocuments: 0, stalePercentage: 0 },
        errors24h: [],
      };
    }

    const settings = await ctx.db
      .query("appSettings")
      .withIndex("by_section", (q) => q.eq("section", "observability"))
      .take(200);

    const settingsMap = new Map<string, unknown>();
    for (const s of settings) {
      settingsMap.set(s.key, s.value);
    }

    // appSettings.value is string | number | boolean; narrow to number so a
    // counter accidentally stored as a string cannot produce NaN downstream.
    const asNumber = (key: string): number => {
      const raw = settingsMap.get(key);
      return typeof raw === "number" ? raw : 0;
    };

    const queriesTotal = asNumber("observability_queries_total");
    const cacheHits = asNumber("observability_cache_hits_total");
    const cacheMisses = asNumber("observability_cache_misses_total");
    const errorsTotal = asNumber("observability_errors_total");
    const embeddingsTotal = asNumber("observability_embeddings_total");
    const aggregatedSummaryRaw = settingsMap.get("observability_aggregated_summary");
    const aggregatedSummary =
      typeof aggregatedSummaryRaw === "string" ? aggregatedSummaryRaw : undefined;
    const aggregatedAtRaw = settingsMap.get("observability_aggregated_at");
    const aggregatedAt = typeof aggregatedAtRaw === "number" ? aggregatedAtRaw : undefined;
    const stalenessRaw = settingsMap.get("observability_staleness_summary") as string | undefined;

    const totalCache = cacheHits + cacheMisses;
    const cacheHitRate = totalCache > 0 ? cacheHits / totalCache : 0;

    const latencySamplesRaw = settingsMap.get("observability_latency_samples");
    let p50 = 0;
    let p95 = 0;
    let p99 = 0;
    let sampleCount = 0;
    if (typeof latencySamplesRaw === "string") {
      try {
        const samples: number[] = JSON.parse(latencySamplesRaw) as number[];
        sampleCount = samples.length;
        if (sampleCount > 0) {
          const sorted = samples.slice().sort((a, b) => a - b);
          const idx50 = Math.ceil(0.5 * sorted.length) - 1;
          const idx95 = Math.ceil(0.95 * sorted.length) - 1;
          const idx99 = Math.ceil(0.99 * sorted.length) - 1;
          p50 = sorted[Math.max(0, idx50)] ?? 0;
          p95 = sorted[Math.max(0, idx95)] ?? 0;
          p99 = sorted[Math.max(0, idx99)] ?? 0;
        }
      } catch {
        console.warn("[DASHBOARD] Failed to parse latency samples");
      }
    }

    let stalenessSummary = { totalDocuments: 0, staleDocuments: 0, stalePercentage: 0 };
    if (typeof stalenessRaw === "string") {
      try {
        stalenessSummary = JSON.parse(stalenessRaw) as {
          totalDocuments: number;
          staleDocuments: number;
          stalePercentage: number;
        };
      } catch {
        console.warn("[DASHBOARD] Failed to parse staleness summary");
      }
    }

    const now = args.now ?? Date.now();
    const twentyFourHoursAgo = now - 24 * 60 * 60 * 1000;
    const recentErrors = await ctx.db
      .query("adminAuditLog")
      .withIndex("by_createdAt", (q) => q.gte("createdAt", twentyFourHoursAgo))
      .take(50);

    const errorEntries = recentErrors
      .filter((e) => e.action === "metrics.errors" || e.action === "metrics.summary")
      .map((e) => ({
        timestamp: e.createdAt,
        function_: e.action,
      }));

    return {
      metrics: {
        queriesTotal,
        cacheHitsTotal: cacheHits,
        cacheMissesTotal: cacheMisses,
        errorsTotal,
        embeddingsTotal,
        cacheHitRate: Math.round(cacheHitRate * 1000) / 1000,
        aggregatedSummary: aggregatedSummary ?? undefined,
        aggregatedAt: aggregatedAt ?? undefined,
      },
      latency: { p50, p95, p99, sampleCount },
      staleness: stalenessSummary,
      errors24h: errorEntries,
    };
  },
});
