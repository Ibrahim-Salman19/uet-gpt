# UET Taxila GPT — Architecture

**Single Source of Truth** — Read this file fully before implementing any task.
A change not documented here did not happen.

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
| **Vector DB** | Convex native `vectorIndex` (3072 dimensions for semantic cache and RAG) |
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
│   │   └── stats.ts                 #   dashboardStats, deleteDocument, deleteFeedback
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
│   │   ├── validator.ts             #   documentValidator type definition
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
│   │   ├── instance.ts              #   rag singleton (3072d, resilient embedding model)
│   │   ├── retrieval.ts             #   Orchestrator: classify → rewrite → HyDE → embed → cache → search → rerank → context
│   │   ├── context.ts               #   Sandwich strategy context assembly (internalQuery)
│   │   ├── routing.ts               #   Intent classification, query rewriting, HyDE generation (Groq LLM)
│   │   ├── prompts.ts               #   SYSTEM_PROMPT template + FEW_SHOT_EXAMPLES
│   │   └── testing.ts               #   insertTestChunk, seed, verify
│   ├── rateLimit.ts                 #   Native Convex sliding-window rate limiter (10 msg/user/min, 100K tokens/global/min)
│   ├── reranking/                   # Reranking (external FlashRank endpoint or fallback)
│   │   └── rerank.ts                #   rerank action (POSTs to RERANKER_URL)
│   ├── threads.ts                   #   create, list, rename, remove, purgeOldArchived
│   ├── users/                       # User management
│   ├── auth.config.ts               #   Clerk JWT issuer config for Convex auth
│   ├── auth.ts                      #   Auth helpers: getUserId, isAuthenticated, isAdmin, requireAuth, requireAdmin
│   ├── constants.ts                 #   CACHE_SIMILARITY_THRESHOLD = 0.92
│   ├── convex.config.ts             #   Convex app config (RAG, agent, workpool, workflow components)
│   ├── crons.ts                     #   7 scheduled cron jobs
│   ├── http.ts                      #   HTTP router (3 routes: crawl, ingest, reset)
│   ├── lib/db_helpers.ts            #   fastCount (thin wrapper around internal .count() API)
│   ├── emergencyStop.ts             #   stopAll / stopBatch — drains in-flight processing jobs
│   ├── schema.ts                    #   DATABASE SCHEMA (15 tables, plus 2 component-managed)
│   └── threads.ts                   #   Thread actions
├── src/
│   ├── app/                         # Next.js App Router pages
│   │   ├── (main)/                  # Main app layout (chat, settings, explore)
│   │   ├── admin/                   # Admin dashboard (overview, documents, crawls, settings, feedback)
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
│   ├── run_agent.sh                 # Cron entry point for Antigravity 2.0 (agy CLI)
│   ├── boot_lock.ps1                # Windows lock file for boot safety
│   └── eval/
│       ├── golden_set.jsonl         #   75 QA pairs across categories
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
│   ├── chunking-strategy.md         # Note: dimension 768 listed here is OUTDATED — actual is 3072
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

The schema is defined in `convex/schema.ts`. Tables `threads` and `messages` are managed by `@convex-dev/agent` and NOT defined in schema.ts.

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
| `queryEmbedding` | `float64[]` | **vectorIndex** `by_queryEmbedding`, 3072 dimensions |
| `response` | `string` | |
| `sources` | `{ entryId, url, title, relevanceScore, excerpt }[]` | |
| `model` | `string` | |
| `tokenCount` | `{ prompt, completion, total }?` | |
| `hits` | `number` | |
| `expiresAt` | `number` | Indexed: `by_expiresAt` |
| `createdAt` | `number` | |
| `embeddingModel` | `string?` | |
| `sourceEntryIds` | `string[]?` | R-5: Source re-index invalidation |

### 4.5 `adminAuditLog`

| Field | Type | Notes |
|-------|------|-------|
| `userId` | `Id<"users">` | Indexed: `by_userId` |
| `action` | 12 enum values | Indexed: `by_action` |
| `target` | `string?` | |
| `details` | `{ oldValue?, newValue?, reason? }` | |
| `ipAddress` | `string?` | |
| `createdAt` | `number` | Indexed: `by_createdAt` |

