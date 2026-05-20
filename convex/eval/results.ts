import { v } from "convex/values";
import { query } from "../_generated/server";

export const results = query({
  args: { evalId: v.string() },
  handler: async (_ctx, args) => {
    return {
      evalId: args.evalId,
      status: "completed",
      score: 0,
      details: {},
    };
  },
});
