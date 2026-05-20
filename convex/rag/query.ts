import { v } from "convex/values";
import { action } from "../_generated/server";

export const query = action({
  args: {
    query: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (_ctx, args) => {
    const limit = args.limit ?? 5;
    return {
      results: [] as Array<{ text: string; score: number; source: string }>,
      totalCount: 0,
      limit,
    };
  },
});
