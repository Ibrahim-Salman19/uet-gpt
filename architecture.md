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
| **Vector DB** | Convex native `vectorIndex` (3072 dimensions for semantic cache, searched via `ctx.vectorSearch`) |
| **Caching** | Upstash Redis (`@upstash/ratelimit` + `@upstash/redis`) + Convex `semanticCache` table with cosine similarity |
| **Crawler** | Crawl4AI local Flask instance → Convex webhooks |
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
│   ├── cache/                       # Semantic cache
│   │   ├── get.ts                   #   Cache lookup (vector search + threshold)
│   │   ├── set.ts                   #   Cache write
│   │   ├── cache-mutations.ts       #   Write path mutations
│   │   ├── cache-queries.ts         #   Read path queries
│   │   ├── internal_mutations.ts    #   Internal cleanup mutations
│   │   └── internal_queries.ts      #   Internal cleanup queries (expiry, hits)
│   ├── crawl/                       # Crawl pipeline
│   │   ├── webhook.ts               #   HTTP action: crawl + ingest endpoints, chunkMarkdown()
│   │   ├── actions.ts               #   embedSingleChunk + query handler
│   │   ├── mutations.ts             #   Core data logic (queue, save, mark, purge, DLQ)
│   │   ├── queries.ts               #   Full-text search queries
│   │   ├── tasks.ts                 #   Scheduled tasks (cleanupExpiredCache, aggregateDailyStats)
│   │   └── jobs.ts                  #   Job definitions
│   ├── doc/                         # Document management
│   ├── embeddings/                  # Embedding generation
│   │   ├── generate.ts              #   Gemini API embedding (key rotation, retry, batch)
│   │   └── search.ts                #   Hybrid search (vector + BM25 + RRF)
│   ├── eval/                        # Evaluation helpers
│   ├── faq.ts                       # FAQ search/create/expiry
│   ├── feedback/                    # Feedback submission
│   ├── messages/                    # Message handling
│   ├── people/                      # People data
│   ├── rag/                         # RAG pipeline
│   │   ├── retrieval.ts             #   Orchestrator: classify → rewrite → HyDE → embed → cache → search → rerank → context
│   │   ├── context.ts               #   Sandwich strategy context assembly
│   │   └── routing.ts               #   Intent classification, query rewriting, HyDE generation
│   ├── reranking/                   # Reranking logic (FlashRank)
│   ├── threads/                     # Thread management
│   ├── users/                       # User management
│   ├── auth.config.ts               # Clerk JWT issuer config for Convex auth
│   ├── auth.ts                      # Auth helpers (getUserId, isAdmin, isAuthenticated)
│   ├── constants.ts                 # Shared constants (CACHE_SIMILARITY_THRESHOLD = 0.92)
│   ├── convex.config.ts             # Convex app config (RAG, agent, workpool, workflow components)
│   ├── crons.ts                     # 5 scheduled cron jobs
│   ├── http.ts                      # HTTP router (crawl + ingest webhook endpoints)
│   ├── messages.ts                  # Message actions
│   ├── rateLimit.ts                 # Native Convex sliding-window rate limiter
│   ├── schema.ts                    # DATABASE SCHEMA (11 tables, plus 2 component-managed)
│   └── threads.ts                   # Thread actions
├── src/
│   ├── app/                         # Next.js App Router pages
│   │   ├── admin/                   # Admin dashboard (stats, documents, crawls, settings, feedback)
│   │   ├── api/                     # API routes (chat, health, cron, webhooks)
│   │   └── auth/                    # Auth pages (login)
│   ├── components/                  # React components
│   │   ├── chat/                    # ChatWindow, ChatMessageBubble, ChatInput, StreamingMessage, SourceList
│   │   ├── sidebar/                 # Sidebar, SidebarHistory, NewChatButton
│   │   ├── admin/                   # Admin UI components
│   │   └── shared/                  # ThemeProvider, ErrorBoundary, LoadingState, SourceCard, ChatSuggestions
│   ├── hooks/                       # Custom React hooks
│   ├── lib/                         # Shared utilities
│   │   ├── llm-models.ts            #   LLM fallback chain definition
│   │   └── rate-limit.ts            #   Upstash Redis rate limit client
│   ├── providers/                   # React context providers
│   ├── middleware.ts                 # Next.js middleware (Clerk auth, CSP headers, route protection)
│   └── instrumentation.ts           # Sentry instrumentation
├── scripts/                         # Python crawler + admin scripts
│   ├── crawler.py                   # Async BFS crawler (curl_cffi, trafilatura)
│   ├── ingest_pdf.py                # PDF ingestion (pymupdf4llm + Gemini VLM fallback)
│   ├── eval/                        # RAG evaluation harness
│   │   ├── golden_set.jsonl         #   75 QA pairs across categories
│   │   └── run_eval.py              #   Evaluation runner (recall_at_k, fragment_hit_rate)
│   └── admin/                       # Convex admin scripts (stale cleanup, DLQ)
├── tests/
│   ├── convex/                      # Convex function tests (webhook, users, tasks, mutations)
│   ├── unit/                        # Unit tests (admin, components, utils, rate-limit, llm-models)
│   ├── integration/                 # Integration tests (chat API, RAG pipeline, embeddings, webhook)
│   ├── e2e/                         # Playwright E2E tests (4 files, minimal coverage)
│   ├── helpers/                     # Test utilities (convex-mock.ts)
│   ├── load-test.ts                 # Load test (not CI-integrated)
│   └── setup.ts                     # Test setup (jest-dom, global fetch mock)
├── docs/
│   ├── anti-pattern-audit-report.md # 24 test anti-patterns across 16 files
│   ├── chunking-strategy.md
│   ├── crawling-strategy.md
│   ├── deployment.md
│   ├── embedding-strategy.md
│   ├── evaluation.md
│   ├── rag-pipeline.md
│   └── security.md
├── testing.md                       # Master testing plan (12 phases)
├── vitest.config.ts                 # Vitest config (node env, alias)
├── playwright.config.ts             # Playwright config (Chromium/Firefox/WebKit)
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
| `messageId` | `string` | Indexed: `by_messageId` |
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
| `providerJobId` | `string?` | Indexed: `by_providerJobId` |
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
| `entryId` | `string?` | Indexed: `by_entryId` |
| `contentHash` | `string?` | |
| `crawlSessionId` | `string?` | Indexed: `by_session` |
| `source` | `string` | |
| `category` | `string` | Indexed: `by_category` |
| `subcategory` | `string?` | |
| `metadata` | `{ lastModified?, author?, wordCount?, language?, etag?, sourceType? }` | |
| `status` | `"pending" \| "processing" \| "indexed" \| "failed" \| "stale" \| "active" \| "pending_embed"` | Indexed: `by_status` |
| `chunkCount` | `number?` | |
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
| `expiresAt` | `number` | Indexed: `by_expiresAt` |

