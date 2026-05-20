import { v } from "convex/values";
import { query } from "../_generated/server";

export const search = query({
  args: {
    query: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 10;
    const docs = await ctx.db.query("documents").take(limit);
    const q = (args.query as string).toLowerCase();
    return docs.filter((d: Record<string, unknown>) => {
      const title = typeof d.title === "string" ? d.title.toLowerCase() : "";
      const content = typeof d.content === "string" ? d.content.toLowerCase() : "";
      return title.includes(q) || content.includes(q);
    });
  },
});
