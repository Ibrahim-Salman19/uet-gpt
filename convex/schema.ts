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
    preferences: v.optional(
      v.object({
        theme: v.optional(v.string()),
        language: v.optional(v.string()),
        fontSize: v.optional(v.string()),
        model: v.optional(v.string()),
      }),
    ),
    metadata: v.optional(
      v.object({
        signupSource: v.optional(v.string()),
        lastFeatureUsed: v.optional(v.string()),
      }),
    ),
  })
    .index("by_clerkId", ["clerkId"])
    .index("by_email", ["email"])
    .index("by_role", ["role"])
    .index("by_lastLoginAt", ["lastLoginAt"]),

  feedback: defineTable({
    messageId: v.string(),
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
    .index("by_rating", ["rating"])
    .index("by_createdAt", ["createdAt"]),

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
    providerJobId: v.optional(v.string()),
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
    .index("by_startedAt", ["startedAt"])
    .index("by_providerJobId", ["providerJobId"]),

  semanticCache: defineTable({
    queryText: v.string(),
    queryEmbedding: v.array(v.float64()),
    response: v.string(),
    sources: v.array(
      v.object({
        entryId: v.string(),
        url: v.string(),
        title: v.string(),
        relevanceScore: v.number(),
        excerpt: v.string(),
        headingPath: v.optional(v.array(v.string())),
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
    embeddingModel: v.optional(v.string()),
    sourceEntryIds: v.optional(v.array(v.string())),
    alternateQueryTexts: v.optional(v.array(v.string())),
    alternateEmbeddings: v.optional(v.array(v.array(v.float64()))),
  })
    .index("by_expiresAt", ["expiresAt"])
    .vectorIndex("by_queryEmbedding", { vectorField: "queryEmbedding", dimensions: 3072 }),

  adminAuditLog: defineTable({
    userId: v.id("users"),
    action: v.union(
      v.literal("user.login"),
      v.literal("user.logout"),
      v.literal("user.create"),
      v.literal("thread.create"),
      v.literal("thread.delete"),
      v.literal("document.create"),
      v.literal("document.delete"),
      v.literal("crawl.start"),
      v.literal("crawl.stop"),
      v.literal("feedback.submit"),
      v.literal("settings.update"),
      v.literal("admin.access"),
      v.literal("metrics.summary"),
      v.literal("metrics.errors"),
      v.literal("metrics.performance"),
      v.literal("staleness.check"),
    ),
    target: v.optional(v.string()),
    details: v.optional(
      v.object({
        oldValue: v.optional(v.string()),
        newValue: v.optional(v.string()),
        reason: v.optional(v.string()),
      }),
    ),
    ipAddress: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_createdAt", ["createdAt"])
    .index("by_userId", ["userId"])
    .index("by_action", ["action"]),

  // DEPRECATED: notifications table is unused — no code reads or writes to it.
  // Kept for schema backward compatibility; can be removed in a future migration.
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

  documents: defineTable({
    url: v.string(),
    title: v.string(),
    entryId: v.optional(v.string()),
    contentHash: v.optional(v.string()),
    crawlSessionId: v.optional(v.string()),
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
    crawledAt: v.number(),
    updatedAt: v.number(),
    error: v.optional(v.string()),
    freshnessTier: v.optional(v.union(v.literal("high"), v.literal("medium"), v.literal("low"))),
    isStale: v.optional(v.boolean()),
  })
    .index("by_url", ["url"])
    .index("by_entryId", ["entryId"])
    .index("by_category", ["category"])
    .index("by_status", ["status"])
    .index("by_crawledAt", ["crawledAt"])
    .index("by_session", ["crawlSessionId"])
    .index("by_tier_and_crawled", ["freshnessTier", "crawledAt"])
    .searchIndex("search_title", { searchField: "title" })
    .index("by_contentHash", ["contentHash"])
    .index("by_source_category", ["source", "category"]),

  processedWebhooks: defineTable({
    jobId: v.string(),
    processedAt: v.number(),
    expiresAt: v.number(),
  })
    .index("by_jobId", ["jobId"])
    .index("by_expiresAt", ["expiresAt"]),

  crawlDeadLetter: defineTable({
    url: v.string(),
    jobId: v.string(),
    failureReason: v.string(),
    failureCount: v.number(),
    lastAttemptAt: v.number(),
    payload: v.object({
      documentId: v.string(),
      url: v.string(),
      contentHash: v.optional(v.string()),
      jobId: v.string(),
      chunkText: v.optional(v.string()),
    }),
    status: v.union(
      v.literal("pending_retry"),
      v.literal("abandoned"),
      v.literal("processing"),
      v.literal("indexed"),
    ),
  })
    .index("by_status", ["status"])
    .index("by_jobId_and_url", ["jobId", "url"]),

  crawledChunks: defineTable({
    documentId: v.id("documents"),
    contentHash: v.string(),
    text: v.string(),
    ragId: v.string(),
    embeddingModel: v.optional(v.string()),
    parentText: v.optional(v.string()), // TASK-E06: Parent-child chunking context
    headingPath: v.optional(v.array(v.string())), // R-7: Section heading hierarchy (e.g. ["Admissions", "Fee Structure"])
    contextualizedText: v.optional(v.string()), // R-9: Gemini-contextualized version of chunk text
  })
    .index("by_documentId", ["documentId"])
    .index("by_documentId_and_contentHash", ["documentId", "contentHash"])
    .index("by_ragId", ["ragId"])
    .searchIndex("search_text", { searchField: "text" }),

  crawlStats: defineTable({
    statsId: v.string(), // singleton e.g., 'global'
    totalDocuments: v.number(),
    indexedDocuments: v.number(),
    processingDocuments: v.number(),
    failedDocuments: v.number(),
    pendingDocuments: v.number(),
    lastUpdatedAt: v.number(),
  }).index("by_statsId", ["statsId"]),

  faqs: defineTable({
    question: v.string(),
    answer: v.string(),
    sourceUrl: v.optional(v.string()),
    createdAt: v.number(),
    expiresAt: v.optional(v.number()),
  }).searchIndex("search_question", { searchField: "question" }),

  appSettings: defineTable({
    key: v.string(),
    value: v.union(v.string(), v.number(), v.boolean()),
    section: v.string(),
    updatedAt: v.number(),
    updatedBy: v.optional(v.id("users")),
  })
    .index("by_key", ["key"])
    .index("by_section", ["section"]),

  // TASK-S02: Rate limiter state — sliding window per user + global token budget.
  // Each row is either keyed by clerkUserId (per-user msg limit) or "global" (token budget).
  // windowStart: epoch ms of the start of the current 1-minute window.
  // count: number of requests (per-user) or total tokens (global) in this window.
  rateLimits: defineTable({
    key: v.string(), // clerkUserId OR "global"
    windowStart: v.number(), // epoch ms — start of current 1-minute window
    count: v.number(), // requests (per-user) or tokens (global) in window
  }).index("by_key", ["key"]),

  evalResults: defineTable({
    evalName: v.string(),
    model: v.optional(v.string()),
    datasetSize: v.number(),
    timestamp: v.number(),
    metrics: v.object({
      recallAtK: v.number(),
      precisionAtK: v.number(),
      mrr: v.number(),
      avgLatency: v.number(),
      totalTokens: v.number(),
    }),
    metadata: v.optional(v.string()),
  })
    .index("by_timestamp", ["timestamp"])
    .index("by_evalName", ["evalName"]),

  // Note: `threads` and `messages` tables are managed by @convex-dev/agent component.
  // Do not define them here to avoid table name conflicts with the component's internal tables.
  // The `feedback.messageId` field uses v.string() to reference agent-managed message IDs.
});
