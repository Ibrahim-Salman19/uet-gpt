# UET Taxila GPT — Architecture

**Single Source of Truth** — Read this file fully before implementing any task.
A change not documented here did not happen.

---

## Quick Reference

- **What**: Autonomous RAG chatbot for UET Taxila (Next.js 16 + Convex + Clerk + Python crawler)
- **Stack**: TypeScript (frontend + API), Python (crawler), Convex (DB + serverless)
- **Key files**: `convex/schema.ts` (DB), `convex/rag/retrieval.ts` (RAG), `src/app/api/chat/route.ts` (chat API)
- **Critical invariant**: 768-dim embeddings — never change without full re-embed
- **Full architecture**: Read this file section by section as needed

---

## Table of Contents

| Section | Lines | Topic |
|---------|-------|-------|
| §1 | 47-51 | Project Identity |
| §2 | 53-69 | Stack Overview |
| §3 | 72-193 | Directory Structure |
| §4 | 197-416 | Database Schema (16 tables) |
| §5 | 419-453 | RAG Pipeline |
| §6 | 456-549 | Crawl Pipeline |
| §7 | 552-627 | Security Architecture |
| §8 | 630-671 | Deployment + Env Vars |
| §9 | 675-692 | Cron Jobs |
| §10 | 695-719 | Embedding Strategy |
| §11 | 722-736 | Semantic Cache |
| §12 | 739-774 | Testing Architecture |
| §13 | 777-794 | Evaluation |
| §14 | 797-824 | Component Configuration |
| §15 | 827-840 | HTTP Router |
| §16 | 844-907 | Admin Dashboard |
| §17 | 910-936 | Dual-Environment (Windows/WSL) |
| §18 | 939-949 | Key Utility Functions |
| §19 | 952-1047 | Frontend Component Tree |
| §20 | 1050-1116 | Streaming & StreamRegistry |
| §21 | 1119-1218 | Test Inventory |
| §22 | 1221-1282 | CI/CD + Deployment |

---

## 1. Project Identity

UET Taxila GPT is an autonomous RAG pipeline chatbot for UET Taxila. It answers questions about admissions, departments, fees, exams, faculty, and campus life using a hybrid search + LLM generation pipeline over a corpus of crawled university web pages and ingested PDFs.

---

## 2. Stack Overview

| Layer | Technology |
|-------|-----------|
| **Frontend** | Next.js 16.2.6 (App Router, Turbopack), React 19.2.4, Tailwind CSS 4, Radix UI |
| **Backend** | Convex (cloud-hosted real-time DB + serverless functions) |
| **Auth** | Clerk (`@clerk/nextjs` v7.3.7) — session management, RBAC (user/admin/superadmin) |
| **LLM Orchestration** | Vercel AI SDK (`ai` v6, `@ai-sdk/react`, `@ai-sdk/groq`, `@ai-sdk/google`, `@ai-sdk/cerebras`) |
| **Vector DB** | Convex native `vectorIndex` (768 dimensions for semantic cache and RAG) |
| **Caching** | Convex `semanticCache` table with cosine similarity + Upstash Redis (`@upstash/ratelimit`) |
| **Crawler** | Python async BFS (`curl_cffi`, `trafilatura`) → POST `/ingest` (primary). Also supports external crawl4AI service → POST `/api/webhook/crawl` (secondary). |
| **RAG** | `@convex-dev/rag` (embedding, indexing, retrieval), `@convex-dev/agent` (agent framework) |
| **Workflow** | `@convex-dev/workflow` + `@convex-dev/workpool` (async task orchestration) |
| **Monitoring** | Sentry (`@sentry/nextjs` v10) |
| **Testing** | Vitest 4.1.7 + Playwright 1.60 + Testing Library |
| **CI** | Biome (lint), TypeScript strict, Vitest, Playwright |

---

## 3. Directory Structure

```
├── convex/                          # Convex backend (serverless functions)
│   ├── _generated/                  # Auto-generated API bindings
│   ├── admin/                       # Admin dashboard queries/mutations
│   │   ├── settings.ts              #   getSettings, upsertSetting, resetSettings
│   │   └── stats.ts                 #   Split queries (1 paginated each): documentStats, userStats, feedbackStats, feedbackCount, crawlStats, crawlCount, cacheStats, deleteDocument, deleteFeedback
│   ├── cache/                       # Semantic cache
│   │   ├── get.ts                   #   Cache lookup (vector search + cosine threshold)
│   │   ├── set.ts                   #   Cache write (TTL tiers, sourceEntryIds)
│   │   └── internal_queries.ts      #   getCacheEntry, incrementHits, getDocByEntryId, cleanupExpired
│   ├── crawl/                       # Crawl pipeline (17 files)
│   │   ├── webhook.ts               #   HTTP actions: crawlWebhook, ingestWebhook, resetWebhook
│   │   ├── actions.ts               #   executeCrawlJob, embedSingleChunk, resetPipelineAction, runDeduplication
│   │   ├── mutations.ts             #   queueChunksForEmbedding, saveEmbedding, onChunkEmbedded, retryDLQ, upsert, enqueue
│   │   ├── queries.ts               #   fullTextSearch, getDocumentCountByStatus, getRecentDocs, searchByUrl, etc.
│   │   ├── tasks.ts                 #   cleanupExpiredCache, aggregateDailyStats
│   │   ├── jobs.ts                  #   cleanupOldRecords (abandoned DLQ + old crawl jobs)
│   │   ├── workflow.ts              #   kickoffDailyCrawl, updateJobState, completeJobByTaskId, failStuckJobs
│   │   ├── trigger.ts               #   Manual crawl trigger (admin mutation)
│   │   ├── backfill.ts              #   Backfill chunksEmbedded counter
│   │   ├── deduplication.ts         #   findDuplicatesBatch, deleteDuplicateDocuments
│   │   ├── staleness.ts             #   markStaleDocuments, purgeStaleDocuments, flagExpiredDocuments
│   │   ├── reset.ts                 #   resetDLQ (admin mutation)
│   │   ├── reset_ops.ts             #   resetPipelineBatch, reembedPendingBatch, resetAbandonedDLQ, resetFailedDocuments
│   │   ├── chunking.ts              #   chunkMarkdown, guardChunkSize, normalizeContent, assignFreshnessTier, canonicalizeUrl
│   │   ├── workpools.ts             #   embeddingPool (maxParallelism:3), crawlPool (maxParallelism:3)
│   │   ├── status.ts                #   Crawl job status query (admin)
│   │   └── list.ts                  #   Recent crawl jobs list (admin)
│   ├── doc/                         # Document CRUD (create, get, list, remove, search via index.ts)
│   │   ├── index.ts                 #   Re-exports all doc operations
│   │   ├── validator.ts             #   documentValidator type (19 fields: _id, _creationTime, url, title, entryId, contentHash, source, category, subcategory, metadata, status, chunkCount, chunksEmbedded, crawlSessionId, freshnessTier, isStale, crawledAt, updatedAt, error)
│   │   ├── create.ts
│   │   ├── get.ts
│   │   ├── list.ts
│   │   ├── remove.ts
│   │   └── search.ts
│   ├── embeddings/                  # Embedding generation
│   │   ├── generate.ts              #   Gemini API embedding (key rotation, retry, batch)
│   │   ├── search.ts                #   Hybrid search (vector + BM25 + RRF + freshness decay + FAQ boost)
│   │   └── doc_queries.ts           #   getDocumentByEntryId (internal query for metadata enrichment)
│   ├── eval.ts                      #   getChunksByRagIds, evaluateSearch
│   ├── faq.ts                       #   addFaq, removeFaq, listFaqs, searchFaqs
│   ├── feedback/                    # Feedback submission
│   │   ├── submit.ts                #   submit mutation (dedup, auth-guarded)
│   │   └── list.ts                  #   list query (admin sees all, user sees own)
│   ├── messages/                    # Message handling
│   │   └── validator.ts             #   messageValidator, sourcesValidator, tokenCountValidator types
│   ├── messages.ts                  #   insert, list (agent component wrappers)
│   ├── people/                      # People data
│   │   └── queries.ts               #   getCount (faculty/admin/staff classification)
│   ├── rag/                         # RAG pipeline
│   │   ├── instance.ts              #   rag singleton (768d, resilient embedding model)
│   │   ├── retrieval.ts             #   Orchestrator: classify → rewrite → HyDE → embed → cache → search → rerank → context
│   │   ├── context.ts               #   Sandwich strategy context assembly (internalQuery)
│   │   ├── routing.ts               #   Intent classification, query rewriting, HyDE generation (Groq LLM)
│   │   ├── prompts.ts               #   SYSTEM_PROMPT template + FEW_SHOT_EXAMPLES
│   │   └── testing.ts               #   insertTestChunk, seed, verify
│   ├── rateLimit.ts                 #   Native Convex sliding-window rate limiter (10 msg/user/min, 100K tokens/global/min) + checkRateLimit query
│   ├── reranking/                   # Reranking (external FlashRank endpoint or fallback)
│   │   └── rerank.ts                #   rerank action (POSTs to RERANKER_URL)
│   ├── threads.ts                   #   create, list, rename, remove, purgeOldArchived
│   ├── users/                       # User management
│   ├── auth.config.ts               #   Clerk JWT issuer config for Convex auth
│   ├── auth.ts                      #   Auth helpers: getUserId, isAuthenticated, isAdmin, requireAuth, requireAdmin
│   ├── constants.ts                 #   CACHE_SIMILARITY_THRESHOLD = 0.92
│   ├── convex.config.ts             #   Convex app config (RAG, agent, workpool, workflow components)
│   ├── crons.ts                     #   10 active cron jobs (crawl cron disabled — Crawl4AI unreachable)
│   ├── http.ts                      #   HTTP router (3 routes: crawl, ingest, reset)
│   ├── lib/db_helpers.ts            #   fastCount (thin wrapper around internal .count() API)
│   ├── emergencyStop.ts             #   stopAll / stopBatch — drains in-flight processing jobs
│   ├── schema.ts                    #   DATABASE SCHEMA (16 tables, plus 2 component-managed)
│   └── threads.ts                   #   Thread actions
├── src/
│   ├── app/                         # Next.js App Router pages
│   │   ├── (main)/                  # Main app layout (chat, settings, explore)
│   │   ├── admin/                   # Admin dashboard (overview, documents, crawls, settings, feedback, users, analytics)
│   │   ├── api/                     # API routes (chat, health, cron, webhooks)
│   │   └── globals.css              # Global Tailwind styles
│   ├── components/                  # React components
│   │   ├── chat/                    # ChatWindow, ChatMessageBubble, ChatInput, ChatMessages, ChatSuggestions, SourceList, SourceCard, MessageActions
│   │   └── markdown.tsx             # Markdown renderer
│   ├── hooks/                       # Custom React hooks (use-messages)
│   ├── lib/                         # Shared utilities
│   │   ├── constants.ts             #   UET_CRAWL_CONFIG (seed URLs, paths), design tokens
│   │   ├── llm-models.ts            #   LLM_FALLBACK_CHAIN definition
│   │   └── rate-limit.ts            #   Upstash Redis rate limit client (admin=200/hr, user=50/hr, anon=10/hr)
│   ├── middleware.ts                 # Next.js middleware (Clerk auth, CSP headers, route protection)
│   └── instrumentation.ts           # Sentry instrumentation
├── scripts/                         # Python crawler + admin scripts
│   ├── crawler.py                   # Async BFS crawler (curl_cffi, trafilatura, markdownify) — pushes to /ingest
│   ├── ingest_pdf.py                # PDF ingestion (pymupdf4llm primary, Gemini VLM fallback)
│   ├── run_agent.sh                 # Cron entry point for opencode
│   ├── boot_lock.ps1                # Windows lock file for boot safety
│   └── eval/
│       ├── golden_set.jsonl         #   50 QA pairs across categories
│       └── run_eval.py              #   Evaluation runner (recall_at_k, fragment_hit_rate)
├── tests/
│   ├── convex/                      # Convex function tests (webhook, users, tasks, mutations, actions)
│   ├── unit/                        # Unit tests (admin, components, utils, rate-limit, llm-models, etc.)
│   ├── integration/                 # Integration tests (chat API, RAG pipeline, embeddings, webhook)
│   ├── e2e/                         # Playwright E2E tests
│   ├── helpers/                     # Test utilities (convex-mock.ts, README.md)
│   ├── load-test.ts                 # Load test (not CI-integrated)
│   └── setup.ts                     # Test setup (jest-dom, global fetch mock)
├── docs/
│   ├── anti-pattern-audit-report.md # Test anti-pattern audit
│   ├── chunking-strategy.md         # Chunking design (dimension 768 — matches schema.ts / instance.ts)
│   ├── crawling-strategy.md
│   ├── deployment.md
│   ├── embedding-strategy.md
│   ├── evaluation.md
│   ├── rag-pipeline.md
│   └── security.md
├── testing.md                       # Master testing plan
├── AGENTS.md                        # Agent instructions (prepended to every prompt)
├── CRONJOB.md                       # Hourly autonomous maintenance protocol
├── TODO.md                          # Task queue
├── CLAUDE.md                        # Claude Code config
└── architecture.md                  # THIS FILE — single source of truth
```

