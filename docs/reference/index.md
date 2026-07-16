# Reference (Index)

> **Audience.** AI / agent developers extending, debugging, or auditing the UETGPT system. This file is the dictionary entry point. The *machinery* lives here; the *rules* live in [`frontend_backend_boundaries.md`](../frontend_backend_boundaries.md) and the *narrative architecture* lives in [`architecture.md`](../../architecture.md).
>
> **Read order.** Skim §1–§3 to orient. Then jump to whichever lookup index in §6 you need. Only descend into `backend.md`, `frontend.md`, or `cross-cutting.md` when you need the deep signatures.

---

## Table of Contents

1. [How to Use This Reference](#1-how-to-use-this-reference)
2. [System Overview & Topology](#2-system-overview--topology)
3. [Tech Stack at a Glance](#3-tech-stack-at-a-glance)
4. [Directory Layout (Annotated)](#4-directory-layout-annotated)
5. [End-to-End Data Flows](#5-end-to-end-data-flows)
6. [Quick Lookup Indices](#6-quick-lookup-indices)
7. [Glossary](#7-glossary)
8. [Cross-Reference Map](#8-cross-reference-map)

---

## 1. How to Use This Reference

This is a **Reference** document in the Diátaxis sense: information-oriented, dense, table-heavy, designed to be *looked up* rather than read linearly. It is split across four files:

| File | Scope | Use when… |
| --- | --- | --- |
| `index.md` (this) | Index, topology, data flows, lookup indices, glossary | you need orientation, a pointer, or a flow trace |
| [`backend.md`](./backend.md) | Convex schema, every Convex function signature, RAG, embeddings, cache, crawl, rate limit, admin, components, Python offline tooling | you are adding/changing backend logic, debugging a query, or reading a Convex validator |
| [`frontend.md`](./frontend.md) | Next.js app router, route handlers, components, hooks, lib utilities, middleware, build config | you are adding/changing UI, a route handler, or build configuration |
| [`cross-cutting.md`](./cross-cutting.md) | Env vars, auth/authz matrix, type mirrors, error handling, logging, rate-limit layer picker, caching layers, observability, agent protocol (CRONJOB.md) | you need a cross-boundary fact (e.g. "which env var does X read?") |

**Companion docs (read these first if you don't already know):**

- [`architecture.md`](../../architecture.md) - narrative system architecture. This reference *agrees* with it; if you find a contradiction, architecture.md wins and this doc is stale.
- [`frontend_backend_boundaries.md`](../frontend_backend_boundaries.md) - *what you're allowed to do and where*. The reference tells you *what exists*; the boundary doc tells you *what you may safely change*.

**Forbidden actions in this repo** (from `AGENTS.md` system reminder - applies to all reference material, not just boundary doc):

- Do **not** change `embeddingDimension: 768` or `filterNames: ["category", "source"]` in the RAG config (`convex/rag/instance.ts`) - re-embedding the entire corpus is required if you do. Note: `crawledChunks` has NO `vectorIndex` in `convex/schema.ts`; the RAG component owns the vectors.
- Do **not** weaken HMAC verification on the crawl webhook (`convex/crawl/webhook.ts`).
- Do **not** skip `requireAuth` / `requireAdmin` in any new Convex function that touches user data.
- Do **not** run `git push --force`, `git add -A`, or commit directly to `main`.
- Do **not** edit `node_modules`, `convex/_generated/*`, or `src/generated/*`.
- Do **not** introduce generic "AI slop" UI aesthetics (e.g. purple gradients, pill-shaped skeletons). Consult the `taste-skill/` and `ui-ux-pro-max-skill/` directories for strict Aesthetic Standards and the Anti-Slop Protocol before any frontend styling.

---

## 2. System Overview & Topology

UETGPT is a **Retrieval-Augmented Generation chatbot for the University of Engineering and Technology (UET) Taxila** (`web.uettaxila.edu.pk`, 23 seed URLs in `src/lib/constants.ts:3-27`). It answers student queries about admissions, academics, administration, and campus life by combining a vector-search RAG over a continuously-crawled corpus of UET web pages with a multi-provider LLM fallback chain. The system is a **hybrid Python + TypeScript** stack: Next.js 16 + Convex (TypeScript) for the live app, Python `scripts/` for offline crawling/PDF/eval.

### 2.1 One-screen topology

```
                            ┌──────────────────────────────────────┐
                            │           Browser (React 19)         │
                            │  Next.js 16 App Router · Tailwind 4  │
                            │  Radix UI · Clerk session · Vercel AI│
                            └─────┬──────────────────┬─────────────┘
                                  │ HTTP/WS           │ /api/chat (LLM)
                                  │ Convex calls      │ /api/webhooks/clerk
                                  ▼                   ▼
              ┌───────────────────────────────────────────────────────┐
              │             src/middleware.ts (Clerk)                 │
              │  public: /sign-in*, /sign-up*, /api/webhooks/*         │
              └──────┬──────────────────────────────────┬─────────────┘
                     │                                  │
       ┌─────────────▼──────────────┐    ┌──────────────▼──────────────┐
       │  Convex (self-hosted)      │    │  Next.js Route Handlers     │
       │                            │    │  /api/chat · /api/cron      │
         │  schema.ts (16 tables)     │    │  /api/health                │
        │  + 5 components (config):  │    │  /api/webhooks/clerk        │
        │    rag, agent,             │    │  /api/webhook/crawl (hmac)  │
        │    crawlWorkflow,          │    │  /ingest · /api/reset       │
        │    embeddingWorkpool,      │    └──────────┬─────────────────┘
        │    crawlWorkpool           │                │
       │                            │                │
       │  Crons (10) · RAG · Cache   │                │ direct
       │  Crawl · RateLimit · Admin │                ▼
       └─────┬───────────┬──────────┘      ┌────────────────────────┐
             │           │                 │  External HTTP         │
             │           │                 │  - Groq (3 models)     │
             │           │                 │  - Cerebras (1 model)  │
             │           │                 │  - Google Gemini 2.5   │
             │           │                 │  - gemini-embedding-2  │
             │           │                 │  - Optional reranker   │
             │           │                 └────────────────────────┘
             │           │
   ┌─────────▼──┐  ┌─────▼──────────────────┐
   │  Upstash   │  │  Crawl4AI (actions)    │
   │  Redis     │  │  Sitemap merge         │
   │  RateLimit │  │  Markdown chunking     │
   │            │  │  Webhook push → Convex │
   └────────────┘  └────────────────────────┘
```

### 2.2 Subsystems (one-liner each)

| Subsystem | Owns | Lives in |
| --- | --- | --- |
| **Auth** | Clerk JWT → Convex identity mapping, `users` table sync | `convex/auth.ts`, `src/middleware.ts`, `src/lib/auth.ts`, `src/components/providers.tsx` (`UserSync`) |
| **Chat** | LLM streaming + RAG context assembly + agent threads | `src/app/api/chat/route.ts`, `convex/rag/*`, `convex/threads.ts`, `convex/messages.ts` |
| **RAG** | Vector search + intent routing + Sandwich context + injection scanner | `convex/rag/instance.ts`, `retrieval.ts`, `routing.ts`, `context.ts`, `prompts.ts` |
| **Embeddings** | gemini-embedding-2 batch generation + hybrid RRF search | `convex/embeddings/generate.ts`, `search.ts`, `doc_queries.ts` |
| **Cache** | Semantic query cache (cosine ≥ 0.92) with tiered TTL | `convex/cache/get.ts`, `set.ts`, `internal_queries.ts` |
| **Crawl** | Sitemap merge → crawl4ai fetch → chunk → embed → store | `convex/crawl/*` (**17 files**: 13 base + `backfill.ts`, `deduplication.ts`, `reset_ops.ts`, `staleness.ts`) |
| **Rate limit** | **Two layers**: (1) Upstash sliding-window in `src/lib/rate-limit.ts` (Next.js), (2) Convex-native sliding in `convex/rateLimit.ts` (`rateLimits` table) | `src/lib/rate-limit.ts`, `convex/rateLimit.ts` |
| **Admin** | Settings (appSettings), stats, audit log, reset, eval scaffolds | `convex/admin/*`, `convex/emergencyStop.ts` (batch mutator on `documents`+`crawlJobs`; `stopAll` is also the default export), `convex/eval/*` (2 stubs); legacy `convex/eval.ts` has real working `getChunksByRagIds` + `evaluateSearch` |
| **Cron** | 10 active cron jobs (1 disabled: crawl - Crawl4AI unreachable; cleanup, retry, stuck-DLQ-reset, fail-stuck, cleanup-old-records, thread-purge, rate-limit-clear, contextualize, staleness, dashboard-stats) | `convex/crons.ts` |
| **Observability** | Sentry (FE + BE only); ~~Vercel Analytics~~ **NOT INTEGRATED**; Convex dashboard | `src/sentry.*.config.ts` (Sentry wrap), `convex/...` (ctx.logger) |
| **Health** | WebSocket heartbeat (25s interval), backend health checks, connection monitoring | `convex/health.ts`, `src/components/ConvexConnectionMonitor.tsx`, `src/app/api/health/heartbeat/route.ts` |

### 2.3 External services (what reaches out)

| Service | Used by | Trigger | Failure mode |
| --- | --- | --- | --- |
| Clerk | FE + BE | Every authenticated request | Convex `requireAuth` throws, FE redirects to `/sign-in` |
| Vercel AI SDK | `src/app/api/chat/route.ts` | Every chat turn | Stream falls through `LLM_FALLBACK_CHAIN`; if all 4 fail, error returned to client |
| Groq (3 models) | Chat + intent routing | Per LLM call in chain | Try next provider in chain |
| Cerebras (1 model) | Chat | Step 2 in fallback chain | Try next provider |
| Google Gemini (gemini-2.5-flash + gemini-embedding-2) | Chat + embeddings | Step 4 / every embed call | Throws; embeddings fail → crawl stalls |
| crawl4AI (HTTP, self-hosted or external) | `convex/crawl/actions.ts` | Per URL | URL marked failed, job continues |
| Upstash Redis | `src/lib/rate-limit.ts` | Every `/api/chat` (Next.js layer) | `checkChatRateLimit` returns null (fails open); Convex layer continues independently |
| Optional Reranker | `convex/reranking/rerank.ts` | Every cache-miss answer | Graceful fallback to position-based scoring |
| Sentry | FE + BE | Every error | Sampled logs only; do not block on Sentry |
| ~~Vercel Analytics~~ | ~~FE~~ | ~~Page view / event~~ | **NOT INTEGRATED** (dev-only `console.log` shim) |

---

## 3. Tech Stack at a Glance

| Layer | Choice | Version | Notes |
| --- | --- | --- | --- |
| Frontend framework | Next.js | 16.2.6 | App Router only; React 19; turbopack + webpack dual aliases |
| UI runtime | React | 19.2.4 | Server Components default; `"use client"` opt-in |
| Styling | Tailwind CSS | 4.x | `tailwind.config.ts` present (TS config); theme tokens also in `globals.css` (CSS-first overrides) |
| Component primitives | Radix UI | latest | Via shadcn-style wrappers in `src/components/ui/*` |
| Auth | Clerk | latest | JWT template, `applicationID: "uet-gpt"`, Svix for webhooks |
| Backend runtime | Convex | latest | Self-hosted; TypeScript-first; reactive queries via `useQuery` |
| AI orchestration | @convex-dev/agent | 0.6.1 | Thread + message management |
| RAG | @convex-dev/rag | 0.7.4 | Vector search + chunking helpers |
| Workflows | @convex-dev/workflow | 0.4.2 | `crawlWorkflow` for crawl pipeline |
| Workpools | @convex-dev/workpool | 0.4.6 | `crawlWorkpool`, `embeddingWorkpool` |
| LLM SDK | Vercel AI SDK | 6.x | `streamText` for chat |
| Embedding model | gemini-embedding-2 | Google Generative AI | 768-dim, batch threshold 2 |
| Primary chat models | Groq llama-4-scout, Cerebras gpt-oss-120b, Groq llama-3.1-8b, Gemini 2.5 Flash | - | See [fallback chain](#llm-fallback-chain) |
| Rate limit | **2 layers**: (1) Upstash Redis sliding window (Next.js), (2) Convex `rateLimits` table sliding window | latest | `src/lib/rate-limit.ts` + `convex/rateLimit.ts` |
| Observability | Sentry (real init in `sentry.{client,server,edge}.config.ts`; `instrumentation.ts` is a thin `register()` wrapper) | latest | FE wrap via `next.config.ts` (withSentryConfig); BE via Convex logger |
| **Offline tooling (Python)** | `curl_cffi` + `trafilatura` (crawler), `pymupdf4llm` (PDF), custom eval harness | Python 3.x | `scripts/crawler.py`, `scripts/ingest_pdf.py`, `scripts/eval/run_eval.py` |

---

## 4. Directory Layout (Annotated)

High-level only. Per-file purpose lives in §6.1 and the deep directory trees in `backend.md` §2 and `frontend.md` §2.

### 4.1 Repo root

```
UETGPT/
├── docs/                              # Documentation
│   ├── architecture.md                # Narrative source of truth (read first)
│   ├── frontend_backend_boundaries.md # Forbidden actions + ownership rules
│   └── reference/
│       ├── index.md                   # This file
│       ├── backend.md                 # Backend dictionary
│       ├── frontend.md                # Frontend dictionary
│       └── cross-cutting.md           # Env, auth, types, errors, observability
├── uet-gpt/                           # The Next.js + Convex app (single app dir)
│   ├── convex/                        # Backend
│   ├── src/                           # Frontend
│   ├── public/                        # Static assets
│   ├── package.json
│   ├── next.config.ts
│   ├── tailwind.config.ts              # Present (TS config); CSS-first theme tokens in globals.css override
│   ├── tsconfig.json
│   ├── postcss.config.mjs
│   ├── src/instrumentation.ts         # Sentry register() wrapper (imports sentry.*.config.ts)
│   ├── src/middleware.ts              # Clerk middleware
│   ├── .env.local.example
│   ├── .github/                        # CI workflows (lint, typecheck, build)
│   └── README.md
```

### 4.2 `uet-gpt/convex/` (backend)

```
convex/
├── _generated/                        # DO NOT EDIT (gitignored, regenerated)
├── schema.ts                          # Sacred - vector index dim/filter names frozen
├── auth.config.ts                     # Clerk JWT provider config
├── auth.ts                            # requireAuth, requireAdmin, getUserId, isAdmin
├── http.ts                            # 3 unique paths / 6 routes (POST+OPTIONS per path) + start-up env guard
├── crons.ts                           # 10 active cron jobs (1 disabled: crawl - Crawl4AI unreachable)
├── convex.config.ts                   # Registers 5 components
├── constants.ts                       # CACHE_SIMILARITY_THRESHOLD = 0.92 (ONLY export)
├── rateLimit.ts                       # Convex sliding-window (10 msg/min/user, 100k tokens/min global)
├── users.ts                           # getOrCreate, getByClerkId, updatePreferences (dual auth on getOrCreate)
├── users/validator.ts                 # userValidator
├── threads.ts                         # create, list, rename, remove + internal getOldArchivedUsersBatch, purgeOldArchived
├── threads/validator.ts               # threadValidator
├── messages.ts                        # insert (threadId: v.id("threads"), 50000-char cap, enforceRateLimit, 2 source helpers) + list
├── messages/validator.ts              # sourcesValidator + tokenCountValidator + messageValidator
├── faq.ts                             # addFaq/removeFaq (admin), listFaqs, searchFaqs
├── people/queries.ts                  # getCount returns {faculty, admin, staff, total} (4 keys)
├── emergencyStop.ts                   # stopBatch (internalMutation) + stopAll (internalAction; also default export)
│
├── lib/                               # Backend helpers
│   └── db_helpers.ts                  # fastCount (unstable API, @ts-expect-error)
│
├── rag/                               # RAG subsystem
│   ├── instance.ts                    # RAG component: 768-dim, modelId="gemini-embedding-2", filterNames=["category","source"]
│   ├── retrieval.ts                   # Vector search + INJECTION_RE scanner (MAX_QUERY_LEN=2000)
│   ├── routing.ts                     # classifyQueryAction (Groq llama-3.1-8b, 7 intents)
│   ├── context.ts                     # Sandwich context builder
│   ├── prompts.ts                     # SYSTEM_PROMPT + FEW_SHOT
│   └── testing.ts                     # RAG seed data
│
├── embeddings/                        # Embedding subsystem
│   ├── generate.ts                    # gemini-embedding-2 batch (4-key rotation, BATCH_THRESHOLD=2)
│   ├── search.ts                      # Hybrid RRF (vector + keyword + faq)
│   └── doc_queries.ts                 # Document metadata queries
│
├── reranking/                         # Optional reranker
│   └── rerank.ts                      # Optional RERANKER_URL, graceful fallback to position
│
├── cache/                             # Semantic cache
│   ├── get.ts                         # vectorSearch on semanticCache.by_queryEmbedding, cosine check
│   ├── set.ts                         # Tier-aware TTL: TTL_HIGH=7d, TTL_MEDIUM=2d, TTL_LOW=1d
│   └── internal_queries.ts            # getCacheEntry, incrementHits, getDocByEntryId, cleanupExpired
│
├── crawl/                             # Crawl pipeline (17 files)
│   ├── webhook.ts                     # 3 httpActions: crawlWebhook (HMAC + state-change routing; DO NOT WEAKEN HMAC), resetWebhook, ingestWebhook (uses shared generateChunks + generateContextSummary)
│   ├── workflow.ts                    # 4 internal mutations: kickoffDailyCrawl, updateJobState, completeJobByTaskId, failStuckJobs
│   ├── actions.ts                     # "use node" - executeCrawlJob, embedSingleChunk, resetPipelineAction, runDeduplication (4 internal actions)
│   ├── workpools.ts                   # 2 Workpools: embeddingPool (p=3, r=5, 4s×2) + crawlPool (p=3, r=3, 5m×3)
│   ├── chunking.ts                    # 11 exports: 7 markdown helpers (guardChunkSize, isQualityChunk, chunkMarkdown, assignFreshnessTier, canonicalizeUrl, normalizeContent, isPdfVirtualUrl) + 4 shared pipeline helpers (buildContextPrefix, sha256, generateContextSummary, generateChunks) used by both webhook.ts and actions.ts
│   ├── jobs.ts                        # cleanupOldRecords (DLQ >7d, jobs >30d)
│   ├── tasks.ts                       # cleanupExpiredCache (BOTH semanticCache AND processedWebhooks) + aggregateDailyStats
│   ├── queries.ts                     # fullTextSearch, getDocumentCountByStatus (admin)
│   ├── trigger.ts                     # Admin mutation: insert job + enqueue via crawlPool
│   ├── status.ts                      # Admin query: per-job status
│   ├── list.ts                        # Admin query: last 20 jobs
│   ├── mutations.ts                   # 8 exports: getProcessedWebhook, markWebhookProcessed, queueChunksForEmbedding, saveEmbedding, onChunkEmbedded, retryDeadLetterQueue, upsertDocument, enqueueDocumentChunks
│   ├── reset.ts                       # resetDLQ (admin): patches abandoned→pending_retry
│   ├── staleness.ts                   # markStaleDocuments (4 statuses → stale) + purgeStaleDocuments + flagExpiredDocuments
│   ├── deduplication.ts               # findDuplicatesBatch + deleteDuplicateDocuments (paginates docs+chunks)
│   ├── backfill.ts                    # Backfill operations
│   └── reset_ops.ts                   # Reset operations
│
├── admin/                             # Admin subsystem
│   ├── settings.ts                    # getSettings (returns [] to non-admins), upsertSetting, resetSettings
│   └── stats.ts                       # Split queries (1 paginated each): documentStats, userStats, feedbackStats, feedbackCount, crawlStats, crawlCount, cacheStats + deleteDocument + deleteFeedback
│
├── doc/                               # Doc-level API (7 files)
│   ├── index.ts                       # Barrel export
│   ├── create.ts                      # `create` (internalMutation) + `updateStatus` (internalMutation, 7 statuses)
│   ├── get.ts                         # `get` + `getByUrl` (queries, both requireAuth)
│   ├── list.ts                        # `list` (query, declares `cursor` but IGNORES it)
│   ├── remove.ts                      # `remove` (admin mutation, calls rag.deleteAsync first)
│   ├── search.ts                      # `search` (query, search_title + client-side category filter)
│   └── validator.ts                   # documentValidator (19 fields: _id, _creationTime, url, title, entryId, contentHash, source, category, subcategory, metadata, status, chunkCount, chunksEmbedded, crawlSessionId, freshnessTier, isStale, crawledAt, updatedAt, error)
│
├── feedback/                          # Feedback subsystem
│   ├── submit.ts                      # Dedupes by (messageId, userId), 2000-char comment cap
│   └── list.ts                        # Admin sees all 50; user sees own 50
│
├── health.ts                          # Heartbeat query + health check (WebSocket keepalive)
│
├── eval/                              # Eval subsystem (2 STUBS only - NO getChunksByRagIds.ts, NO evaluateSearch.ts in this dir)
    ├── run.ts                         # public action stub: returns `{ id, status: "pending", ... }`, no DB writes
    └── results.ts                     # public query stub: returns `{ status: "completed", score: 0, details: {} }`, no DB reads
# NOTE: Legacy convex/eval.ts (top-level) contains REAL functions: getChunksByRagIds (internalQuery) + evaluateSearch (action calling rag.search). Registered in _generated/api.d.ts.
```

### 4.3 `uet-gpt/src/` (frontend)

```
src/
├── app/                               # App Router
│   ├── layout.tsx                     # Root layout (HTML shell, fonts, <Providers>)
│   ├── page.tsx                       # 7-line `redirect("/chat")` (server)
│   ├── globals.css                    # Tailwind + theme variables
│   ├── (main)/                        # Authenticated route group
│   │   ├── layout.tsx                 # App shell (sidebar + main)
│   │   ├── chat/
│   │   │   ├── page.tsx               # NEW-THREAD landing (client, calls api.threads.create)
│   │   │   └── [threadId]/
│   │   │       ├── page.tsx           # Server: unwraps async params, renders <ChatThreadClient>
│   │   │       └── client.tsx         # Client: ChatThreadClient - actual chat thread UI
│   │   ├── explore/page.tsx           # Browse index
│   │   └── settings/page.tsx          # User settings
│   ├── admin/                         # Admin route group (role-gated)
│   │   ├── layout.tsx                 # Admin guard (requireAdmin) - CLIENT component w/ ClientOnly
│   │   ├── page.tsx                   # Admin overview dashboard (6 StatCards - 3 primary + 3 secondary) - CLIENT
│   │   ├── analytics/page.tsx
│   │   ├── crawls/page.tsx            # NOTE plural
│   │   ├── documents/page.tsx
│   │   ├── feedback/page.tsx
│   │   └── settings/page.tsx
│   ├── sign-in/[[...sign-in]]/page.tsx
│   ├── sign-up/[[...sign-up]]/page.tsx
│   ├── unauthorized/page.tsx          # 403 page for non-admins (force-dynamic)
│   └── api/
│       ├── chat/route.ts              # LLM streaming (ConvexHttpClient + LLM_FALLBACK_CHAIN)
│       ├── cron/route.ts              # verifyCronSecret (header OR ?cron_secret=)
│       ├── health/route.ts            # CRON_SECRET bearer, checks 5 services (Convex/Groq/Gemini/Cerebras/Clerk); returns 503 when all fail
      ├── health/heartbeat/route.ts  # Lightweight HTTP heartbeat (25s interval, bypasses React cache)
│       └── webhooks/clerk/route.ts    # svix Webhook.verify signature
│
├── components/                        # React components
│   ├── providers.tsx                  # Provider orchestration + INLINE UserSync (private) + ConvexConnectionMonitor
│   ├── theme-provider.tsx             # ThemeProvider + useTheme (lowercase, hyphenated)
│   ├── preferences-provider.tsx       # PreferencesProvider + usePreferences (5 accent themes, audio synth)
│   ├── ui/                            # 23 Radix wrappers (avatar, badge, button, calendar, card, command, dialog, dropdown-menu, form, input, label, popover, scroll-area, select, separator, sheet, skeleton, sonner, switch, table, tabs, textarea, tooltip)
│   ├── auth/                          # 1 file: auth-guard.tsx (AuthGuard with requireAdmin prop)
│   ├── chat/                          # 9 files (chat-window, chat-message, chat-input-new, source-list, …)
│   ├── shared/                        # 4 files (loading-spinner, confirm-dialog, …)
│   └── sidebar/                       # 5 files (index/Sidebar, header, history, new-chat-button, search)
│
├── hooks/                             # Custom React hooks (13 files)
│   ├── use-chat.ts                    # LLM streaming via fetch /api/chat + streamRegistry
│   ├── use-threads.ts                 # create/list/delete/rename via api.threads.*
│   ├── use-stable-query.ts            # Wraps useQuery with stable ref
│   ├── stream-registry.ts             # Subscribable streaming state
│   ├── [DELETED Jun 2026] use-admin.ts, use-copy-to-clipboard.ts, use-sources.ts
│   ├── use-debounce.ts                # Debounced value hook
│   ├── use-local-storage.ts           # SSR-safe localStorage hook
│   ├── use-media-query.ts             # Responsive breakpoint hook
│   ├── use-messages.ts                # Message list w/ optimistic updates
│   ├── use-mounted.ts                 # Track client mount (avoids hydration mismatch)
│   └── use-user-data.ts               # Clerk user + Convex user join
│
├── lib/                               # Frontend utilities
│   ├── auth.ts                        # requireUser/requireAdmin/getUserRole (Clerk server)
│   ├── convex.ts                      # [DELETED June 2026] - was Convex client setup; consumers create their own inline
│   ├── rate-limit.ts                  # Upstash sliding window (user 50/hr, admin 200/hr, anon 10/hr)
│   ├── constants.ts                   # UET_CRAWL_CONFIG (23 seedUrls, maxPages=500, maxDepth=5) + CACHE_SIMILARITY_THRESHOLD
│   ├── types.ts                       # Plain-TS type mirrors
│   ├── llm-models.ts                  # LLM_FALLBACK_CHAIN (4 entries, no env reads)
│   ├── retry.ts                       # Exponential backoff
│   ├── utils.ts                       # cn() classname helper
│   ├── analytics.ts                   # Intentional no-op stubs (see §21.15)
│   ├── prompt.ts                      # Shared buildSystemPrompt/extractText (used by route.ts + tests)
│   ├── clerk-claims.ts                # ClerkSessionClaims helpers
│   └── clerk-theme.ts                 # UET Clerk appearance (IMPORTED by sign-in/page.tsx and sign-up/page.tsx)
│
├── sentry.{client,server,edge}.config.ts  # Real Sentry init
├── instrumentation.ts                 # Thin register() wrapper, conditionally imports sentry.* configs
└── middleware.ts                      # clerkMiddleware (public: sign-in, sign-up, api/webhooks)
```

### 4.4 `uet-gpt/tests/` (test infrastructure)

```
tests/
├── setup.ts                            # Vitest global setup (DOM env, jest-dom matchers)
├── load-test.ts                        # Manual load test (run on demand, not in CI)
├── helpers/                            # Shared mock factories
│   ├── README.md                       # Conventions for writing helpers
│   ├── convex-mock.ts                  # Generic Convex mock builder (queries + actions)
│   └── admin-mocks.tsx                 # `buildAdminMocks({...})` factory for admin pages (convex/react, next/navigation, lucide-react, shadcn UI components, sonner); consumed via `vi.hoisted(() => buildAdminMocks({...}))` in test files
├── unit/                               # 34 component + helper unit tests
│   └── admin-*.test.tsx                # 6 admin page tests all use `buildAdminMocks` from tests/helpers/
├── integration/                        # Cross-module integration tests
├── convex/                             # Backend-only Convex tests
└── e2e/                                # Playwright end-to-end tests
```

---

## 5. End-to-End Data Flows

Five canonical flows. Each is a *trace*, not a tutorial - it shows the message, the file that handles it, and what that file may do.

### 5.1 Chat (the most-traveled path)

```
User types message in <ChatInput>
        │
        ▼
src/app/api/chat/route.ts (POST)
        │
        ├─ Upstash sliding window                              [src/lib/rate-limit.ts]
        │     tier: user=50/h · admin=200/h · anon=10/h
        │
        ├─ Manual body validation (JSON.parse + Array.isArray) [src/app/api/chat/route.ts]
        │
        ├─ ConvexHttpClient → api.cache.get                   [convex/cache/get.ts]
        │     └─ vectorSearch("semanticCache", "by_queryEmbedding")
        │         if cosine ≥ 0.92 → return cached response   [convex/constants.ts]
        │
        ├─ (cache miss) RAG pipeline                           [convex/rag/retrieval.ts]
        │     ├─ Pre-retrieval INJECTION_RE scan                [convex/rag/retrieval.ts]
        │     ├─ Intent classification (Groq llama-3.1-8b)    [convex/rag/routing.ts]
        │     │     7-way: admissions/academic/administrative/
        │     │            campus_life/general/off_topic/simple_fact
        │     ├─ Hybrid search (vector + keyword, RRF k=60)    [convex/embeddings/search.ts]
        │     ├─ Optional reranker (if RERANKER_URL set)       [convex/reranking/rerank.ts]
        │     └─ Sandwich context assembly                     [convex/rag/context.ts]
        │
        ├─ (NOT WIRED - convex/rateLimit.ts exists with         [convex/rateLimit.ts]
        │     per-user 10 msg/min, global 100K tokens/min,
        │     but chat route only uses Upstash rate limit above)
        │
        ├─ Insert user message + sources to agent thread       [src/hooks/use-chat.ts]
        │
        ├─ LLM_FALLBACK_CHAIN (streamText)                     [src/lib/llm-models.ts]
        │     1. Groq llama-4-scout-17b-16e-instruct
        │     2. Cerebras gpt-oss-120b
        │     3. Groq llama-3.1-8b-instant
        │     4. Google gemini-2.5-flash
        │     [src/app/api/chat/route.ts]
        │
        ├─ (on success) Cache result with tier-aware TTL       [convex/cache/set.ts]
        │     high=7d · medium=2d · low=1d
        │
        └─ Stream back to client (Vercel AI SDK)
```

### 5.2 Crawl (the data-ingestion path)

```
External sitemap or admin trigger
        │
        ├─ (admin) convex/crawl/trigger.ts → trigger (admin mutation)
        │     creates crawlJobs row, status=pending
        │
        ▼
convex/crawl/webhook.ts POST /api/webhook/crawl
        │
        ├─ HMAC-SHA256 verify (CRAWL_WEBHOOK_SECRET)           [convex/crawl/webhook.ts]
        ├─ ±5min timestamp skew check
        ├─ processedWebhooks dedup (by jobId)
        │
        ├─ Route by state (acknowledged without processing; see webhook.ts:58-65):
        │     "started"  → acknowledge only (no enqueueCrawlJob exists)
        │     "completed"→ completeJobByTaskId [convex/crawl/workflow.ts]
        │     "failed"   → status=failed
        │
        ▼
convex/crawl/workflow.ts → kickoffDailyCrawl (cron) or trigger → executeCrawlJob
        │
        ▼
convex/crawl/workpools.ts → crawlPool.run(ctx, job, fn)
        │     maxParallelism=3, 5min backoff
        │
        ▼
convex/crawl/actions.ts
        │
        ├─ Sitemap merge (parallel URL discovery)
        ├─ Per URL: fetch via crawl4AI (markdown output)
        ├─ For each document:
        │     ├─ chunkMarkdown(content, MAX_SAFE_CHARS=7200)  [convex/crawl/chunking.ts]
        │     ├─ Compute contentHash
        │     ├─ Dedupe via existing chunks (same hash)
        │     ├─ queueChunksForEmbedding                        [convex/crawl/mutations.ts]
        │     └─ embeddingWorkpool.run                          [convex/crawl/workpools.ts]
        │           maxParallelism=3, 4s backoff (Gemini free tier)
        │
        ▼
convex/embeddings/generate.ts
        │
        ├─ Batch ≥ BATCH_THRESHOLD=2 → gemini-embedding-2 batch API
        ├─ < threshold → single-call API
        ├─ Insert into crawledChunks w/ embedding (768-dim)
        └─ vectorSearch index updated
```

### 5.3 Clerk lifecycle (the identity path)

```
User signs in (Clerk) → ClerkSessionClaims cookie
        │
        ├─ (FE) src/middleware.ts → clerkMiddleware
        │     public routes pass-through; protected → requireAuth
        │
        ▼
UserSync mount in src/components/providers.tsx
        │
        ├─ useUser() returns Clerk user
        ├─ on mount: api.users.getOrCreate(clerkUserId)        [convex/users.ts]
        │     with 3-retry exponential backoff (1s base)
        │
        ▼
convex/users.ts
        │
        ├─ Idempotent insert into `users` table
        ├─ Returns existing row if present (sync'd)
        │
        ▼
Authed user lands in <ChatInput>
        │
        ▼
Clerk webhook (user.created / user.updated / user.deleted)
        │
        ▼
src/app/api/webhooks/clerk/route.ts
        │
        ├─ Svix signature verify (CLERK_SIGNING_SECRET)
        │
        ▼
Convex mutation (calls `convex/users.ts::getOrCreate` for user.created/user.updated; authenticated via WEBHOOK_SECRET shared secret)
        │
        └─ Reconcile users table (create/update)
```

### 5.4 Cron (the housekeeping path)

```
convex/crons.ts schedules 10 active jobs (1 disabled: crawl - Crawl4AI unreachable)
        │
        ├─ Sun 00:00 UTC weekly-uet-webcrawl [DISABLED]
        │     └─ kickoffDailyCrawl [convex/crawl/workflow.ts] (weekly instead of daily)
        │
        ├─ 01:00 UTC daily-cleanup-expired-cache
        │     └─ delete semanticCache rows where expiresAt < now()   [convex/cache/internal_queries.ts]
        │
        ├─ 03:00 UTC daily-contextualize-chunks
        │     └─ contextualize 10 chunks/day (was 50)   [convex/embeddings/contextualizeCron.ts]
        │
        ├─ 04:00 UTC staleness-check
        │     └─ check document staleness   [convex/observability/staleness.ts]
        │
        ├─ 4h interval retry-dead-letter
        │     └─ re-enqueue crawlDeadLetter rows (max 3 retries)
        │
        ├─ 30min interval reset-stuck-dlq-entries
        │     └─ reset stuck "processing" DLQ entries to "pending_retry"
        │
        ├─ 2h interval fail-stuck-crawl-jobs
        │     └─ set status=failed where status=running AND startedAt < now-2h
        │
        ├─ Sun 02:00 UTC cleanup-old-records
        │     └─ purge old crawlJobs, feedback, notifications       [convex/crawl/jobs.ts]
        │
        ├─ Sun 03:00 UTC purge-old-archived-threads
        │     └─ delete old agent threads
        │
        ├─ 1h interval clear-stale-rate-limits
        │     └─ clear stale rate limit tracking rows
        │
        └─ 1h interval compute-dashboard-stats
              └─ pre-compute admin dashboard statistics
```

**Removed:** `daily-cleanup-expired-v2` (redundant), `metrics-aggregation` (disabled), `daily-uet-webcrawl` (replaced by weekly)
**Added since original:** `reset-stuck-dlq-entries` (30min), `clear-stale-rate-limits` (1h), `compute-dashboard-stats` (1h)

### 5.5 Emergency stop (the kill path)

```
Admin invokes convex/emergencyStop.ts::stopAll (from Convex dashboard)
        │
        ▼
stopAll (internalAction) loops stopBatch (internalMutation):
        │
        ├─ documents.processing (limit 500) → status="failed"
        │
        └─ crawlJobs.running (limit 500) → status="cancelled"
        ├─ convex/crawl/actions.ts → refuses to enqueue
        ├─ src/app/api/chat/route.ts → returns 500 (catch-all error handler)
        └─ Admin dashboard shows banner
```

---

## 6. Quick Lookup Indices

### 6.1 File-to-purpose index

> Format: **`path`** - purpose. RBAC: `pub` (public) · `auth` (authed) · `admin` · `cron` · `webhook` · `internal` (Convex-internal only).
> Full signatures in `backend.md` §3 or `frontend.md` §3.

#### Backend Convex files (most-frequently-asked-about)

| Path | Purpose | RBAC |
| --- | --- | --- |
| `convex/schema.ts` | All 16 tables, all indexes; vectors live in the RAG component (no vector index in `crawledChunks`); `semanticCache.by_queryEmbedding` is the only `vectorIndex` | internal |
| `convex/auth.ts` | `requireAuth`, `requireAdmin`, `getUserId`, `isAuthenticated`, `isAdmin` | internal |
| `convex/auth.config.ts` | Clerk JWT provider registration (`applicationID: "uet-gpt"`) | internal |
| `convex/http.ts` | HTTP routes: `/api/webhook/crawl` (HMAC), `/ingest`, `/api/reset`, OPTIONS | mixed |
| `convex/crons.ts` | 10 active cron jobs (1 disabled: crawl - Crawl4AI unreachable) | cron |
| `convex/clerk/webhook.ts` | Clerk user webhook HTTP action (header-based auth) | webhook |
| `convex/convex.config.ts` | Registers: agent, rag, crawlWorkflow, embeddingWorkpool, crawlWorkpool | internal |
| `convex/constants.ts` | `CACHE_SIMILARITY_THRESHOLD=0.92` (ONLY export) | internal |
| `convex/rateLimit.ts` | Sliding-window per-user + global token budget | internal |
| `convex/users.ts` | `getOrCreate`, `getByClerkId`, `updatePreferences` (dual auth on `getOrCreate`) | mixed |
| `convex/threads.ts` | `create` (uses `components.agent.threads.createThread`), `list` (returns `threadValidator[]`), `rename`, `remove` (+ internal `getOldArchivedUsersBatch`, `purgeOldArchived`) | auth |
| `convex/messages.ts` | `insert` (50000-char cap, enforces rate limit) + `list` | auth |
| `convex/faq.ts` | `addFaq`/`removeFaq` (admin) + `listFaqs` + `searchFaqs` (internal) | mixed |
| `convex/feedback/{submit,list}.ts` | Submit feedback (thumbs/comment) + admin list | auth |
| `convex/emergencyStop.ts` | Batch mutator: `stopBatch` (internalMutation) + `stopAll` (internalAction loops; also default export) | internal |
| `convex/eval.ts` | **REAL functions**: `getChunksByRagIds` (internalQuery) + `evaluateSearch` (action calls `rag.search`) - NOT a stub | mixed |
| `convex/doc/*` | **7 files**: `index` (barrel), `create` (internalMutation), `get`/`getByUrl` (query), `list` (query, cursor arg ignored), `remove` (admin mutation), `search` (query), `validator` (7-status validator) | auth/admin |
| `convex/rag/retrieval.ts` | Hybrid search + INJECTION_RE scanner | internal |
| `convex/rag/routing.ts` | 7-way intent classification via Groq llama-3.1-8b | internal |
| `convex/rag/context.ts` | Sandwich context builder | internal |
| `convex/rag/prompts.ts` | SYSTEM_PROMPT + FEW_SHOT examples | internal |
| `convex/rag/instance.ts` | RAG component singleton | internal |
| `convex/rag/testing.ts` | RAG seed data | internal |
| `convex/embeddings/generate.ts` | gemini-embedding-2 batch + single | internal |
| `convex/embeddings/search.ts` | Hybrid RRF (vector + keyword) | internal |
| `convex/embeddings/doc_queries.ts` | `getDocumentByEntryId` (internalQuery) - joins chunks→docs | internal |
| `convex/crawl/backfill.ts` | One-shot migration: populate `chunksEmbedded` | internal |
| `convex/crawl/reset_ops.ts` | 4 INTERNAL mutations: `resetAbandonedDLQ`, `resetPipelineBatch`, `resetFailedDocuments`, `reembedPendingBatch` | internal |
| `convex/reranking/rerank.ts` | Optional HTTP rerank w/ positional fallback | internal |
| `convex/cache/get.ts` | vectorSearch("semanticCache") + cosine check | internal |
| `convex/cache/set.ts` | Tier-aware TTL insert | internal |
| `convex/cache/internal_queries.ts` | getCacheEntry, incrementHits, cleanup | internal |
| `convex/crawl/webhook.ts` | 3 httpActions: `crawlWebhook` (HMAC verify + state-change routing), `resetWebhook`, `ingestWebhook` (shares `generateChunks` + `generateContextSummary` with crawlWebhook) | webhook |
| `convex/crawl/workflow.ts` | 4 internal mutations: `kickoffDailyCrawl`, `updateJobState`, `completeJobByTaskId`, `failStuckJobs` | cron/admin |
| `convex/crawl/actions.ts` | Sitemap merge + crawl4AI fetch | internal |
| `convex/crawl/workpools.ts` | crawlWorkpool, embeddingWorkpool | internal |
| `convex/crawl/chunking.ts` | 11 exports: 7 markdown helpers (`chunkMarkdown`, `guardChunkSize`, `isQualityChunk`, `normalizeContent`, `canonicalizeUrl`, `assignFreshnessTier`, `isPdfVirtualUrl`) + 4 shared pipeline helpers (`buildContextPrefix`, `sha256`, `generateContextSummary`, `generateChunks`) reused by webhook.ts | internal |
| `convex/crawl/mutations.ts` | 8 exports: `getProcessedWebhook`, `markWebhookProcessed`, `queueChunksForEmbedding`, `saveEmbedding`, `onChunkEmbedded`, `retryDeadLetterQueue`, `upsertDocument`, `enqueueDocumentChunks` | internal |
| `convex/crawl/queries.ts` | 11 exports: `fullTextSearch`, `getDocumentCountByStatus`, `getRecentDocs`, `getDLQSample`, `searchByUrl`, `getFailedDocs`, `getPendingEmbedDocs`, `getDocsBySource`, `getJobById`, `getChunksForDoc`, `getChunksWithHeadings` | internal |
| `convex/crawl/jobs.ts` | cleanupOldRecords | cron |
| `convex/crawl/tasks.ts` | cleanupExpiredCache | cron |
| `convex/embeddings/contextualizeCron.ts` | contextualizeCron (10 chunks/day) | cron |
| `convex/observability/staleness.ts` | checkStaleness | cron |
| `convex/crawl/trigger.ts` | Admin-triggered crawl entry | admin |
| `convex/crawl/status.ts` | Per-job status query | auth/admin |
| `convex/crawl/list.ts` | Paginated job list | auth/admin |
| `convex/crawl/reset.ts` | Admin reset | admin |
| `convex/admin/settings.ts` | getSettings/upsertSetting/resetSettings on `appSettings` | admin |
| `convex/admin/stats.ts` | Split queries (7 functions): documentStats, userStats, feedbackStats, feedbackCount, crawlStats, crawlCount, cacheStats + deleteDocument + deleteFeedback | admin |
| `convex/feedback/submit.ts` | Submit feedback | auth |
| `convex/feedback/list.ts` | List feedback | admin |
| `convex/doc/validator.ts` | Document-level validators | internal |
| `convex/messages/validator.ts` | Message-level validators | internal |
| `convex/eval/results.ts` | [DELETED Jun 2026] Eval results stub - removed as dead code | - |
| `convex/eval/run.ts` | [DELETED Jun 2026] Eval run stub - removed as dead code | - |
| `convex/lib/db_helpers.ts` | `fastCount` (unstable Convex API) | internal |

#### Frontend files (most-frequently-asked-about)

| Path | Purpose | RBAC |
| --- | --- | --- |
| `src/middleware.ts` | `clerkMiddleware` w/ public matcher | middleware |
| `src/lib/auth.ts` | `requireUser`, `requireAdmin`, `getUserRole` | server |
| `src/lib/convex.ts` | [DELETED] Exported ConvexReactClient + ConvexHttpClient but nothing imported them. Consumers create their own inline. | mixed (was) |
| `src/lib/rate-limit.ts` | Upstash sliding window 3-tier | server |
| `src/lib/constants.ts` | UET_CRAWL_CONFIG + re-export CACHE_SIMILARITY_THRESHOLD | mixed |
| `src/lib/types.ts` | Plain-TS type mirrors | mixed |
| `src/lib/llm-models.ts` | LLM_FALLBACK_CHAIN | server |
| `src/lib/retry.ts` | Exponential backoff | server |
| `src/lib/utils.ts` | `cn` classname helper | mixed |
| `src/lib/analytics.ts` | Vercel analytics wrappers | client |
| `src/lib/clerk-claims.ts` | ClerkSessionClaims helpers | server |
| `src/lib/clerk-theme.ts` | UET Clerk appearance | client |
| `src/components/providers.tsx` | Provider orchestration + UserSync | client |
| `src/app/api/chat/route.ts` | LLM streaming + LLM_FALLBACK_CHAIN | public (rate-limited) |
| `src/app/api/cron/route.ts` | Vercel cron entry (CRON_SECRET) | cron |
| `src/app/api/health/route.ts` | Health probe (CRON_SECRET) | internal |
| `src/app/api/webhooks/clerk/route.ts` | Svix verify → Convex sync | webhook |
| `src/app/layout.tsx` | Root layout | public |
| `src/app/page.tsx` | Redirects to /chat (also next.config.ts has server-level redirect) | public |
| `src/app/(main)/chat/[threadId]/page.tsx` | Thread-specific chat UI | auth |
| `src/app/(main)/chat/page.tsx` | Chat landing (creates new thread) | auth |
| `src/app/admin/layout.tsx` | Admin guard | admin |
| `src/app/admin/page.tsx` | Admin dashboard | admin |
| `src/app/sign-in/[[...sign-in]]/page.tsx` | Clerk sign-in | public |
| `src/app/sign-up/[[...sign-up]]/page.tsx` | Clerk sign-up | public |
| `next.config.ts` | Turbopack + webpack aliases, Sentry wrap, security headers, image patterns | build |

### 6.2 Symbol index (most-called)

> Format: **`name`** - file:line - RBAC - one-liner.

#### Convex functions

| Symbol | File | RBAC | Purpose |
| --- | --- | --- | --- |
| `requireAuth` | `convex/auth.ts` | internal | Throws if not authed; returns userId |
| `requireAdmin` | `convex/auth.ts` | internal | Throws if not admin; returns userId |
| `getUserId` | `convex/auth.ts` | internal | Returns userId or null |
| `isAuthenticated` | `convex/auth.ts` | internal | Returns boolean |
| `isAdmin` | `convex/auth.ts` | internal | Returns boolean |
| `enforceRateLimit` | `convex/rateLimit.ts` | internal | Sliding-window per-user + global |
| `checkRateLimit` | `convex/rateLimit.ts` | query | Read-only rate limit status check (user + global) |
| `get` | `convex/cache/get.ts` | auth | Cache lookup with cosine check |
| `set` | `convex/cache/set.ts` | internal | Tier-aware TTL insert |
| `retrieveContext` | `convex/rag/retrieval.ts` | auth | Hybrid search + injection scan |
| `classifyQueryAction` | `convex/rag/routing.ts` | internal | Groq llama-3.1-8b 7-way |
| `buildContext` | `convex/rag/context.ts` | internal | Pre-/post-chunk context |
| `generate` | `convex/embeddings/generate.ts` | internal | gemini-embedding-2 batch |
| `searchDocumentsAction` | `convex/embeddings/search.ts` | internal | RRF k=60 |
| `rerank` | `convex/reranking/rerank.ts` | internal | HTTP rerank or positional fallback |
| `kickoffDailyCrawl` | `convex/crawl/workflow.ts` | cron/admin | Idempotent job kickoff (closest to old "enqueueCrawlJob" intent; `webhook.ts` only exports httpActions) |
| `chunkMarkdown` | `convex/crawl/chunking.ts` | internal | Markdown → chunks |
| `generateChunks` | `convex/crawl/chunking.ts` | internal | Shared 2-level chunk pipeline (used by `crawlWebhook` and `ingestWebhook`); wraps `chunkMarkdown` + `guardChunkSize` with a `buildContextPrefix` header |
| `generateContextSummary` | `convex/crawl/chunking.ts` | internal | Lazy-loads `@ai-sdk/google` for Gemini 2.5 Flash doc summary; reused by both crawl webhooks |
| `queueChunksForEmbedding` | `convex/crawl/mutations.ts` | internal | Insert + contentHash dedup |
| `getOrCreate` | `convex/users.ts` | mixed (dual auth) | Idempotent user sync |
| `documentStats` | `convex/admin/stats.ts` | admin | Document status counts (indexed/pending/failed via .paginate()) |
| `userStats` | `convex/admin/stats.ts` | admin | User counts (total + active in 24h via .paginate()) |
| `feedbackStats` | `convex/admin/stats.ts` | admin | Recent 10 feedback items (via .take(10)) |
| `feedbackCount` | `convex/admin/stats.ts` | admin | Total feedback count (via .paginate()) |
| `crawlStats` | `convex/admin/stats.ts` | admin | Recent 5 crawl jobs (via .take(5)) |
| `crawlCount` | `convex/admin/stats.ts` | admin | Total crawl job count (via .paginate()) |
| `cacheStats` | `convex/admin/stats.ts` | admin | Cache entry count (via .paginate()) |
| `getSettings` | `convex/admin/settings.ts` | admin (returns `[]` to non-admin) | Read admin settings |
| `upsertSetting` | `convex/admin/settings.ts` | admin | Write admin setting |
| `submit` | `convex/feedback/submit.ts` | auth | Submit thumbs/comment (dedupes by (messageId,userId)) |
| `stopBatch` | `convex/emergencyStop.ts` | internal | Mutate processing→failed, running→cancelled (500/batch) |
| `stopAll` | `convex/emergencyStop.ts` | internal | Loops `stopBatch` |
| `cleanupOldRecords` | `convex/crawl/jobs.ts` | cron | Purge old records (DLQ >7d, jobs >30d) |
| `cleanupExpired` | `convex/cache/internal_queries.ts` | cron | Delete expired `semanticCache` rows (NB: this name in `cache/internal_queries.ts`; the cron `daily-cleanup-expired-cache` calls the same function in `crawl/tasks.ts::cleanupExpiredCache` which handles BOTH `semanticCache` AND `processedWebhooks`) |
| `contextualizeCron` | `convex/embeddings/contextualizeCron.ts` | cron | Contextualize 10 chunks/day via Gemini Flash (was 50) |
| `checkStaleness` | `convex/observability/staleness.ts` | cron | Daily document staleness check |

#### Frontend functions

| Symbol | File | Purpose |
| --- | --- | --- |
| `POST /api/chat` | `src/app/api/chat/route.ts` | LLM streaming |
| `GET /api/cron` | `src/app/api/cron/route.ts` | Vercel cron entry |
| `GET /api/health` | `src/app/api/health/route.ts` | Health probe |
| `POST /api/webhooks/clerk` | `src/app/api/webhooks/clerk/route.ts` | Clerk lifecycle |
| `requireUser` | `src/lib/auth.ts` | Throw if not authed (server) |
| `requireAdmin` | `src/lib/auth.ts` | Throw if not admin (server) |
| `getUserRole` | `src/lib/auth.ts` | Get role from Clerk |
| `cn` | `src/lib/utils.ts` | Tailwind classname merge |
| `retryWithBackoff` | `src/lib/retry.ts` | Exponential backoff helper |
| `LLM_FALLBACK_CHAIN` | `src/lib/llm-models.ts` | Provider chain |
| `UserSync` | `src/components/providers.tsx` (INLINE, not exported) | Clerk → Convex user sync |

### 6.3 Env var index (cross-refs to `cross-cutting.md` §5.1)

> Full table with `where-read`, `owner`, and `default` lives in `cross-cutting.md`. Quick pointer:

| Var | Read by | Notes |
| --- | --- | --- |
| `CONVEX_DEPLOYMENT` (NOT `CONVEX_DEPLOY_KEY`) | Convex CLI | Deploy name |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` (NOT `CLERK_PUBLISHABLE_KEY`) | ClerkProvider, `src/app/api/health/route.ts` | Public |
| `CLERK_SECRET_KEY` | `src/lib/auth.ts` (server) | Secret |
| `CLERK_SIGNING_SECRET` (NOT `CLERK_WEBHOOK_SECRET`) | `src/app/api/webhooks/clerk/route.ts` | svix verify |
| `CLERK_JWT_ISSUER` (NOT `CLERK_JWT_KEY`) | Convex auth | JWT verification |
| `CONVEX_AUTH_TOKEN` | `convex/http.ts` start guard, `/ingest`, `/api/reset` | Bearer |
| `CRAWL_WEBHOOK_SECRET` | `convex/crawl/webhook.ts` | HMAC-SHA256 (±5min skew) |
| `WEBHOOK_SECRET` | `convex/users.ts::getOrCreate` (shared secret branch of dual auth) | Bearer-style |
| `CRON_SECRET` | `src/app/api/cron/route.ts`, `src/app/api/health/route.ts` | Bearer or query |
| `GEMINI_API_KEY` (1 of 4 rotation) | `convex/embeddings/generate.ts`, `src/app/api/chat/route.ts` | Gemini 2.5 Flash / gemini-embedding-2 |
| `GEMINI_API_KEY_1` | `convex/embeddings/generate.ts` (rotation key 2) | Gemini embedding (rotation) |
| `GEMINI_API_KEY_2` | `convex/embeddings/generate.ts` (rotation key 3) | Gemini embedding (rotation) |
| `GOOGLE_GENERATIVE_AI_API_KEY` | `convex/embeddings/generate.ts` (rotation key 4), `convex/crawl/webhook.ts` (doc summarization) | gemini-embedding-2 / Gemini 2.5 Flash |
| `GROQ_API_KEY` | `src/app/api/chat/route.ts` | Groq |
| `CEREBRAS_API_KEY` | `src/app/api/chat/route.ts` | Cerebras |
| `UPSTASH_REDIS_REST_URL` | `src/lib/rate-limit.ts` | Upstash |
| `UPSTASH_REDIS_REST_TOKEN` | `src/lib/rate-limit.ts` | Upstash |
| `RERANKER_URL` | `convex/reranking/rerank.ts` | Optional (graceful fallback) |
| `CRAWL4AI_BASE_URL` | `convex/crawl/actions.ts` (fallback if CRAWL4AI_URL unset) | Default `http://localhost:11235` |
| `ADMIN_EMAILS` | **NOT READ by any code** (placeholder in `.env.local.example` only) | Was intended for admin bootstrap; admin role determined solely by Clerk user metadata |
| `SENTRY_DSN` / `NEXT_PUBLIC_SENTRY_DSN` | `src/sentry.{server,client,edge}.config.ts` | Sentry |
| `NEXT_PUBLIC_CONVEX_URL` | `src/lib/convex.ts` (removed - consumers create their own `ConvexHttpClient` inline) | Convex public URL |
| `NEXT_PUBLIC_APP_URL` | `src/app/api/chat/route.ts` (CSRF origin check) | Public base URL |

### 6.4 Error behavior (no structured error codes)

| Where | Behavior | Status/Code |
| --- | --- | --- |
| `convex/auth.ts` | Throws `new ConvexError("Authentication required")` / `new ConvexError("Admin access required")` | ConvexError → client 4xx |
| `convex/rateLimit.ts` | Throws `new ConvexError("Rate limit exceeded: ...")` | ConvexError → client 4xx |
| `convex/crawl/webhook.ts` | Returns plain string: `"Payload too large"`, `"Missing signature headers"`, `"Request timestamp expired"`, `"Invalid signature"`, `"Server configuration error"`, `"Internal Server Error"`, `"Unauthorized"` | HTTP 400 / 401 / 413 / 500 |
| `convex/embeddings/generate.ts` | Throws `new Error(...)` on all-keys-exhausted | Uncaught → Convex 500 |
| `src/app/api/chat/route.ts` | Returns `NextResponse.json({ error: "..." }, { status })` with plain English messages | HTTP 400 / 401 / 403 / 413 / 429 / 500 |
| `convex/cache/get.ts` | Returns `null` on cache miss (normal, not error) | Normal flow |

### 6.5 Forbidden index (do-not-touch)

| Path | Forbidden change |
| --- | --- |
| `convex/schema.ts` | `dimensions: 768` on `by_queryEmbedding` index (would require full re-embed) |
| `convex/rag/instance.ts` | `embeddingDimension: 768` (must match embedding model output dim) |
| `convex/rag/instance.ts` | `filterNames: ["category", "source"]` (must match RAG filter calls) |
| `convex/auth.config.ts` | `applicationID` mismatch with Clerk JWT template |
| `convex/crawl/webhook.ts` | Weakening HMAC verify or removing timestamp skew check |
| `convex/http.ts` | Removing start-up env guard |
| `convex/embeddings/generate.ts` | Changing batch threshold without re-indexing test |
| `src/lib/llm-models.ts` | Removing a fallback (must keep ≥1 provider) |
| `convex/rag/prompts.ts` | Removing FEW_SHOT examples wholesale (drift) |
| `src/middleware.ts` | Removing public matcher (locks webhooks) |

---

## 7. Glossary

| Term | Definition |
| --- | --- |
| **Agent thread** | A conversation thread managed by `@convex-dev/agent`. Lives in the `agent` component's `threads` table, not in `schema.ts`. |
| **ApplicationID** | Clerk JWT template identifier. Must match between Clerk dashboard and `convex/auth.config.ts`. Currently `"uet-gpt"`. |
| **ApplicationID mismatch** | When the JWT template name in Clerk ≠ the `applicationID` in `convex/auth.config.ts`. Causes "`Authentication required`" error on every Convex call. |
| **Cache tier** | TTL category: `high` (7d), `medium` (2d), `low` (1d). Selected by `freshnessTier` derived from URL pattern (admission/academic → high, department/faculty → medium, other → low). |
| **Crawled chunks** | Markdown segments stored in the `@convex-dev/rag` component (NOT in `crawledChunks` with a `by_embedding` vector index - verified `convex/schema.ts` has NO vector index on `crawledChunks`). Vectors are owned by the rag component. |
| **Crawl job** | A row in `crawlJobs` representing one crawl run. State machine: `pending → running → (completed \| failed \| cancelled)`. Has `trigger: manual\|scheduled\|webhook`, `startedBy`, `duration`. |
| **Content hash** | SHA-256 of chunk text. Used to dedupe identical content across crawls. |
| **Crawl workflow** | The `@convex-dev/workflow` instance kicked off in `convex/crawl/workflow.ts::kickoffDailyCrawl`. Idempotency: no pending/running, no completed <23h. |
| **Diátaxis** | Documentation framework: Tutorial (learning), How-to (goal-oriented), Reference (information), Explanation (understanding). This is Reference. |
| **Embedding dimension** | The size of the vector produced by the embedding 768** (gemini-embedding-2). Set in `convex/rag/instance.ts` as `embeddingDimension: 768` (NOT in `convex/schema.ts` - there is no vector index on `crawledChunks`). |
| **Emergency stop** | The `convex/emergencyStop.ts` batch mutator (`stopAll`→`stopBatch`) that flips `documents.processing`→`failed` and `crawlJobs.running`→`cancelled` in 500-row batches. NOT a flag check; invoke directly from Convex dashboard. |
| **LLM fall-through chain** | The 4-entry `LLM_FALLBACK_CHAIN` list in `src/lib/llm-models.ts` (static, no env reads). `src/app/api/chat/route.ts::getAvailableModels` rotates preferred+chain. |
| **Filter names** | The two metadata fields allowed for vector index filtering: `category` and `source`. Set in `convex/rag/instance.ts::rag` config (`filterNames: ["category", "source"]`), NOT in `convex/schema.ts`. |
| **HMAC-SHA256** | Hash-based message auth code. Used in `convex/crawl/webhook.ts` to verify webhook integrity. ±5 min skew tolerance. |
| **Hybrid search** | Combines vector search (semantic) with keyword search, fused via Reciprocal Rank Fusion (RRF, k=60). |
| **Idempotency** | Property that repeated calls produce the same result. `users.getOrCreate`, `kickoffDailyCrawl`, `processedWebhooks` are idempotent. |
| **INJECTION_RE** | Regex blocklist in `convex/rag/retrieval.ts` (`scanForInjection`) applied to the **user query** (not to retrieved chunks). Filters prompt-injection patterns before search. |
| **Intent** | One of 7 categories: `admissions`, `academic`, `administrative`, `campus_life`, `general`, `off_topic`, `simple_fact`. |
| **Internal vs. public** | Convex functions can be `query`/`mutation`/`action` (callable from client) or `internalQuery`/`internalMutation`/`internalAction` (callable only from server). |
| **LLM fallback chain** | See [Fallback chain](#llm-fallback-chain). |
| **MAX_SAFE_CHARS** | 7200. Max markdown chars per chunk (rough char count, not token count). |
| **MAX_QUERY_LEN** | 2_000. Max chars in a user query sent to RAG. Local to `convex/rag/retrieval.ts` (NOT exported). |
| **Provider (LLM)** | One of Groq, Cerebras, Google Gemini. Each provides ≥1 model. |
| **RRF (k=60)** | Reciprocal Rank Fusion with k=60. Standard constant for hybrid search fusion. |
| **Reranker** | Optional HTTP service (`RERANKER_URL`) that re-orders search results. Falls back to position-based scoring if unavailable. |
| **Sandwich context** | Pattern: system prompt + few-shot + retrieved chunks (filling) + user query + guardrail suffix. Reduces injection at the edges. |
| **Semantic cache** | Cache of LLM responses indexed by query embedding. Hit if cosine similarity ≥ 0.92. |
| **Sitemap merge** | Combining multiple sitemap XMLs into a deduplicated URL set before crawling. |
| **Slider window** | Rate limit pattern: counts events in the last N seconds, not fixed buckets. |
| **State machine** | The lifecycle `pending → running → completed \| failed \| cancelled` for `crawlJobs`. |
| **Tiered TTL** | Different cache TTLs by tier (high/medium/low), not one-size-fits-all. |
| **User sync** | The flow that keeps `convex/users` rows in lockstep with Clerk users. Triggered by `UserSync` on mount and by Clerk webhooks. |
| **Vector index** | The `by_queryEmbedding` index on `semanticCache` (768-dim, no filter). Vectors for `crawledChunks` are owned by the `@convex-dev/rag` component and indexed in the component's internal storage using `filterNames: ["category", "source"]` configured in `convex/rag/instance.ts`. **`crawledChunks` has NO `vectorIndex` in `convex/schema.ts`.** |
| **Workpool** | `@convex-dev/workpool` concurrency limiter. Two pools: `crawlWorkpool` (3-parallel, 5min backoff) and `embeddingWorkpool` (3-parallel, 4s backoff for Gemini free tier). |

### LLM fallback chain

| Step | Provider | Model | Env var | Notes |
| --- | --- | --- | --- | --- |
| 1 | Groq | `meta-llama/llama-4-scout-17b-16e-instruct` | `GROQ_API_KEY` | Primary |
| 2 | Cerebras | `gpt-oss-120b` | `CEREBRAS_API_KEY` | Fallback if Groq down |
| 3 | Groq | `llama-3.1-8b-instant` | `GROQ_API_KEY` | Smaller Groq if Cerebras down |
| 4 | Google | `gemini-2.5-flash` | `GEMINI_API_KEY` | Last resort; uses Vercel AI SDK |

Plus a **separate** 1-step chain for intent classification (`convex/rag/routing.ts`): Groq `llama-3.1-8b-instant`. Failure here falls back to the `general` intent.

---

## 8. Cross-Reference Map

| Doc | Owns | When to read |
| --- | --- | --- |
| [`architecture.md`](../../architecture.md) | Narrative system architecture, request flows, data model rationale | First; establishes the mental model |
| [`frontend_backend_boundaries.md`](../frontend_backend_boundaries.md) | *What you may change where.* Forbidden actions, ownership rules, handoff contracts | Before editing anything; re-read §21 caveats before any cross-cutting change |
| [`index.md`](./index.md) | This file. Index, topology, data flows, lookup indices | When you need orientation or a pointer |
| [`backend.md`](./backend.md) | Every Convex schema field, every Convex function signature, subsystem internals | When you are touching the backend |
| [`frontend.md`](./frontend.md) | Every Next.js route, every component, every hook, every lib util, build config | When you are touching the frontend |
| [`cross-cutting.md`](./cross-cutting.md) | Every env var × reader, auth matrix, type mirrors, error catalog, observability | When you need a cross-boundary fact |

**Reading order for a new contributor:**

1. `architecture.md` (skim §1–§4)
2. `frontend_backend_boundaries.md` (read all; internalize §21 caveats)
3. `index.md` (this file) §1–§3
4. Then deep-dive per task into `backend.md` / `frontend.md` / `cross-cutting.md`

**Reading order for an AI agent doing a code change:**

1. Locate the change in `index.md` §6.1 (file-to-purpose)
2. Read the forbidden index in `index.md` §6.5 to confirm the change is allowed
3. Read `frontend_backend_boundaries.md` for the relevant section
4. Read `backend.md` / `frontend.md` / `cross-cutting.md` for the affected file's full signature
5. Read `architecture.md` for the *why*
6. Make the change
7. Verify with the test/lint commands in `package.json`