Actions: `user.login`, `user.logout`, `user.create`, `thread.create`, `thread.delete`, `document.create`, `document.delete`, `crawl.start`, `crawl.stop`, `feedback.submit`, `settings.update`, `admin.access`.

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
| `isStale` | `boolean?` | |

### 4.8 `processedWebhooks`

Dedup table for idempotency.

| Field | Type | Notes |
|-------|------|-------|
| `jobId` | `string` | Indexed: `by_jobId` |
| `processedAt` | `number` | |
| `expiresAt` | `number` | Indexed: `by_expiresAt` (30-day TTL) |

### 4.9 `crawlDeadLetter`

| Field | Type | Notes |
|-------|------|-------|
| `url` | `string` | |
| `jobId` | `string` | Indexed: `by_jobId_and_url` |
| `failureReason` | `string` | |
| `failureCount` | `number` | Max 5 before `"abandoned"` |
| `lastAttemptAt` | `number` | |
| `payload` | `any` | |
| `status` | `"pending_retry" \| "abandoned" \| "processing" \| "indexed"` | Indexed: `by_status` |

### 4.10 `crawledChunks`

| Field | Type | Notes |
|-------|------|-------|
| `documentId` | `Id<"documents">` | Indexed: `by_documentId`, compound: `by_documentId_and_contentHash` |
| `contentHash` | `string` | |
| `text` | `string` | searchIndex: `search_text` |
| `ragId` | `string` | RAG component entry ID — Indexed: `by_ragId` |
| `embeddingModel` | `string?` | e.g. `"gemini-embedding-2"` |
| `parentText` | `string?` | Parent-child chunking context |
| `headingPath` | `string[]?` | Section heading hierarchy |

### 4.11 `crawlStats`

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

### 4.12 `faqs`

| Field | Type | Notes |
|-------|------|-------|
| `question` | `string` | searchIndex: `search_question` |
| `answer` | `string` | |
| `sourceUrl` | `string?` | |
| `createdAt` | `number` | |
| `expiresAt` | `number?` | |

### 4.13 `appSettings`

Key/value/section config store.

| Field | Type | Notes |
|-------|------|-------|
| `key` | `string` | Indexed: `by_key` |
| `value` | `string \| number \| boolean` | |
| `section` | `string` | Indexed: `by_section` |
| `updatedAt` | `number` | |
| `updatedBy` | `Id<"users">?` | |

### 4.14 `rateLimits`

Convex-native sliding window rate limiter state.

| Field | Type | Notes |
|-------|------|-------|
| `key` | `string` | clerkUserId or `"global"` — Indexed: `by_key` |
| `windowStart` | `number` | Epoch ms — start of current 1-minute window |
| `count` | `number` | Requests (per-user) or tokens (global) in window |

---

## 5. RAG Pipeline

The RAG pipeline is orchestrated by `convex/rag/retrieval.ts:retrieveContext` (a Convex action). The RAG component instance is initialized in `convex/rag/instance.ts` with `embeddingDimension: 3072`, custom resilient embedding model wrapping Gemini, and filter names `["category", "source"]`. RAG namespace: `"uet-global"`.

### 5.1 Pipeline Stages

| # | Stage | File | Description |
|---|-------|------|-------------|
| 1 | **Pre-Retrieval Security** | `rag/retrieval.ts` | Injection scan. Max 2000 chars. Blocklist: `ignore previous instructions`, `system:`, `role:`, `[INST]`, `</s>`, `<\|im_start\|>`, `<\|im_end\|>`, `### Instruction`, `<script`, XSS variants |
| 2 | **Intent Classification** | `rag/routing.ts:classifyQueryAction` | Groq Llama 3.1 8B classifies as `admissions`, `academic`, `administrative`, `campus_life`, `general`, `off_topic`, `simple_fact`. Off-topic → short-circuit with refusal. |
| 3 | **Query Rewriting** | `rag/routing.ts:rewriteQueryAction` | Keyword-rich expansion, Roman Urdu → English translation, abbreviation expansion (UET → University of Engineering and Technology). Temperature 0.3. |
| 4 | **HyDE** | `rag/routing.ts:hydeQueryAction` | Hypothetical 3-5 sentence document for queries < 15 words. Temperature 0.5. |
| 5 | **Embedding** | `embeddings/generate.ts:generate` | Gemini `gemini-embedding-2`, 3072 dimensions. Key rotation across 4 env vars. Batch API for ≥2 texts. 3× retry with exponential backoff + jitter. Prefix: `task: search result \| query: ${text}`. |
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
| 2 | Cerebras | Llama 3.3 70B (`gpt-oss-120b`) | `@ai-sdk/cerebras` | Speed fallback |
| 3 | Groq | Llama 3.1 8B (`llama-3.1-8b-instant`) | `@ai-sdk/groq` | Fast fallback |
| 4 | Gemini | 1.5 Flash (`gemini-2.5-flash`) | `@ai-sdk/google` | Reliable fallback |

