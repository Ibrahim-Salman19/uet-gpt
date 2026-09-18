import { v } from "convex/values";
import { internalMutation, internalQuery, mutation, query } from "./_generated/server";
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
  args: { now: v.number() },
  handler: async (ctx, args) => {
    const faqs = await ctx.db.query("faqs").order("desc").take(100);
    return faqs.filter((faq) => faq.expiresAt === undefined || faq.expiresAt > args.now);
  },
});

/**
 * Candidate pool handed to the FAQ gate, not the number of FAQs that reach an answer.
 *
 * The search index matches raw terms and does not stem, but the gate that decides which
 * FAQ is relevant (shared/faqMatch.ts: faqCoverage) does. So a student asking to "freeze"
 * a semester does not rank the "How to get freezing of a Semester?" entry, even though the
 * gate would score it 0.67. Measured against production on 2026-09-18: at take(8) that
 * question returned eight unrelated admissions FAQs and not the freezing one, while asking
 * about "freezing" returned it first. Take a pool wide enough that the stemming gate is
 * what selects, then embeddings/search.ts keeps only its best 2 matches.
 */
const FAQ_CANDIDATE_POOL = 50;

export const searchFaqs = internalQuery({
  args: { query: v.string(), now: v.number() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("faqs")
      .withSearchIndex("search_question", (q) => q.search("question", args.query))
      .filter((q) =>
        q.or(q.eq(q.field("expiresAt"), undefined), q.gt(q.field("expiresAt"), args.now)),
      )
      .take(FAQ_CANDIDATE_POOL);
  },
});

/**
 * Replace the FAQ entries that came from one official page (embeddings/search.ts merges
 * matching FAQs into retrieval). Loaded from scripts/faq/official-faqs.json by
 * scripts/faq/load_official_faqs.cjs, so re-running the loader refreshes rather than
 * duplicates. Batched per source page to stay inside one mutation transaction.
 */
export const replaceFaqsForSource = internalMutation({
  args: {
    sourceUrl: v.string(),
    entries: v.array(v.object({ question: v.string(), answer: v.string() })),
  },
  returns: v.object({ removed: v.number(), inserted: v.number() }),
  handler: async (ctx, args) => {
    const existing = await ctx.db.query("faqs").take(200);
    let removed = 0;
    for (const faq of existing) {
      if (faq.sourceUrl === args.sourceUrl) {
        await ctx.db.delete(faq._id);
        removed++;
      }
    }
    const now = Date.now();
    for (const entry of args.entries) {
      await ctx.db.insert("faqs", {
        question: entry.question,
        answer: entry.answer,
        sourceUrl: args.sourceUrl,
        createdAt: now,
      });
    }
    return { removed, inserted: args.entries.length };
  },
});
