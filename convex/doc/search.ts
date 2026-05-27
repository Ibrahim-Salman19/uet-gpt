import { v } from "convex/values";
import { query } from "../_generated/server";
import { documentValidator } from "./validator";

export const search = query({
  args: {
    query: v.string(),
    limit: v.optional(v.number()),
    category: v.optional(v.string()),
  },
  returns: v.array(documentValidator),
  handler: async (ctx, args) => {
    const limit = args.limit ?? 10;
    const q = args.query.toLowerCase();
    const category = args.category;

    const results = (await ctx.db
      .query("documents")
      .withSearchIndex("search_title", (searchQ) => searchQ.search("title", q))
      .take(limit)) as unknown as (typeof documentValidator.type)[];

    if (category) {
      return results.filter((r) => r.category === category);
    }

    return results;
  },
});
