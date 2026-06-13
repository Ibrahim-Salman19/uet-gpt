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
    const cursor = args.cursor;

    if (status && category) {
      const results: (typeof documentValidator.type)[] = [];
      let currentCursor = cursor ?? null;
      while (results.length < limit) {
        const page = await ctx.db
          .query("documents")
          .withIndex("by_status", (q) => q.eq("status", status))
          .paginate({ numItems: limit, cursor: currentCursor });

        for (const doc of page.page) {
          if (doc.category === category) {
            results.push(doc as typeof documentValidator.type);
            if (results.length >= limit) break;
          }
        }
        if (page.isDone) break;
        currentCursor = page.continueCursor;
      }
      return results;
    }

    if (status) {
      const page = await ctx.db
        .query("documents")
        .withIndex("by_status", (q) => q.eq("status", status))
        .paginate({ numItems: limit, cursor: cursor ?? null });
      return page.page as (typeof documentValidator.type)[];
    }

    if (category) {
      const page = await ctx.db
        .query("documents")
        .withIndex("by_category", (q) => q.eq("category", category))
        .paginate({ numItems: limit, cursor: cursor ?? null });
      return page.page as (typeof documentValidator.type)[];
    }

    const page = await ctx.db.query("documents").paginate({ numItems: limit, cursor: cursor ?? null });
    return page.page as (typeof documentValidator.type)[];
  },
});
