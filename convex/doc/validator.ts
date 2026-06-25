import { v } from "convex/values";

export const documentValidator = v.object({
  _id: v.id("documents"),
  _creationTime: v.number(),
  url: v.string(),
  title: v.string(),
  entryId: v.optional(v.string()),
  contentHash: v.optional(v.string()),
  source: v.string(),
  category: v.string(),
  subcategory: v.optional(v.string()),
  metadata: v.optional(
    v.object({
      lastModified: v.optional(v.string()),
      author: v.optional(v.string()),
      wordCount: v.optional(v.number()),
      language: v.optional(v.string()),
      etag: v.optional(v.string()),
      sourceType: v.optional(v.string()),
    }),
  ),
  status: v.union(
    v.literal("pending"),
    v.literal("processing"),
    v.literal("indexed"),
    v.literal("failed"),
    v.literal("stale"),
    v.literal("active"),
    v.literal("pending_embed"),
  ),
  chunkCount: v.optional(v.number()),
  chunksEmbedded: v.optional(v.number()),
  crawlSessionId: v.optional(v.string()),
  personType: v.optional(v.union(v.literal("faculty"), v.literal("staff"), v.literal("admin"))),
  freshnessTier: v.optional(v.union(v.literal("high"), v.literal("medium"), v.literal("low"))),
  isStale: v.optional(v.boolean()),
  crawledAt: v.number(),
  updatedAt: v.number(),
  error: v.optional(v.string()),
});

export type DocumentValidator = typeof documentValidator.type;
