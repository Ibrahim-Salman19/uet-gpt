import { v } from "convex/values";
import { mutation, query } from "../_generated/server";

export const insertStructuredFact = mutation({
  args: {
    type: v.union(
      v.literal("fee_amount"),
      v.literal("deadline"),
      v.literal("merit_value"),
      v.literal("eligibility_requirement"),
      v.literal("entry_test_date"),
      v.literal("exam_date"),
      v.literal("schedule_time"),
      v.literal("required_document"),
    ),
    subject: v.string(),
    normalizedValue: v.string(),
    unit: v.optional(v.string()),
    session: v.optional(v.string()),
    validFrom: v.optional(v.number()),
    validUntil: v.optional(v.number()),
    sourceVersionId: v.string(),
    authority: v.string(),
    freshnessState: v.union(v.literal("fresh"), v.literal("aged"), v.literal("unknown")),
    applicability: v.union(
      v.literal("current"),
      v.literal("historical"),
      v.literal("session_specific"),
      v.literal("expired"),
      v.literal("unknown"),
    ),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("structuredFacts", {
      ...args,
      createdAt: Date.now(),
    });
  },
});

export const getStructuredFacts = query({
  args: {
    type: v.union(
      v.literal("fee_amount"),
      v.literal("deadline"),
      v.literal("merit_value"),
      v.literal("eligibility_requirement"),
      v.literal("entry_test_date"),
      v.literal("exam_date"),
      v.literal("schedule_time"),
      v.literal("required_document"),
    ),
    subject: v.string(),
    session: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    let facts = await ctx.db
      .query("structuredFacts")
      .withIndex("by_type_and_subject", (q) => q.eq("type", args.type).eq("subject", args.subject))
      .collect();

    if (args.session) {
      facts = facts.filter((f) => !f.session || f.session === args.session);
    }

    return facts;
  },
});