### 4.9 `crawlDeadLetter`

| Field | Type | Notes |
|-------|------|-------|
| `url` | `string` | |
| `jobId` | `string` | Indexed: `by_jobId_and_url` |
| `failureReason` | `string` | |
| `failureCount` | `number` | |
| `lastAttemptAt` | `number` | |
| `payload` | `any` | |
| `status` | `"pending_retry" \| "abandoned" \| "processing" \| "indexed"` | Indexed: `by_status` |

### 4.10 `crawledChunks`

| Field | Type | Notes |
|-------|------|-------|
| `documentId` | `Id<"documents">` | Indexed: `by_documentId` |
| `contentHash` | `string` | |
| `text` | `string` | searchIndex: `search_text` |
| `ragId` | `string` | Indexed: `by_ragId` |
| `embeddingModel` | `string?` | |
| `parentText` | `string?` | Parent-child chunking context |

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

The RAG pipeline is orchestrated by `convex/rag/retrieval.ts:retrieveContext` (a Convex action).

### 5.1 Pipeline Stages

| # | Stage | File | Description |
|---|-------|------|-------------|
| 1 | **Intent Classification** | `rag/routing.ts:classifyQueryAction` | LLM classifies as `admissions`, `academic`, `administrative`, `campus_life`, `general`, `off_topic`, `simple_fact`. Off-topic → short-circuit with refusal. |
| 2 | **Query Rewriting** | `rag/routing.ts:rewriteQueryAction` | Keyword-rich expansion, Roman Urdu → English translation, abbreviation expansion. |
| 3 | **HyDE** | `rag/routing.ts:hydeQueryAction` | Hypothetical document generation for queries < 15 words. |
| 4 | **Embedding** | `embeddings/generate.ts:generate` | Gemini `gemini-embedding-2`, 3072 dimensions. Key rotation across 4 env vars. Batch API for ≥2 texts. 3× retry with exponential backoff. |
| 5 | **Semantic Cache** | `cache/get.ts:get` | Cosine similarity via manual vector search loop at threshold **0.92** (from `constants.ts`). Hit → return cached response + source list; increment hit counter. |
| 6 | **Hybrid Search** | `embeddings/search.ts:searchDocumentsAction` | Vector search (`ctx.vectorSearch`) + BM25 full-text (`searchIndex`) → RRF fusion (k=60). Time decay weighting per freshness tier. FAQ interception. |
| 7 | **Reranking** | `reranking/rerank.ts:rerank` | FlashRank cross-encoder (`cross-encoder/ms-marco-MiniLM-L-6-v2`). k=8 → top 4. Falls back to slice on failure. |
| 8 | **Context Assembly** | `rag/context.ts:buildContext` | Sandwich strategy: high relevance → medium → low. Anti-hallucination confidence tiers: <0.2 **refuse**, 0.2–0.4 **hedge**, 0.4–0.6 **cite**, >0.6 **normal**. Max 3000 tokens. |
| 9 | **LLM Generation** | Frontend (Vercel AI SDK) | Stream response via fallback model chain. |
| 10 | **Cache Update** | `cache/set.ts:set` | Async via `after()`. Write response + sources + model to `semanticCache` with TTL. |

