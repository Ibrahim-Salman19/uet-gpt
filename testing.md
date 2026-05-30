# UETGPT Testing Strategy & Execution Plan

**Source of Truth:** This document defines all testing phases, priorities, patterns, and standards.
Testing skills loaded from `testing folder/.agents/skills/`:
- `test-driven-development/` (TDD cycle, Red-Green-Refactor)
- `testing-anti-patterns.md` (mock behavior, test-only methods, incomplete mocks)
- `systematic-debugging/` (root cause tracing, defense-in-depth)
- `verification-before-completion/` (evidence before claims)
- `webapp-testing/` (Playwright scripts with_server.py, element discovery, console logging)
- `browser-testing-with-devtools/` (DOM inspection, console logs, network, performance, a11y)
- `clerk-testing/` (setupClerkTestingToken, storageState, pk_test_* keys)

---

## Current State (Audit Baseline)

| Layer | Tool | Files | Tests | Notes |
|-------|------|-------|-------|-------|
| Unit (Convex) | Vitest | 21+ | ~205 | Good coverage but brittle mocks |
| Integration | Vitest | 4 | ~40 | RAG pipeline, chat API, embeddings, webhook |
| E2E | Playwright | 4 | 8 | Minimal coverage, no auth tests working |
| Convex Crawl | Vitest | 1 | 4 | Webhook chunking tests |
| Load Test | Manual | 1 | — | NOT CI-integrated, has hardcoded secrets |
| **Total** | — | 31+ | ~257 | — |

**Key Gaps Identified:**
1. No Convex mutation/query testing (only actions tested via `_handler` casts)
2. E2E tests have no working auth setup (Clerk middleware skipped only via PLAYWRIGHT_TEST)
3. No component/integration tests for chat streaming (SSE), source rendering, error states
4. Semantic cache write path untested
5. Crawl workflow (webhook → chunk → embed → store) not tested end-to-end
6. No rate limiting integration test against real Upstash
7. Load test not CI-safe (hardcoded secrets)
8. No accessibility (a11y) tests
9. Admin frontend tests use shallow rendering patterns
10. No regression test suite (no before/after baselines)

---

## Phase 1: Foundation & Standards (This Phase)

**Goal:** Establish test infrastructure, fix critical gaps, and standardize patterns.

### 1.1 Fix Test Setup & Infrastructure

- [ ] **1.1.1** Audit `vitest.config.ts` — ensure `environment: "jsdom"` is correct for all tests (may need `node` env for Convex tests)
- [ ] **1.1.2** Add `vitest.config.ts` workspace mode for separate Convex/React environments:
  ```
  projects/
    vitest.convex.config.ts  (environment: "node")
    vitest.react.config.ts   (environment: "jsdom")
  ```
- [ ] **1.1.3** Remove hardcoded secrets from `tests/load-test.ts` → use env vars or mock
- [ ] **1.1.4** Add CI-integrated smoke test for load test (no real API calls)
- [ ] **1.1.5** Add `@convex-dev/testing` or similar for Convex mutation/query mocking

### 1.2 Standardize Test Patterns (Anti-Pattern Audit)

Apply rules from `testing-anti-patterns.md`:

- [ ] **1.2.1** Fix incomplete mocks — search test mocks missing full response shapes
- [ ] **1.2.2** Remove `_handler` casts — add proper Convex test helpers instead (see 1.1.5)
- [ ] **1.2.3** Assert on real behavior, not mock calls — check for mock existence anti-patterns
- [ ] **1.2.4** Ensure test utilities live in `tests/helpers/` not in production code
- [ ] **1.2.5** Verify no test-only methods exist in `convex/` or `src/`

### 1.3 Add Missing Unit Tests

