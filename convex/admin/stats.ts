import { query } from "../_generated/server";

export const stats = query({
  args: {},
  handler: async (ctx) => {
    const documents = await ctx.db.query("documents").collect();
    const feedback = await ctx.db.query("feedback").collect();
    const threads = await ctx.db.query("threads").collect();
    return {
      totalDocuments: documents.length,
      totalFeedback: feedback.length,
      totalThreads: threads.length,
    };
  },
});