Chain defined in `src/lib/llm-models.ts`.

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
        → RAG component embed + index (3072d) → crawledChunks table
```

**Path B — External crawl4AI Service (Secondary)**:
```
External crawl4AI instance
  → POST /api/webhook/crawl (HMAC-SHA256 auth)
    → crawlWebhook (chunkMarkdown → queueChunksForEmbedding)
      → workpool embedSingleChunk
        → RAG component embed + index (3072d) → crawledChunks table
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
| `Content-Security-Policy` | Dynamic (set in middleware with per-request nonce) |

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

```
CONVEX_DEPLOYMENT=             # Convex deployment URL
CLERK_SECRET_KEY=              # Clerk API secret
CLERK_SIGNING_SECRET=          # Clerk webhook signing secret
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=  # Clerk publishable key (client-side)
CLERK_JWT_ISSUER=              # Clerk JWT issuer URL for Convex auth
GROQ_API_KEY=                  # Groq LLM API
GEMINI_API_KEY=                # Primary Gemini API key
GEMINI_API_KEY_1=              # Gemini key rotation #1
GEMINI_API_KEY_2=              # Gemini key rotation #2
GOOGLE_GENERATIVE_AI_API_KEY=  # Gemini key rotation #3
CEREBRAS_API_KEY=              # Cerebras LLM API
CRAWL_WEBHOOK_SECRET=          # HMAC secret for crawl webhooks
CRAWL_WEBHOOK_SECRET_NEW=      # Secondary HMAC secret (key rotation)
CONVEX_AUTH_TOKEN=             # Bearer token for /ingest and /api/reset webhooks
CONVEX_SITE_URL=               # Convex site URL for webhook callbacks
SENTRY_ORG=                    # Sentry organization
SENTRY_PROJECT=                # Sentry project
OPENROUTER_API_KEY=            # OpenRouter (currently unused — removed as embedding fallback)
RERANKER_URL=                  # External FlashRank reranker endpoint
CRON_SECRET=                   # API route cron authentication
```

---

## 9. Cron Jobs

Defined in `convex/crons.ts`:

| Name | Schedule | Handler | Purpose |
|------|----------|---------|---------|
| `daily-uet-webcrawl` | Daily 00:00 UTC | `internal.crawl.workflow.kickoffDailyCrawl` | Trigger daily UET website crawl |
| `daily-cleanup-expired-cache` | Daily 01:00 UTC | `internal.crawl.tasks.cleanupExpiredCache` | Remove expired cache entries |
| `daily-cleanup-expired-v2` | Daily 13:00 UTC | `internal.cache.internal_queries.cleanupExpired` | Second cleanup pass (limit: 100) |
| `retry-dead-letter` | Every 4 hours | `internal.crawl.mutations.retryDeadLetterQueue` | Retry DLQ items (limit: 100) |
| `fail-stuck-crawl-jobs` | Every 30 min | `internal.crawl.workflow.failStuckJobs` | Timeout running jobs > 2 hours |
| `cleanup-old-records` | Weekly Sun 02:00 UTC | `internal.crawl.jobs.cleanupOldRecords` | Purge abandoned DLQ (>7d) + old crawl jobs (>30d) |
| `purge-old-archived-threads` | Weekly Sun 03:00 UTC | `internal.threads.purgeOldArchived` | Archive cleanup (>6 months) |