- [ ] **1.3.1** `convex/rag/context.ts` — `buildContext` sandwich strategy, token budget, anti-hallucination guard
- [ ] **1.3.2** `convex/rag/routing.ts` — `classifyQueryAction` with all intent classes, off_topic paths, failure fallback to "general"
- [ ] **1.3.3** `convex/cache/get.ts` — cache hit/miss/expiry, cosine similarity edge cases (empty arrays, zero vectors)
- [ ] **1.3.4** `convex/cache/set.ts` — cache write, TTL, embedding validation
- [ ] **1.3.5** `src/lib/rate-limit.ts` — role-based tiers, Upstash failure fallback, analytics flag
- [ ] **1.3.6** `convex/auth.ts` — `getUserId`, `isAuthenticated`, `isAdmin` with various identity scenarios
- [ ] **1.3.7** `src/lib/llm-models.ts` — model priority based on env vars, fallback chain construction

### 1.4 Implement TDD Workflow

Per `test-driven-development/SKILL.md` — all new code follows Red-Green-Refactor:
```
RED:   Write one failing test per behavior
       Verify it fails (expected failure reason)
GREEN: Write minimal code to pass
       Verify it passes
REFACTOR: Clean up, keep green
```

**Gate function for every commit:**
- [ ] Every new function has a test that failed first
- [ ] Test proves the bug (catches the exact behavior)
- [ ] No mock-testing (asserting on mocks, not real code)
- [ ] Complete mock data shapes, not partial mocks

---

## Phase 2: Convex Backend Testing

**Goal:** Full coverage of all Convex actions, mutations, and queries.

### 2.1 Crawl Pipeline

- [ ] **2.1.1** `convex/crawl/webhook.ts` — `chunkMarkdown` edge cases:
  - Empty content, very long content, tables, code blocks, unicode
  - Overlap boundary cases (exact boundary, within overlap, no overlap)
  - Quality filter (too few meaningful words)
- [ ] **2.1.2** `convex/crawl/actions.ts` — `embedSingleChunk`:
  - Successful embedding via RAG component
  - 400 malformed (skipped, no retry)
  - Other errors (retry via workpool)
  - `onChunkEmbedded` callback (success → insert, failure → DLQ)
- [ ] **2.1.3** `convex/crawl/mutations.ts` — core data logic (709 lines):
  - `queueChunksForEmbedding` — upsert, dedup, fast path (unchanged hash)
  - `saveEmbedding` — insert crawledChunks record
  - `markStaleDocuments` / `purgeStaleDocuments` — lifecycle transitions
  - `flagExpired` — tier-based TTL expiry
  - DLQ operations (insert, reset, abandon)
- [ ] **2.1.4** `convex/crawl/workflow.ts` — `kickoffDailyCrawl`:
  - Idempotency (skip if pending/running jobs exist)
  - Scheduled vs manual trigger
- [ ] **2.1.5** `convex/crawl/webhook.ts` — HMAC verification:
  - Valid signature, expired timestamp, invalid signature, missing headers

### 2.2 RAG Pipeline

- [ ] **2.2.1** `convex/rag/retrieval.ts` — `retrieveContext` full orchestration:
  - Happy path: classify → rewrite → HyDE → embed → cache check → search → RRF → enrich → FAQ → context
  - Off-topic short-circuit
  - Cache hit (verify no search occurs)
  - Embedding failure → BM25-only search
  - All sub-steps fail individually
- [ ] **2.2.2** `convex/embeddings/search.ts` — hybrid search:
  - `searchDocumentsAction` — vector + BM25 + FAQ + RRF + time decay
  - `generateHyDE` — only for short queries (<15 words), Gemini fallback
  - Time decay coefficients per freshness tier
  - Empty results, single result, many results (trim to limit)
- [ ] **2.2.3** `convex/embeddings/generate.ts` — key rotation:
  - All 4 keys tried in order: GEMINI_API_KEY, _1, _2, GOOGLE_GENERATIVE_AI_API_KEY
  - First key failure → fall through to next
  - All keys fail → throw
  - Task prefix formatting

### 2.3 Cache Layer

- [ ] **2.3.1** `convex/cache/get.ts`:
  - Vector search + cosine similarity at threshold 0.98
  - Manual dimension-safe loop correctness
  - Empty embedding → null (no search)
  - Expired entry → null (even if vector match)
  - Hit counter increment
