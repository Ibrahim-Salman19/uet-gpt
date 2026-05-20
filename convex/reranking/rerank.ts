import { v } from "convex/values";
import { action } from "../_generated/server";

export const rerank = action({
  args: {
    query: v.string(),
    documents: v.array(v.object({ text: v.string(), id: v.string() })),
    topK: v.optional(v.number()),
  },
  handler: async (_ctx, args) => {
    const docs = args.documents as Array<{ text: string; id: string }>;
    const topK = (args.topK as number) ?? docs.length;
    return docs.slice(0, topK).map((d: { text: string; id: string }, i: number) => ({
      ...d,
      score: 1 - i / docs.length,
    }));
  },
});