---

## 4. Convex Database Schema

The schema is defined in `convex/schema.ts`. Tables `threads` and `messages` are managed by `@convex-dev/agent` and NOT defined in schema.ts. **16 tables defined in schema.ts** (plus 2 component-managed).

### 4.1 `users`

| Field | Type | Notes |
|-------|------|-------|
| `_id` | `Id<"users">` | Auto-generated |
| `clerkId` | `string` | Indexed: `by_clerkId` |
| `name` | `string` | |
| `email` | `string` | Indexed: `by_email` |
| `imageUrl` | `string?` | |
| `role` | `"user" \| "admin" \| "superadmin"` | Indexed: `by_role` |
| `isActive` | `boolean` | |
| `lastLoginAt` | `number?` | Indexed: `by_lastLoginAt` |
| `preferences` | `{ theme?, language?, fontSize?, model? }` | |
| `metadata` | `{ signupSource?, lastFeatureUsed? }` | |

### 4.2 `feedback`

| Field | Type | Notes |
|-------|------|-------|
| `messageId` | `string` | Indexed: `by_messageId` (references agent-managed message IDs) |
| `userId` | `Id<"users">` | Indexed: `by_userId` |
| `rating` | `"thumbsUp" \| "thumbsDown"` | Indexed: `by_rating` |
| `comment` | `string?` | |
| `category` | `"accurate" \| "inaccurate" \| "incomplete" \| "irrelevant" \| "other"?` | |
| `createdAt` | `number` | Indexed: `by_createdAt` |

### 4.3 `crawlJobs`

| Field | Type | Notes |
|-------|------|-------|
| `trigger` | `"manual" \| "scheduled" \| "webhook"` | Indexed: `by_trigger` |
| `startedBy` | `Id<"users">?` | |
| `status` | `"pending" \| "running" \| "completed" \| "failed" \| "cancelled"` | Indexed: `by_status` |
| `providerJobId` | `string?` | External crawl4AI task ID — Indexed: `by_providerJobId` |
| `config` | `{ maxPages, maxDepth, includePaths, excludePaths, allowExternalLinks }` | |
| `stats` | `{ totalPages, successfulPages, failedPages, skippedPages, totalChunks, totalTokens, bytesProcessed }` | |
| `error` | `string?` | |
| `startedAt` | `number` | Indexed: `by_startedAt` |
| `completedAt` | `number?` | |
| `duration` | `number?` | |

### 4.4 `semanticCache`

| Field | Type | Notes |
|-------|------|-------|
| `queryText` | `string` | |
| `queryEmbedding` | `float64[]` | **vectorIndex** `by_queryEmbedding`, 768 dimensions |
| `response` | `string` | |
| `sources` | `{ entryId, url, title, relevanceScore, excerpt, headingPath? }[]` | |
| `model` | `string` | |
| `tokenCount` | `{ prompt, completion, total }?` | |
| `hits` | `number` | |
| `expiresAt` | `number` | Indexed: `by_expiresAt` |
| `createdAt` | `number` | |
| `embeddingModel` | `string?` | |
| `sourceEntryIds` | `string[]?` | R-5: Source re-index invalidation |
| `alternateQueryTexts` | `string[]?` | Alternate query texts for cache matching |
| `alternateEmbeddings` | `float64[][]?` | Alternate query embeddings for cache matching |
| `maxDocumentUpdatedAt` | `number?` | Max updatedAt of source documents for staleness check |

### 4.5 `adminAuditLog`

| Field | Type | Notes |
|-------|------|-------|
| `userId` | `Id<"users">` | Indexed: `by_userId` |
| `action` | 17 enum values | Indexed: `by_action` |
| `target` | `string?` | |
| `details` | `{ oldValue?, newValue?, reason? }` | |
| `ipAddress` | `string?` | |
| `createdAt` | `number` | Indexed: `by_createdAt` |

Actions: `user.login`, `user.logout`, `user.create`, `thread.create`, `thread.delete`, `document.create`, `document.delete`, `crawl.start`, `crawl.stop`, `feedback.submit`, `settings.update`, `admin.access`, `metrics.summary`, `metrics.errors`, `metrics.performance`, `staleness.check`, `role.change`.

### 4.6 `notifications`

| Field | Type | Notes |
|-------|------|-------|
| `userId` | `Id<"users">` | Indexed: `by_userId` |
| `title` | `string` | |
| `body` | `string` | |
| `type` | `"info" \| "success" \| "warning" \| "error"` | |
| `isRead` | `boolean` | Indexed: `by_isRead` |
| `link` | `string?` | |
| `createdAt` | `number` | |

### 4.7 `documents`

| Field | Type | Notes |
|-------|------|-------|
| `url` | `string` | Indexed: `by_url` |
| `title` | `string` | searchIndex: `search_title` |
| `entryId` | `string?` | RAG entry ID — Indexed: `by_entryId` |
| `contentHash` | `string?` | SHA-256 — Indexed: `by_contentHash` |
| `crawlSessionId` | `string?` | Indexed: `by_session` |
| `source` | `string` | Hostname or `"pdf"` — Indexed: `by_source_category` |
| `category` | `string` | Typically `"crawled"` — Indexed: `by_category` |
| `subcategory` | `string?` | |
| `metadata` | `{ lastModified?, author?, wordCount?, language?, etag?, sourceType? }` | |
| `status` | `"pending" \| "processing" \| "indexed" \| "failed" \| "stale" \| "active" \| "pending_embed"` | Indexed: `by_status` |
| `chunkCount` | `number?` | Total chunks produced |
| `chunksEmbedded` | `number?` | Actual count of successfully embedded chunks |
| `crawledAt` | `number` | Indexed: `by_crawledAt` |
| `updatedAt` | `number` | |
| `error` | `string?` | |
| `freshnessTier` | `"high" \| "medium" \| "low"?` | Indexed: `by_tier_and_crawled` |
| `isStale` | `boolean?` | Indexed: `by_status_and_isStale` (compound) |
| `personType` | `"faculty" \| "staff" \| "admin"?` | Indexed: `by_personType` |

