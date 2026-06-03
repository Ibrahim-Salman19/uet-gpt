import { v } from "convex/values";
import type { Id } from "../_generated/dataModel";
import { internalMutation } from "../_generated/server";

export const create = internalMutation({
  args: {
    url: v.string(),
    title: v.string(),
    entryId: v.optional(v.string()),
    contentHash: v.optional(v.string()),
    source: v.optional(v.string()),
    category: v.optional(v.string()),
    subcategory: v.optional(v.string()),
    metadata: v.optional(
      v.object({
        lastModified: v.optional(v.string()),
        author: v.optional(v.string()),
        wordCount: v.optional(v.number()),
        language: v.optional(v.string()),
      }),
    ),
    chunkCount: v.optional(v.number()),
  },
  returns: v.id("documents"),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("documents")
      .withIndex("by_url", (q) => q.eq("url", args.url))
      .unique();
    if (existing) {
      return existing._id as Id<"documents">;
    }
    const now = Date.now();
    const documentId = await ctx.db.insert("documents", {
      url: args.url,
      title: args.title,
      source: args.source ?? new URL(args.url).hostname,
      category: args.category ?? "general",
      ...(args.entryId !== undefined && { entryId: args.entryId }),
      ...(args.contentHash !== undefined && { contentHash: args.contentHash }),
      ...(args.subcategory !== undefined && { subcategory: args.subcategory }),
      ...(args.metadata !== undefined && { metadata: args.metadata }),
      ...(args.chunkCount !== undefined && { chunkCount: args.chunkCount }),
      status: "pending" as const,
      crawledAt: now,
      updatedAt: now,
    });
    return documentId as Id<"documents">;
  },
});

export const updateStatus = internalMutation({
  args: {
    documentId: v.id("documents"),
    status: v.union(
      v.literal("pending"),
      v.literal("processing"),
      v.literal("indexed"),
      v.literal("failed"),
      v.literal("stale"),
    ),
    entryId: v.optional(v.string()),
    chunkCount: v.optional(v.number()),
    error: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { documentId, status, entryId, chunkCount, error } = args;
    const now = Date.now();
    await ctx.db.patch(documentId, {
      status,
      updatedAt: now,
      ...(entryId !== undefined && { entryId }),
      ...(chunkCount !== undefined && { chunkCount }),
      ...(error !== undefined && { error }),
    });
  },
});
