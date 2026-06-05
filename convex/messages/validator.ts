import { v } from "convex/values";

export const sourcesValidator = v.optional(
  v.array(
    v.object({
      documentId: v.optional(v.string()),
      chunkId: v.optional(v.string()),
      entryId: v.optional(v.string()),
      url: v.string(),
      title: v.string(),
      relevanceScore: v.number(),
      excerpt: v.string(),
      headingPath: v.optional(v.array(v.string())),
    }),
  ),
);

export const tokenCountValidator = v.optional(
  v.object({
    prompt: v.number(),
    completion: v.number(),
    total: v.number(),
  }),
);

export const messageValidator = v.object({
  _id: v.id("messages"),
  _creationTime: v.number(),
  threadId: v.id("threads"),
  role: v.union(v.literal("user"), v.literal("assistant")),
  content: v.string(),
  sources: sourcesValidator,
  tokenCount: tokenCountValidator,
  createdAt: v.number(),
});

export type MessageValidator = typeof messageValidator.type;