### 5.2 LLM Fallback Chain

| # | Provider | Model | SDK | Purpose |
|---|----------|-------|-----|---------|
| 1 | Groq | Llama 4 Scout (`meta-llama/llama-4-scout-17b-16e-instruct`) | `@ai-sdk/groq` | Primary RAG generation |
| 2 | Cerebras | Llama 3.3 70B (`gpt-oss-120b`) | `@ai-sdk/cerebras` | Speed fallback |
| 3 | Groq | Llama 3.1 8B (`llama-3.1-8b-instant`) | `@ai-sdk/groq` | Fast fallback |
| 4 | Gemini | 1.5 Flash (`gemini-2.5-flash`) | `@ai-sdk/google` | Reliable fallback |

Chain defined in `src/lib/llm-models.ts`. Frontend iterates this array, catching failures and moving to the next provider.

### 5.3 Injection Security (Pre-Retrieval)

Defined in `convex/rag/retrieval.ts`:

| Check | Threshold | Action |
|-------|-----------|--------|
| Max query length | 2,000 characters | `ConvexError` with message |
| Injection patterns | Regex blocklist | `ConvexError` with rephrase instruction |

Blocklist patterns: `ignore previous instructions`, `system:`, `role:`, `[INST]`, `</s>`, `<|im_start|>`, `<|im_end|>`, `### Instruction`, `<script`.

---

## 6. Crawl Pipeline

### 6.1 Architecture

```
Crawl4AI (local Flask) → POST /api/webhook/crawl → webhook.ts (HMAC verify) →
  chunkMarkdown() (parent: 3000ch, child: 800ch, overlap: 300/100) →
  mutate queueChunksForEmbedding → workpool embedSingleChunk →
  RAG component embed + index (3072d) → crawledChunks table
```

### 6.2 Webhook Security

Defined in `convex/crawl/webhook.ts`:

| Mechanism | Detail |
|-----------|--------|
| HMAC-SHA256 | Timestamp + raw body signed with `CRAWL_WEBHOOK_SECRET` |
| Timestamp validation | Max 5-minute skew (replay attack prevention) |
| Payload size limit | 10MB (`/api/webhook/crawl`), 4MB (`/ingest`) |
| Domain allowlist | Only `*.uettaxila.edu.pk` (plus `pdf://` virtual URLs for ingest) |
| Idempotency | `processedWebhooks` table dedup by `jobId` |
| Auth token | `CONVEX_AUTH_TOKEN` Bearer token for `/ingest` endpoint |

### 6.3 Chunking Strategy

| Parameter | Parent | Child |
|-----------|--------|-------|
| Max chunk size | 3,000 chars (~750 tokens) | 800 chars (~200 tokens) |
| Overlap | 300 chars | 100 chars |
| Table preservation | Row-level split with header re-injection | Inherited from parent |
| Sentence boundary | Abbreviation-protected regex split | Inherited |
| Quality filter | ≥5 meaningful words | ≥5 meaningful words |

### 6.4 Freshness Tiers

| Tier | TTL | Purpose |
|------|-----|---------|
| High | 7 days | Admissions, fee schedules, academic calendar |
| Medium | 30 days | Department info, faculty lists |
| Low | 90 days | Campus history, static reference pages |

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
| **Ingest Webhooks** | Bearer token via `CONVEX_AUTH_TOKEN` | `convex/crawl/webhook.ts` |

### 7.2 Route Protection

