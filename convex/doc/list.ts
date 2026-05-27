import { v } from "convex/values";
import { query } from "../_generated/server";
import { documentValidator } from "./validator";

export const list = query({
  args: {
    limit: v.optional(v.number()),
    cursor: v.optional(v.string()),
    status: v.optional(
      v.union(
        v.literal("pending"),
        v.literal("processing"),
        v.literal("indexed"),
        v.literal("failed"),
        v.literal("stale"),
      ),
    ),
    category: v.optional(v.string()),
  },
  returns: v.array(documentValidator),
  handler: async (ctx, args) => {
    const limit = args.limit ?? 50;
    const status = args.status;
    const category = args.category;

    if (status) {
      return (await ctx.db
        .query("documents")
        .withIndex("by_status", (q) => q.eq("status", status))
        .take(limit)) as unknown as (typeof documentValidator.type)[];
    }

    if (category) {
      return (await ctx.db
        .query("documents")
        .withIndex("by_category", (q) => q.eq("category", category))
        .take(limit)) as unknown as (typeof documentValidator.type)[];
    }

    return (await ctx.db
      .query("documents")
      .take(limit)) as unknown as (typeof documentValidator.type)[];
  },
});