### 4.8 `processedWebhooks`

Dedup table for idempotency.

| Field | Type | Notes |
|-------|------|-------|
| `jobId` | `string` | Indexed: `by_jobId` |
| `processedAt` | `number` | |
| `expiresAt` | `number` | Indexed: `by_expiresAt` (30-day TTL) |

### 4.9 `evalResults`

Stores evaluation run results for regression tracking.

| Field | Type | Notes |
|-------|------|-------|
| `evalName` | `string` | Indexed: `by_evalName` |
| `model` | `string?` | |
| `datasetSize` | `number` | |
| `timestamp` | `number` | Indexed: `by_timestamp` |
| `metrics` | `{ recallAtK, precisionAtK, mrr, avgLatency, totalTokens }` | |
| `metadata` | `string?` | |

### 4.10 `crawlDeadLetter`

| Field | Type | Notes |
|-------|------|-------|
| `url` | `string` | |
| `jobId` | `string` | Indexed: `by_jobId_and_url` |
| `failureReason` | `string` | |
| `failureCount` | `number` | Max 5 before `"abandoned"` |
| `lastAttemptAt` | `number` | |
| `payload` | `{ documentId, url, contentHash?, jobId, chunkText? }` | |
| `status` | `"pending_retry" \| "abandoned" \| "processing" \| "indexed"` | Indexed: `by_status`, `by_url` |

### 4.11 `crawledChunks`

| Field | Type | Notes |
|-------|------|-------|
| `documentId` | `Id<"documents">` | Indexed: `by_documentId`, compound: `by_documentId_and_contentHash` |
| `contentHash` | `string` | |
| `text` | `string` | searchIndex: `search_text` |
| `ragId` | `string` | RAG component entry ID — Indexed: `by_ragId` |
| `embeddingModel` | `string?` | e.g. `"gemini-embedding-2"` |
| `parentText` | `string?` | Parent-child chunking context |
| `headingPath` | `string[]?` | Section heading hierarchy |
| `contextualizedText` | `string?` | Gemini-contextualized version of chunk text — Indexed: `by_contextualizedText` |

### 4.12 `crawlStats`

Singleton stats counter.

| Field | Type | Notes |
|-------|------|-------|
| `statsId` | `string` | e.g. `"global"` — Indexed: `by_statsId` |
| `totalDocuments` | `number` | |
| `indexedDocuments` | `number` | |
| `processingDocuments` | `number` | |
| `failedDocuments` | `number` | |
| `pendingDocuments` | `number` | |
| `lastUpdatedAt` | `number` | |

### 4.13 `faqs`

| Field | Type | Notes |
|-------|------|-------|
| `question` | `string` | searchIndex: `search_question` |
| `answer` | `string` | |
| `sourceUrl` | `string?` | |
| `createdAt` | `number` | |
| `expiresAt` | `number?` | |

### 4.14 `appSettings`

Key/value/section config store.

| Field | Type | Notes |
|-------|------|-------|
| `key` | `string` | Indexed: `by_key` |
| `value` | `string \| number \| boolean` | |
| `section` | `string` | Indexed: `by_section` |
| `updatedAt` | `number` | |
| `updatedBy` | `Id<"users">?` | |

### 4.15 `rateLimits`

Convex-native sliding window rate limiter state.

| Field | Type | Notes |
|-------|------|-------|
| `key` | `string` | clerkUserId or `"global"` — Indexed: `by_key` |
| `windowStart` | `number` | Epoch ms — start of current 1-minute window |
| `count` | `number` | Requests (per-user) or tokens (global) in window |

### 4.16 `dashboardStats`

Singleton stats counter for admin dashboard overview. Updated by `dashboardStats` mutation (aggregated from split queries).

| Field | Type | Notes |
|-------|------|-------|
| `statsId` | `string` | e.g. `"global"` — Indexed: `by_statsId` |
| `documentStats` | `{ total, indexed, pending, failed }` | Document counts by status |
| `userStats` | `{ total, activeLast24h }` | User counts |
| `feedbackCount` | `number` | Total feedback entries |
| `crawlCount` | `number` | Total crawl jobs |
| `cacheStats` | `{ total }` | Semantic cache entry count |
| `lastUpdatedAt` | `number` | Last aggregation timestamp |

---

## 5. RAG Pipeline

The RAG pipeline is orchestrated by `convex/rag/retrieval.ts:retrieveContext` (a Convex action). The RAG component instance is initialized in `convex/rag/instance.ts` with `embeddingDimension: 768`, custom resilient embedding model wrapping Gemini, and filter names `["category", "source"]`. RAG namespace: `"uet-global"`.

### 5.1 Pipeline Stages

| # | Stage | File | Description |
|---|-------|------|-------------|
| 1 | **Pre-Retrieval Security** | `rag/retrieval.ts` | Injection scan. Max 2000 chars. Blocklist: `ignore previous instructions`, `system:`, `role:`, `[INST]`, `</s>`, `<\|im_start\|>`, `<\|im_end\|>`, `### Instruction`, `<script`, XSS variants |
| 2 | **Intent Classification** | `rag/routing.ts:classifyQueryAction` | Groq Llama 3.1 8B classifies as `admissions`, `academic`, `administrative`, `campus_life`, `general`, `off_topic`, `simple_fact`. Off-topic → short-circuit with refusal. |
| 3 | **Query Rewriting** | `rag/routing.ts:rewriteQueryAction` | Keyword-rich expansion, Roman Urdu → English translation, abbreviation expansion (UET → University of Engineering and Technology). Temperature 0.3. |
| 4 | **HyDE** | `rag/routing.ts:hydeQueryAction` | Hypothetical 3-5 sentence document for queries < 15 words. Temperature 0.5. |
| 5 | **Embedding** | `embeddings/generate.ts:generate` | Gemini `gemini-embedding-2`, 768 dimensions. Key rotation across 4 env vars. Batch API for ≥2 texts. 3× retry with exponential backoff + jitter. Prefix: `task: search result \| query: ${text}`. |
| 6 | **Semantic Cache** | `cache/get.ts:get` | Cosine similarity via `ctx.vectorSearch` at threshold **0.92** from `constants.ts`. Hit → return cached response + sources; increment hit counter. Source re-index invalidation (R-5): checks if source doc updated since cache entry. |
| 7 | **Hybrid Search** | `embeddings/search.ts:searchDocumentsAction` | Vector search (`rag.search`, 40 results) + BM25 full-text (`search_text` searchIndex, 40 results) → RRF fusion (k=60). Time decay weighting per freshness tier (floor at 0.20). FAQ tier-1 retrieval (score * 2.0). |
| 8 | **Reranking** | `reranking/rerank.ts:rerank` | External FlashRank endpoint via `RERANKER_URL` env var. Falls back to linear decay scoring if unconfigured. topK=4. |
| 9 | **Context Assembly** | `rag/context.ts:buildContext` (internalQuery) | Sandwich strategy: highest relevance at start AND end of context to mitigate lost-in-the-middle. Anti-hallucination confidence tiers: <0.20 **refuse**, 0.20-0.40 **hedge**, 0.40-0.60 **cite**, >0.60 **normal**. Max 3000 tokens. |
| 10 | **LLM Generation** | `src/app/api/chat/route.ts` (API route) | Iterates LLM fallback chain. `getAvailableModels()` filters by provider availability. Strips `<think>` tags. Streams via `toTextStreamResponse()` with `X-Sources`/`X-Intent` headers. |
| 11 | **Cache Update** | `cache/set.ts:set` (async via `after()`) | Writes response + sources + model to `semanticCache`. TTL per freshness tier: high=7d, medium=2d, low=1d. Stores `sourceEntryIds` for invalidation. |

### 5.2 LLM Fallback Chain

| # | Provider | Model | SDK | Purpose |
|---|----------|-------|-----|---------|
| 1 | Groq | Llama 4 Scout (`meta-llama/llama-4-scout-17b-16e-instruct`) | `@ai-sdk/groq` | Primary RAG generation |
| 2 | Cerebras | GPT-OSS 120B (`gpt-oss-120b`) | `@ai-sdk/cerebras` | Speed fallback |
| 3 | Groq | Llama 3.1 8B (`llama-3.1-8b-instant`) | `@ai-sdk/groq` | Fast fallback |
| 4 | Gemini | 2.5 Flash (`gemini-2.5-flash`) | `@ai-sdk/google` | Reliable fallback |

Model IDs are the single source of truth; they live in `src/lib/llm-models.ts` (`LLM_FALLBACK_CHAIN`). Keep the human-readable labels above in sync with those IDs.

### 5.3 System Prompt

Defined in `convex/rag/prompts.ts` — template with `{context}` placeholder. Core rules: cite-only-UET-content, source citation via markdown links, language matching (English/Urdu/Roman Urdu), Pakistani English spellings, prompt injection guardrails. Includes 2 few-shot examples (BS CS fee structure, admissions timing).

---

## 6. Crawl Pipeline

### 6.1 Dual-Path Architecture

Two independent crawl paths feed into the same ingest pipeline:

