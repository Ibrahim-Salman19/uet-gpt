import { v } from "convex/values";
import { query } from "../_generated/server";
import { requireAuth } from "../auth";
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
    await requireAuth(ctx);
    const limit = Math.min(args.limit ?? 50, 100);
    const status = args.status;
    const category = args.category;

    if (status) {
      return (await ctx.db
        .query("documents")
        .withIndex("by_status", (q) => q.eq("status", status))
        .take(limit)) as (typeof documentValidator.type)[];
    }

    if (category) {
      return (await ctx.db
        .query("documents")
        .withIndex("by_category", (q) => q.eq("category", category))
        .take(limit)) as (typeof documentValidator.type)[];
    }

    return (await ctx.db.query("documents").take(limit)) as (typeof documentValidator.type)[];
  },
});
