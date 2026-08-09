import { v } from "convex/values";
import { mutation } from "../_generated/server";
import type { ReasonCode } from "../agent/policy";

export const logOperationalEvent = mutation({
  args: {
    event: v.string(),
    reason: v.string(),
    queryRisk: v.optional(v.string()),
    eligibleSources: v.optional(v.number()),
    freshPrimarySources: v.optional(v.number()),
    agedSources: v.optional(v.number()),
    unknownFreshnessSources: v.optional(v.number()),
    metadataJson: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("traceSpans", {
      traceId: `evt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      spanId: `span_${Date.now()}`,
      name: args.event,
      reasonCode: args.reason as ReasonCode,
      startTime: Date.now(),
      endTime: Date.now(),
      durationMs: 0,
      status: args.reason.includes("ERROR") || args.reason.includes("FAILED") ? "error" : "ok",
      attributesJson: JSON.stringify({
        queryRisk: args.queryRisk,
        eligibleSources: args.eligibleSources,
        freshPrimarySources: args.freshPrimarySources,
        agedSources: args.agedSources,
        unknownFreshnessSources: args.unknownFreshnessSources,
        metadata: args.metadataJson ? JSON.parse(args.metadataJson) : undefined,
      }),
    });
  },
});