**Path A — Python BFS Crawler (Primary)**:
```
scripts/crawler.py (curl_cffi + trafilatura)
  → POST /ingest (Bearer token auth)
    → ingestWebhook (upsertDocument → enqueueDocumentChunks)
      → workpool embedSingleChunk
        → RAG component embed + index (768d) → crawledChunks table
```

**Path B — External crawl4AI Service (Secondary)**:
```
External crawl4AI instance
  → POST /api/webhook/crawl (HMAC-SHA256 auth)
    → crawlWebhook (chunkMarkdown → queueChunksForEmbedding)
      → workpool embedSingleChunk
        → RAG component embed + index (768d) → crawledChunks table
```

**Path C — Reset Pipeline**:
```
Any caller
  → POST /api/reset (Bearer token auth)
    → resetWebhook → resetPipelineAction
      → cascade delete all tables (crawledChunks → documents → DLQ → webhooks → jobs → stats)
```

### 6.2 Webhook Security

| Mechanism | Detail |
|-----------|--------|
| HMAC-SHA256 | `/api/webhook/crawl`: Timestamp + raw body signed with `CRAWL_WEBHOOK_SECRET` (supports dual-secret rotation via `CRAWL_WEBHOOK_SECRET_NEW`) |
| Timestamp validation | Max 5-minute skew (replay attack prevention) |
| Bearer token | `/ingest` and `/api/reset`: `CONVEX_AUTH_TOKEN` Bearer header |
| Payload size limit | 10MB (`/api/webhook/crawl`), 4MB (`/ingest`) |
| Domain allowlist | Only `*.uettaxila.edu.pk` (plus `pdf://` virtual URLs for ingest) |
| Idempotency | `processedWebhooks` table dedup by `jobId` (30-day TTL) |

### 6.3 Chunking Strategy `(convex/crawl/chunking.ts)`

| Parameter | Parent | Child |
|-----------|--------|-------|
| Max chunk size | 3,000 chars (~750 tokens) | 800 chars (~200 tokens) |
| Overlap | 300 chars | 100 chars |
| Table preservation | Row-level split with header re-injection | Inherited from parent |
| Sentence boundary | Abbreviation-protected regex split | Inherited |
| Quality filter | ≥5 meaningful words | ≥5 meaningful words |
| Heading tracking | `headingStack` via markdown heading levels | Inherits `headingPath` |

Guard: `guardChunkSize()` splits text at sentence boundaries if > 7200 chars.

### 6.4 Pipeline Data Flow

```
webhook.ts (HTTP)                mutations.ts (DB ops)
├── crawlWebhook                 ├── queueChunksForEmbedding (doc upsert + diff + enqueue)
│   └── via internal.mutations   ├── saveEmbedding (persist chunk, incr counter)
│       ├── getProcessedWebhook  ├── onChunkEmbedded (workpool callback → DLQ mgmt)
│       └── markWebhookProcessed ├── retryDeadLetterQueue (re-enqueue abandoned)
├── ingestWebhook                ├── upsertDocument (skip/update/insert)
│   └── via internal.mutations   └── enqueueDocumentChunks (enqueue + status)
│       ├── upsertDocument
│       └── enqueueDocumentChunks    actions.ts (node actions)
└── resetWebhook                 ├── embedSingleChunk (rag.add → saveEmbedding)
    └── via internal.actions      ├── executeCrawlJob (crawl4AI orchestration)
        └── resetPipelineAction   ├── resetPipelineAction (cascade delete)
                                   ├── runDeduplication (find+delete by URL)
                                   └── internal.rag.routing.hydeQueryAction
```

### 6.5 Embedding Workpool

| Property | Value |
|----------|-------|
| `maxParallelism` | 3 |
| Retry | 5 attempts, 4s initial backoff, exponential base 2 |
| Pre-embedding | Resolve `namespaceId` once per batch via `rag.getOrCreateNamespace` |

### 6.6 Document Freshness Tiers

**Assignment** (`chunking.ts:assignFreshnessTier`):
| Tier | Keyword Match | Document Cache TTL | Document Expiry TTL |
|------|---------------|---------------------|---------------------|
| High | root URLs, `admission`, `academic` | 7 days (cache) | 30 days (staleness) |
| Medium | `department`, `faculty` | 2 days (cache) | 90 days (staleness) |
| Low | everything else | 1 day (cache) | 180 days (staleness) |

Cache TTLs apply to `semanticCache` entries. Document expiry TTLs apply to `documents` table entries (flagged as `isStale` by `flagExpiredDocuments`).

---

## 7. Security Architecture

### 7.1 Authentication & Authorization

| Layer | Mechanism | File |
|-------|-----------|------|
| **Frontend** | `clerkMiddleware` protecting all routes | `src/middleware.ts` |
| **RBAC** | `user` / `admin` / `superadmin` roles, enforced in Convex auth helpers | `convex/auth.ts` |
| **Convex Auth** | Clerk JWT issuer validated via `auth.config.ts` | `convex/auth.config.ts` |
| **Clerk Webhooks** | Svix signature verification (events: `user.created`, `user.updated`) | `src/app/api/webhooks/clerk/` |
| **Crawl Webhooks** | HMAC-SHA256 + timestamp validation | `convex/crawl/webhook.ts` |
| **Ingest/Reset Webhooks** | Bearer token via `CONVEX_AUTH_TOKEN` | `convex/crawl/webhook.ts` |

**Note:** `auth.config.ts` currently uses `applicationID: "uet-gpt"`. If Clerk JWT audience doesn't match, `getUserIdentity()` silently returns null. Change to `"convex"` (Clerk default) or configure custom JWT template in Clerk dashboard.

> **Defense-in-depth caveat:** `src/middleware.ts` (the Clerk middleware) is an
> *intercept-only* layer for redirects and is **not** a sufficient authorization
> boundary on its own — middleware can be bypassed (cf. CVE-2025-29927). Every
> privileged operation must **also** enforce authZ server-side in Convex functions
> (`requireAuth` / `requireAdmin` / `requirePermission` in `convex/auth.ts`) and in
> route handlers. Treat middleware as UX routing, not as the gate.
>
> **Next.js 16 migration note:** Next.js 16 renames the middleware convention to
> `proxy.ts` (exporting `proxy` instead of `middleware`); `src/middleware.ts` is the
> legacy name. Track migrating `src/middleware.ts` → `src/proxy.ts` as a known item
> (the bundled Clerk skill template under `.agents/skills/clerk-nextjs-patterns/`
> already uses `proxy.ts`).

### 7.2 Route Protection

| Route Category | Access | Matcher |
|----------------|--------|---------|
| Public | No auth | `/`, `/unauthorized`, `/api/webhooks(.*)`, `/api/health`, `/api/cron(.*)` |
| Auth | Redirect if signed in | `/sign-in(.*)`, `/sign-up(.*)` |
| Admin | Auth + admin/superadmin role | `/admin(.*)`, `/api/admin(.*)` |
| Protected | Auth required | `/chat(.*)`, `/explore(.*)`, `/settings(.*)`, `/api/chat(.*)`, `/api/threads(.*)`, `/api/messages(.*)`, `/api/feedback(.*)` |

### 7.3 Rate Limiting

| Limit | Scope | Window | Implementation |
|-------|-------|--------|---------------|
| 10 messages/minute | Per-user | Sliding 60s | `convex/rateLimit.ts` (Convex-native, `rateLimits` table) |
| 100,000 tokens/minute | Global | Sliding 60s | `convex/rateLimit.ts` (same table, key=`"global"`) |
| 50 req/hr | Per-user HTTP API | 1 hour | `src/lib/rate-limit.ts` (Upstash Redis, slidingWindow) |
| 200 req/hr | Admin/superadmin HTTP API | 1 hour | `src/lib/rate-limit.ts` (Upstash Redis, slidingWindow) |
| 10 req/hr | Anonymous HTTP API | 1 hour | `src/lib/rate-limit.ts` (Upstash Redis, slidingWindow) |

### 7.4 HTTP Security Headers (next.config.ts)