| Route Category | Access | Matcher |
|----------------|--------|---------|
| Public | No auth | `/`, `/unauthorized`, `/api/webhooks(.*)`, `/api/health`, `/api/cron(.*)` |
| Auth | Redirect if signed in | `/sign-in(.*)`, `/sign-up(.*)` |
| Admin | Auth + admin/superadmin role | `/admin(.*)`, `/api/admin(.*)` |
| Protected | Auth required | `/chat(.*)`, `/explore(.*)`, `/settings(.*)`, `/api/chat(.*)`, `/api/threads(.*)`, `/api/messages(.*)`, `/api/feedback(.*)` |

### 7.3 Rate Limiting

| Limit | Scope | Window | File |
|-------|-------|--------|------|
| 10 messages/minute | Per-user (Convex native) | Sliding 60s | `convex/rateLimit.ts` |
| 100,000 tokens/minute | Global (Convex native) | Sliding 60s | `convex/rateLimit.ts` |
| Upstash Redis rate limit | Client-side complement | Configurable | `src/lib/rate-limit.ts` |

### 7.4 HTTP Security Headers (next.config.ts)

| Header | Value |
|--------|-------|
| `X-Frame-Options` | `DENY` |
| `X-Content-Type-Options` | `nosniff` |
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains; preload` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `Permissions-Policy` | `geolocation=(), microphone=(), camera=()` |
| `Content-Security-Policy` | Dynamic (set in middleware with per-request nonce) |

### 7.5 Forbidden Operations (Never Violate)

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
| Frontend | Vercel | Next.js standalone output |
| Backend | Convex Cloud | Auto-deploys on push |
| Crawler | Local Crawl4AI Flask instance | Manual/scripted trigger |
| Monitoring | Sentry | Errors + performance + Vercel monitors |

### 8.2 Environment Variables

```
CONVEX_DEPLOYMENT=             # Convex deployment URL
CLERK_SECRET_KEY=              # Clerk API secret
CLERK_SIGNING_SECRET=          # Clerk webhook signing secret
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=  # Clerk publishable key (client-side)
GROQ_API_KEY=                  # Groq LLM API
GEMINI_API_KEY=                # Primary Gemini API key
GEMINI_API_KEY_1=              # Gemini key rotation #1
GEMINI_API_KEY_2=              # Gemini key rotation #2
GOOGLE_GENERATIVE_AI_API_KEY=  # Gemini key rotation #3
CEREBRAS_API_KEY=              # Cerebras LLM API
CRAWL_WEBHOOK_SECRET=          # HMAC secret for crawl webhooks
CONVEX_AUTH_TOKEN=             # Bearer token for /ingest webhook
SENTRY_ORG=                    # Sentry organization
SENTRY_PROJECT=                # Sentry project
OPENROUTER_API_KEY=            # OpenRouter (fallback embedding)
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
| `purge-old-archived-threads` | Weekly Sun 03:00 UTC | `internal.threads.purgeOldArchived` | Archive cleanup |

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
| **Batch API** | 50% discount ($0.10/M vs $0.20/M) |

### 10.2 Key Rotation

Keys tried in order: `GEMINI_API_KEY` → `GEMINI_API_KEY_1` → `GEMINI_API_KEY_2` → `GOOGLE_GENERATIVE_AI_API_KEY`. First success wins. All fail → `ConvexError`. OpenRouter fallback removed to prevent vector space incompatibility.

### 10.3 Task Prefix

Embed queries are prefixed: `task: search result | query: ${text}`.

---

## 11. Semantic Cache

### 11.1 Design

| Property | Value | File |
|----------|-------|------|
| **Similarity threshold** | 0.92 (cosine) | `convex/constants.ts` |
| **Vector index dimensions** | 3072 | `schema.ts` — `vectorIndex("by_queryEmbedding", ...)` |
| **TTL** | 24 hours (configurable per table) | Default in cache write path |
| **Search method** | Manual dimension-safe loop via `ctx.vectorSearch` | `cache/get.ts` |
| **Write trigger** | Async via `after()` after successful LLM generation | `cache/set.ts` |
| **Hit tracking** | Increment counter, returns cached + sources | `cache/get.ts` |
| **Cleanup** | Cron: daily + second pass, timer-triggered mutation | `crons.ts`, `tasks.ts` |

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
| `vitest.config.ts` | `node` env (jsdom not installed), `resolve.alias` for `@/` and `convex/` |
| `playwright.config.ts` | Chromium, Firefox, WebKit projects |

### 12.3 Test Distribution

