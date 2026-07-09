# Reference (Backend)

> **Audience.** AI / agent developers adding/changing Convex logic, debugging queries, or reading validators.
>
> **Index.** See [`reference.md`](./reference.md) §6.1 for the file-to-purpose index and §6.2 for the symbol index. The deep signatures live here.
>
> **Companion.** Forbidden actions in [`frontend_backend_boundaries.md`](./frontend_backend_boundaries.md) and narrative in [`architecture.md`](./architecture.md). Cross-boundary facts in [`reference.cross-cutting.md`](./reference.cross-cutting.md).

---

## Table of Contents

1. [How to Use This File](#1-how-to-use-this-file)
2. [Annotated Directory Tree (Full)](#2-annotated-directory-tree-full)
3. [Schema](#3-schema)
4. [Public API Surface](#4-public-api-surface)
5. [Internal API Surface](#5-internal-api-surface)
6. [HTTP Routes](#6-http-routes)
7. [Cron Schedule](#7-cron-schedule)
8. [Auth Subsystem](#8-auth-subsystem)
9. [RAG Subsystem](#9-rag-subsystem)
10. [Embeddings Subsystem](#10-embeddings-subsystem)
11. [Reranking Subsystem](#11-reranking-subsystem)
12. [Semantic Cache Subsystem](#12-semantic-cache-subsystem)
13. [Crawl Pipeline](#13-crawl-pipeline)
14. [Rate Limiting](#14-rate-limiting)
15. [Admin Subsystem](#15-admin-subsystem)
16. [FAQ, Feedback, Threads, Messages, Users](#16-faq-feedback-threads-messages-users)
16A. [Document Subsystem (`convex/doc/*`)](#16a-document-subsystem-convexdoc)
17. [Emergency Stop](#17-emergency-stop)
18. [Component Registrations](#18-component-registrations)
19. [Eval Subsystem (Scaffolded)](#19-eval-subsystem-scaffolded)
20. [Validators](#20-validators)
21. [Constants Reference](#21-constants-reference)

---

## 1. How to Use This File

**Read by intent:**

| If you want to… | Jump to |
| --- | --- |
| Add a new table | §3 (Schema) — see also [forbidden changes](#6.5-forbidden-index-do-not-touch) |
| Add a new Convex function | §4 (Public API) for client-callable or §5 (Internal API) for server-only |
| Add a new HTTP route | §6 (HTTP Routes) — copy an existing one; preserve auth |
| Add a new cron | §7 (Cron Schedule) |
| Change RAG behavior | §9 (RAG) — read all six sub-files; coordinate with prompts.ts |
| Change cache threshold | §12 + §21 (`CACHE_SIMILARITY_THRESHOLD`) |
| Change crawl pipeline | §13 (Crawl) — read all 13 sub-files; touch workpools cautiously |
| Add a new admin endpoint | §15 (Admin) — uses `appSettings` table |
| Add a new validator | §20 (Validators) |
| Understand LLM/embed constants | §21 (Constants) |

**Conventions used in tables:**

- **RBAC:** `pub` (public, no auth) · `auth` (requires Clerk JWT) · `admin` (requires `role: "admin"`) · `cron` (Vercel cron) · `webhook` (HMAC/Svix) · `internal` (server-only via `internalQuery/Mutation/Action`).
- **Args:** shorthand for Convex `v.*` validators; full object bodies in `convex/doc/validator.ts` and `convex/messages/validator.ts`.
- **Returns:** Convex validator (return value) or `void` (mutation with side effect).
- **Line refs:** relative to file unless absolute path given. Validate with `grep -n` before editing.

---

## 2. Annotated Directory Tree (Full)

```
convex/
├── _generated/                    # Auto-generated. DO NOT EDIT.
│   ├── api.d.ts                   # Public API types (api.*)
│   ├── server.d.ts                # Server-side type helpers
│   ├── dataModel.d.ts             # Doc<"tableName"> types
│   └── api.js, server.js, dataModel.js
│
├── schema.ts                      # ALL **14 tables** + indexes. Sacred (vector dim + filterNames frozen).
│
├── auth.config.ts                 # Clerk JWT provider ("applicationID": "uet-gpt"; domain has placeholder fallback)
│
├── auth.ts                        # requireAuth, requireAdmin, getUserId, isAuthenticated, isAdmin (return Doc<"users">)
│
├── http.ts                        # 3 unique paths / 6 routes (POST+OPTIONS per path) + start-up env guard
│
├── crons.ts                       # 7 scheduled jobs (1 disabled: crawl — Crawl4AI unreachable, see §7)
│
├── convex.config.ts               # Registers 5 components (see §18)
│
├── constants.ts                   # ONLY exports `CACHE_SIMILARITY_THRESHOLD = 0.92` (1 line). All other constants are local to their files.
│
├── rateLimit.ts                   # Convex sliding-window rate limiter
│
├── users.ts                       # `getOrCreate` (dual auth: WEBHOOK_SECRET OR identity.subject === args.clerkId) + `getByClerkId` + `updatePreferences`
│
├── threads.ts                     # Agent thread wrappers (uses components.agent.threads)
│
├── messages.ts                    # Insert message with sources + tokenCount
│
├── faq.ts                         # FAQ search (vector) + admin add
│
├── feedback/                      # Thumbs up/down + comments (submit.ts, list.ts)
│
├── emergencyStop.ts               # stopBatch (internalMutation) + stopAll (internalAction) — mutates docs+jobs in 500-row batches
├── people/queries.ts              # getCount (4-key public query, if/else URL/title classifier — NOT regex)
│
├── rag/
│   ├── instance.ts                # RAG component singleton
│   ├── retrieval.ts               # Hybrid search + INJECTION_RE scanner
│   ├── routing.ts                 # 7-way intent classification (Groq llama-3.1-8b)
│   ├── context.ts                 # Sandwich context builder
│   ├── prompts.ts                 # SYSTEM_PROMPT + FEW_SHOT
│   └── testing.ts                 # RAG seed data
│
├── reranking/
│   └── rerank.ts                  # Optional HTTP rerank + positional fallback
│
├── cache/
│   ├── get.ts                     # vectorSearch("semanticCache") + cosine check
│   ├── set.ts                     # Tier-aware TTL insert
│   └── internal_queries.ts        # getCacheEntry, incrementHits, cleanup
│
├── crawl/                         # **16 files**
│   ├── webhook.ts                 # HMAC-SHA256 + state-change routing (DO NOT WEAKEN)
│   ├── workflow.ts                # kickoffDailyCrawl (idempotency: no pending/running, no completed <23h)
│   ├── actions.ts                 # "use node" — executeCrawlJob, embedSingleChunk, resetPipelineAction, runDeduplication
│   ├── workpools.ts               # 2 Workpools: embeddingPool (p=3, r=5, 4s×2) + crawlPool (p=3, r=3, 5m×3)
│   ├── chunking.ts                # 7 exports: guardChunkSize, isQualityChunk, chunkMarkdown (3000/300), assignFreshnessTier, canonicalize, normalizeContent, isPdfVirtualUrl
│   ├── queries.ts                 # 11 exports: fullTextSearch (uses search_text index), getDocumentCountByStatus (admin), getRecentDocs, getDLQSample, searchByUrl, getFailedDocs, getPendingEmbedDocs, getDocsBySource, getJobById, getChunksForDoc, getChunksWithHeadings
│   ├── mutations.ts               # 8 exports: getProcessedWebhook, markWebhookProcessed, queueChunksForEmbedding, saveEmbedding, onChunkEmbedded, retryDeadLetterQueue, upsertDocument, enqueueDocumentChunks
│   ├── jobs.ts                    # cleanupOldRecords ({ limit? }) — DLQ >7d + jobs >30d constants hardcoded inside handler
│   ├── tasks.ts                   # cleanupExpiredCache (BOTH semanticCache AND processedWebhooks) + aggregateDailyStats (PUBLIC mutation, not internal)
│   ├── trigger.ts                 # Admin mutation: insert job + enqueue via crawlPool (verified 55 lines)
│   ├── status.ts                  # Admin query: ctx.db.get(jobId) (verified 48 lines)
│   ├── list.ts                    # Admin query: last 20 jobs (verified 47 lines, hardcoded take(20))
│   ├── reset.ts                   # resetDLQ (public admin): cap 500, patches abandoned→pending_retry
│   ├── reset_ops.ts               # 4 INTERNAL mutations: resetAbandonedDLQ, resetPipelineBatch, resetFailedDocuments, reembedPendingBatch
│   ├── staleness.ts               # markStaleDocuments (4 statuses → stale) + purgeStaleDocuments + flagExpiredDocuments
│   ├── deduplication.ts           # findDuplicatesBatch + deleteDuplicateDocuments (paginates docs+chunks)
│   └── backfill.ts                # One-shot migration: populate chunksEmbedded field
│
├── admin/
│   ├── settings.ts                # getSettings (returns [] to non-admins), upsertSetting, resetSettings
│   └── stats.ts                   # Split queries (7 functions, 1 paginated each): documentStats, userStats, feedbackStats, feedbackCount, crawlStats, crawlCount, cacheStats + deleteDocument + deleteFeedback
│
├── doc/                           # **7 files** (doc-level API; see §16A for full signatures)
│   ├── index.ts                   # Barrel export
│   ├── create.ts                  # `create` (internalMutation) + `updateStatus` (internalMutation, 7 statuses)
│   ├── get.ts                     # `get` + `getByUrl` (queries, both requireAuth)
│   ├── list.ts                    # `list` (query, declares `cursor` but IGNORES it)
│   ├── remove.ts                  # `remove` (admin mutation, calls rag.deleteAsync first)
│   ├── search.ts                  # `search` (query, search_title + client-side category filter)
│   └── validator.ts               # documentValidator (19 fields: _id, _creationTime, url, title, entryId, contentHash, source, category, subcategory, metadata, status, chunkCount, chunksEmbedded, crawlSessionId, freshnessTier, isStale, crawledAt, updatedAt, error)
│
├── embeddings/                    # **3 files** (no index.ts barrel)
│   ├── generate.ts                # gemini-embedding-2 batch + single (4-key rotation, BATCH_THRESHOLD=2)
│   ├── search.ts                  # Hybrid RRF (vector + keyword), k=60
│   └── doc_queries.ts             # `getDocumentByEntryId` (internalQuery, joins chunks→docs)
│
├── lib/                           # **1 file** (no index.ts, no url_helpers.ts)
│   └── db_helpers.ts              # `fastCount(db, tableName)` — uses `collect().length` (type-safe, no @ts-expect-error)
│
├── messages/
│   ├── validator.ts               # sourcesValidator + tokenCountValidator + messageValidator
│
├── threads/
│   ├── validator.ts               # threadValidator (_id: v.string(), userId: v.string())
│
├── users/
│   ├── validator.ts               # userValidator
│
├── feedback/
│   ├── submit.ts                  # Dedupes by (messageId, userId), 2000-char comment cap
│   └── list.ts                    # Admin sees all 50; user sees own 50
│
└── eval/                          # **2 STUBS only — NO getChunksByRagIds.ts, NO evaluateSearch.ts, NO index.ts**
    ├── run.ts                     # public `action` stub: returns `{ id, status: "pending", ... }`, no DB writes
    └── results.ts                 # public `query` stub: returns `{ status: "completed", score: 0, details: {} }`, no DB reads
```

---

## 3. Schema

**File:** `convex/schema.ts` (sacred — vector index dim and filterNames are frozen).

**14 tables** (verified by reading `convex/schema.ts`). Plus tables in `@convex-dev/agent` component (`threads`, `messages`, `streamingMessages`, etc.) — see §18. The RAG corpus is managed by `@convex-dev/rag` — `crawledChunks` does NOT have a `vectorIndex` in this schema; the `filterNames` (`["category","source"]`) live in `convex/rag/instance.ts`.

### 3.1 Table inventory

| Table | Owner subsystem | Indexes | Vector? | Notes |
| --- | --- | --- | --- | --- |
| `users` | auth | `by_clerkId`, `by_email`, `by_role`, `by_lastLoginAt` | — | Clerk sync target |
| `feedback` | feedback | `by_messageId`, `by_userId`, `by_rating`, `by_createdAt` | — | NO `by_threadId`; rating is `thumbsUp`/`thumbsDown` |
| `crawlJobs` | crawl | `by_status`, `by_trigger`, `by_startedAt`, `by_providerJobId` | — | State machine; trigger is `manual`/`scheduled`/`webhook`; config + stats nested |
| `documents` | crawl | `by_url`, `by_entryId`, `by_category`, `by_status`, `by_crawledAt`, `by_session`, `by_tier_and_crawled`, `search_title`, `by_contentHash`, `by_source_category` (10 indexes) | — | Per-URL doc |
| `crawledChunks` | RAG | `by_documentId`, `by_documentId_and_contentHash`, `by_ragId`, `search_text` (4 indexes) | — (RAG owns vectors) | Metadata only; vectors in `@convex-dev/rag` |
| `faqs` | FAQ | `search_question` (1 search index) | — | Curated Q&A |
| `semanticCache` | cache | `by_expiresAt` | `by_queryEmbedding` (768) | Only `vectorIndex` in schema |
| `processedWebhooks` | crawl | `by_jobId`, `by_expiresAt` | — | Idempotency (keyed by `jobId`, NOT `webhookId`) |
| `crawlDeadLetter` | crawl | `by_status`, `by_jobId_and_url` | — | Retry queue |
| `crawlStats` | crawl | `by_statsId` (NOT `by_date`) | — | Daily aggregates (singleton-style row) |
| `adminAuditLog` | admin | `by_userId`, `by_createdAt`, `by_action` | — | Admin actions (action is 12-literal union) |
| `notifications` | user | `by_userId`, `by_isRead` | — | In-app notifications (`isRead`, NOT `read`) |
| `rateLimits` | rate limit | `by_key` (no `by_expiresAt`) | — | Sliding window (no `expiresAt` field) |
| `appSettings` | admin | (key is PK) | — | KV config; HAS `section` field; used by `admin/settings.ts` |

### 3.2 Per-table reference

#### `users`

Owns the Clerk↔Convex user mapping. One row per Clerk user.

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `clerkId` (not `clerkUserId`) | `v.string()` | yes | From Clerk; unique via `by_clerkId` |
| `email` | `v.string()` | yes | Latest email from Clerk |
| `name` | `v.string()` | yes | Display name |
| `imageUrl` | `v.optional(v.string())` | no | From Clerk |
| `role` | `v.union(v.literal("user"), v.literal("admin"), v.literal("superadmin"))` | yes | Default `"user"` on create |
| `isActive` | `v.boolean()` | yes | Soft-delete flag (false = archived) |
| `lastLoginAt` | `v.number()` | yes | Updated on `getOrCreate` |
| `preferences` | `v.object({ theme, language, fontSize, model })` | yes | UI prefs |
| `metadata` | `v.object({ signupSource, lastFeatureUsed })` | yes | Observability |

**Indexes:**

- `by_clerkId` — used by `getOrCreate` (which is the ONLY public function in `convex/users.ts`).
- `by_email`, `by_role`, `by_lastLoginAt` — for admin queries.

**Used by:** `convex/auth.ts` (via `getUserId`), `convex/users.ts`, `convex/admin/*`, `convex/feedback/*`, `convex/emergencyStop.ts`.

**Invariant:** Exactly one row per `clerkId`. `isActive=false` is *not* deletion — row stays for audit.

---

#### `feedback`

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `userId` | `v.id("users")` | yes | Author |
| `messageId` | `v.string()` | yes | From agent thread |
| `rating` | `v.union(v.literal("thumbsUp"), v.literal("thumbsDown"))` | yes | NOTE camelCase |
| `category` | `v.union(v.literal("accurate"), v.literal("inaccurate"), v.literal("incomplete"), v.literal("irrelevant"), v.literal("other"))` | yes | |
| `comment` | `v.optional(v.string())` | no | Free text, ≤ 2000 chars |
| `createdAt` | `v.number()` | yes | |

**Indexes:** `by_userId`, `by_messageId`, `by_rating`, `by_createdAt`. **NO `by_threadId`** — feedback is keyed on messageId.

**Dedup:** `convex/feedback/submit.ts` checks for an existing row with the same `(messageId, userId)` and returns the existing id if present.

---

#### `crawlJobs`

State machine: `pending → running → (completed | failed | cancelled)`.

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `status` | `v.union(v.literal("pending"), v.literal("running"), v.literal("completed"), v.literal("failed"), v.literal("cancelled"))` | yes | |
| `trigger` | `v.union(v.literal("manual"), v.literal("scheduled"), v.literal("webhook"))` | yes | Source |
| `startedBy` | `v.optional(v.string())` | no | User id or `"system"` |
| `startedAt` | `v.optional(v.number())` | no | Set on `pending → running` |
| `completedAt` | `v.optional(v.number())` | no | Set on terminal |
| `duration` | `v.optional(v.number())` | no | completedAt - startedAt |
| `providerJobId` | `v.optional(v.string())` | no | External provider's job id (e.g. crawl4AI) |
| `config` | `v.object({ maxPages, maxDepth, includePaths, excludePaths, allowExternalLinks })` | yes | Crawl parameters (NESTED, not flat) |
| `stats` | `v.object({ totalPages, successfulPages, failedPages, skippedPages, totalChunks, totalTokens, bytesProcessed })` | yes | Live stats (NESTED, not flat) |
| `error` | `v.optional(v.string())` | no | Last error msg |

**Indexes:** `by_status`, `by_trigger`, `by_startedAt`, `by_providerJobId`. **No `totalUrls`/`processedUrls`/`failedUrls`/`chunksIndexed` (those moved into `stats`); no `attempts`, no `sitemapUrl` field.**

**Lifecycle:**

- Created by `convex/crawl/trigger.ts::trigger` (admin mutation) or by `convex/crawl/workflow.ts::kickoffDailyCrawl` (cron). There is NO `enqueueCrawlJob` function in the codebase.
- Cron `fail-stuck-crawl-jobs` (every 2 hours) flips `running → failed` after 2h.
- Retry cron reads from `crawlDeadLetter`, re-enqueues into a new `crawlJobs` row.

---

#### `documents`

One row per unique URL. `contentHash` is the SHA-256 of the markdown (whole page). Content itself lives in `crawledChunks.text` + RAG component — NOT on this row.

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `url` | `v.string()` | yes | Unique via `by_url` |
| `title` | `v.string()` | yes | |
| `entryId` | `v.string()` | yes | Foreign key into the RAG component namespace |
| `crawlSessionId` | `v.string()` | yes | Groups docs from one crawl run |
| `contentHash` | `v.string()` | yes | SHA-256 hex; for dedup |
| `status` | `v.union(v.literal("pending"), v.literal("processing"), v.literal("indexed"), v.literal("failed"), v.literal("stale"), v.literal("active"), v.literal("pending_embed"))` | yes | **7 values** (per `convex/doc/validator.ts`) |
| `crawledAt` | `v.number()` | yes | Updated each crawl (NOT `lastCrawledAt`) |
| `updatedAt` | `v.number()` | yes | |
| `error` | `v.optional(v.string())` | no | Last error msg (NOT `errorMessage`) |
| `source` | `v.string()` | yes | E.g. `"uet.edu.pk"` |
| `category` | `v.string()` | yes | E.g. `"admissions"`, `"academic"` |
| `subcategory` | `v.optional(v.string())` | no | |
| `metadata` | `v.optional(v.any())` | no | Free-form |
| `chunkCount` | `v.number()` | yes | |
| `chunksEmbedded` | `v.optional(v.number())` | no | Populated by backfill/crawl |
| `freshnessTier` | `v.optional(v.union(v.literal("high"), v.literal("medium"), v.literal("low")))` | no | TTL tier |
| `isStale` | `v.optional(v.boolean())` | no | Flag set by staleness cron |

**Indexes (10):** `by_url`, `by_entryId`, `by_category`, `by_status`, `by_crawledAt`, `by_session`, `by_tier_and_crawled`, `search_title`, `by_contentHash`, `by_source_category`.

**`category` and `source` are the filter names configured on the RAG component (`convex/rag/instance.ts`).** If you add a new field, you must also add it to `filterNames` in `convex/rag/instance.ts` — which is a forbidden change because re-embedding the entire corpus is required.

---

#### `crawledChunks`

**The RAG corpus metadata. Vectors live in the `@convex-dev/rag` component — this table has NO `vectorIndex`.** The vector index lives in `rag` component's internal storage; the RAG component's `filterNames` (`["category","source"]`) are configured in `convex/rag/instance.ts`.

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `documentId` | `v.id("documents")` | yes | |
| `text` | `v.string()` | yes | ≤ `MAX_SAFE_CHARS` (7200, in `convex/crawl/chunking.ts`) — NOT `content` |
| `contentHash` | `v.string()` | yes | SHA-256 of `text` (per-chunk) |
| `ragId` | `v.string()` | yes | Entry id from `@convex-dev/rag` |
| `embeddingModel` | `v.string()` | yes | E.g. `"gemini-embedding-2"` |
| `parentText` | `v.optional(v.string())` | no | Surrounding context (for sandwich) |
| `headingPath` | `v.optional(v.array(v.string()))` | no | Markdown heading breadcrumb |
| `source` | `v.string()` | yes | Mirrors `documents.source` |
| `category` | `v.string()` | yes | Mirrors `documents.category` |
| `url` | `v.string()` | yes | Mirrors `documents.url` |
| `title` | `v.string()` | yes | |
| `chunkIndex` | `v.number()` | yes | Position within document |
| `tokenCount` | `v.number()` | yes | Approx |
| `createdAt` | `v.number()` | yes | |

**Forbidden:** do not change `embeddingDimension: 768` in `convex/rag/instance.ts` or its `filterNames: ["category","source"]`. Both require a full re-embed of the corpus.

**Idempotency:** `convex/crawl/deduplication.ts::findDuplicatesBatch` and `deleteDuplicateDocuments` paginate `crawledChunks` and dedup by `contentHash`.

---

#### `faqs`

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `question` | `v.string()` | yes | |
| `answer` | `v.string()` | yes | |
| `sourceUrl` | `v.optional(v.string())` | no | Optional source attribution |
| `expiresAt` | `v.optional(v.number())` | no | Optional expiry |
| `createdAt` | `v.number()` | yes | |

**Indexes:** `search_question` (search index only). NO `by_category`, NO `by_isActive`, NO `keywords` field.

---

#### `semanticCache`

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `queryEmbedding` | `v.array(v.number())` | yes | 768-dim |
| `queryText` | `v.string()` | yes | Original query |
| `response` | `v.string()` | yes | Cached LLM response |
| `sources` | `v.array(v.any())` | yes | Citation metadata |
| `model` | `v.string()` | yes | LLM model id (e.g. `groq/llama-4-scout-17b-16e-instruct`) |
| `tokenCount` | `v.optional(v.number())` | no | Tokens consumed |
| `hits` | `v.optional(v.number())` | no | Increments on hit (NOT `hitCount`) |
| `embeddingModel` | `v.string()` | yes | E.g. `"gemini-embedding-2"` |
| `sourceEntryIds` | `v.optional(v.array(v.string()))` | no | RAG entry ids used |
| `createdAt` | `v.number()` | yes | |
| `expiresAt` | `v.number()` | yes | Computed from `freshnessTier` arg at insert time (tier is NOT stored on the row) |

**Vector index:**

```ts
.defineVectorIndex("by_queryEmbedding", {
  vectorField: "queryEmbedding",
  dimensions: 768,
})
```

**TTL tiers** (defined locally in `convex/cache/set.ts` — NOT in `convex/constants.ts` which only exports `CACHE_SIMILARITY_THRESHOLD`):

| Tier | TTL constant | TTL | Used when |
| --- | --- | --- | --- |
| `high` | `TTL_HIGH` | 7 days | Factual, low-volatility (e.g. admission deadlines) |
| `medium` | `TTL_MEDIUM` | 2 days | Standard (default) |
| `low` | `TTL_LOW` | 1 day | Time-sensitive or volatile |

---

#### `processedWebhooks`

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `jobId` | `v.string()` | yes | Idempotency key (NOT `webhookId`) |
| `processedAt` | `v.number()` | yes | |
| `expiresAt` | `v.number()` | yes | For GC |

**Indexes:** `by_jobId`, `by_expiresAt`. NO `source` field.

**Idempotency:** `convex/crawl/webhook.ts` writes before processing; `WEBHOOK_DUPLICATE` thrown on collision.

---

#### `crawlDeadLetter`

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `url` | `v.string()` | yes | |
| `jobId` | `v.id("crawlJobs")` | yes | |
| `failureReason` | `v.string()` | yes | NOT `error` |
| `failureCount` | `v.number()` | yes | NOT `attempts` |
| `lastAttemptAt` | `v.number()` | yes | |
| `payload` | `v.optional(v.any())` | no | Original request payload |
| `status` | `v.union(...)` | yes | `"pending_retry" \| "abandoned" \| "in_progress"` |

**Indexes:** `by_status`, `by_jobId_and_url`. NO `nextRetryAt`.

**Retry cron:** every 4h, re-enqueue if `failureCount < 3`.

---

#### `crawlStats`

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `statsId` | `v.string()` | yes | Singleton key (NOT `date`) |
| `totalDocuments` | `v.number()` | yes | |
| `indexedDocuments` | `v.number()` | yes | |
| `processingDocuments` | `v.number()` | yes | |
| `failedDocuments` | `v.number()` | yes | |
| `pendingDocuments` | `v.number()` | yes | |
| `lastUpdatedAt` | `v.number()` | yes | |

**Indexes:** `by_statsId` (NOT `by_date`).

**Written by:** `convex/crawl/tasks.ts::aggregateDailyStats`.

---

#### `adminAuditLog`

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `userId` | `v.id("users")` | yes | Actor (admin) |
| `action` | `v.union(<12 literal strings>)` | yes | Strict union: e.g. `"user.login"`, `"crawl.start"`, `"admin.access"` (NOT free `v.string()`) |
| `target` | `v.optional(v.string())` | no | E.g. row id |
| `details` | `v.optional(v.any())` | no | JSON-serializable |
| `ipAddress` | `v.optional(v.string())` | no | |
| `createdAt` | `v.number()` | yes | |

**Indexes:** `by_userId`, `by_createdAt`, `by_action`.

---

#### `notifications`

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `userId` | `v.id("users")` | yes | |
| `type` | `v.union(v.literal("info"), v.literal("success"), v.literal("warning"), v.literal("error"))` | yes | 4-literal union (NOT free `v.string()`) |
| `title` | `v.string()` | yes | |
| `body` | `v.string()` | yes | |
| `isRead` | `v.boolean()` | yes | NOT `read` |
| `link` | `v.optional(v.string())` | no | |
| `createdAt` | `v.number()` | yes | |

**Indexes:** `by_userId`, `by_isRead` (NOT `by_read`).

---

#### `rateLimits`

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `key` | `v.string()` | yes | Just `userId` (NOT composite `"userId:action"`) — see `convex/rateLimit.ts:90` |
| `count` | `v.number()` | yes | Sliding count |
| `windowStart` | `v.number()` | yes | Start of window |

**Indexes:** `by_key` only. NO `expiresAt` field.

---

#### `appSettings`

In `schema.ts` (line 274). Used by `convex/admin/settings.ts::getSettings`/`upsertSetting`. Keyed by `(key, section)`.

| Field | Type | Notes |
| --- | --- | --- |
| `key` | `v.string()` | PK part |
| `value` | `v.any()` | JSON-serializable |
| `section` | `v.string()` | Used by `by_section` index for filtering |
| `updatedAt` | `v.number()` | |
| `updatedBy` | `v.id("users")` | |

**Known keys:**

| Key | Type | Default | Used by |
| --- | --- | --- | --- |
| `emergencyStop` | `v.boolean()` | `false` | `convex/emergencyStop.ts` |
| `crawl.enabled` | `v.boolean()` | `true` | `convex/crawl/actions.ts` |
| `cache.threshold` | `v.number()` | `0.92` | (currently uses constant) |
| `feature.betaReranker` | `v.boolean()` | `false` | `convex/reranking/rerank.ts` |

---

### 3.3 Vector index invariants

| Index | Table | Dim | Filter fields | Re-embed cost |
| --- | --- | --- | --- | --- |
| `by_queryEmbedding` | `semanticCache` | 768 | (none) | ~all cache rows |
| _(no `by_embedding 768 | `category`, `source` (via RAG `filterNames`) | ~all chunks |

**Change procedure if you absolutely must change vector index:**

1. Update `schema.ts` (schema change auto-deploys; index enters "building" state).
2. Trigger `convex/crawl/actions.ts` to re-embed the entire corpus via `embeddingWorkpool`.
3. Wait for index build (visible in Convex dashboard).
4. Update `CACHE_SIMILARITY_THRESHOLD` and any hard-coded `768` literals.
5. Re-embed the `semanticCache` rows.
6. Update all docs to reflect new dim.

**Don't do this lightly.** Always check `architecture.md` and the boundary doc first.

### 3.4 Tables in `@convex-dev/agent` component

Not in `convex/schema.ts`. Available via `components.agent.threads`, `components.agent.messages`, etc.

| Table | Used by | Notes |
| --- | --- | --- |
| `threads` | `convex/threads.ts` | Conversation threads |
| `messages` | `convex/messages.ts` | Per-message w/ role, content, sources |
| `streamingMessages` | (server-side) | Live streams |
| `toolCalls` | (future) | Tool invocations |
| `v.vector` | (future) | Per-thread memory |

**`components.agent.threads.createThread({...})`** — see [`@convex-dev/agent` docs](https://docs.convex.dev/agents/threads). Used to bootstrap a chat.

---

## 4. Public API Surface

Functions callable from the client. Listed by namespace → function name.

### 4.1 `auth`

| Function | Type | RBAC | Args | Returns |
| --- | --- | --- | --- | --- |
| `requireAuth` | `internal` | any | — | `Doc<"users">` (throws `ConvexError("Authentication required")`) |
| `requireAdmin` | `internal` | admin | — | `Doc<"users">` (throws `ConvexError("Admin access required")`) |
| `getUserId` | `internal` | any | — | `Id<"users"> \| null` |
| `isAuthenticated` | `internal` | any | — | `boolean` |
| `isAdmin` | `internal` | any | — | `boolean` (true for `admin` OR `superadmin`) |

> These are helpers imported by other functions, not exposed at `api.auth.*`.

### 4.2 `users`

| Function | Type | RBAC | Args | Returns |
| --- | --- | --- | --- | --- |
| `getOrCreate` | mutation | dual | `{ clerkId, name, email, imageUrl?, secret? }` | `Id<"users">` |
| `getByClerkId` | query | mixed | `{ clerkId: v.string() }` | `Doc<"users"> \| null` |
| `updatePreferences` | mutation | auth | `{ preferences: v.object(...) }` | `void` |

> `getOrCreate` auth is dual: `WEBHOOK_SECRET` env (when no JWT, e.g. from `src/app/api/webhooks/clerk/route.ts`) OR `identity.subject === args.clerkId` (when JWT is present). `role` defaults to `"user"` on insert, but checks `ADMIN_BOOTSTRAP_EMAIL` env var — if `args.email` matches, the inserted role is `"admin"` instead.
>
> **`upsertFromWebhook`** (`internalMutation`) syncs Clerk user data (including `publicMetadata.role`) into `convex.users`. It also logs role changes to `adminAuditLog` with action `"role.change"`. Bootstrap via `ADMIN_BOOTSTRAP_EMAIL` is applied only on user creation (not on updates), preventing silent re-promotion after deliberate demotion.
>
> **There is no `currentUser` or `updateRole` public mutation.** Admin role changes are performed via Clerk Backend API in `src/app/admin/users/actions.ts` (server actions), which trigger a Clerk webhook → `upsertFromWebhook` to sync the new role to Convex.

### 4.3 `threads`

| Function | Type | RBAC | Args | Returns |
| --- | --- | --- | --- | --- |
| `create` | mutation | auth | `{ title: "New Chat" }` | `v.string()` (NOT `Id<"agent.threads">`) — uses `components.agent.threads.createThread` with `userId: identity.subject` |
| `list` | query | auth | — | `Thread[]` |
| `rename` | mutation | auth | `{ threadId, title }` | `void` |
| `remove` | mutation | auth | `{ threadId }` | `void` |

> `convex/threads.ts` exports 4 public functions: `create`, `list`, `rename`, `remove`. Plus 2 internal helpers: `getOldArchivedUsersBatch`, `purgeOldArchived`. `use-threads.ts` correctly references `api.threads.rename` and `api.threads.remove` — no `(api.threads as any)` cast is needed.

### 4.4 `messages`

| Function | Type | RBAC | Args | Returns |
| --- | --- | --- | --- | --- |
| `insert` | mutation | auth | `{ threadId: v.string(), role: "user" \| "assistant", content, sources?, tokenCount? }` | `v.string()` (NOT `Id<"agent.messages">`) — defaults `tokenCount: 1000`; 50000-char content cap; calls `enforceRateLimit` |
| `list` | query | auth | `{ threadId }` | `Message[]` |

> `role` union is `v.union(v.literal("user"), v.literal("assistant"))` — **NO** `"system"` literal.
> `convex/messages.ts` exports `toAppSource` and `toComponentSource` helpers for transforming sources between Convex and component shapes.

### 4.5 `faq`

| Function | Type | RBAC | Args | Returns |
| --- | --- | --- | --- | --- |
| `addFaq` | mutation | admin | `{ question, answer, sourceUrl? }` | `Id<"faqs">` |
| `removeFaq` | mutation | admin | `{ id }` | `void` |
| `listFaqs` | query | auth | — | `FAQ[]` |
| `searchFaqs` | internal | internal | `{ query: string }` | `FAQ[]` (uses `search_question` index, top 3) |

### 4.6 `feedback`

| Function | Type | RBAC | Args | Returns |
| --- | --- | --- | --- | --- |
| `submit` | mutation | auth | `{ messageId, rating: "thumbsUp"\|"thumbsDown", category, comment? }` | `Id<"feedback">` (dedupes by `(messageId, userId)`; comment ≤ 2000 chars; returns existing id if user already rated) |
| `list` | query | auth | — | `Feedback[]` (admin sees all 50 desc; user sees own 50) |

### 4.7 `admin.settings`

| Function | Type | RBAC | Args | Returns |
| --- | --- | --- | --- | --- |
| `getSettings` | query | auth (admin) | `{ section?: v.string() }` | `Settings[]` (filters by `by_section` index when `section` provided; returns `[]` to non-admins; does NOT throw) |
| `upsertSetting` | mutation | admin | `{ key, value, section }` | `void` |
| `resetSettings` | mutation | admin | — | `void` |

### 4.8 `admin.stats`

| Function | Type | RBAC | Args | Returns |
| --- | --- | --- | --- | --- |
| `documentStats` | query | admin | `{}` | `{ total, indexed, pending, failed }` (via .paginate()) |
| `userStats` | query | admin | `{ refTime? }` | `{ total, activeLast24h }` (via .paginate()) |
| `feedbackStats` | query | admin | `{}` | `{ total (placeholder), recent[] }` (via .take(10)) |
| `feedbackCount` | query | admin | `{}` | `number` (via .paginate()) |
| `crawlStats` | query | admin | `{}` | `{ total (placeholder), recent[] }` (via .take(5)) |
| `crawlCount` | query | admin | `{}` | `number` (via .paginate()) |
| `cacheStats` | query | admin | `{}` | `{ total }` (via .paginate()) |

### 4.9 `crawl.*` (admin)

| Function | Type | RBAC | Args | Returns |
| --- | --- | --- | --- | --- |
| `trigger` | mutation | admin | `{ sitemapUrl? }` | `Id<"crawlJobs">` |
| `list` | query | auth/admin | `{ status?, limit? }` | `CrawlJob[]` |
| `status` | query | auth/admin | `{ jobId }` | `CrawlJob \| null` |
| `reset` | mutation | admin | `{ confirm: true }` | `void` |

### 4.10 `eval.*` (admin, **STUBS ONLY**)

| Function | Type | RBAC | Args | Returns |
| --- | --- | --- | --- | --- |
| `run` | action (stub) | admin | — | `Id<"evalRuns">` (stub — does NOT exist as fully implemented) |
| `results` | query (stub) | admin | — | `EvalResult[]` (stub — does NOT exist as fully implemented) |

> `getChunksByRagIds` and `evaluateSearch` **do not exist** in `convex/eval/` — they live in legacy `convex/eval.ts` at the root level. The `convex/eval/` directory contains only the `run.ts` and `results.ts` stubs.

### 4.11 `emergencyStop`

| Function | Type | RBAC | Args | Returns |
| --- | --- | --- | --- | --- |
| `stopBatch` | `internalMutation` | internal | — | `boolean` (true if more rows remain; mutates `documents.processing`→`failed` and `crawlJobs.running`→`cancelled` in 500-row batches) |
| `stopAll` | `internalAction` (default export) | internal | — | `void` (loops `stopBatch` via `ctx.runMutation`) |

> `emergencyStop.ts` is a **batch mutator**, not a flag check. There is no `isStopped` query and no `appSettings.emergencyStop` key.

---

## 5. Internal API Surface

Server-only functions. Imported by other Convex functions, not callable from client.

| Function | Type | File | Purpose |
| --- | --- | --- | --- |
| `enforceRateLimit` | (helper, NOT internal) | `rateLimit.ts` | Plain async helper: `enforceRateLimit(ctx, userId, tokenEstimate = 1000)`. Key is just `userId` (not composite). No `action` or `cost` arg. |
| `incrementHits` | internalMutation | `cache/internal_queries.ts` | Bump cache row `hits` (defensive `entry.hits ?? 0`) |
| `getCacheEntry` | internalQuery | `cache/internal_queries.ts` | Fetch cache row by id |
| `cleanupExpired` | internalMutation | `cache/internal_queries.ts` | Delete expired `semanticCache` rows ONLY (does NOT touch `processedWebhooks`) |
| `getDocByEntryId` | internalQuery | `cache/internal_queries.ts` | Reverse lookup for cache entry |
| `generateEmbeddingsInternal` | (helper) | `embeddings/generate.ts` | gemini-embedding-2 batch (4-key rotation, BATCH_THRESHOLD=2) |
| `searchDocumentsAction` | (public) `action` | `embeddings/search.ts` | Hybrid RRF (vector + keyword + faq) |
| `classifyQueryAction` | internalAction | `rag/routing.ts` | 7-way classification (Groq llama-3.1-8b-instant) |
| `retrieveContext` | internalAction | `rag/retrieval.ts` | Vector search + `scanForInjection` (applied to user query, NOT to retrieved chunks) (MAX_QUERY_LEN=2000) |
| `buildContext` | internalQuery | `rag/context.ts` | Sandwich context assembly |
| `rerank` | internalAction | `reranking/rerank.ts` | Optional HTTP rerank (RERANKER_URL); graceful fallback to position. Args use `text` (not `content`) and `topK` (not `topN`). |
| `cleanupOldRecords` | internalMutation | `crawl/jobs.ts` | Args: `{ limit?: v.number() }` (NOT `olderThanDays`); 7d/30d constants hardcoded inside |
| `aggregateDailyStats` | (public) `mutation` | `crawl/tasks.ts` | Update crawlStats (PUBLIC, not internal) |
| `queueChunksForEmbedding` | internalMutation | `crawl/mutations.ts` (NOT `deduplication.ts`) | Insert + dedup by contentHash |
| `kickoffDailyCrawl` | internalMutation | `crawl/workflow.ts` | Idempotency: no pending/running, no completed <23h ago |
| `updateJobState` | internalMutation | `crawl/workflow.ts` | Patch crawlJobs.status |
| `completeJobByTaskId` | internalMutation | `crawl/workflow.ts` | Mark job complete from external task id |
| `failStuckJobs` | internalMutation | `crawl/workflow.ts` | Cron helper: running > 2h → failed |
| `markStaleDocuments` | internalMutation | `crawl/staleness.ts` | 4 statuses (active/pending_embed/processing/indexed) → stale |
| `purgeStaleDocuments` | internalMutation | `crawl/staleness.ts` | Delete stale docs + chunks + RAG |
| `flagExpiredDocuments` | internalMutation | `crawl/staleness.ts` | Sets `isStale = true` on expired docs |
| `findDuplicatesBatch` | internalQuery | `crawl/deduplication.ts` | Paginate documents, return duplicates |
| `deleteDuplicateDocuments` | internalMutation | `crawl/deduplication.ts` | Paginate chunks, delete via RAG |
| `executeCrawlJob` | internalAction | `crawl/actions.ts` | Workpool step (sitemap merge + crawl4ai fetch + chunk + enqueue embedding) |
| `embedSingleChunk` | internalAction | `crawl/actions.ts` | Single-chunk embed (workpool task body) |
| `resetPipelineAction` | internalAction | `crawl/actions.ts` | Admin: triggers `resetPipelineBatch` loop |
| `runDeduplication` | internalAction | `crawl/actions.ts` | Runs `findDuplicatesBatch` + `deleteDuplicateDocuments` |
| `fastCount` | (helper) | `lib/db_helpers.ts` | `collect().length` wrapper (type-safe via `DatabaseReader` — no `.count()` or `@ts-expect-error`) |

> **Removed/wrong entries (kept out):** `enqueueCrawlJob` (NOT in `webhook.ts` — that file only has httpActions `crawlWebhook`/`resetWebhook`/`ingestWebhook`); `runCrawlJob` (NOT exported — actual is `executeCrawlJob` in `crawl/actions.ts`); `crawlWorkflow` (NOT exported from `workflow.ts` — the workflow component instance is registered globally in `convex.config.ts`; the daily cron calls `kickoffDailyCrawl` directly); `startCrawl` (does not exist); `crawlUrl` / `fetchSitemap` (private helpers in `actions.ts`, not exported).

> Internal functions are accessible via `internal.{namespace}.{function}` from other Convex functions. Frontend never calls these directly.

---

## 6. HTTP Routes

**File:** `convex/http.ts` (with route bodies in `convex/crawl/*`).

**3 POST routes** + 3 OPTIONS preflights (one per POST that takes JSON).

### 6.1 Start-up env guard

```ts
if (!process.env.CONVEX_AUTH_TOKEN && !process.env.CRAWL_WEBHOOK_SECRET) {
  throw new Error("Convex HTTP routes require CONVEX_AUTH_TOKEN or CRAWL_WEBHOOK_SECRET");
}
```

**Forbidden to remove.** Without this, the routes are open to the world.

### 6.2 `POST /api/webhook/crawl`

**File:** `convex/crawl/webhook.ts` · RBAC: `webhook` (HMAC)

| Aspect | Value |
| --- | --- |
| Auth | HMAC-SHA256 via `CRAWL_WEBHOOK_SECRET` (**DO NOT WEAKEN** — see `frontend_backend_boundaries.md`) |
| Skew | ±5 min on `X-Crawl-Timestamp` |
| Idempotency | `processedWebhooks` table (keyed by `jobId`) |
| Body | **Crawl4AI-shaped payload** `{ task_id, job_id, url, status, data, ... }` (NOT the `{ webhookId, status, jobId?, sitemapUrl?, error? }` shape previously documented) |
| Returns | `200 { ok: true }` or `4xx`/`5xx` with plain string error messages: `400 "Request timestamp expired"`, `401 "Invalid signature"` / `"Unauthorized"`, `500 "Server configuration error"` / `"Internal Server Error"` |

**State-change routing:**

- State-change notifications (`status: "started"`, etc.) are ACKNOWLEDGED without processing (see `webhook.ts:58-65`).
- Real completion/failure is handled by `completeJobByTaskId` (from `crawl/workflow.ts`) when the actual result payload arrives.
- There is NO `enqueueCrawlJob` exported from `webhook.ts` — that name was a fabrication.

### 6.3 `POST /ingest`

**File:** `convex/crawl/actions.ts` (handler `ingestWebhook` in `webhook.ts`) · RBAC: bearer (`CONVEX_AUTH_TOKEN`)

| Aspect | Value |
| --- | --- |
| Auth | `Authorization: Bearer ${CONVEX_AUTH_TOKEN}` |
| Body | `{ url, markdown, contentHash, crawlSessionId, sourceType }` (required) + optional `{ title, freshnessTier }` — **NOT** `{ urls: string[] }` |
| Returns | `200 { success: true, action: "skipped" \| "updated" \| "inserted" }` (NOT `{ jobId }`) |

### 6.4 `POST /api/reset`

**File:** `convex/crawl/webhook.ts` (`resetWebhook`) · RBAC: bearer (`CONVEX_AUTH_TOKEN`)

| Aspect | Value |
| --- | --- |
| Auth | Bearer (from `Authorization` header) |
| Body | NONE — no args |
| Returns | `200 { ok: true }` (NOT `{ reset: [...] }`); the reset work happens via `resetPipelineAction` which loops `resetPipelineBatch` |

**Destructive.** Bearer token is the only guard.

### 6.5 `OPTIONS /api/webhook/crawl`, `OPTIONS /ingest`, `OPTIONS /api/reset` (preflights)

CORS preflight handlers. Return standard CORS headers for the above routes.

---

## 7. Cron Schedule

**File:** `convex/crons.ts` — 7 jobs (1 disabled: crawl — Crawl4AI unreachable).

| Cron name | Schedule (UTC) | Handler | Purpose |
| --- | --- | --- | --- |
| `weekly-uet-webcrawl` | **DISABLED** (was `0 0 * * 0`) | `kickoffDailyCrawl` (from `crawl/workflow.ts`) | Weekly sitemap crawl — disabled because Crawl4AI Docker unreachable from Convex cloud |
| `daily-cleanup-expired-cache` | `0 1 * * *` | `cleanupExpiredCache` | Delete semanticCache rows past `expiresAt` |
| `daily-contextualize-chunks` | `0 3 * * *` | `contextualizeCron` | Contextualize 10 chunks/day via Gemini Flash |
| `staleness-check` | `0 4 * * *` | `checkStaleness` | Check document staleness |
| `retry-dead-letter` | `0 */4 * * *` | retry from `crawlDeadLetter` | Re-enqueue failed URLs (max 3 attempts) |
| `fail-stuck-crawl-jobs` | `0 */2 * * *` | mark `running > 3h` as failed | Prevent infinite-running jobs (was */30) |
| `cleanup-old-records` | `0 2 * * 0` | `cleanupOldRecords` | Weekly purge of old crawlJobs, feedback, notifications |
| `purge-old-archived-threads` | `0 3 * * 0` | (agent component call) | Delete archived threads |

**Removed crons:** `daily-uet-webcrawl` (replaced by weekly), `daily-cleanup-expired-v2` (redundant), `metrics-aggregation` (disabled).

**Adding a new cron:**

1. Edit `convex/crons.ts`. Convex auto-reloads.
2. The handler must be an `internalMutation` or `internalAction` defined elsewhere.
3. Document in this file (§7) and in `architecture.md` if it's a new subsystem.

**Do not add a cron that runs more often than every 15 minutes** unless you've justified it (e.g. `fail-stuck-crawl-jobs` is `0 */2 * * *`).

---

## 8. Auth Subsystem

### 8.1 `convex/auth.config.ts`

Registers the Clerk JWT provider.

```ts
{
  providers: [
    {
      domain: process.env.CLERK_JWT_ISSUER || "https://clerk-jwt-issuer-placeholder.com",
      applicationID: "uet-gpt",
    },
  ],
}
```

**`applicationID: "uet-gpt"`** is the JWT template name in Clerk. **Forbidden to change without also updating Clerk dashboard and re-deploying.**

### 8.2 `convex/auth.ts` helpers

| Function | Signature | Throws | Use when |
| --- | --- | --- | --- |
| `requireAuth(ctx)` | → `Promise<Doc<"users">>` | `ConvexError("Authentication required")` (string, NOT `UNAUTHENTICATED` code) | Need an authed user |
| `requireAdmin(ctx)` | → `Promise<Doc<"users">>` | `ConvexError("Admin access required")` (string, NOT `FORBIDDEN` code) | Admin-only |
| `getUserId(ctx)` | → `Promise<Id<"users"> \| null>` | — | Optional auth |
| `isAuthenticated(ctx)` | → `Promise<boolean>` | — | Branching |
| `isAdmin(ctx)` | → `Promise<boolean>` (true for `admin` or `superadmin`) | — | Branching |

**Pattern in mutations:**

```ts
export const myMutation = mutation({
  args: { ... },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);
    // ... use userId
  },
});
```

**Don't bypass `requireAuth` even in "internal-looking" mutations.** Convex functions are callable from any client that knows the function name.

### 8.3 `convex/users.ts`

| Function | Type | Args | Returns | Notes |
| --- | --- | --- | --- | --- |
| `getOrCreate` | mutation | `{ clerkId, name, email, imageUrl?, secret? }` | `Id<"users">` | Idempotent; dual auth (see §5.2). `role` defaults to `"user"`; checks `ADMIN_BOOTSTRAP_EMAIL` on insert. |
| `getByClerkId` | query | `{ clerkId: v.string() }` | `Doc<"users"> \| null` | Lookup by Clerk id |
| `updatePreferences` | mutation | `{ preferences: v.object(...) }` | `void` | Update user prefs |

> `convex/users.ts` exports 3 public functions + 2 internal webhook functions (`upsertFromWebhook`, `deleteFromWebhook`). There is **no** `currentUser` or `updateRole` public mutation. Admin role changes are performed via Clerk Backend API (server actions) which trigger a Clerk webhook → `upsertFromWebhook` syncs the role to the Convex DB. `ADMIN_BOOTSTRAP_EMAIL` is referenced in both `getOrCreate` and `upsertFromWebhook` for first-admin setup.

---

## 9. RAG Subsystem

### 9.1 `convex/rag/instance.ts` — RAG component singleton

```ts
import { RAG } from "@convex-dev/rag";
import { components } from "../_generated/api";

const resilientEmbeddingModel = {
  specificationVersion: "v3",
  provider: "convex-rag",
  maxEmbeddingsPerCall: 2048,
  supportsParallelCalls: true,
  modelId: "gemini-embedding-2",
  doEmbed: async (options: { values: string[] }) => {
    const { generateEmbeddingsInternal } = await import("../embeddings/generate.js");
    const embeddings = await generateEmbeddingsInternal(options.values);
    return { embeddings, warnings: [] };
  },
};

export const rag = new RAG(components.rag, {
  embeddingDimension: 768,
  textEmbeddingModel: resilientEmbeddingModel,
  filterNames: ["category", "source"],
});
```

**Why singleton:** the RAG instance is referenced by every RAG subsystem file; we want one config.

**Custom embedding model:** wraps `convex/embeddings/generate.ts::generateEmbeddingsInternal` with 4-key rotation (GEMINI_API_KEY → GEMINI_API_KEY_1 → GEMINI_API_KEY_2 → GOOGLE_GENERATIVE_AI_API_KEY), BATCH_THRESHOLD=2, exponential backoff.

### 9.2 `convex/rag/retrieval.ts` — hybrid search + injection scan

```ts
export const retrieveContext = internalAction({
  args: {
    query: v.string(),
    userId: v.id("users"),
    category: v.optional(v.string()),
  },
  handler: async (ctx, { query, userId, category }) => {
    if (query.length > MAX_QUERY_LEN) {
      throw new Error("INVALID_INPUT");
    }
    // NOTE: INJECTION_RE is applied to the USER QUERY via scanForInjection,
    // NOT to retrieved chunks. There is no post-retrieval content filter.
    const safeQuery = scanForInjection(query);
    const intent = await classifyQueryAction(ctx, safeQuery);
    const results = await searchDocumentsAction(ctx, { queryText: safeQuery, category, intent });
    return results;
  },
});
```

**`INJECTION_RE`** (in this file) is a regex blocklist for known prompt-injection patterns (e.g. `"ignore previous instructions"`, `"you are now"`), applied to the **user query** (via `scanForInjection`) before retrieval. There is NO post-retrieval content filter on chunks. Update it carefully — false positives drop legitimate queries.

### 9.3 `convex/rag/routing.ts` — intent classification + query rewrite + HyDE

```ts
export const classifyQueryAction = action({
  args: { query: v.string() },
  returns: intentValidator, // 7-way: admissions/academic/administrative/campus_life/general/off_topic/simple_fact
  handler: async (_ctx, args) => {
    if (!process.env.GROQ_API_KEY) return "general";
    const { object } = await generateObject({
      model: groq("llama-3.1-8b-instant"),
      schema: z.object({ intent: z.enum(INTENT_ENUM).describe("Query category about UET Taxila") }),
      prompt: `Classify the following user query about UET Taxila into one of the categories. Query: "${args.query}"`,
      temperature: 0,
    });
    return INTENT_ENUM.includes(object.intent) ? object.intent : "general";
  },
});

export const rewriteQueryAction = action({ ... }); // Roman Urdu → English keyword search
export const hydeQueryAction = internalAction({ ... }); // Hypothetical doc for embedding search
```

**Intents:** `admissions | academic | administrative | campus_life | general | off_topic | simple_fact`. On parse failure, defaults to `general`.

**Why a separate model:** keeps intent classification cheap and isolated from the main chat fallback chain.

### 9.4 `convex/rag/context.ts` — Sandwich context builder

Builds the prompt in the form:

```
[SYSTEM_PROMPT]
[FEW_SHOT examples]
---
[Retrieved chunk 1]
[Retrieved chunk 2]
...
---
[User query]
---
[Guardrail suffix: "Only use the above context..."]
```

**Why Sandwich:** injection attempts at the start or end of retrieved content are more likely to be ignored by the model when the user query is in the middle.

### 9.5 `convex/rag/prompts.ts` — SYSTEM_PROMPT + FEW_SHOT

Exports two constants:

- `SYSTEM_PROMPT` — the persistent system message.
- `FEW_SHOT_EXAMPLES` — array of `{ role, content }` example turns (export is `FEW_SHOT_EXAMPLES`, plural).

**Forbidden to remove FEW_SHOT wholesale** — drift in model behavior is the cost. Add examples, don't replace.

### 9.6 `convex/rag/testing.ts` — RAG seed data

Used in dev/test to seed `crawledChunks` and `faqs`. Not called in production paths.

---

## 10. Embeddings Subsystem

### 10.1 `convex/embeddings/generate.ts`

```ts
export const generate = action({
  args: { text: v.string() },  // singular, not array
  returns: v.array(v.float64()),
  handler: async (ctx, { text }) => {
    if (!text) return [];
    return await generateEmbeddingsInternal([text]);
    // BATCH_THRESHOLD = 2 is checked INSIDE generateEmbeddingsInternal:
    // >= 2 → batchEmbed, < 2 → singleEmbed
  },
});
```

- `BATCH_THRESHOLD = 2` (local to `convex/embeddings/generate.ts` — NOT in `constants.ts`)
- `dimensions = 768` (gemini-embedding-2)
- Retries: 3x exponential on 429/5xx, no retry on 4xx; 4-key rotation (GEMINI_API_KEY → GEMINI_API_KEY_1 → GEMINI_API_KEY_2 → GOOGLE_GENERATIVE_AI_API_KEY)

### 10.2 `convex/embeddings/search.ts`

```ts
export const searchDocumentsAction = action({  // public action, NOT internalAction
  args: {
    queryText: v.string(),
    queryEmbedding: v.optional(v.array(v.number())),
    hydeQuery: v.optional(v.string()),
    limit: v.optional(v.number()),
    category: v.optional(v.string()),
  },
  returns: v.array(<source>),
  handler: async (ctx, args) => {
    // 1. Embed query (unless queryEmbedding pre-supplied)
    // 2. rag.search(...) for vector results
    // 3. fullTextSearch(queryText) for keyword results
    // 4. hybridRank(vectorResults, keywordResults, K_RRF) — RRF k=60
    // 5. optional rerank via internal.reranking.rerank
  },
});
```

The function name is `searchDocumentsAction` (NOT `hybridSearch`); `hybridRank` is a private helper inside the file. Args differ from prior docs — uses `queryText` (not `query`) + `category` at top level (not nested in `opts`).

**`K_RRF = 60`** is the standard constant for RRF.

### 10.3 `convex/embeddings/doc_queries.ts` (verified, 66 lines)

> ⚠️ **`convex/embeddings/` contains 3 files:** `doc_queries.ts`, `generate.ts`, `search.ts` — there is no `index.ts` barrel export.

| Function | Type | Args | Returns | Behavior |
| --- | --- | --- | --- | --- |
| `getDocumentByEntryId` | internalQuery | `entryId: v.string()` | `v.union(v.null(), v.object({ url, title, category, crawledAt?, freshnessTier?, parentText?, headingPath? }))` | Looks up `crawledChunks` by `by_ragId` index first → joins to `documents`. Falls back to `documents.by_entryId` index if no chunk found |

**Type alias defined inline:** `DocQueryResult` (shape of the return value). Used by `convex/crawl/actions.ts` and the RAG retrieval path.

---

## 11. Reranking Subsystem

**File:** `convex/reranking/rerank.ts`

```ts
export const rerank = internalAction({
  args: {
    query: v.string(),
    documents: v.array(v.object({ text: v.string(), id: v.string() })),  // field is `text`, not `content`
    topK: v.optional(v.number()),                                          // arg is `topK`, not `topN`
  },
  handler: async (_ctx, { query, documents, topK = 5 }) => {
    if (!process.env.RERANKER_URL) {
      return documents.map((d, i) => ({ ...d, score: 1 - i / documents.length })); // 1 - i/N
    }
    const res = await fetch(`${process.env.RERANKER_URL}/rerank`, { method: "POST", body: JSON.stringify({ query, documents, top_n: topK }) });
    if (!res.ok) return documents.map((d, i) => ({ ...d, score: 1 - i / documents.length }));
    return await res.json();
  },
});
```

**Graceful degradation:** if `RERANKER_URL` is unset or errors, falls back to position-based scoring `1 - i/documents.length`. Never throws to caller.

---

## 12. Semantic Cache Subsystem

### 12.1 `convex/cache/get.ts`

```ts
export const get = action({  // public action, NOT internalAction; function name is `get`, not `searchOrCache`
  args: { query: v.string(), userId: v.id("users") },
  handler: async (ctx, { query, userId }) => {
    const queryEmbedding = await generate(ctx, { text: query });  // returns v.array(v.float64())
    const candidates = await ctx.vectorSearch("semanticCache", "by_queryEmbedding", {
      vector: queryEmbedding,
      limit: 1,  // limit is 1, not 5
    });
    for (const cand of candidates) {
      const similarity = cosineSimilarity(queryEmbedding, cand.queryEmbedding);
      if (similarity >= CACHE_SIMILARITY_THRESHOLD && cand.expiresAt > Date.now()) {
        await incrementHits(ctx, { id: cand._id });
        return { cached: true, response: cand.response, sources: cand.sources };
      }
    }
    return { cached: false };
  },
});
```

**`CACHE_SIMILARITY_THRESHOLD = 0.92`** from `convex/constants.ts`. Bumping it higher = more cache hits but more stale answers.

### 12.2 `convex/cache/set.ts`

```ts
export const set = internalMutation({  // function name is `set`, not `cacheResponse`
  args: {
    queryText: v.string(),
    queryEmbedding: v.array(v.number()),
    response: v.string(),
    sources: v.array(v.any()),
    model: v.string(),                                                                  // required
    tokenCount: v.optional(v.number()),
    ttlMs: v.optional(v.number()),
    freshnessTier: v.optional(v.union(v.literal("high"), v.literal("medium"), v.literal("low"))),  // arg is `freshnessTier`, not `tier`
    sourceEntryIds: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const ttl = args.ttlMs ?? TIER_TTL[args.freshnessTier ?? "medium"]; // high=7d, medium=2d, low=1d
    return await ctx.db.insert("semanticCache", {
      ...args,
      hits: 0,
      createdAt: Date.now(),
      expiresAt: Date.now() + ttl,
    });
  },
});
```

### 12.3 `convex/cache/internal_queries.ts`

| Function | Type | Purpose |
| --- | --- | --- |
| `getCacheEntry` | internalQuery | Fetch by `_id` |
| `incrementHits` (plural) | internalMutation | Bump `hits` |
| `getDocByEntryId` | internalQuery | Reverse lookup |
| `cleanupExpired` | internalMutation | Delete `semanticCache` rows where `expiresAt < now()` (NOT `processedWebhooks`) |

**`cleanupExpired` is idempotent.** Cron `daily-cleanup-expired-cache` (in `crawl/tasks.ts::cleanupExpiredCache` which is the multi-table variant) cleans BOTH `semanticCache` AND `processedWebhooks`. The `daily-cleanup-expired-v2` cron was removed (redundant). The `cache/internal_queries.ts::cleanupExpired` is no longer scheduled.

---

## 13. Crawl Pipeline

13 files, three layers: **ingress** (webhook, trigger), **execution** (workflow, workpools, actions, chunking, mutations), **queries/cleanup** (queries, jobs, tasks, status, list, reset).

### 13.1 `convex/crawl/webhook.ts` — ingress + HMAC

> **REMOVED.** `enqueueCrawlJob` is NOT exported from `convex/crawl/webhook.ts`. That file only exports 3 httpAction handlers: `crawlWebhook`, `resetWebhook`, `ingestWebhook`. The actual cron entry for daily crawl is `kickoffDailyCrawl` in `convex/crawl/workflow.ts`. The admin-trigger path is `convex/crawl/trigger.ts::trigger`.

### 13.2 `convex/crawl/workflow.ts` — workflow kickoff

> **`crawlWorkflow` and `startCrawl` do NOT exist** as exports. The file `convex/crawl/workflow.ts` exports 4 internal mutations only: `kickoffDailyCrawl`, `updateJobState`, `completeJobByTaskId`, `failStuckJobs`. The `@convex-dev/workflow` instance (`components.crawlWorkflow`) is registered globally in `convex/convex.config.ts` and used inside `kickoffDailyCrawl`.

### 13.3 `convex/crawl/actions.ts` — sitemap merge + crawl4AI

> `fetchSitemap` and `crawlUrl` are NOT exported. `fetchSitemapUrls` (lowercase `u`) is a private helper in `crawl/actions.ts:19`. The public/internal action is `executeCrawlJob` (see §5).
>
> **Crawl4AI** is the external fetcher; runs in the `crawlPool` to limit concurrency to 3.

### 13.4 `convex/crawl/workpools.ts`

```ts
export const crawlPool = new Workpool(components.crawlWorkpool, {  // name is crawlPool, NOT crawlWorkpool
  maxParallelism: 3,
  retry: { maxAttempts: 3, initialBackoffMs: 5_000 },
});

export const embeddingPool = new Workpool(components.embeddingWorkpool, {  // name is embeddingPool, NOT embeddingWorkpool
  maxParallelism: 3,
  retry: { maxAttempts: 5, initialBackoffMs: 4_000 }, // Gemini free tier — 5 attempts, not 3
});
```

**Don't bump `maxParallelism` past 3 for `embeddingPool`** without verifying your Gemini quota. 4s backoff is for free tier.

### 13.5 `convex/crawl/chunking.ts`

// MAX_SAFE_CHARS is a private const (NOT export const) at line 1
const MAX_SAFE_CHARS = 7200;

export const chunkMarkdown = (md: string, maxChars = 3000, overlap = 300): string[] => {
  // splits on heading boundaries, paragraphs, then chars
  // returns chunks each ≤ maxChars (capped to MAX_SAFE_CHARS = 7200)
};
```

**`MAX_SAFE_CHARS = 7200` ≈ 2000 tokens.** Larger chunks exceed gemini-embedding-2 input limit.

### 13.6 `convex/crawl/mutations.ts`

```ts
export const queueChunksForEmbedding = internalMutation({
  args: { documentId: v.id("documents"), chunks: v.array(v.string()) },
  handler: async (ctx, { documentId, chunks }) => {
    for (const chunk of chunks) {
      const hash = sha256(chunk);
      const existing = await ctx.db.query("crawledChunks")
        .withIndex("by_contentHash", q => q.eq("contentHash", hash))
        .first();
      if (existing) continue; // dedup
      await ctx.db.insert("crawledChunks", {
        documentId,
        content: chunk,
        contentHash: hash,
        // embedding filled by embeddingWorkpool
        source: "...",
        category: "...",
        url: "...",
        title: "...",
        chunkIndex: i,
        tokenCount: estimateTokens(chunk),
        createdAt: Date.now(),
      });
      await embeddingWorkpool.push(ctx, { chunkId: ... });
    }
  },
});
```

### 13.7 `convex/crawl/queries.ts`

| Function | Purpose |
| --- | --- |
| `fullTextSearch` | Search `crawledChunks.text` by keyword (uses `search_text` index) |
| `getDocumentCountByStatus` | Group count by status for stats |
| `getRecentDocs` | Recent docs for admin |
| `getDLQSample` | Dead-letter sample |
| `searchByUrl` | Lookup by URL |
| `getFailedDocs` | Failed docs for retry |
| `getPendingEmbedDocs` | Pending embed |
| `getDocsBySource` | Group by source |
| `getJobById` | Single job lookup |
| `getChunksForDoc` | Chunks for a doc (NOT `getChunksByDocument` — that name was fabricated) |
| `getChunksWithHeadings` | Chunks with heading path |

> `getChunksByDocument` does NOT exist. The correct function name is `getChunksForDoc`.

### 13.8 `convex/crawl/jobs.ts`

```ts
export const cleanupOldRecords = internalMutation({
  args: { limit: v.optional(v.number()) },  // arg is `limit`, not `olderThanDays`
  handler: async (ctx, { limit = 200 }) => {
    const dlqCutoff = Date.now() - 7 * 86_400_000;   // 7d hardcoded
    const jobCutoff = Date.now() - 30 * 86_400_000;  // 30d hardcoded
    // delete old crawlJobs (>30d), feedback (>7d), notifications (>30d), crawlDeadLetter (>7d)
  },
});
```

### 13.9 `convex/crawl/tasks.ts`

| Function | Type | Purpose |
| --- | --- | --- |
| `cleanupExpiredCache` | internalMutation | Multi-table: deletes `semanticCache` AND `processedWebhooks` rows where `expiresAt < now()` |
| `aggregateDailyStats` | (public) `mutation` | Updates `crawlStats` row (PUBLIC mutation, not internal) |

### 13.10 `convex/crawl/trigger.ts` — admin entry (verified)

```ts
// convex/crawl/trigger.ts (verified, 55 lines)
export const trigger = mutation({
  args: {
    url: v.string(),
    maxPages: v.optional(v.number()),                // default 10
    maxDepth: v.optional(v.number()),                // default 2
    includePaths: v.optional(v.array(v.string())),
    excludePaths: v.optional(v.array(v.string())),
    allowExternalLinks: v.optional(v.boolean()),     // default false
    startedBy: v.optional(v.id("users")),
    trigger: v.optional(v.union(v.literal("manual"), v.literal("scheduled"), v.literal("webhook"))),  // default "manual"
  },
  handler: async (ctx, args) => { /* requires requireAdmin; throws ConvexError if pending; inserts crawlJobs + enqueues crawlPool */ }
});
```

Throws `ConvexError("A crawl job is already pending")` if a pending job already exists. Inserts a `crawlJobs` row and enqueues `internal.crawl.actions.executeCrawlJob` to the `crawlPool`.

### 13.11 `convex/crawl/status.ts`, `list.ts`, `reset.ts` (verified)

| File | Function | Type | RBAC | Returns |
| --- | --- | --- | --- | --- |
| `convex/crawl/status.ts` | `status` | query | requireAdmin | `v.union(v.null(), <crawlJobsValidator>)` — straight `ctx.db.get(jobId)` |
| `convex/crawl/list.ts` | `list` | query | requireAdmin | `v.array(<crawlJobsValidator>)` — hardcoded `take(20)` |
| `convex/crawl/reset.ts` | `resetDLQ` | mutation | requireAdmin | `v.number()` — takes 500 `crawlDeadLetter` rows with `status: "abandoned"`, patches to `"pending_retry"` + `failureCount: 0` |

### 13.12 `convex/crawl/reset_ops.ts` — internal batched ops (verified, 192 lines, 4 exports)

| Function | Type | Args | Returns | Behavior |
| --- | --- | --- | --- | --- |
| `resetAbandonedDLQ` | internalMutation | `limit?: v.number()` (default 200) | `{ resetCount, remaining: "more" \| "done" }` | Patches all `crawlDeadLetter.status: "abandoned"` → `"pending_retry"` (paginated) |
| `resetPipelineBatch` | internalMutation | `limit?: v.number()` (default 200) | `{ deleted, remaining: "more" \| "done" }` | Multi-table batched wipe: `crawledChunks` (with `rag.delete` per chunk) → `documents` → `crawlDeadLetter` → `processedWebhooks` → `crawlJobs` → `crawlStats`. One table per call; needs repeated calls. |
| `resetFailedDocuments` | internalMutation | `limit?: v.number()` (default 200) | `{ reset, remaining: "more" \| "done" }` | Patches `documents.status: "failed"` → `"pending_embed"` |
| `reembedPendingBatch` | internalMutation | `limit?: v.number()` (default 10) | `{ processed, chunksQueued, remaining: "more" \| "done" }` | Loads pending_embed docs, paginates their chunks, gets/creates `"uet-global"` RAG namespace, enqueues each chunk to `embeddingPool` via `internal.crawl.actions.embedSingleChunk` with `onComplete: internal.crawl.mutations.onChunkEmbedded`. Patches doc to `"processing"`. If chunks missing, marks as `"failed"`. |

> `convex/crawl/reset.ts::resetDLQ` (public, cap 500) and `convex/crawl/reset_ops.ts::resetAbandonedDLQ` (internal, paginated) **overlap in purpose** but are not duplicates — the public one is for the admin UI button; the internal one is for cron-driven maintenance.

### 13.13 `convex/crawl/backfill.ts` — one-shot migration (verified, 38 lines)

```ts
// convex/crawl/backfill.ts
export const run = internalMutation({
  args: {},
  returns: v.string(),  // "Updated N documents..."
  handler: async (ctx) => {
    // Paginates `documents` via `by_crawledAt` (100/page)
    // For docs where `chunksEmbedded === undefined`:
    //   - if status === "indexed" → set chunksEmbedded = chunkCount || 0
    //   - else → count existing crawledChunks via by_documentId (take 200) and set that count
  }
});
```

One-shot migration to populate the `chunksEmbedded` field on existing `documents`. Run once, then ignore.

### 13.14 `convex/crawl/deduplication.ts` (verified, 51 lines)

| Function | Type | Args | Returns | Behavior |
| --- | --- | --- | --- | --- |
| `findDuplicatesBatch` | internalQuery | `cursor: v.union(v.string(), v.null())` | pagination result | Paginates `documents` via `by_url` index, 500 items/page |
| `deleteDuplicateDocuments` | internalMutation | `documentIds: v.array(v.id("documents"))` | `{ deleted: number }` | For each doc: paginates its `crawledChunks` (500/page), deletes each chunk's RAG vector via `rag.delete()`, then deletes the chunk row, then deletes the doc |

---

## 14. Rate Limiting

**Two layers, no in-memory layer** (verified):

| Layer | Where | Limit | Storage |
| --- | --- | --- | --- |
| Upstash (Next.js) | `src/lib/rate-limit.ts` | user 50/h, admin 200/h, anon 10/h | Redis sliding window (`Ratelimit.slidingWindow`) |
| Convex | `convex/rateLimit.ts` | 10 msg/min/user, 100K tok/min global | `rateLimits` table sliding window |

**Convex layer** (verified file `convex/rateLimit.ts`):

```ts
// enforceRateLimit is a plain async helper (NOT a Convex function — not internalMutation).
// Called from inside other mutations/actions.
export async function enforceRateLimit(
  ctx: MutationCtx,
  userId: string,                // string, not v.id("users")
  tokenEstimate: number = 1_000, // arg is `tokenEstimate`, not `cost` (default 1000, not 1)
): Promise<void> {
  // Per-user key: just `userId` (NOT composite `${userId}:${action}`)
  // Global key: "global" (limit: 100k tokens/min)
  // Sliding window via rateLimits table
}
```

The Upstash layer is the first check; `safeLimit` returns `{ success: true, limit: 0, remaining: 0, reset: 0 }` if Upstash is unavailable, so the Convex layer still applies. See `reference.cross-cutting.md` §5.6 for the layer picker.

---

## 15. Admin Subsystem

### 15.1 `convex/admin/settings.ts` (verified)

| Function | Type | Args | Returns |
| --- | --- | --- | --- |
| `getSettings` | query (auth — admin) | — | `Settings[]` (returns `[]` to non-admins; does NOT throw) |
| `upsertSetting` | mutation (admin) | `{ key, value }` | `void` |
| `resetSettings` | mutation (admin) | — | `void` |

### 15.2 `convex/admin/stats.ts` (verified)

| Function | Type | Args | Returns |
| --- | --- | --- | --- |
| `documentStats` | query (admin) | `{}` | `{ total, indexed, pending, failed }` — paginates all docs via cursor loop |
| `userStats` | query (admin) | `{ refTime? }` | `{ total, activeLast24h }` — paginates all users via cursor loop |
| `feedbackStats` | query (admin) | `{}` | `{ total, recent[] }` — uses `.take(10)` for recent |
| `feedbackCount` | query (admin) | `{}` | `number` — paginates all feedback via cursor loop |
| `crawlStats` | query (admin) | `{}` | `{ total, recent[] }` — uses `.take(5)` for recent |
| `crawlCount` | query (admin) | `{}` | `number` — paginates all crawl jobs via cursor loop |
| `cacheStats` | query (admin) | `{}` | `{ total }` — paginates all cache entries via cursor loop |

### 15.3 Admin user management (server actions)

`src/app/admin/users/actions.ts` — Next.js server actions for admin user management via Clerk Backend API:

| Function | Purpose | Auth | Rate-limited |
| --- | --- | --- | --- |
| `searchUsers` | Search users by name/email | Clerk API `publicMetadata.role` (live, not JWT) | No |
| `setUserRole` | Set user role in Clerk | Clerk API (live) | Yes (30/min via Upstash) |
| `removeUserRole` | Remove admin role | Clerk API (live) | Yes (30/min via Upstash) |

> Server actions re-verify admin role via `clerkClient().users.getUser(userId)` (live Clerk API), not just JWT claims. Role change mutations use `checkAdminActionRateLimit`. Changes in Clerk trigger a webhook → `upsertFromWebhook` syncs to Convex.

### 15.4 Audit logging

Role changes are logged to `adminAuditLog` (action: `"role.change"`) automatically in `convex/users.ts::upsertFromWebhook` when the webhook detects a role change. See schema `adminAuditLog` for the full action union.

### 15.5 Permission matrix

Two permission matrix definitions — `convex/auth.ts` (server-side canonical) and `src/lib/permissions.ts` (client-side mirror). Both must be kept in sync. See `convex/auth.ts:15` for the full `Permission` type and `ROLE_PERMISSIONS` map.

---

## 16. FAQ, Feedback, Threads, Messages, Users

### 16.1 FAQ (`convex/faq.ts`) (verified)

| Function | Type | Notes |
| --- | --- | --- |
| `addFaq` | mutation (admin) | Validates + inserts |
| `removeFaq` | mutation (admin) | Removes by id |
| `listFaqs` | query | Lists all active FAQs |
| `searchFaqs` | internal (query) | Uses `search_question` search index, top 3 results |

### 16.2 Feedback (verified)

| File | Function | Type | Notes |
| --- | --- | --- | --- |
| `convex/feedback/submit.ts` | `submit` | mutation (auth) | Dedupes by `(messageId, userId)`, 2000-char comment cap |
| `convex/feedback/list.ts` | `list` | query (auth) | Admin sees all 50 (ordered desc); user sees own 50 |

> There is **NO** `convex/feedback.ts` wrapper — the public functions are exported directly from `convex/feedback/{submit,list}.ts`.

### 16.3 Threads (`convex/threads.ts`) (verified)

| Function | Type | Maps to |
| --- | --- | --- |
| `create` | mutation (auth) | `components.agent.threads.createThread` (with `userId: identity.subject`); returns `v.string()` |
| `list` | query (auth) | Returns `threadValidator[]` |
| `rename` | mutation (auth) | `{ threadId, title }` → `void` |
| `remove` | mutation (auth) | `{ threadId }` → `void` |

> All 4 public functions are exported. `use-threads.ts` calls `api.threads.rename` and `api.threads.remove` directly — no `(api.threads as any)` cast needed.

### 16.4 Messages (`convex/messages.ts`) (verified)

| Function | Type | Args | Returns |
| --- | --- | --- | --- |
| `insert` | mutation (auth) | `{ threadId: v.string(), role: "user" \| "assistant", content, sources?, tokenCount? }` | `v.string()` (defaults `tokenCount: 1000`; 50000-char content cap; calls `enforceRateLimit`) |
| `list` | query (auth) | `{ threadId }` | `Message[]` |

**`role`** is `v.union(v.literal("user"), v.literal("assistant"))` — **NO `"system"` literal**.
**Helpers:** `toAppSource` and `toComponentSource` transform sources between Convex and component shapes.
**Validators:** in `convex/messages/validator.ts` — `sourcesValidator` (with `entryId`), `tokenCountValidator` (prompt/completion/total), `messageValidator`.

### 16.5 Users (`convex/users.ts`)

**3 public functions** (`getOrCreate`, `getByClerkId`, `updatePreferences`) + **2 internal functions** (`upsertFromWebhook`, `deleteFromWebhook`). See §4.2 above.

---

## 16A. Document Subsystem (`convex/doc/*`)

**7 files, all flat in `convex/doc/`** (no subdirectories). All ops require `requireAuth` except `remove` which requires `requireAdmin`.

| File | Exports | Notes |
| --- | --- | --- |
| `convex/doc/index.ts` | barrel re-export of `create`/`updateStatus` (from create), `get`/`getByUrl` (from get), `list`, `remove`, `search`, `documentValidator` value + `DocumentValidator` type | 7 lines |
| `convex/doc/create.ts` | `create` (internalMutation), `updateStatus` (internalMutation) | `create` dedupes by URL index; `updateStatus` accepts 7 status literals (in sync with validator) |
| `convex/doc/get.ts` | `get` (query), `getByUrl` (query) | both `requireAuth`; `getByUrl` uses `by_url` index |
| `convex/doc/list.ts` | `list` (query) | requires `requireAuth`; routes through `by_status`, `by_category`, or unindexed full table take. **`cursor` arg is declared but IGNORED** — pagination not actually implemented |
| `convex/doc/remove.ts` | `remove` (mutation) | requires `requireAdmin`; if document has `entryId`, calls `rag.deleteAsync()` (errors logged, not thrown); then `ctx.db.delete(documentId)` |
| `convex/doc/search.ts` | `search` (query) | requires `requireAuth`; uses `search_title` search index, then client-side filters by category (Convex search indexes don't support combined `.eq()`) |
| `convex/doc/validator.ts` | `documentValidator` (value), `DocumentValidator` (type) | **7 status literals** (per validator): `pending`, `processing`, `indexed`, `failed`, `stale`, `active`, `pending_embed`. `updateStatus` also accepts all 7 — now in sync |

**Document status state machine (7 values, per `documentValidator`):**

```
pending → processing → indexed
   ↓            ↓          ↓
failed ←─── failed ←───  stale
   ↓
pending_embed
```

**Consumed by:** `convex/explore/*` (search/list), `convex/admin/*` (browser, delete), `convex/crawl/*` (upsert, status transitions).

---

## 17. Emergency Stop

**File:** `convex/emergencyStop.ts` (verified)

**`emergencyStop.ts` is NOT a flag check — it is an active batch mutator.** The exported functions are:

- `stopBatch` (`internalMutation`): batch-updates `documents` rows with `status="processing"` → `status="failed"` and `crawlJobs` rows with `status="running"` → `status="cancelled"` in batches of 500. Returns `boolean` (true when there are still rows to process).
- `stopAll` (`internalAction`, default export): loops `stopBatch` via `ctx.runMutation` until done.

**There is no `isEmergencyStopped` query and no `appSettings.emergencyStop` key in the verified code.** The "stop" semantic is "stop the current work" — it is invoked from admin UIs and crons, not checked at request time.

**`convex/admin/settings.ts::getSettings` returns `[]` to non-admins** (does NOT throw). `upsertSetting` and `resetSettings` are admin-gated mutations.

---

## 18. Component Registrations

**File:** `convex/convex.config.ts` (verified)

```ts
import { defineApp } from "convex/server";
import agent from "@convex-dev/agent/convex.config";
import rag from "@convex-dev/rag/convex.config";
import crawlWorkflow from "@convex-dev/workflow/convex.config";
import workpool from "@convex-dev/workpool/convex.config";

const app = defineApp();
app.use(agent);
app.use(rag);
app.use(crawlWorkflow);
app.use(workpool, { name: "embeddingWorkpool" });
app.use(workpool, { name: "crawlWorkpool" });
export default app;
```

**Five components (verified):**

| Component | Where used | Code reference |
| --- | --- | --- |
| `agent` | `convex/threads.ts`, `convex/messages.ts` | `components.agent.threads.*` |
| `rag` | `convex/rag/instance.ts` | `components.rag` |
| `crawlWorkflow` | `convex/crawl/workflow.ts` | `components.crawlWorkflow` |
| `embeddingWorkpool` | `convex/crawl/workpools.ts` | `components.embeddingWorkpool` (maxParallelism=3, 5 retries, 4s base ×2) |
| `crawlWorkpool` | `convex/crawl/workpools.ts` | `components.crawlWorkpool` (maxParallelism=3, 3 retries, 5min base ×3) |

**Adding a new component** (rare): register in `convex.config.ts`, install the package, add to `components` in `convex/_generated/api`.

---

## 19. Eval Subsystem (Python-Driven)

The `convex/eval/` stubs (`run.ts`, `results.ts`) were **deleted in v15.0** as dead code. The Python harness (`scripts/eval/run_eval.py`) is the only real implementation. It calls the legacy top-level `convex/eval.ts` functions (`getChunksByRagIds`, `evaluateSearch`) which ARE registered in `_generated/api.d.ts`.

### 19.2 `convex/eval.ts` (legacy top-level file)

The file at `convex/eval.ts` is **NOT a stub** — it is 55 lines and contains real working implementations:

| Function | Type | Purpose |
| --- | --- | --- |
| `getChunksByRagIds` | internalQuery | Fetch chunks by RAG entry ids |
| `evaluateSearch` | (public) `action` | Runs `rag.search` for an eval query and returns results |

Both are registered in `convex/_generated/api.d.ts:47,114`. The Python harness imports them via `api.eval.evaluateSearch` / `api.eval.getChunksByRagIds`. Do NOT delete this file — it backs the eval harness.

---

## 20. Validators

### 20.1 `convex/doc/validator.ts`

| Validator | Used for | Notes |
| --- | --- | --- |
| `documentValidator` (value) | Document insert/update | All 19 fields: _id, _creationTime, url, title, entryId, contentHash, source, category, subcategory, metadata, status (7 literals), chunkCount, chunksEmbedded, crawlSessionId, freshnessTier, isStale, crawledAt, updatedAt, error |
| `DocumentValidator` (type) | TypeScript type | Inferred from validator |

> **`documentStatusValidator` and `documentPatchValidator` do NOT exist** as separate exports in `convex/doc/validator.ts`. Status transitions are done inline via `v.union(...)` in the mutator args.

### 20.2 `convex/messages/validator.ts`

| Validator | Used for | Notes |
| --- | --- | --- |
| `sourcesValidator` | `messages.sources` array element | Shape: `{ documentId?, chunkId?, entryId?, url, title, relevanceScore, excerpt, headingPath? }` |
| `tokenCountValidator` | Token accounting | `{ prompt, completion, total }` |
| `messageValidator` | Full message shape | Includes `role` (no `system` literal) + `sources` + `tokenCount` |

> **`messageInsertValidator` and `messageRoleValidator` do NOT exist** as separate exports. `role` is inlined in `messageValidator`.

**Source shape (actual, from `messages/validator.ts`):**

```ts
{
  documentId: v.optional(v.string()),  // NOT v.id("documents") — optional
  chunkId: v.optional(v.string()),     // NOT v.id("crawledChunks") — optional
  entryId: v.optional(v.string()),     // RAG entry id
  url: v.string(),
  title: v.string(),
  relevanceScore: v.number(),          // field is `relevanceScore`, not `score`
  excerpt: v.string(),
  headingPath: v.optional(v.array(v.string())),
}
```

### 20.3 Reuse rule

If you add a field to `crawledChunks` (e.g. `language`), check:

1. `convex/schema.ts` for the new field
2. `convex/doc/validator.ts` for the new field
3. `convex/messages/validator.ts` if it appears in sources
4. `convex/rag/retrieval.ts` if it's a filter dimension
5. Type mirrors in `src/lib/types.ts` (see `reference.cross-cutting.md` §5.3)

**All five must change together** for type safety.

---

## 21. Constants Reference

**File:** `convex/constants.ts` — verified to export ONLY `CACHE_SIMILARITY_THRESHOLD = 0.92` (1 line).

All other "constants" are local to their consuming files. The table below is the verified inventory:

| Constant | Value | Defined in | Forbidden to change? |
| --- | --- | --- | --- |
| `CACHE_SIMILARITY_THRESHOLD` | `0.92` | `convex/constants.ts` (re-exported by `src/lib/constants.ts`) | Tunable |
| `MAX_QUERY_LEN` | `2_000` | `rag/retrieval.ts` (local) | Tunable |
| `BATCH_THRESHOLD` | `2` | `embeddings/generate.ts` (local) | Tunable |
| `MAX_SAFE_CHARS` | `7_200` | `crawl/chunking.ts` (local) | Tunable |
| `TTL_HIGH` | `7 * 86_400_000` ms (7d) | `cache/set.ts` (local) | Tunable |
| `TTL_MEDIUM` | `2 * 86_400_000` ms (2d) | `cache/set.ts` (local) | Tunable |
| `TTL_LOW` | `1 * 86_400_000` ms (1d) | `cache/set.ts` (local) | Tunable |
| `EMBEDDING_DIM` | `3_072` | `rag/instance.ts` | **Forbidden** (re-embed cost) |
| `FILTER_NAMES` | `["category", "source"]` | `rag/instance.ts` | **Forbidden** (re-embed cost) |
| Workpool: `crawlPool` | maxParallelism=3, retries=3, 5min base ×3 | `crawl/workpools.ts` | Tunable (verify quota) |
| Workpool: `embeddingPool` | maxParallelism=3, retries=5, 4s base ×2 | `crawl/workpools.ts` | Tunable (verify Gemini quota) |
| UET seed URLs | 23 entries | `src/lib/constants.ts:3-27` (UET_CRAWL_CONFIG) | Tunable (verify allowlist) |
| UET crawl limits | maxPages=500, maxDepth=5 | `src/lib/constants.ts` (UET_CRAWL_CONFIG) | Tunable (verify rate budget) |

---

## Appendix A: Forbidden changes quick reference

| Path | Don't change |
| --- | --- |
| `schema.ts` vector indexes | dim, filterFields |
| `auth.config.ts` | `applicationID` |
| `crawl/webhook.ts` | HMAC verify, timestamp skew |
| `http.ts` | Start-up env guard |
| `rag/prompts.ts` | Wholesale removal of FEW_SHOT |
| `embeddings/generate.ts` | Batch threshold without re-index test |
| `lib/db_helpers.ts` | `fastCount` signature (`.collect().length` — type-safe) |
