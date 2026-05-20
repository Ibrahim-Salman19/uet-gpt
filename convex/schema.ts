import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    clerkId: v.string(),
    name: v.string(),
    email: v.string(),
    imageUrl: v.optional(v.string()),
    role: v.union(v.literal("user"), v.literal("admin"), v.literal("superadmin")),
    isActive: v.boolean(),
    lastLoginAt: v.optional(v.number()),
    preferences: v.optional(v.object({})),
    metadata: v.optional(v.any()),
  })
    .index("by_clerkId", ["clerkId"])
    .index("by_email", ["email"])
    .index("by_role", ["role"]),

  feedback: defineTable({
    messageId: v.id("messages"),
    userId: v.id("users"),
    rating: v.union(v.literal("thumbsUp"), v.literal("thumbsDown")),
    comment: v.optional(v.string()),
    category: v.optional(
      v.union(
        v.literal("accurate"),
        v.literal("inaccurate"),
        v.literal("incomplete"),
        v.literal("irrelevant"),
        v.literal("other"),
      ),
    ),
    createdAt: v.number(),
  })
    .index("by_messageId", ["messageId"])
    .index("by_userId", ["userId"])
    .index("by_rating", ["rating"]),

  crawlJobs: defineTable({
    trigger: v.union(v.literal("manual"), v.literal("scheduled"), v.literal("webhook")),
    startedBy: v.optional(v.id("users")),
    status: v.union(
      v.literal("pending"),
      v.literal("running"),
      v.literal("completed"),
      v.literal("failed"),
      v.literal("cancelled"),
    ),
    config: v.object({
      maxPages: v.number(),
      maxDepth: v.number(),
      includePaths: v.array(v.string()),
      excludePaths: v.array(v.string()),
      allowExternalLinks: v.boolean(),
    }),
    stats: v.object({
      totalPages: v.number(),
      successfulPages: v.number(),
      failedPages: v.number(),
      skippedPages: v.number(),
      totalChunks: v.number(),
      totalTokens: v.number(),
      bytesProcessed: v.number(),
    }),
    error: v.optional(v.string()),
    startedAt: v.number(),
    completedAt: v.optional(v.number()),
    duration: v.optional(v.number()),
  })
    .index("by_status", ["status"])
    .index("by_trigger", ["trigger"])
    .index("by_startedAt", ["startedAt"]),

  semanticCache: defineTable({
    queryText: v.string(),
    queryEmbedding: v.array(v.float64()),
    response: v.string(),
    sources: v.array(
      v.object({
        documentId: v.id("documents"),
        chunkId: v.id("chunks"),
        url: v.string(),
        title: v.string(),
        relevanceScore: v.number(),
        excerpt: v.string(),
      }),
    ),
    model: v.string(),
    tokenCount: v.optional(
      v.object({
        prompt: v.number(),
        completion: v.number(),
        total: v.number(),
      }),
    ),
    hits: v.number(),
    expiresAt: v.number(),
    createdAt: v.number(),
  })
    .index("by_expiresAt", ["expiresAt"])
    .vectorIndex("by_queryEmbedding", { vectorField: "queryEmbedding", dimensions: 768 }),

  adminAuditLog: defineTable({
    userId: v.id("users"),
    action: v.string(),
    target: v.optional(v.string()),
    details: v.optional(v.any()),
    ipAddress: v.optional(v.string()),
    createdAt: v.number(),
  }).index("by_createdAt", ["createdAt"]),

  notifications: defineTable({
    userId: v.id("users"),
    title: v.string(),
    body: v.string(),
    type: v.union(
      v.literal("info"),
      v.literal("success"),
      v.literal("warning"),
      v.literal("error"),
    ),
    isRead: v.boolean(),
    link: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_userId", ["userId"])
    .index("by_isRead", ["isRead"]),
});