| Header | Value |
|--------|-------|
| `X-Frame-Options` | `DENY` |
| `X-Content-Type-Options` | `nosniff` |
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains; preload` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `Permissions-Policy` | `geolocation=(), microphone=(), camera=()` |
| `Content-Security-Policy` | Statically set in `next.config.ts` (whitelists `*.clerk.accounts.dev` and `clerk.browser.systems` for authentication) |

### 7.5 Chat API Security (`src/app/api/chat/route.ts`)

| Check | Detail |
|-------|--------|
| CSRF | Origin + Referer check against `NEXT_PUBLIC_APP_URL` (localhost:3000 allowed) |
| DoS guard | 100KB body limit, 8000 char per-message limit |
| Auth | Clerk `auth()` returns 401 if no userId |

### 7.6 Forbidden Operations (Never Violate)

1. **schema.ts filter field names on vector indexes** — changing them corrupts the live vector index and requires full re-embed
2. **HMAC auth guard in webhook.ts** — the timestamp + signature check block must never be removed
3. **embeddingDimension** in any RAG config — dimension mismatch silently breaks all similarity scores
4. **Synchronous embedding inside HTTP webhook handler** — hits Convex 1MB limit
5. **`git push --force`** — never
6. **`git add -A`** — always use explicit file paths or `git add -p`
7. **Commits directly to `main` or `master`** — always use `agent/YYYY-MM-DD`

---

## 8. Deployment

### 8.1 Hosting

| Component | Platform | Notes |
|-----------|----------|-------|
| Frontend | Next.js (server) | Wherever app is deployed |
| Backend | Convex Cloud | Auto-deploys on push |
| Crawler | Local / server | Python script or external crawl4AI |
| Monitoring | Sentry | Errors + performance |

### 8.2 Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `CONVEX_DEPLOYMENT` | Yes | Convex deployment URL |
| `NEXT_PUBLIC_CONVEX_URL` | Yes | Convex client URL (used by frontend) |
| `CLERK_SECRET_KEY` | Yes | Clerk API secret |
| `CLERK_SIGNING_SECRET` | Yes | Clerk webhook signing secret |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Yes | Clerk publishable key (client-side) |
| `CLERK_JWT_ISSUER` | Yes | Clerk JWT issuer URL for Convex auth |
| `GROQ_API_KEY` | Yes | Groq LLM API |
| `GEMINI_API_KEY` | Yes | Primary Gemini API key |
| `GEMINI_API_KEY_1` | No | Gemini key rotation #1 |
| `GEMINI_API_KEY_2` | No | Gemini key rotation #2 |
| `GOOGLE_GENERATIVE_AI_API_KEY` | No | Gemini key rotation #3 |
| `CEREBRAS_API_KEY` | Yes | Cerebras LLM API |
| `CRAWL_WEBHOOK_SECRET` | Yes | HMAC secret for crawl webhooks |
| `CRAWL_WEBHOOK_SECRET_NEW` | No | Secondary HMAC secret (key rotation) — NOT YET CONFIGURED |
| `CONVEX_AUTH_TOKEN` | Yes | Bearer token for `/ingest` and `/api/reset` webhooks |
| `CONVEX_SITE_URL` | Yes | Convex site URL for webhook callbacks |
| `SENTRY_DSN` | Yes | Sentry DSN (replaces SENTRY_ORG/SENTRY_PROJECT) |
| `CRAWL4AI_BASE_URL` | No | Crawl4AI service URL (default: `http://localhost:11235`) |
| `NEXT_PUBLIC_APP_URL` | Yes | Frontend app URL for CSRF checks |
| `CRON_SECRET` | Yes | API route cron authentication |
| `OPENROUTER_API_KEY` | No | OpenRouter (presence guard only — embedding fallback removed to prevent vector space incompatibility) |
| `RERANKER_URL` | No | External FlashRank reranker endpoint — OPTIONAL |
| `UPSTASH_REDIS_REST_URL` | Yes | Upstash Redis REST URL for rate limiting |
| `UPSTASH_REDIS_REST_TOKEN` | Yes | Upstash Redis REST token for rate limiting |
| `WEBHOOK_SECRET` | No | Clerk webhook secret (legacy — use `CLERK_SIGNING_SECRET`) |
| `ADMIN_BOOTSTRAP_EMAIL` | No | Auto-promote first user with this email to admin |
| `CONVEX_DEPLOY_KEY` | No | Convex deploy key for CI |

---

## 9. Cron Jobs

Defined in `convex/crons.ts`:

| Name | Schedule | Handler | Purpose |
|------|----------|---------|---------|
| `weekly-uet-webcrawl` | **DISABLED** (was Sun 00:00 UTC) | `internal.crawl.workflow.kickoffDailyCrawl` | Trigger UET website crawl — disabled because Crawl4AI Docker unreachable from Convex cloud |
| `daily-cleanup-expired-cache` | Daily 01:00 UTC | `internal.crawl.tasks.cleanupExpiredCache` | Remove expired cache entries |
| `retry-dead-letter` | Every 4 hours | `internal.crawl.mutations.retryDeadLetterQueue` | Retry DLQ items (limit: 100) |
| `reset-stuck-dlq-entries` | Every 30 minutes | `internal.crawl.mutations.resetStuckDLQEntries` | Reset DLQ entries stuck in "processing" state (worker crash recovery) |
| `fail-stuck-crawl-jobs` | Every 2 hours | `internal.crawl.workflow.failStuckJobs` | Timeout running jobs > 2 hours |
| `cleanup-old-records` | Weekly Sun 02:00 UTC | `internal.crawl.jobs.cleanupOldRecords` | Purge abandoned DLQ (>7d) + old crawl jobs (>30d) |
| `purge-old-archived-threads` | Weekly Sun 03:00 UTC | `internal.threads.purgeOldArchived` | Archive cleanup (>6 months) |
| `clear-stale-rate-limits` | Every 1 hour | `internal.rateLimit.clearStaleRateLimits` | Hourly cleanup for stale rate limit tracking |
| `daily-contextualize-chunks` | Daily 03:00 UTC | `internal.embeddings.contextualizeCron.contextualizeCron` | Backfill raw chunks via Gemini Flash free tier |
| `staleness-check` | Daily 04:00 UTC | `internal.observability.staleness.checkStaleness` | Check document staleness |
| `compute-dashboard-stats` | Every 1 hour | `internal.admin.stats.computeDashboardStats` | Pre-compute dashboard statistics |

---

## 10. Embedding Strategy

### 10.1 Model Details

| Property | Value |
|----------|-------|
| **Model** | `gemini-embedding-2` |
| **Dimensions** | 768 (MRL supports 768/1536/3072; this deployment uses 768) |
| **Context** | 8192 tokens |
| **Free tier** | ~60 RPM, ~1500 RPD |
| **Paid Tier 1** | 3000 RPM, 1M TPM |
| **Batch API** | 50% discount ($0.10/M vs $0.20/M) — used for ≥2 texts |

### 10.2 Key Rotation

Keys tried in order: `GEMINI_API_KEY` → `GEMINI_API_KEY_1` → `GEMINI_API_KEY_2` → `GOOGLE_GENERATIVE_AI_API_KEY`. First success wins. All fail → `ConvexError`. The `OPENROUTER_API_KEY` is read for a presence guard only (no actual fallback — removed to prevent vector space incompatibility).

### 10.3 Resilient Embedding Model

Defined in `rag/instance.ts` — custom `EmbeddingModel` wrapping `generateEmbeddingsInternal`:
- `maxEmbeddingsPerCall: 2048`
- `supportsParallelCalls: true`
- `modelId: "gemini-embedding-2"`
- Filter names: `["category", "source"]`

---

## 11. Semantic Cache

### 11.1 Design

| Property | Value | File |
|----------|-------|------|
| **Similarity threshold** | 0.92 (cosine) | `convex/constants.ts` |
| **Vector index dimensions** | 768 | `schema.ts` — `vectorIndex("by_queryEmbedding", ...)` |
| **Search method** | `ctx.vectorSearch` on `semanticCache` table | `cache/get.ts` |
| **Cache TTL tiers** | High=7d, Medium=2d, Low=1d | `cache/set.ts` |
| **Write trigger** | Async via `after()` after successful LLM generation | `cache/set.ts`, `chat/route.ts` |
| **Hit tracking** | Increment counter, returns cached + sources | `cache/get.ts` |
| **Source invalidation** | Checks `sourceEntryIds` against `documents.updatedAt` | `cache/get.ts` (R-5) |
| **Cleanup** | Cron: daily 01:00 UTC | `crons.ts`, `tasks.ts`, `internal_queries.ts` |

---

## 12. Testing Architecture

### 12.1 Framework

| Tool | Version | Purpose |
|------|---------|---------|
| Vitest | 4.1.7 | Unit + integration tests |
| Playwright | 1.60 | E2E browser tests |
| Testing Library | — | Component testing (React) |

### 12.2 Configuration

| Config | Value |
|--------|-------|
| `vitest.config.ts` | `node` env, `testTimeout: 30000` (WSL needs it — setup can take 30s+), `resolve.alias` for `@/` and `convex/` |
| `playwright.config.ts` | Chrome desktop + mobile (Pixel 5) — Firefox and WebKit not configured |

### 12.3 Test Distribution

Tests under `tests/` organized into:
- `convex/` — Convex function tests (webhook, mutations, tasks, users, actions)
- `unit/` — Unit tests (admin components, rate-limit, llm-models, search, feedback, embeddings, RAG context)
- `integration/` — Integration tests (RAG pipeline, webhook, embeddings, chat API)
- `e2e/` — Playwright E2E (auth, chat, admin, home flows)
- `helpers/` — Test utilities (`convex-mock.ts`)

See `testing.md` for detailed test plan (12 phases) and `docs/archive/anti-pattern-audit-report.md` for known issues.

### 12.4 Quality Gates

Per `AGENTS.md`, every commit must pass:
1. `pnpm typecheck` → zero TypeScript errors
2. `python -m py_compile scripts/*.py` → zero syntax errors
3. `python scripts/eval/run_eval.py` → recall_at_5 not regressed
4. All relevant unit tests pass

---

## 13. Evaluation

### 13.1 Harness

| Component | Location | Description |
|-----------|----------|-------------|
| Golden set | `scripts/eval/golden_set.jsonl` | 50 QA pairs across categories (admissions, fees, exams, departments, etc.) — confirmed by `wc -l` |
| Runner | `scripts/eval/run_eval.py` | Computes `recall_at_5` (primary metric) and `fragment_hit_rate` |
| Convex eval action | `convex/eval.ts:evaluateSearch` | Runs `rag.search()` on "uet-global" namespace and hydrates chunk results |

### 13.2 Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Success (stable or improved recall) |
| 1 | Eval errored (network/auth) — transient, not a regression |
| 2 | REGRESSION — recall_at_5 dropped > 0.5% → trigger emergency protocol |

---

## 14. Convex Component Configuration

Defined in `convex/convex.config.ts`:

```typescript
import agent from "@convex-dev/agent/convex.config.js";
import rag from "@convex-dev/rag/convex.config.js";
import workflow from "@convex-dev/workflow/convex.config.js";
import workpool from "@convex-dev/workpool/convex.config.js";

const app = defineApp();
app.use(rag);
app.use(agent);
app.use(workpool, { name: "embeddingWorkpool" });
app.use(workpool, { name: "crawlWorkpool" });
app.use(workflow, { name: "crawlWorkflow" });
```

### 14.1 Component Roles

| Component | Config | Purpose |
|-----------|--------|---------|
| `@convex-dev/rag` | default | Embedding, indexing, vector retrieval on `"uet-global"` namespace |
| `@convex-dev/agent` | default | Thread/message management agent framework (manages `threads` and `messages` tables) |
| `@convex-dev/workpool` | `embeddingWorkpool` | Async chunk embedding tasks (maxParallelism:3, 5 retries, 4s→64s backoff) |
| `@convex-dev/workpool` | `crawlWorkpool` | Async crawl job execution (maxParallelism:3, 3 retries, 5m→45m backoff) |
| `@convex-dev/workflow` | `crawlWorkflow` | Daily crawl orchestration (kickoff, state tracking, timeout) |

---

## 15. HTTP Router

Defined in `convex/http.ts`:

| Route | Methods | Handler | Auth |
|-------|---------|---------|------|
| `/api/webhook/crawl` | POST, OPTIONS | `crawlWebhook` from `./crawl/webhook` | HMAC-SHA256 |
| `/ingest` | POST, OPTIONS | `ingestWebhook` from `./crawl/webhook` | Bearer `CONVEX_AUTH_TOKEN` |
| `/api/reset` | POST, OPTIONS | `resetWebhook` from `./crawl/webhook` | Bearer `CONVEX_AUTH_TOKEN` |
| `/api/webhook/clerk` | POST, OPTIONS | `userWebhook` from `./clerk/webhook` | Svix signature verification |

CORS: `/api/webhook/crawl`, `/ingest` use `Access-Control-Allow-Origin: *`. `/api/reset`, `/api/webhook/clerk` use restricted origins via `getAllowedOrigins()`.

Guard: startup crash if neither `CONVEX_AUTH_TOKEN` nor `CRAWL_WEBHOOK_SECRET` is configured.

---

## 16. Admin Dashboard

The admin interface at `/admin(.*)` provides:

| Page | Purpose |
|------|---------|
| Overview | Metrics from 7 split queries: documentStats, userStats, feedbackCount, feedbackStats, crawlCount, crawlStats, cacheStats |
| Documents | Browse, search, filter, delete documents |
| Crawls | Trigger crawl, monitor status, cancel running jobs |
| Users | Search users, manage roles (admin/superadmin/user) via Clerk Backend API |
| Feedback | View user feedback with ratings and categories |
| Settings | Configure app settings (key/value/section) |

### 16.0 Admin Stats Queries (Per-Query Read-Limit Compliance)

**Constraint:** Convex enforces per-function transaction limits — a single query/mutation may read at most ~16,384 documents / ~8 MiB and is subject to overall execution-time limits (see the Convex "Limits" docs). There is **no** "one paginated call per function" rule; `.collect()`/`.take()`/`.paginate()` may be called multiple times. The real risk is that one monolithic `dashboardStats` summing every table in a single transaction can exceed the document-read / scan limit as data grows.

**Solution:** Split monolithic `dashboardStats` into 7 independent queries so each stays comfortably under the per-query read limit and can page large tables with a cursor loop. The client uses parallel `useQuery()` hooks to fetch them concurrently.

| Query | Paginated Call | Returns |
|-------|---------------|---------|
| `documentStats` | `.paginate()` with cursor loop | `{ total, indexed, pending, failed }` |
| `userStats` | `.paginate()` with cursor loop | `{ total, activeLast24h }` |
| `feedbackStats` | `.take(10)` | `{ total (placeholder), recent[] }` |
| `feedbackCount` | `.paginate()` with cursor loop | `number` |
| `crawlStats` | `.take(5)` | `{ total (placeholder), recent[] }` |
| `crawlCount` | `.paginate()` with cursor loop | `number` |
| `cacheStats` | `.paginate()` with cursor loop | `{ total }` |

**Note:** `feedbackStats` and `crawlStats` return `recent.length` as `total` (placeholder). Actual counts are in `feedbackCount` and `crawlCount`.

### 16.1 Role Management System

**Source of truth:** Clerk `publicMetadata.role` (edge/client) + Convex `users.role` (server).

| Component | File | Role check |
|-----------|------|------------|
| Edge middleware | `src/middleware.ts` | `sessionClaims.metadata.role` — redirects non-admins from `/admin(.*)` |
| Admin layout | `src/app/admin/layout.tsx` | `AuthGuard` with `isAdmin` from Clerk session claims |
| Server-side | `convex/auth.ts` | `isAdmin()`, `requireAdmin()`, `requirePermission()` — queries `users.role` from Convex DB |
| Client-side | `src/lib/clerk-claims.ts` | `isAdminRole()`, `getRoleFromClaims()` — reads JWT claims |
| Permissions | `src/lib/permissions.ts` | Centralized `ROLE_PERMISSIONS` matrix, `hasPermission()` |

**Roles:** `user` → `admin` → `superadmin` (hierarchical, higher includes lower permissions).

**Role sync flow:** Clerk Dashboard or Admin UI → Clerk `publicMetadata.role` → `user.updated` webhook → `convex/clerk/webhook.ts` → `convex/users.upsertFromWebhook` → Convex `users.role`.

**First-admin bootstrap:** Set `ADMIN_BOOTSTRAP_EMAIL` env var to auto-promote the first user with that email to admin on login or webhook sync.

**JWT template (one-time setup):** Configure Clerk JWT template mapping `user.publicMetadata` → `metadata` claim. This makes `sessionClaims.metadata.role` available at the edge without a Convex round-trip.

### 16.2 Permission Matrix

| Permission | user | admin | superadmin |
|------------|------|-------|------------|
| `chat:send` | yes | yes | yes |
| `doc:read` | yes | yes | yes |
| `crawl:trigger` | no | yes | yes |
| `crawl:list` | no | yes | yes |
| `doc:delete` | no | yes | yes |
| `settings:manage` | no | yes | yes |
| `users:manage` | no | yes | yes |
| `emergency:stop` | no | no | yes |

---

## 17. Dual-Environment Protocol (Windows / WSL)

**Critical: This project's `node_modules` is owned by Windows.** The frontend agent runs on Windows PowerShell and controls `pnpm install`. WSL must never mutate the shared `node_modules`.

### 17.1 The Problem

`pnpm` creates symlinks inside `node_modules/.pnpm/`. On Windows these are NTFS junctions/symlinks; on WSL (`/mnt/c/` mount) those symlinks are unreadable. Running `pnpm install` from both environments produces an incompatible mix of symlink types, causing `MODULE_NOT_FOUND`, `EACCES`, or vitest hangs at startup.

### 17.2 Ground Rules

| Rule | Detail |
|------|--------|
| **Ownership** | Windows owns `node_modules` and all `pnpm install` / `pnpm dev` / `pnpm build` commands |
| **WSL forbids `pnpm install`** | Never run `pnpm install` from WSL on the shared directory |
| **WSL test execution** | Run tests via `pnpm exec vitest` from WSL pointing at `/mnt/c/...` path, but only if node_modules is in a consistent (Windows-created) state |
| **Clean install for WSL only** | If WSL needs its own node_modules, clone into a WSL-native path (e.g. `~/uetgpt-test/`) — never touch the Windows-owned copy |
| **Config files** | `vitest.config.ts` uses `fileURLToPath(new URL(...))` for cross-platform path resolution. Do not revert to `__dirname` patterns. |

### 17.3 Test Execution Preference

Tests pass reliably on Windows (55 test files, 197+ individual test cases, frontend agent confirmed). Use Windows for all test execution unless explicitly testing WSL-specific behavior. The WSL hang symptom (vitest 4.1.7 prints `RUN v4.1.7` then hangs indefinitely) is caused by rolldown native binding file descriptor issues when following broken Windows symlinks on WSL's `/mnt/c/` mount.

### 17.4 If node_modules Must Be Rebuilt

1. Only the **Windows agent** initiates the rebuild: `pnpm install` from Windows PowerShell
2. After rebuild, WSL may need `@rolldown/binding-linux-x64-gnu` symlink recreated in `node_modules/.pnpm/rolldown@1.0.1/node_modules/@rolldown/` and `node_modules/@rolldown/` — the Windows install does not include the linux binding. Use absolute symlinks (`ln -sf /absolute/path`) — WSL's `/mnt/c/` mount does not reliably follow relative symlinks across file systems.

---

## 18. Key Utility Functions

| Function | File | Purpose |
|----------|------|---------|
| `fastCount(db, tableName)` | `convex/lib/db_helpers.ts` | Full-table count via internal `.count()` API (no filter support) |
| `enforceRateLimit(ctx, userId, tokenEstimate)` | `convex/rateLimit.ts` | Dual-limit: per-user (10/min) + global tokens (100K/min) |
| `cosineSimilarity(a, b)` | `convex/cache/get.ts` | Cosine similarity calculation (returns 0 on mismatch) |
| `hybridRank(vectorResults, textResults, k, weights)` | `convex/embeddings/search.ts` | RRF fusion with configurable k and weights |
| `stopAll` | `convex/emergencyStop.ts` | Drains all in-flight processing jobs (emergency) |
| `evaluateSearch(query, topK)` | `convex/eval.ts` | RAG search evaluation for test harness |

