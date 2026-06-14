import { v } from "convex/values";
import type { Id } from "../_generated/dataModel";
import { internalMutation } from "../_generated/server";

function safeGetHostname(urlStr: string): string {
  try {
    return new URL(urlStr).hostname;
  } catch {
    return "unknown";
  }
}

function classifyDocument(url: string, title: string): "faculty" | "staff" | "admin" | null {
  const FACULTY_PATTERNS = ["faculty", "professor", "dr.", "prof."];
  const STAFF_PATTERNS = ["staff"];
  const ADMIN_PATTERNS = ["admin", "head", "registrar", "chancellor"];
  const text = `${url} ${title}`.toLowerCase();
  if (FACULTY_PATTERNS.some((p) => text.includes(p))) return "faculty";
  if (STAFF_PATTERNS.some((p) => text.includes(p))) return "staff";
  if (ADMIN_PATTERNS.some((p) => text.includes(p))) return "admin";
  return null;
}

function buildDocumentFields(args: {
  url: string;
  title: string;
  source?: string;
  category?: string;
  entryId?: string;
  contentHash?: string;
  subcategory?: string;
  metadata?: unknown;
  chunkCount?: number;
  status: "pending";
  crawledAt: number;
  updatedAt: number;
}): Record<string, unknown> {
  return {
    url: args.url,
    title: args.title,
    source: args.source ?? safeGetHostname(args.url),
    category: args.category ?? "general",
    ...(args.entryId !== undefined && { entryId: args.entryId }),
    ...(args.contentHash !== undefined && { contentHash: args.contentHash }),
    ...(args.subcategory !== undefined && { subcategory: args.subcategory }),
    ...(args.metadata !== undefined && { metadata: args.metadata }),
    ...(args.chunkCount !== undefined && { chunkCount: args.chunkCount }),
    status: args.status,
    crawledAt: args.crawledAt,
    updatedAt: args.updatedAt,
    personType: classifyDocument(args.url, args.title) ?? undefined,
  };
}

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
    const documentId = await ctx.db.insert(
      "documents",
      buildDocumentFields({
        url: args.url,
        title: args.title,
        source: args.source,
        category: args.category,
        entryId: args.entryId,
        contentHash: args.contentHash,
        subcategory: args.subcategory,
        metadata: args.metadata,
        chunkCount: args.chunkCount,
        status: "pending",
        crawledAt: now,
        updatedAt: now,
      }) as any,
    );
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
      v.literal("active"),
      v.literal("pending_embed"),
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