---

## 10. Embedding Strategy

### 10.1 Model Details

| Property | Value |
|----------|-------|
| **Model** | `gemini-embedding-2` |
| **Dimensions** | 3072 (MRL supports 768/1536/3072) |
| **Context** | 8192 tokens |
| **Free tier** | ~60 RPM, ~1500 RPD |
| **Paid Tier 1** | 3000 RPM, 1M TPM |
| **Batch API** | 50% discount ($0.10/M vs $0.20/M) — used for ≥2 texts |

### 10.2 Key Rotation

Keys tried in order: `GEMINI_API_KEY` → `GEMINI_API_KEY_1` → `GEMINI_API_KEY_2` → `GOOGLE_GENERATIVE_AI_API_KEY`. First success wins. All fail → `ConvexError`. OpenRouter fallback removed to prevent vector space incompatibility.

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
| **Vector index dimensions** | 3072 | `schema.ts` — `vectorIndex("by_queryEmbedding", ...)` |
| **Search method** | `ctx.vectorSearch` on `semanticCache` table | `cache/get.ts` |
| **Cache TTL tiers** | High=7d, Medium=2d, Low=1d | `cache/set.ts` |
| **Write trigger** | Async via `after()` after successful LLM generation | `cache/set.ts`, `chat/route.ts` |
| **Hit tracking** | Increment counter, returns cached + sources | `cache/get.ts` |
| **Source invalidation** | Checks `sourceEntryIds` against `documents.updatedAt` | `cache/get.ts` (R-5) |
| **Cleanup** | Cron: daily 01:00 + 13:00 UTC | `crons.ts`, `tasks.ts`, `internal_queries.ts` |

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
| `playwright.config.ts` | Chromium, Firefox, WebKit projects |

### 12.3 Test Distribution

Tests under `tests/` organized into:
- `convex/` — Convex function tests (webhook, mutations, tasks, users, actions)
- `unit/` — Unit tests (admin components, rate-limit, llm-models, search, feedback, embeddings, RAG context)
- `integration/` — Integration tests (RAG pipeline, webhook, embeddings, chat API)
- `e2e/` — Playwright E2E (auth, chat, admin, home flows)
- `helpers/` — Test utilities (`convex-mock.ts`)

See `testing.md` for detailed test plan (12 phases) and `docs/anti-pattern-audit-report.md` for known issues.

### 12.4 Quality Gates

Per `AGENTS.md`, every commit must pass:
1. `npx convex dev --dry-run` → zero TypeScript errors
2. `python -m py_compile scripts/*.py` → zero syntax errors
3. `python scripts/eval/run_eval.py` → recall_at_5 not regressed
4. All relevant unit tests pass

---

## 13. Evaluation

### 13.1 Harness

| Component | Location | Description |
|-----------|----------|-------------|
| Golden set | `scripts/eval/golden_set.jsonl` | 75 QA pairs across categories (admissions, fees, exams, departments, etc.) |
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

All routes include CORS support (`Access-Control-Allow-Origin: *`).

Guard: startup crash if neither `CONVEX_AUTH_TOKEN` nor `CRAWL_WEBHOOK_SECRET` is configured.

---

## 16. Admin Dashboard

The admin interface at `/admin(.*)` provides:

| Page | Purpose |
|------|---------|
| Overview | 11 metrics (total docs, indexed, pending, failed, crawl stats, cache hits, users, feedback, storage) |
| Documents | Browse, search, filter, delete documents |
| Crawls | Trigger crawl, monitor status, cancel running jobs |
| Feedback | View user feedback with ratings and categories |
| Settings | Configure app settings (key/value/section) |

Admin accessible only to `admin`/`superadmin` roles, enforced by middleware RBAC + Convex auth helpers.

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

Tests pass reliably on Windows (403 tests, frontend agent confirmed). Use Windows for all test execution unless explicitly testing WSL-specific behavior. The WSL hang symptom (vitest 4.1.7 prints `RUN v4.1.7` then hangs indefinitely) is caused by rolldown native binding file descriptor issues when following broken Windows symlinks on WSL's `/mnt/c/` mount.

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
