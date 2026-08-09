import { v } from "convex/values";
import { mutation } from "../_generated/server";

export const recordTraceSpan = mutation({
  args: {
    traceId: v.string(),
    spanId: v.string(),
    parentSpanId: v.optional(v.string()),
    name: v.string(),
    runState: v.optional(v.string()),
    reasonCode: v.optional(v.string()),
    startTime: v.number(),
    endTime: v.optional(v.number()),
    status: v.union(v.literal("ok"), v.literal("error")),
    attributesJson: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const durationMs = args.endTime ? args.endTime - args.startTime : undefined;
    return await ctx.db.insert("traceSpans", {
      ...args,
      durationMs,
    });
  },
});
