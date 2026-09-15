import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
// NOTE: the vectorIndex `dimensions: 768` literal below MUST equal
// EMBEDDING_DIMENSION in convex/embeddings/dimension.ts. A schema vectorIndex
// dimension requires a static numeric literal (not a runtime import), so the
// two are kept in sync by tests/embeddings/dimension.test.ts rather than by a
// shared import. Changing either without the other corrupts the live vector
// index (AGENTS.md forbidden operation).

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
    .index("by_role", ["role"]),

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
    .index("by_messageId_and_userId", ["messageId", "userId"])
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
    maxDocumentUpdatedAt: v.optional(v.number()),
    // Per-source-document contentHash snapshot taken at write time. The read
    // path compares it to each document's current contentHash (updatedAt is
    // not usable: it is bumped on every recrawl, even when content is unchanged).
    sourceDocVersions: v.optional(
      v.array(v.object({ documentId: v.id("documents"), contentHash: v.optional(v.string()) })),
    ),
  })
    .index("by_expiresAt", ["expiresAt"])
    .vectorIndex("by_queryEmbedding", { vectorField: "queryEmbedding", dimensions: 768 }),

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
      v.literal("role.change"),
      v.literal("bulk_operations.resume"),
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
    .index("by_userId", ["userId"]),

  // WS-5: the deprecated `notifications` table was removed. It had zero
  // read/write code; the "notifications" string in the admin settings UI is an
  // appSettings section key, unrelated to this table. Convex drops the empty
  // table definition on the next deploy without affecting data (the table held
  // no rows). No vectorIndex was defined on it, so removal is safe per AGENTS.md.

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
    personType: v.optional(v.union(v.literal("faculty"), v.literal("staff"), v.literal("admin"))),
    lifecycleStatus: v.optional(
      v.union(
        v.literal("active"),
        v.literal("superseded"),
        v.literal("withdrawn"),
        v.literal("explicitly_stale"),
        v.literal("quarantined"),
        v.literal("deleted"),
      ),
    ),
    freshnessState: v.optional(
      v.union(v.literal("fresh"), v.literal("aged"), v.literal("unknown")),
    ),
    applicability: v.optional(
      v.union(
        v.literal("current"),
        v.literal("historical"),
        v.literal("session_specific"),
        v.literal("expired"),
        v.literal("timeless"),
        v.literal("unknown"),
      ),
    ),
    academicSession: v.optional(v.string()),
    documentVersionId: v.optional(v.string()),
    // Phase 6.21A Part 4/5: monotonic per-document ingestion-round counter.
    // Bumped every time a content-changed ingestion round starts (never on the
    // unchanged fast path). Work items enqueued for a round carry the round's
    // generation number; a completion whose generation no longer matches this
    // field is stale and MUST NOT mutate crawledChunks, RAG, or document status
    // (see saveEmbedding in crawl/mutations.ts). Absent on legacy rows created
    // before this field existed - treated as generation 0 by readers.
    ingestionGeneration: v.optional(v.number()),
    // Phase 6.21A Part 7: hash of every indexing-pipeline setting (chunking
    // version/sizes, context-prefix version, embedding model/dimensions - see
    // computeIndexingFingerprint in crawl/chunkKey.ts) that was active the last
    // time this document was fully indexed. The unchanged-document fast path
    // requires BOTH contentHash and indexingFingerprint to match; a pipeline
    // change alone (source content unchanged) now forces a rebuild instead of
    // being silently skipped. Absent on legacy rows - treated as never-matching
    // (forces one rebuild the first time a legacy row is re-ingested).
    indexingFingerprint: v.optional(v.string()),
  })
    .index("by_url", ["url"])
    .index("by_entryId", ["entryId"])
    .index("by_category", ["category"])
    .index("by_status", ["status"])
    .index("by_status_and_category", ["status", "category"])
    .index("by_crawledAt", ["crawledAt"])
    .index("by_session", ["crawlSessionId"])
    .index("by_tier_and_crawled", ["freshnessTier", "crawledAt"])
    .searchIndex("search_title", { searchField: "title" })
    .index("by_contentHash", ["contentHash"])
    .index("by_source_category", ["source", "category"])
    .index("by_personType", ["personType"])
    .index("by_status_and_isStale", ["status", "isStale"])
    .index("by_lifecycleStatus", ["lifecycleStatus"])
    .index("by_freshnessState", ["freshnessState"]),

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
      // Phase 6.21A Part 2/5: carried through so a DLQ retry re-enqueues
      // under the correct structural identity and generation instead of
      // falling back to undefined (which would break the
      // by_documentId_and_chunkKey lookup and generation fencing on retry).
      // Absent on rows written before this field existed.
      chunkKey: v.optional(v.string()),
      ingestionGeneration: v.optional(v.number()),
    }),
    status: v.union(
      v.literal("pending_retry"),
      v.literal("abandoned"),
      v.literal("processing"),
      v.literal("indexed"),
    ),
  })
    .index("by_status", ["status"])
    .index("by_jobId_and_url", ["jobId", "url"])
    .index("by_url", ["url"]),

  crawledChunks: defineTable({
    documentId: v.id("documents"),
    contentHash: v.string(),
    text: v.string(),
    ragId: v.string(),
    embeddingModel: v.optional(v.string()),
    parentText: v.optional(v.string()), // TASK-E06: Parent-child chunking context (LEGACY - new rows use parentId; kept for back-compat until migrateParentTextToTable runs)
    parentId: v.optional(v.id("chunkParents")), // Normalized parent reference (WS-1): replaces per-child parentText duplication
    headingPath: v.optional(v.array(v.string())), // R-7: Section heading hierarchy (e.g. ["Admissions", "Fee Structure"])
    contextualizedText: v.optional(v.string()), // R-9: Gemini-contextualized version of chunk text
    // Phase 6.21A Part 2/8: structural (position-stable) chunk identity - see
    // computeChunkKey in crawl/chunkKey.ts. LEGACY rows written before this
    // field existed have no chunkKey and are only reachable via the
    // by_documentId_and_contentHash index until they are naturally replaced by
    // a future re-crawl (no forced backfill, same convention as parentText
    // above and migrateParentTextToTable's lazy-migration precedent).
    chunkKey: v.optional(v.string()),
    // Phase 6.21A Part 5: the ingestionGeneration this row's content was last
    // written under. Lets completion-contract checks count distinct chunkKeys
    // actually committed under the CURRENT generation (see
    // isGenerationComplete in crawl/mutations.ts) rather than trusting an
    // over-incrementable counter alone.
    ingestionGeneration: v.optional(v.number()),
  })
    .index("by_documentId", ["documentId"])
    .index("by_documentId_and_contentHash", ["documentId", "contentHash"])
    .index("by_documentId_and_chunkKey", ["documentId", "chunkKey"])
    .index("by_ragId", ["ragId"])
    .index("by_contextualizedText", ["contextualizedText"])
    .searchIndex("search_text", { searchField: "text" })
    // Retrieval-pipeline remediation plan, Phase 4: contextualizedText (the
    // Gemini-generated context blurb - see embeddings/contextualize.ts) was
    // being generated and stored but never searched. A document only matches
    // this index once contextualizedText is set, so this only covers whatever
    // fraction of the corpus the contextualization cron has processed so far.
    .searchIndex("search_contextualized_text", { searchField: "contextualizedText" }),

  // WS-1: Normalized parent storage. The parent chunk text used to be duplicated
  // onto every child via crawledChunks.parentText (K× duplication per parent,
  // ~5× source bloat). Now each parent is stored ONCE here and children reference
  // it via parentId. Storage-normalized design (Anthropic Contextual Retrieval +
  // hierarchical chunking best practice: "store parent documents separately keyed
  // by ID; index children only"). Hydrated into the retrieval path by
  // batchFetchDocMeta for the post-fusion top-K only, so no query-bandwidth cost.
  chunkParents: defineTable({
    documentId: v.id("documents"),
    contentHash: v.string(), // sha256(parent text) → dedup identical parents within a doc
    text: v.string(),
  })
    .index("by_documentId", ["documentId"])
    .index("by_documentId_and_contentHash", ["documentId", "contentHash"]),

  // Transient staging for the RAG onComplete commit boundary (see
  // onRagEntryComplete in crawl/mutations.ts). rag.defineOnComplete's
  // callback only receives RAG's own Entry shape - no raw chunk text field -
  // and duplicating full chunk text into RAG's own entry metadata is
  // deliberately avoided, so embedSingleChunk stages the raw text here
  // (keyed by ragVersionKey) immediately before its rag.add() call.
  // Deliberately NOT read-and-deleted synchronously (retry-storm race, Part
  // 15): ragVersionKey is shared by every concurrent attempt at one
  // (position, generation), and RAG's own same-key promotion chain
  // (component/entries.js's promoteToReadyHandler) can produce several
  // successive "ready" entries that each independently need this SAME
  // staged row to run their own commit - deleting it after the FIRST one
  // strands every later chain link with nothing staged.
  //
  // stagePendingChunkText upserts by ragVersionKey (August 2026 incident
  // remediation) instead of always inserting, so every Workpool retry and
  // DLQ re-enqueue of the same logical chunk refreshes ONE row instead of
  // appending a duplicate - this is what previously inflated ~700 struggling
  // chunks into ~17,000 staged rows. `updatedAt` (not the immutable
  // _creationTime) is the GC grace-period clock: it keeps advancing as long
  // as the chunk is still being actively retried at any layer, and only
  // stops once retries genuinely end (success or DLQ abandonment), which is
  // exactly when the row becomes safe to GC. See gcOrphanedPendingChunkText
  // in reconciliation.ts, the ONLY thing that ever deletes these rows.
  pendingChunkText: defineTable({
    ragVersionKey: v.string(),
    chunkText: v.string(),
    // Optional: rows written before this field existed have no value here
    // and fall back to _creationTime in the GC check (see reconciliation.ts).
    updatedAt: v.optional(v.number()),
  }).index("by_ragVersionKey", ["ragVersionKey"]),

  crawlStats: defineTable({
    statsId: v.string(), // singleton e.g., 'global'
    totalDocuments: v.number(),
    indexedDocuments: v.number(),
    processingDocuments: v.number(),
    failedDocuments: v.number(),
    pendingDocuments: v.number(),
    lastUpdatedAt: v.number(),
  }).index("by_statsId", ["statsId"]),

  // Durable, server-side kill switch for expensive crawl/embedding
  // operations (August 2026 incident remediation - resource-safety mandate
  // section 40: "kill switch must not depend only on process memory"). A
  // row's ABSENCE means "nobody has ever needed emergency stop" (the normal
  // state for a healthy system), not an unknown/unsafe condition, so
  // isBulkOperationsEnabled (crawl/bulkOperationsControl.ts) defaults to
  // enabled=true when no row exists. Once a row exists, its value is
  // authoritative and is checked before every expensive producer-side
  // action - see that file for the full list of call sites.
  bulkOperationsControl: defineTable({
    key: v.string(), // singleton, "global"
    enabled: v.boolean(),
    updatedAt: v.number(),
    updatedBy: v.optional(v.id("users")),
    reason: v.optional(v.string()),
  }).index("by_key", ["key"]),

  faqs: defineTable({
    question: v.string(),
    answer: v.string(),
    sourceUrl: v.optional(v.string()),
    createdAt: v.number(),
    expiresAt: v.optional(v.number()),
  })
    .index("by_expiresAt", ["expiresAt"])
    .searchIndex("search_question", { searchField: "question" }),

  appSettings: defineTable({
    key: v.string(),
    value: v.union(v.string(), v.number(), v.boolean()),
    section: v.string(),
    updatedAt: v.number(),
    updatedBy: v.optional(v.id("users")),
  })
    .index("by_key", ["key"])
    .index("by_section", ["section"]),

  // TASK-S02: Rate limiter state - sliding window per user + global token budget.
  // Each row is either keyed by clerkUserId (per-user msg limit) or "global" (token budget).
  // windowStart: epoch ms of the start of the current 1-minute window.
  // count: number of requests (per-user) or total tokens (global) in this window.
  rateLimits: defineTable({
    key: v.string(), // clerkUserId OR "global"
    windowStart: v.number(), // epoch ms - start of current 1-minute window
    count: v.number(), // requests (per-user) or tokens (global) in window
  })
    .index("by_key", ["key"])
    .index("by_windowStart", ["windowStart"]),

  evalResults: defineTable({
    evalName: v.string(),
    model: v.optional(v.string()),
    datasetSize: v.number(),
    timestamp: v.number(),
    metrics: v.object({
      recallAtK: v.optional(v.number()),
      precisionAtK: v.optional(v.number()),
      mrr: v.optional(v.number()),
      avgLatency: v.optional(v.number()),
      totalTokens: v.optional(v.number()),
    }),
    metadata: v.optional(v.string()),
  }).index("by_timestamp", ["timestamp"]),

  dashboardStats: defineTable({
    statsId: v.string(), // singleton e.g., 'global'
    documentStats: v.object({
      total: v.number(),
      indexed: v.number(),
      pending: v.number(),
      failed: v.number(),
    }),
    userStats: v.object({
      total: v.number(),
      activeLast24h: v.number(),
    }),
    feedbackCount: v.number(),
    crawlCount: v.number(),
    cacheStats: v.object({
      total: v.number(),
    }),
    lastUpdatedAt: v.number(),
    // Phase 6.21A Part 9: cursor-driven rebuild coalescing/stuck-build
    // detection. computeDashboardStats (the cron entry point) refuses to
    // start a second rebuild while buildInProgress is true and recent; the
    // documentStats/userStats/etc. fields above are only ever patched by the
    // FINAL step of a rebuild, so a partial or crashed run never overwrites
    // the last good snapshot.
    buildInProgress: v.optional(v.boolean()),
    buildStartedAt: v.optional(v.number()),
  }).index("by_statsId", ["statsId"]),

  sourceRegistry: defineTable({
    sourceId: v.string(),
    canonicalHost: v.string(),
    allowedPathPrefixes: v.array(v.string()),
    deniedPathPrefixes: v.array(v.string()),
    authority: v.union(
      v.literal("official_primary"),
      v.literal("official_secondary"),
      v.literal("official_archive"),
    ),
    sourceType: v.union(
      v.literal("html"),
      v.literal("pdf"),
      v.literal("structured_feed"),
      v.literal("verified_faq"),
    ),
    defaultFreshnessTier: v.union(v.literal("high"), v.literal("medium"), v.literal("low")),
    crawlEnabled: v.boolean(),
    liveVerificationEnabled: v.boolean(),
    parserProfile: v.string(),
    maximumResponseBytes: v.number(),
    owner: v.string(),
    approvedAt: v.number(),
  })
    .index("by_sourceId", ["sourceId"])
    .index("by_canonicalHost", ["canonicalHost"]),

  structuredFacts: defineTable({
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
    createdAt: v.number(),
  })
    .index("by_type_and_subject", ["type", "subject"])
    .index("by_session", ["session"])
    .index("by_freshnessState", ["freshnessState"]),

  evaluationSuites: defineTable({
    suiteId: v.string(),
    version: v.string(),
    status: v.union(
      v.literal("draft"),
      v.literal("reviewed"),
      v.literal("release_candidate"),
      v.literal("production"),
    ),
    sourceSnapshot: v.string(),
    questionCount: v.number(),
    owner: v.string(),
    createdAt: v.number(),
  })
    .index("by_suiteId", ["suiteId"])
    .index("by_status", ["status"]),

  agentReleases: defineTable({
    releaseId: v.string(),
    gitCommit: v.string(),
    promptVersion: v.string(),
    modelRegistryVersion: v.string(),
    retrievalPolicyVersion: v.string(),
    freshnessPolicyVersion: v.string(),
    evidencePolicyVersion: v.string(),
    evaluationSuiteVersion: v.string(),
    corpusGeneration: v.string(),
    offlineEvaluationResult: v.string(),
    previewEvaluationResult: v.string(),
    canaryEvaluationResult: v.optional(v.string()),
    status: v.union(
      v.literal("candidate"),
      v.literal("preview"),
      v.literal("canary"),
      v.literal("production"),
      v.literal("rolled_back"),
      v.literal("retired"),
    ),
    approvedBy: v.optional(v.string()),
    approvedAt: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_releaseId", ["releaseId"])
    .index("by_status", ["status"])
    .index("by_gitCommit", ["gitCommit"]),

  traceSpans: defineTable({
    traceId: v.string(),
    spanId: v.string(),
    parentSpanId: v.optional(v.string()),
    name: v.string(),
    runState: v.optional(v.string()),
    reasonCode: v.optional(v.string()),
    startTime: v.number(),
    endTime: v.optional(v.number()),
    durationMs: v.optional(v.number()),
    status: v.union(v.literal("ok"), v.literal("error")),
    attributesJson: v.optional(v.string()),
  })
    .index("by_traceId", ["traceId"])
    .index("by_name", ["name"])
    .index("by_reasonCode", ["reasonCode"]),

  // Note: `threads` and `messages` tables are managed by @convex-dev/agent component.
  // Do not define them here to avoid table name conflicts with the component's internal tables.
  // The `feedback.messageId` field uses v.string() to reference agent-managed message IDs.
});