| Layer | Files | Tests | Status |
|-------|-------|-------|--------|
| Convex (unit) | 21+ | ~205 | Good coverage, brittle mocks |
| Integration | 4 | ~40 | RAG, chat API, embeddings, webhook |
| E2E (Playwright) | 4 | 8 | Minimal, no auth tests working |
| Load test | 1 | — | Not CI-integrated |
| **Total** | **31+** | **~257** | |

### 12.4 Quality Gates

Per `AGENTS.md`, every commit must pass:
1. `npx convex dev --dry-run` → zero TypeScript errors
2. `python -m py_compile scripts/*.py` → zero syntax errors
3. `python scripts/eval/run_eval.py` → recall_at_5 not regressed
4. All relevant unit tests pass

### 12.5 TDD Mandate

Per `test-driven-development/SKILL.md` — Iron Law: **NO PRODUCTION CODE WITHOUT A FAILING TEST FIRST.** All new code must follow Red-Green-Refactor.

### 12.6 Anti-Pattern Remediation

24 test anti-patterns identified across 16 files (see `docs/anti-pattern-audit-report.md`). Key remediation:
- 25 `_handler` casts replaced with `vi.mock("convex/_generated/server")` wrappers
- 9 admin test files with mock-testing anti-patterns pending fix
- Hardcoded secrets removed from load test

### 12.7 Loaded Testing Skills

Testing is governed by 9 loaded skills (see `testing.md`): TDD, anti-patterns, systematic-debugging, verification-before-completion, webapp-testing, browser-testing-with-devtools, clerk-testing, code-review-and-quality, doubt-driven-development.

---

## 13. Evaluation

### 13.1 Harness

| Component | Location | Description |
|-----------|----------|-------------|
| Golden set | `scripts/eval/golden_set.jsonl` | 75 QA pairs across categories (admissions, fees, exams, departments, etc.) |
| Runner | `scripts/eval/run_eval.py` | Computes `recall_at_5` (primary metric) and `fragment_hit_rate` |
| Per-category | Per-category breakdown | Flags categories where recall < 0.5 |

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

| Component | Purpose |
|-----------|---------|
| `@convex-dev/rag` | Embedding, indexing, vector retrieval |
| `@convex-dev/agent` | Thread/message management agent framework |
| `@convex-dev/workpool` (embeddingWorkpool) | Async chunk embedding tasks |
| `@convex-dev/workpool` (crawlWorkpool) | Async crawl processing tasks |
| `@convex-dev/workflow` (crawlWorkflow) | Daily crawl orchestration |

---

## 15. HTTP Router

Defined in `convex/http.ts`:

| Route | Method | Handler | Purpose |
|-------|--------|---------|---------|
| `/api/webhook/crawl` | POST | `crawlWebhook` | Crawl4AI batch webhook |
| `/ingest` | POST | `ingestWebhook` | Single-page/m anual ingest |

Guard: startup crash if neither `CONVEX_AUTH_TOKEN` nor `CRAWL_WEBHOOK_SECRET` is configured.

---

## 16. Admin Dashboard

The admin interface at `/admin(.*)` provides:

| Page | Purpose |
|------|---------|
| Overview | 11 metrics (total docs, indexed, pending, failed, crawl stats, cache hits, users, feedback, etc.) |
| Documents | Browse, search, filter, delete documents |
| Crawls | Trigger crawl, monitor status, cancel running jobs |
| Feedback | View user feedback with ratings and categories |
| Settings | Configure app settings (key/value/section) |
| Analytics | Usage trends and statistics |

Admin accessible only to `admin`/`superadmin` roles, enforced by middleware RBAC + Convex auth helpers.

---

## 17. Changelog

### [2026-05-30] Initial architecture.md creation
- **Created**: `architecture.md` — comprehensive single source of truth for the UET Taxila GPT project
- **Sections**: Project Identity, Stack Overview, Directory Structure, Database Schema (14 tables), RAG Pipeline (10 stages), Crawl Pipeline, Security Architecture, Deployment, Cron Jobs, Embedding Strategy, Semantic Cache, Testing Architecture, Evaluation, Convex Component Configuration, HTTP Router, Admin Dashboard
- **Why**: Mandated by AGENTS.md as the definitive reference; no prior architecture documentation existed at this scope
- **Reference files**: schema.ts (11 tables + 2 component-managed), retrieval.ts (9-stage orchestration), routing.ts (7 intent categories), webhook.ts (HMAC + chunking), rateLimit.ts (Convex-native sliding window), crons.ts (5 scheduled jobs), convex.config.ts (5 components), constants.ts (0.92 threshold), 8 docs/*.md, testing.md (12-phase plan), AGENTS.md, CRONJOB.md