- [ ] **2.3.2** `convex/cache/set.ts`:
  - Write with all fields, write with minimal fields
  - Empty embedding → no write
  - TTL calculation
- [ ] **2.3.3** `convex/cache/internal_queries.ts`:
  - `cleanupExpired` — deletes up to 50 expired entries
  - `incrementHits` — atomic counter update

### 2.4 Auth & User Functions

- [ ] **2.4.1** `convex/users.ts` — `getOrCreate`, `getByClerkId`
- [ ] **2.4.2** `convex/auth.ts` — role checks with various JWT claims
- [ ] **2.4.3** `convex/threads.ts` — thread CRUD proxy, `purgeOldArchived` (NO-OP verification)
- [ ] **2.4.4** `convex/faq.ts` — search, create, expiry

### 2.5 Cron & Tasks

- [ ] **2.5.1** `convex/crons.ts` — cron registration (schedule correctness, handler existence)
- [ ] **2.5.2** `convex/crawl/tasks.ts` — `cleanupExpiredCache`, `aggregateDailyStats`
- [ ] **2.5.3** `src/app/api/cron/route.ts` — CRON_SECRET auth, handler delegation

---

## Phase 3: API Route Testing

**Goal:** All Next.js API routes have request/response tests.

### 3.1 Chat API (`/api/chat`)

- [ ] **3.1.1** POST handler — mock Convex HTTP client:
  - Successful SSE streaming response
  - Rate limit exceeded (429)
  - Unauthorized (no Clerk session)
  - LLM fallback chain (all 4 models tried)
  - Cache write via `after()` on completion
  - Response headers: `X-Sources`, `X-Intent`
- [ ] **3.1.2** Edge case: empty question, very long question, non-text content
- [ ] **3.1.3** SSE stream format correctness (data: lines, proper termination)

### 3.2 Health API (`/api/health`)

- [ ] **3.2.1** Returns JSON with status for each service (convex, groq, gemini, cerebras, clerk)
- [ ] **3.2.2** Partial failure (some services down)

### 3.3 Webhooks

- [ ] **3.3.1** Clerk webhook — Svix verification, user.created/user.updated events, missing secret
- [ ] **3.3.2** Crawl webhook (Convex HTTP) — HMAC verification, payload parsing, idempotency

---

## Phase 4: Frontend Component Testing

**Goal:** All UI components render, interact, and handle states correctly.

### 4.1 Chat Components

- [ ] **4.1.1** `ChatWindow` — loading, empty, messages, error states
- [ ] **4.1.2** `ChatMessageBubble` — user vs assistant styling, source citations, markdown rendering
- [ ] **4.1.3** `ChatInput` — text entry, submit, disabled while streaming, keyboard shortcuts
- [ ] **4.1.4** `StreamingMessage` — animated text, complete state, error state
- [ ] **4.1.5** `SourceList` / `SourceCard` — expandable, empty, with relevance scores

### 4.2 Sidebar

- [ ] **4.2.1** `Sidebar` — open/close on mobile, responsive breakpoints
- [ ] **4.2.2** `SidebarHistory` — threads list, empty, loading, search filtering
- [ ] **4.2.3** `NewChatButton` — creates thread, redirects

### 4.3 Admin Components

- [ ] **4.3.1** Auth guard — non-admin redirected, admin sees content
- [ ] **4.3.2** Dashboard stats — all 11 metrics, loading, error, empty
- [ ] **4.3.3** Document browser — filtering, pagination, delete with confirmation
- [ ] **4.3.4** Crawl management — trigger, status polling, cancel, error states

### 4.4 Shared Components

- [ ] **4.4.1** `ThemeProvider` / `ThemeToggle` — light/dark toggle, persistence
- [ ] **4.4.2** `ErrorBoundary` — catches errors, shows fallback, recovery
- [ ] **4.4.3** `LoadingState` / `EmptyState` — renders correctly with various props

