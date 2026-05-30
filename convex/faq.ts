import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const addFaq = mutation({
  args: {
    question: v.string(),
    answer: v.string(),
    sourceUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
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
    await ctx.db.delete(args.id);
  },
});

export const listFaqs = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("faqs").order("desc").collect();
  },
});

export const searchFaqs = query({
  args: { query: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("faqs")
      .withSearchIndex("search_question", (q) => q.search("question", args.query))
      .take(3);
  },
});
