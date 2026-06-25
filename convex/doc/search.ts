import { v } from "convex/values";
import { query } from "../_generated/server";
import { requireAuth } from "../auth";
import { documentValidator } from "./validator";

export const search = query({
  args: {
    query: v.string(),
    limit: v.optional(v.number()),
    category: v.optional(v.string()),
  },
  returns: v.array(documentValidator),
  handler: async (ctx, args) => {
    await requireAuth(ctx);
    const limit = Math.min(args.limit ?? 10, 50);
    const q = args.query.toLowerCase();
    const category = args.category;

    const results = await ctx.db
      .query("documents")
      .withSearchIndex("search_title", (searchQ) => searchQ.search("title", q))
      .take(limit);

    // Client-side filter is required here because Convex search indexes
    // only support .search() calls, not combined .eq() filters. The
    // alternative would be a full-text search + post-filter, which is
    // what we do here. At typical doc volumes this is fast since the
    // search index already limits results to `limit` items.
    if (category) {
      return results.filter((r) => r.category === category);
    }

    return results;
  },
});
