import { v } from "convex/values";
import { mutation, query } from "../_generated/server";

export const registerAgentRelease = mutation({
  args: {
    releaseId: v.string(),
    gitCommit: v.string(),
    promptVersion: v.string(),
    modelRegistryVersion: v.string(),
    retrievalPolicyVersion: v.string(),
    freshnessPolicyVersion: v.string(),
    evidencePolicyVersion: v.string(),
    evaluationSuiteVersion: v.string(),
    corpusGeneration: v.string(),
    offlineEvaluationResult: v.string(),
    previewEvaluationResult: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("agentReleases", {
      ...args,
      status: "candidate",
      createdAt: Date.now(),
    });
  },
});

export const promoteReleaseStatus = mutation({
  args: {
    releaseId: v.string(),
    targetStatus: v.union(
      v.literal("candidate"),
      v.literal("preview"),
      v.literal("canary"),
      v.literal("production"),
      v.literal("rolled_back"),
      v.literal("retired"),
    ),
    approvedBy: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const release = await ctx.db
      .query("agentReleases")
      .withIndex("by_releaseId", (q) => q.eq("releaseId", args.releaseId))
      .first();

    if (!release) {
      throw new Error(`Release ID ${args.releaseId} not found.`);
    }

    await ctx.db.patch(release._id, {
      status: args.targetStatus,
      approvedBy: args.approvedBy,
      approvedAt: Date.now(),
    });

    return { releaseId: args.releaseId, newStatus: args.targetStatus };
  },
});

export const getActiveProductionRelease = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("agentReleases")
      .withIndex("by_status", (q) => q.eq("status", "production"))
      .first();
  },
});
