import { v } from "convex/values";
import { internalQuery, mutation, query } from "./_generated/server";
import { requireAdmin } from "./auth";

export const addFaq = mutation({
  args: {
    question: v.string(),
    answer: v.string(),
    sourceUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    return await ctx.db.insert("faqs", {
      question: args.question,
      answer: args.answer,
      sourceUrl: args.sourceUrl,
      createdAt: Date.now(),
    });
  },
});

export const removeFaq = mutation({
  args: {
    id: v.id("faqs"),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    await ctx.db.delete(args.id);
  },
});

export const listFaqs = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("faqs").order("desc").take(100);
  },
});

export const searchFaqs = internalQuery({
  args: { query: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("faqs")
      .withSearchIndex("search_question", (q) => q.search("question", args.query))
      .take(3);
  },
});
