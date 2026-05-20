import { v } from "convex/values";
import { action } from "../_generated/server";

export const run = action({
  args: {
    datasetId: v.string(),
    metric: v.optional(v.string()),
  },
  handler: async (_ctx, args) => {
    return {
      id: crypto.randomUUID(),
      status: "pending",
      datasetId: args.datasetId,
      metric: args.metric ?? "accuracy",
    };
  },
});