---

## Phase 5: E2E Playwright Testing

**Goal:** Full user flows automated in real browser.

### 5.1 Auth Flows

- [ ] **5.1.1** Sign-up flow (Clerk UI) — using `setupClerkTestingToken()` + `pk_test_*` keys
- [ ] **5.1.2** Sign-in flow — email/password, OAuth (Google mock)
- [ ] **5.1.3** Protected routes redirect to sign-in
- [ ] **5.1.4** Auth state persistence via `storageState`

### 5.2 Chat Flow

- [ ] **5.2.1** Send message, see streaming response, verify sources rendered
- [ ] **5.2.2** New chat, thread switching, history persistence
- [ ] **5.2.3** Error states (network failure, rate limit, empty response)

### 5.3 Admin Flow

- [ ] **5.3.1** Dashboard loads with stats, charts render
- [ ] **5.3.2** Document browsing, searching, deleting
- [ ] **5.3.3** Crawl trigger, status monitoring, cancellation

### 5.4 Cross-Browser

- [ ] **5.4.1** Chrome, Firefox, WebKit (configured in `playwright.config.ts`)
- [ ] **5.4.2** Mobile viewports (375px, 768px, 1024px)

Per `browser-testing-with-devtools/SKILL.md`:
```
Check for:
- [ ] Zero console errors or warnings
- [ ] Network requests return 200/expected status
- [ ] Accessibility tree correct
- [ ] Screenshot comparison (before/after)
```

---

## Phase 6: Semantic Cache & Embedding Testing

**Goal:** Vector search correctness, embedding quality, cache behavior under load.

### 6.1 Embedding Generation

- [ ] **6.1.1** Gemini API response parsing (all response shapes)
- [ ] **6.1.2** Dimension mismatch detection (not 3072 → error)
- [ ] **6.1.3** Retry logic (3 attempts with exponential backoff)
- [ ] **6.1.4** Batch embedding (up to 100 per call)

### 6.2 Vector Search

- [ ] **6.2.1** Cosine similarity edge cases: identical vectors, opposite vectors, zero vectors
- [ ] **6.2.2** RRF fusion: empty results, single source, custom weights
- [ ] **6.2.3** FAQ interception: scoring boost, combined with vector results
- [ ] **6.2.4** Time decay: age calculation, tier-based lambda values

### 6.3 Cache Behavior

- [ ] **6.3.1** Cache hit: same query, similar query (below threshold), identical query
- [ ] **6.3.2** Cache miss: completely different query, expired entry
- [ ] **6.3.3** Cache write: background via `after()`, concurrent writes
- [ ] **6.3.4** Cleanup: expired entries, multiple cleanup runs

---

## Phase 7: Performance & Load Testing

**Goal:** Establish baselines, prevent regressions.

### 7.1 Benchmarks

- [ ] **7.1.1** RAG pipeline end-to-end latency (p50/p95/p99)
- [ ] **7.1.2** Embedding generation throughput (requests/second)
- [ ] **7.1.3** Convex vector search latency (sub-50ms target)
- [ ] **7.1.4** Cache lookup vs full pipeline (speedup ratio)

### 7.2 Load Tests

- [ ] **7.2.1** Clean `tests/load-test.ts` — env-var-only secrets, CI-safe mode
- [ ] **7.2.2** Concurrent chat requests (5/10/25 concurrent)
- [ ] **7.2.3** Cache performance under load (hit ratio, throughput)
- [ ] **7.2.4** Rate limiter behavior under load

### 7.3 CI Integration

- [ ] **7.3.1** Add benchmark assertions to CI (no regression >10%)
- [ ] **7.3.2** Smoke load test in CI (1 concurrent, short duration)

---

## Phase 8: Accessibility & Visual Testing

**Goal:** Meet WCAG 2.1 AA, consistent rendering.

### 8.1 Accessibility

