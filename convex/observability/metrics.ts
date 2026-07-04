import { v } from "convex/values";
import { internalMutation } from "../_generated/server";

const MAX_QUERY_PREVIEW = 20;
const MAX_ID_PREVIEW = 8;

export function truncateQuery(text: string): string {
  if (text.length <= MAX_QUERY_PREVIEW) return text;
  return text.slice(0, MAX_QUERY_PREVIEW) + "...";
}

export function truncateEntityId(id: string): string {
  if (id.length <= MAX_ID_PREVIEW) return id;
  return id.slice(0, MAX_ID_PREVIEW) + "...";
}

export function recordTiming(): { end: () => number; lap: (label: string) => number } {
  const start = Date.now();
  const marks = new Map<string, number>();
  return {
    end: () => Date.now() - start,
    lap: (label: string) => {
      const elapsed = Date.now() - start;
      marks.set(label, elapsed);
      return elapsed;
    },
  };
}

export const incrementCounter = internalMutation({
  args: { key: v.string(), incrementBy: v.number() },
  returns: v.number(),
  handler: async (ctx, args) => {
    // NOTE: This is a read-then-write without an idempotency key, which
    // risks lost updates under concurrent calls. This is acceptable here
    // because counters are observational — approximate values are fine and
    // the cost of adding a transactional lock outweighs the precision gain.
    const existing = await ctx.db
      .query("appSettings")
      .withIndex("by_key", (q) => q.eq("key", args.key))
      .first();

    let newValue = args.incrementBy;
    if (existing) {
      const current = typeof existing.value === "number" ? existing.value : 0;
      newValue = current + args.incrementBy;
      await ctx.db.patch(existing._id, { value: newValue, updatedAt: Date.now() });
    } else {
      await ctx.db.insert("appSettings", {
        key: args.key,
        value: newValue,
        section: "observability",
        updatedAt: Date.now(),
      });
    }
    return newValue;
  },
});

export const setMetricValue = internalMutation({
  args: { key: v.string(), value: v.union(v.string(), v.number(), v.boolean()) },
  returns: v.null(),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("appSettings")
      .withIndex("by_key", (q) => q.eq("key", args.key))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, { value: args.value, updatedAt: Date.now() });
    } else {
      await ctx.db.insert("appSettings", {
        key: args.key,
        value: args.value,
        section: "observability",
        updatedAt: Date.now(),
      });
    }
  },
});

export const getMetricValue = internalMutation({
  args: { key: v.string() },
  returns: v.union(v.string(), v.number(), v.boolean(), v.null()),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("appSettings")
      .withIndex("by_key", (q) => q.eq("key", args.key))
      .first();
    if (!existing) return null;
    return existing.value;
  },
});

export const recordLatencySample = internalMutation({
  args: { latencyMs: v.number() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("appSettings")
      .withIndex("by_key", (q) => q.eq("key", "observability_latency_samples"))
      .first();

    let samples: number[] = [];
    if (existing && typeof existing.value === "string") {
      try {
        samples = JSON.parse(existing.value) as number[];
      } catch {
        samples = [];
      }
    }

    samples.push(args.latencyMs);
    const maxSamples = 500;
    if (samples.length > maxSamples) {
      samples = samples.slice(samples.length - maxSamples);
    }

    const serialized = JSON.stringify(samples);
    if (existing) {
      await ctx.db.patch(existing._id, { value: serialized, updatedAt: Date.now() });
    } else {
      await ctx.db.insert("appSettings", {
        key: "observability_latency_samples",
        value: serialized,
        section: "observability",
        updatedAt: Date.now(),
      });
    }
  },
});