---

## 19. Frontend Component Tree

All components live under `src/components/`. Grouped by folder with one-line descriptions.

### 19.1 `chat/` — Chat Interface (9 components)

| Component | File | Description |
|-----------|------|-------------|
| `ChatWindow` | `chat-window.tsx` | Top-level chat layout: composes ChatMessages, ChatInput, and GlassPortal |
| `ChatMessages` | `chat-messages.tsx` | Scrollable message list with empty/loading/error states and auto-scroll |
| `ChatMessageBubble` | `chat-message.tsx` | Single message bubble with avatar, markdown, source list, and actions |
| `ChatInputNew` | `chat-input-new.tsx` | Auto-growing textarea with send/stop button and keyboard shortcuts |
| `ChatSuggestions` | `chat-suggestions.tsx` | Default suggestion chips shown in empty chat state |
| `SourceList` | `source-list.tsx` | Collapsible expandable list of source citations for a message |
| `SourceCard` | `source-card.tsx` | Single source card with hostname, title, relevance score, and external link |
| `MessageActions` | `message-actions.tsx` | Copy, thumbs up/down feedback, pin, and delete actions per message |
| `GlassPortal` | `glass-portal.tsx` | Frosted-glass container overlay with grid texture for visual depth |

### 19.2 `sidebar/` — Sidebar Navigation (4 components)

| Component | File | Description |
|-----------|------|-------------|
| `Sidebar` | `index.tsx` | Main sidebar: user profile, thread list, search, admin/settings links |
| `SidebarHistory` | `history.tsx` | Thread list with active-thread highlighting and inline delete |
| `SidebarSearch` | `search.tsx` | Thread search input with keyboard shortcut to open command palette |
| `NewChatButton` | `new-chat-button.tsx` | Creates a new thread via Convex mutation and navigates to it |

### 19.3 `shared/` — Shared Layout Components (4 components)

| Component | File | Description |
|-----------|------|-------------|
| `ResponsiveContainer` | `responsive-container.tsx` | Size-variant max-width container (sm/md/lg/xl/full) |
| `PageHeader` | `page-header.tsx` | Standardized page title + description + action slot |
| `LoadingSpinner` | `loading-spinner.tsx` | Animated spinner with sm/md/lg/xl size variants |
| `ErrorView` | `error-view.tsx` | Error display with heading, message, digest, and reset button |

### 19.4 `auth/` — Authentication (1 component)

| Component | File | Description |
|-----------|------|-------------|
| `AuthGuard` | `auth-guard.tsx` | Clerk auth gate with optional `requireAdmin` role check and redirect |

### 19.5 `ui/` — Primitive UI Components (13 components)

| Component | File | Description |
|-----------|------|-------------|
| `Button` | `ui/button.tsx` | Radix-based button with variant/size props |
| `Card` | `ui/card.tsx` | Card container with Header/Content/Footer sub-components |
| `Badge` | `ui/badge.tsx` | Inline badge for status/labels |
| `Input` | `ui/input.tsx` | Styled text input |
| `Label` | `ui/label.tsx` | Form label component |
| `Select` | `ui/select.tsx` | Dropdown select (Radix) |
| `Switch` | `ui/switch.tsx` | Toggle switch (Radix) |
| `Tabs` | `ui/tabs.tsx` | Tab navigation (Radix) |
| `ScrollArea` | `ui/scroll-area.tsx` | Custom scrollbar container (Radix) |
| `Separator` | `ui/separator.tsx` | Horizontal/vertical divider |
| `Skeleton` | `ui/skeleton.tsx` | Placeholder loading skeleton |
| `Sonner` | `ui/sonner.tsx` | Toast notification provider wrapper |
| `Tooltip` | `ui/tooltip.tsx` | Hover tooltip (Radix) |

### 19.6 Root-Level Components (19 components)

| Component | File | Description |
|-----------|------|-------------|
| `Providers` | `providers.tsx` | Root provider tree: Clerk, Convex, Theme, Preferences, Toaster |
| `ConvexReadyGate` | `convex-ready-gate.tsx` | Blocks rendering until Clerk + Convex auth is resolved (10s timeout) |
| `MainShell` | `main-shell.tsx` | Main layout: sidebar + content area + diagnostics panel |
| `CommandPalette` | `command-palette.tsx` | Cmd+K command palette with thread/settings/admin actions |
| `LoadingState` | `loading-state.tsx` | Skeleton placeholders for messages, sidebar, admin pages |
| `EmptyState` | `empty-state.tsx` | Empty chat state with default suggestions and graduation cap icon |
| `ConnectionStatus` | `connection-status.tsx` | Online/offline detection with auto-reconnect toast |
| `ConvexConnectionMonitor` | `ConvexConnectionMonitor.tsx` | Dev-mode Convex WebSocket connection state logger |
| `DiagnosticsPanel` | `diagnostics-panel.tsx` | Debug panel: FPS, ping, WebGL toggle, connection info |
| `ThemeProvider` | `theme-provider.tsx` | Light/dark theme context with localStorage persistence |
| `ThemeToggle` | `theme-toggle.tsx` | Sun/moon toggle button for theme switching |
| `PreferencesProvider` | `preferences-provider.tsx` | Global preferences: accent theme, WebGL, glow, animations, sounds, typing anim |
| `PreferencesModal` | `preferences-modal.tsx` | Settings modal for accent theme, feature toggles |
| `VoiceModal` | `voice-modal.tsx` | Web Speech API voice input modal with transcript confirmation |
| `VoiceModalWrapper` | `voice-modal-wrapper.tsx` | Connects VoiceModal to preferences context for chat input integration |
| `WebGLBackdrop` | `webgl-backdrop.tsx` | Three.js animated 3D backdrop (lazy-loaded, WebGL detection) |
| `AmbientGlow` | `ambient-glow.tsx` | Mouse-following ambient glow effect |
| `BackdropWrapper` | `backdrop-wrapper.tsx` | Error-boundary wrapper around lazy-loaded WebGLBackdrop |
| `Markdown` | `markdown.tsx` | Markdown renderer with syntax highlighting, safe URLs, and copy button |

### 19.7 Custom Hooks (7 hooks)

| Hook | File | Description |
|------|------|-------------|
| `useChat` | `hooks/use-chat.ts` | Chat orchestration: insert message, stream response, handle errors, source extraction |
| `useMessages` | `hooks/use-messages.ts` | Real-time message list for a thread with streaming overlay via StreamRegistry |
| `useThreads` | `hooks/use-threads.ts` | Thread list with create, rename, archive, and purge mutations |
| `useStableQuery` | `hooks/use-stable-query.ts` | Convex `useQuery` wrapper that prevents unnecessary re-renders on arg changes |
| `useUserData` | `hooks/use-user-data.ts` | Single source of truth for Convex user data (deduplicates across providers) |
| `useDebounce` | `hooks/use-debounce.ts` | Generic debounce hook for rate-limiting rapid function calls |
| `StreamRegistry` | `hooks/stream-registry.ts` | Singleton pub/sub registry for streaming content delivery to active threads |

---

## 20. Streaming & StreamRegistry Architecture

### 20.1 Stream Pipeline (`src/lib/chat/stream.ts`)

The chat API streams LLM output via `streamText()` from the Vercel AI SDK with a think-tag stripping layer.

```
LLM Provider → streamText() → textStream
  → tryModelWithFallback (tries models in order, reads first token to detect failure)
    → streamWithStrippedThinking (new ReadableStream wrapping the reader)
      → processChunk (state machine: tracks <think>/</think> tags)
        → flushTextFn (enqueues clean text to client)
          → Client receives clean streaming text
```

**Key design decisions:**

| Decision | Detail |
|----------|--------|
| Think-tag stripping | State machine tracks `<think>`/`</think>` boundaries, including partial matches at chunk boundaries. Only strict prefixes of `<think>`/`</think>` are buffered; arbitrary `<` content is flushed. |
| Mid-stream failure | If a provider fails after the first token, an inline error message is appended (`[Error: Connection to AI provider lost mid-stream]`). The response is NOT written to semantic cache (onFinish is not called). |
| First-token fallback | Provider failure before/at the first token triggers `tryModelWithFallback` to try the next model. After the first token, the model is committed. |
| Reasoning models | `REASONING_MODEL_IDS` (currently `gpt-oss-120b`) force `temperature: 1.0` regardless of the config default. |
| Stream proxy | The return value is a `Proxy` that intercepts `textStream` to return the stripped stream while preserving all other properties of the original `StreamTextResult`. |

### 20.2 StreamRegistry (`src/hooks/stream-registry.ts`)

A singleton pub/sub bridge that allows the chat API route to push streaming content into React hooks without direct coupling.

```typescript
class StreamRegistry {
  private listeners = new Map<string, Set<StreamCallback>>();
  //                threadId → Set of callbacks
}
export const streamRegistry = new StreamRegistry();
```

**Data flow:**

```
1. useMessages hook registers:  streamRegistry.register(threadId, callback)
2. API route streams response:
   → StreamRegistry.update(threadId, content, sources)
     → ForEach registered callback → callback(content, sources)
3. useMessages callback: setMessages(prev => mergeStreamingContent(prev, content))
4. useMessages unregisters on unmount: streamRegistry.unregister(threadId, callback)
```

**Design rationale:**

