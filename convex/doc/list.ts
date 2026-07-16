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
        v.literal("active"),
        v.literal("pending_embed"),
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
    const offset = Math.min(args.cursor ? Number.parseInt(args.cursor, 10) : 0, 1000);

    let baseQuery;
    if (status && category) {
      // Compound index: status + category - most selective
      baseQuery = ctx.db
        .query("documents")
        .withIndex("by_status_and_category", (q) =>
          q.eq("status", status).eq("category", category),
        );
    } else if (status) {
      baseQuery = ctx.db.query("documents").withIndex("by_status", (q) => q.eq("status", status));
    } else if (category) {
      baseQuery = ctx.db
        .query("documents")
        .withIndex("by_category", (q) => q.eq("category", category));
    } else {
      baseQuery = ctx.db.query("documents");
    }

    const maxToTake = Math.min(offset + limit, 1100);
    const results = await baseQuery.take(maxToTake);

    const page = results.slice(offset);
    return page;
  },
});