Per `browser-testing-with-devtools/SKILL.md`:
- [ ] **8.1.1** Heading hierarchy (no skipped levels)
- [ ] **8.1.2** Focus order (logical tab sequence)
- [ ] **8.1.3** Color contrast (4.5:1 minimum)
- [ ] **8.1.4** ARIA labels on all interactive elements
- [ ] **8.1.5** Dynamic content announcements (ARIA live regions)

### 8.2 Visual Regression

- [ ] **8.2.1** Screenshot baselines for all pages (light + dark mode)
- [ ] **8.2.2** Responsive breakpoints: 375px, 768px, 1024px, 1440px
- [ ] **8.2.3** Loading/empty/error states visual verification

---

## Phase 9: CI/CD & Quality Gates

**Goal:** Automated quality enforcement on every PR.

### 9.1 CI Pipeline (`.github/workflows/ci.yml`)

```
PR → lint (biome) → typecheck (tsc) → unit tests (vitest) →
     integration tests (vitest) → build (next build) →
     E2E tests (playwright) → coverage report
```

- [ ] **9.1.1** Add coverage thresholds (80% minimum, 90% target)
- [ ] **9.1.2** Add test run time budget (unit < 30s, integration < 60s, E2E < 3min)
- [ ] **9.1.3** Add performance regression check

### 9.2 Quality Gates

Per `verification-before-completion/SKILL.md`:
```
NO COMPLETION CLAIMS WITHOUT FRESH VERIFICATION EVIDENCE
```

- [ ] **9.2.1** All tests pass (fresh run, not cached)
- [ ] **9.2.2** Zero lint errors
- [ ] **9.2.3** TypeScript strict mode clean
- [ ] **9.2.4** Coverage not regressed
- [ ] **9.2.5** E2E tests pass in headless Chrome

---

## Execution Plan

### Priority Matrix

| Phase | Effort | Impact | Priority |
|-------|--------|--------|----------|
| 1: Foundation | Medium | High | **P0** |
| 2: Convex Backend | Large | Critical | **P0** |
| 3: API Routes | Medium | High | **P1** |
| 4: Frontend | Large | Medium | **P2** |
| 5: E2E | Large | High | **P1** |
| 6: Cache & Embedding | Medium | Medium | **P2** |
| 7: Performance | Medium | Medium | **P3** |
| 8: Accessibility | Medium | Low | **P3** |
| 9: CI/CD | Small | High | **P0** |

### Phase Assignments for Agent Spawning

Each phase can be worked in parallel by separate agents:

```
Phase 1 (Foundation)
  ├── Agent A: 1.1 Infrastructure, 1.2 Anti-pattern audit
  └── Agent B: 1.3 Missing unit tests, 1.4 TDD workflow docs

Phase 2 (Convex Backend)
  ├── Agent C: 2.1 Crawl pipeline tests
  ├── Agent D: 2.2 RAG pipeline tests  
  ├── Agent E: 2.3 Cache layer tests
  └── Agent F: 2.4-2.5 Auth, Users, Cron tests

Phase 3 (API Routes)
  └── Agent G: Chat API, Health, Webhooks

Phase 4 (Frontend)
  ├── Agent H: Chat components
  ├── Agent I: Sidebar, Shared components
  └── Agent J: Admin components

Phase 5 (E2E)
  ├── Agent K: Auth + Chat flows
  └── Agent L: Admin flows, cross-browser

Phase 6-9 (Optimizations)
  └── Agent M: Cache/Embedding + Performance + CI/CD
```

---

## Verification Checklist (per `verification-before-completion/SKILL.md`)

Before claiming any phase complete:
- [ ] Tests written using TDD (failed first, then passed)
- [ ] `pnpm test` — all tests pass, 0 failures
- [ ] `pnpm lint` — 0 errors, 0 warnings
- [ ] `npx tsc --noEmit` — 0 errors
- [ ] `pnpm test:e2e` — all E2E tests pass
- [ ] No testing anti-patterns (mock-testing, incomplete mocks, test-only methods)
- [ ] Test utilities in `tests/helpers/`, not in production code
- [ ] Coverage not regressed from baseline