| Concern | Solution |
|---------|----------|
| Multiple listeners per thread | Uses `Set<StreamCallback>` per threadId — transient double-mounts during navigation or React StrictMode never clobber each other |
| Thread key | Thread Convex `_id` as string key |
| Source delivery | Optional `sources` parameter delivered once with the first chunk; hooks extract and attach to message |
| Cleanup | `unregister()` removes the callback and cleans up empty Sets |

### 20.3 Integration with useChat

`useChat` orchestrates the full send→stream→persist cycle:

1. **Insert user message** via `api.messages.insert` mutation
2. **Stream response** via `POST /api/chat` with the thread ID and message content
3. **Read `X-Sources` and `X-Intent` headers** from the response for source metadata
4. **Update StreamRegistry** with streaming content so `useMessages` can display it in real-time
5. **Insert assistant message** via `api.messages.insert` once the stream completes

---

## 21. Test Inventory

### 21.1 Summary

| Category | Test Files | Framework | Pattern |
|----------|-----------|-----------|---------|
| **Unit** | 34 | Vitest | `tests/unit/*.test.ts(x)` |
| **Integration** | 4 | Vitest | `tests/integration/*.test.ts` |
| **Convex** | 5 | Vitest | `tests/convex/**/*.test.ts` |
| **E2E** | 12 | Playwright | `tests/e2e/*.spec.ts` |
| **Total** | **55** | — | — |

Plus 1 load test (`tests/load-test.ts`) — not CI-integrated, run manually.

### 21.2 Unit Tests (34 files)

| File | Tests |
|------|-------|
| `admin-analytics.test.tsx` | Admin analytics page rendering |
| `admin-crawls.test.tsx` | Admin crawl management page |
| `admin-documents.test.tsx` | Admin document list page |
| `admin-feedback.test.tsx` | Admin feedback list page |
| `admin-layout.test.tsx` | Admin layout auth guard |
| `admin-overview.test.tsx` | Admin dashboard overview |
| `admin-settings.test.tsx` | Admin settings page |
| `auth-helpers.test.ts` | Convex auth helpers (getUserId, isAdmin, requireAuth) |
| `chat-suggestions.test.tsx` | Chat suggestion chips |
| `clerk-webhook.test.ts` | Clerk webhook event parsing |
| `connection-status.test.tsx` | Online/offline detection |
| `convex-ready-gate.test.tsx` | ConvexReadyGate loading/timeout states |
| `document-validator.test.ts` | Document schema validation |
| `embeddings-generate.test.ts` | Gemini embedding generation + key rotation |
| `empty-state.test.tsx` | Empty state component |
| `feedback-submit.test.ts` | Feedback submission mutation |
| `glass-portal.test.tsx` | GlassPortal rendering |
| `llm-models.test.ts` | LLM fallback chain resolution |
| `load-test-smoke.test.ts` | Load test smoke check |
| `loading-state.test.tsx` | Loading skeleton variants |
| `messages-api.test.ts` | Messages API (insert, list) |
| `next-config.test.ts` | Next.js config validation |
| `rag-context.test.ts` | RAG context assembly (sandwich strategy) |
| `rate-limit.test.ts` | Convex rate limiter logic |
| `retry.test.ts` | Retry with backoff utility |
| `schema.test.ts` | Convex schema validation |
| `search.test.ts` | Hybrid search (vector + BM25 + RRF) |
| `sidebar-history.test.tsx` | Sidebar thread list |
| `source-card.test.tsx` | Source citation card |
| `tailwind-config.test.ts` | Tailwind CSS config validation |
| `threads-api.test.ts` | Threads API (create, list, rename) |
| `types.test.ts` | TypeScript type definitions |
| `use-stable-query.test.ts` | useStableQuery hook behavior |
| `utils.test.ts` | Utility functions (cn, copyToClipboard) |

### 21.3 Integration Tests (4 files)

| File | Tests |
|------|-------|
| `chat-api.test.ts` | Chat API route end-to-end (auth, rate limit, streaming) |
| `embeddings-integration.test.ts` | Embedding pipeline integration |
| `rag-pipeline.test.ts` | Full RAG pipeline (classify → rewrite → embed → search → rerank) |
| `webhook-integration.test.ts` | Webhook ingest flow integration |

### 21.4 Convex Tests (5 files)

| File | Tests |
|------|-------|
| `crawl/actions.test.ts` | Crawl actions (embedSingleChunk, executeCrawlJob) |
| `crawl/mutations.test.ts` | Crawl mutations (DLQ retry, upsert, enqueue) |
| `crawl/tasks.test.ts` | Crawl tasks (cleanupExpiredCache, aggregateDailyStats) |
| `crawl/webhook.test.ts` | Webhook handlers (crawlWebhook, ingestWebhook, HMAC auth) |
| `users.test.ts` | User mutations (upsertFromWebhook, role management) |

### 21.5 E2E Tests (12 files)

| File | Tests |
|------|-------|
| `accessibility.spec.ts` | Keyboard navigation, ARIA labels, focus management |
| `admin-flow.spec.ts` | Admin dashboard navigation and interactions |
| `auth-flow.spec.ts` | Sign-in/sign-up/redirect flows |
| `capture.spec.ts` | Screenshot and video capture |
| `chat-flow.spec.ts` | Full chat conversation flow |
| `chat.spec.ts` | Chat UI rendering and interactions |
| `error-recovery.spec.ts` | Error states and recovery behavior |
| `home.spec.ts` | Home page rendering |
| `model-selector.spec.ts` | LLM model selection UI |
| `performance.spec.ts` | Page load and interaction timing |
| `responsive.spec.ts` | Mobile/tablet/desktop layout verification |
| `sidebar.spec.ts` | Sidebar navigation and thread management |

### 21.6 Test Infrastructure

| File | Purpose |
|------|---------|
| `tests/setup.ts` | Global test setup (jest-dom, fetch mock) |
| `tests/helpers/convex-mock.ts` | Convex function mocking utilities |
| `tests/helpers/admin-mocks.tsx` | Admin page test helpers |
| `tests/stubs/server-only.ts` | Stub for `server-only` module |
| `tests/e2e/global.setup.ts` | Playwright global setup (Clerk auth) |
| `tests/e2e/fixtures/base-test.ts` | Shared Playwright test fixture |

---

## 22. CI/CD Pipelines

### 22.1 GitHub Actions Workflows

#### `ci.yml` — Continuous Integration

Triggers on: push to `main`, PRs to `main`.

| Job | Runner | Timeout | Steps | Purpose |
|-----|--------|---------|-------|---------|
| **lint** | ubuntu-24.04 | 10m | checkout → pnpm setup → `biome check src/ convex/` | Lint & format check |
| **typecheck** | ubuntu-24.04 | 10m | checkout → pnpm setup → `convex codegen --typecheck disable` → `pnpm typecheck` | TypeScript strict mode |
| **test** | ubuntu-24.04 | 15m | checkout → pnpm setup → `pnpm test -- --run --reporter verbose` | Unit tests (Vitest) |
| **audit** | ubuntu-24.04 | 10m | checkout → pnpm setup → `pnpm audit --audit-level=high` | Supply-chain security |
| **e2e** | ubuntu-24.04 | 30m | checkout → pnpm setup → codegen → playwright install → `pnpm test:e2e` | E2E browser tests |
| **build** | ubuntu-24.04 | 30m | checkout → pnpm setup → codegen → `pnpm build` | Production build check |

**Gating:** `build` depends on `[lint, typecheck, test, e2e]`. E2E and build only run on push to main (require secrets). PRs run lint/typecheck/test/audit only.

**Concurrency:** `group: ${{ github.workflow }}-${{ github.ref }}` with `cancel-in-progress: true`.

**Security:** All checkout steps use `persist-credentials: false`. Actions are pinned to commit SHAs (not tags).

#### `deploy.yml` — Production Deployment

Triggers on: push to `main` (paths-ignore: docs, markdown, LICENSE), `workflow_dispatch` (environment: production/preview).

| Job | Runner | Timeout | Depends On | Purpose |
|-----|--------|---------|------------|---------|
| **build** | ubuntu-24.04 | 30m | — | Build frontend as gate |
| **deploy-convex** | ubuntu-24.04 | 20m | build | `npx convex deploy` — deploys backend + cron jobs |
| **deploy-frontend** | ubuntu-24.04 | 20m | deploy-convex | Vercel CLI: pull → build → deploy (prebuilt) |

**Order:** build → deploy-convex → deploy-frontend (sequential, convex first so frontend can immediately use new backend).

**Vercel deployment:** Uses `pnpm dlx vercel@latest pull/build/deploy` with prebuilt output. Supports `production` and `preview` environments.

### 22.2 Vercel Configuration (`vercel.json`)

| Setting | Value |
|---------|-------|
| Framework | Next.js |
| Build command | `pnpm build` |
| Install command | `pnpm install --frozen-lockfile` |
| Output directory | `.next` |
| Default function memory | 1024 MB |
| Default function maxDuration | 60s |
| Health route memory | 256 MB, 10s timeout |
| Webhook routes memory | 256 MB, 30s timeout |
| Vercel cron | `/api/cron` — daily at midnight UTC |
| GitHub integration | `silent: true`, `autoJobCancelation: true` |

### 22.3 Deployment Flow Diagram

```
Push to main
  ├─ ci.yml: lint → typecheck → test → audit → e2e → build (all must pass)
  └─ deploy.yml:
       1. build (gate — Next.js production build)
       2. deploy-convex (convex deploy — backend + crons + schema)
       3. deploy-frontend (vercel pull → build → deploy --prebuilt)
```
