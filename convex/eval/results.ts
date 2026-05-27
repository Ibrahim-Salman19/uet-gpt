import { v } from "convex/values";
import { query } from "../_generated/server";

export const results = query({
  args: { evalId: v.string() },
  returns: v.object({
    evalId: v.string(),
    status: v.string(),
    score: v.number(),
    details: v.object({}),
  }),
  handler: async (_ctx, args) => {
    return {
      evalId: args.evalId,
      status: "completed",
      score: 0,
      details: {},
    };
  },
});
