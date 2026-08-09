import { v } from "convex/values";
import { mutation, query } from "../_generated/server";

export const EVALUATION_CATEGORIES = [
  "current_admissions",
  "fees",
  "merit_and_eligibility",
  "entry_tests",
  "examination_date_sheets",
  "programs_and_departments",
  "faculty_and_contacts",
  "campus_general",
  "historical_questions",
  "english",
  "urdu",
  "roman_urdu",
  "pdf_table_cases",
  "stale_and_conflict_cases",
  "unanswerable_off_topic",
  "security_adversarial",
  "provider_cache_failures",
] as const;

export const createEvaluationSuite = mutation({
  args: {
    suiteId: v.string(),
    version: v.string(),
    sourceSnapshot: v.string(),
    questionCount: v.number(),
    owner: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("evaluationSuites", {
      ...args,
      status: "draft",
      createdAt: Date.now(),
    });
  },
});

export const getEvaluationSuites = query({
  args: {
    status: v.optional(
      v.union(
        v.literal("draft"),
        v.literal("reviewed"),
        v.literal("release_candidate"),
        v.literal("production"),
      ),
    ),
  },
  handler: async (ctx, args) => {
    if (args.status) {
      return await ctx.db
        .query("evaluationSuites")
        .withIndex("by_status", (q) => q.eq("status", args.status!))
        .collect();
    }
    return await ctx.db.query("evaluationSuites").collect();
  },
});
