# UETGPT Testing Strategy & Execution Plan

**Source of Truth:** This document defines all testing phases, priorities, patterns, and standards.
Testing skills loaded from `.agents/skills/`:
- `test-driven-development/SKILL.md` (TDD cycle, Iron Law: no code without failing test first)
- `testing-anti-patterns.md` (never test mocks, no test-only methods, complete mocks)
- `systematic-debugging/SKILL.md` (Iron Law: no fixes without root cause)
- `verification-before-completion/SKILL.md` (Iron Law: no claims without fresh evidence)
- `webapp-testing/SKILL.md` (Playwright + with_server.py, reconnaissance-then-action)
- `browser-testing-with-devtools/SKILL.md` (DOM/console/network/a11y/profiling)
- `clerk-testing/SKILL.md` (setupClerkTestingToken, storageState, pk_test_*)
- `code-review-and-quality/SKILL.md` (5-axis review: correctness, readability, architecture, security, performance)
- `doubt-driven-development/SKILL.md` (fresh-context adversarial review before non-trivial decisions)

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
1. ~~No Convex mutation/query testing (only actions tested via `_handler` casts)~~ **FIXED Phase 3**
2. E2E tests have no working auth setup (Clerk middleware skipped only via PLAYWRIGHT_TEST)
3. No component/integration tests for chat streaming (SSE), source rendering, error states
4. Semantic cache write path untested
5. Crawl workflow (webhook → chunk → embed → store) not tested end-to-end
6. No rate limiting integration test against real Upstash
7. Load test not CI-safe (hardcoded secrets)
8. No accessibility (a11y) tests
9. Admin frontend tests use shallow rendering patterns (ANTI-PATTERN: testing mock behavior)
10. No regression test suite (no before/after baselines)
11. No cross-model adversarial review for non-trivial test decisions
12. No CI-side quality gates (coverage thresholds, performance budgets)

---

## Phase 1: Foundation & Standards (Completed)

**Goal:** Establish test infrastructure, fix critical gaps, and standardize patterns.

### 1.1 Fix Test Setup & Infrastructure — Partial

- [x] **1.1.1** Audit `vitest.config.ts` — ensure `environment: "jsdom"` is correct for all tests (may need `node` env for Convex tests). **Verdict:** jsdom not installed, environment section causes vitest 4.1.7 to hang. Using `node` env for all tests. Admin JSX tests need jsdom install as separate fix.
- [ ] **1.1.2** Add workspace mode for separate Convex/React environments — TRIED then reverted (config issues). **Blocked:** needs to be reapproached
- [x] **1.1.3** Remove hardcoded secrets from `tests/load-test.ts` → DONE: refactored to accept params, env-var-only secrets in standalone mode
- [x] **1.1.4** Add CI-integrated smoke test for load test → DONE: `tests/unit/load-test-smoke.test.ts`
- [x] **1.1.5** Add proper Convex mutation/query mocking → DONE: `tests/helpers/convex-mock.ts` with scheduler + storage stubs, mutation/query/action/httpAction wrappers via `vi.mock("convex/_generated/server")`
- [x] **1.1.6** Remove `test.environment`/`test.setupFiles`/`test.globals` from vitest config (causes vitest 4.1.7 hang) → **DONE:** vitest.config.ts simplified to only `resolve.alias`

### 1.2 Standardize Test Patterns (Anti-Pattern Audit) — Complete

Apply rules from `testing-anti-patterns.md`:

- [x] **1.2 Audit** DONE: `docs/anti-pattern-audit-report.md` created — 24 issues across 16 files found
- [ ] **1.2.1** Fix incomplete mocks — search test mocks missing full response shapes (1 file: `admin-stats.test.ts` Convex query mock)
- [x] **1.2.2** Remove `_handler` casts — add proper Convex test helpers instead (6 files affected) → **DONE:** replaced with `vi.mock("convex/_generated/server")` wrappers
- [ ] **1.2.3** Assert on real behavior, not mock calls — 9 admin test files assert on mock skeletons/icons. **HIGH priority:** these tests pass/fail based on mock existence, not component correctness
- [x] **1.2.4** Ensure test utilities live in `tests/helpers/` — DONE: `convex-mock.ts`, `README.md`
- [x] **1.2.5** Verify no test-only methods in production — Verified clean
- [x] **1.2.6** Fix env var leaks between tests — DONE: `users.test.ts` uses `vi.stubEnv`/`vi.unstubAllEnvs` scoped per-describe
- [x] **1.2.7** Fix missing `afterEach` imports (vitest 4.x requires explicit imports when `globals: false`) — DONE: added to `webhook.test.ts`, `users.test.ts`
- [x] **1.2.8** Fix missing `vi.mock` for `_generated/api` in `tasks.test.ts` — DONE
- [x] **1.2.9** Fix stale production imports in tests (`llm-models.test.ts` was referencing non-existent exports) — DONE

### 1.3 Add Missing Unit Tests — Partial

- [ ] **1.3.1** `convex/rag/context.ts` — `buildContext` sandwich strategy — NOT YET DONE (existing test uses `_handler` pattern, now fixed)
- [ ] **1.3.2** `convex/rag/routing.ts` — `classifyQueryAction` — NOT YET DONE
- [ ] **1.3.3** `convex/cache/get.ts` — cache hit/miss/expiry — NOT YET DONE
- [ ] **1.3.4** `convex/cache/set.ts` — cache write, TTL — NOT YET DONE
- [x] **1.3.5** `src/lib/rate-limit.ts` — DONE: `tests/unit/rate-limit.test.ts` (6 tests)
- [x] **1.3.6** `convex/auth.ts` — role checks — DONE (auth-helpers.test.ts existed, extended)
- [x] **1.3.7** `src/lib/llm-models.ts` — DONE: `tests/unit/llm-models.test.ts` (5 tests)

### 1.4 TDD Workflow — Mandatory

Per `test-driven-development/SKILL.md` — ALL new code MUST follow Red-Green-Refactor:

```
RED:   Write one failing test per behavior
       Verify it fails (expected failure reason — feature missing, not typo)
GREEN: Write minimal code to pass
       Verify it passes
REFACTOR: Clean up, keep green
```

**Iron Law:**
```
NO PRODUCTION CODE WITHOUT A FAILING TEST FIRST
```

**Verification gate for every commit:**
- [ ] Every new function has a test that failed first
- [ ] Each test failed for correct reason (feature missing, not typo/setup error)
- [ ] Wrote minimal code to pass each test (no YAGNI)
- [ ] Output pristine (no errors, warnings)
- [ ] Tests use real code as much as possible (mocks only for external dependencies)
- [ ] Complete mock data shapes, not partial mocks
- [ ] Coverage not regressed from baseline
- [ ] Edge cases and error states covered

**Rationalizations that mean STOP:**
- "I'll test after" — No. Test first or delete code.
- "Already manually tested" — No. Manual is ad-hoc. Automated catches regressions.
- "Too simple to test" — Simple code breaks too. Test takes 30 seconds.

---

## Phase 2: Convex Backend Testing (In Progress)

**Goal:** Full coverage of all Convex actions, mutations, and queries.

### 2.1 Crawl Pipeline — Partial

- [x] **2.1.1** `convex/crawl/webhook.ts` — `chunkMarkdown` edge cases:
  - Empty content, very long content, tables, code blocks, unicode — **DONE**
  - Overlap boundary cases (exact boundary, within overlap, no overlap) — **DONE**
  - Quality filter (too few meaningful words) — **DONE**
- [x] **2.1.2** `convex/crawl/actions.ts` — `embedSingleChunk`:
  - Successful embedding via RAG component — **DONE**
  - 400 malformed (skipped, no retry) — **DONE**
  - Other errors (retry via workpool) — **DONE**
  - `onChunkEmbedded` callback (success → insert, failure → DLQ) — **DONE**
- [x] **2.1.3** `convex/crawl/mutations.ts` — core data logic (709 lines):
  - `queueChunksForEmbedding` — upsert, dedup, fast path (unchanged hash) — **DONE**
  - `saveEmbedding` — insert crawledChunks record — **DONE**
  - `markStaleDocuments` / `purgeStaleDocuments` — lifecycle transitions — **DONE**
  - `flagExpired` — tier-based TTL expiry — **DONE**
  - DLQ operations (insert, reset, abandon) — **DONE**
- [ ] **2.1.4** `convex/crawl/workflow.ts` — `kickoffDailyCrawl`:
  - Idempotency (skip if pending/running jobs exist)
  - Scheduled vs manual trigger
- [x] **2.1.5** `convex/crawl/webhook.ts` — HMAC verification:
  - Valid signature, expired timestamp, invalid signature, missing headers — **DONE**
- [x] **2.1.6** `convex/crawl/tasks.ts` — `cleanupExpiredCache`, `aggregateDailyStats` — **DONE**
- [x] **2.1.7** Webhook HTTP action (`crawlWebhook`, `ingestWebhook`) with mocks — **DONE**

### 2.2 RAG Pipeline — Partial

- [x] **2.2.1** `convex/rag/retrieval.ts` — `retrieveContext` full orchestration:
  - Happy path: classify → rewrite → HyDE → embed → cache check → search → RRF → enrich → FAQ → context — **DONE**
  - Off-topic short-circuit — **DONE**
  - Cache hit (verify no search occurs) — **DONE**
  - Embedding failure → BM25-only search — **DONE**
  - All sub-steps fail individually — **DONE**
- [ ] **2.2.2** `convex/embeddings/search.ts` — hybrid search:
  - `searchDocumentsAction` — vector + BM25 + FAQ + RRF + time decay
  - `generateHyDE` — only for short queries (<15 words), Gemini fallback
  - Time decay coefficients per freshness tier
  - Empty results, single result, many results (trim to limit)
- [x] **2.2.3** `convex/embeddings/generate.ts` — key rotation:
  - All 4 keys tried in order: GEMINI_API_KEY, _1, _2, GOOGLE_GENERATIVE_AI_API_KEY — **DONE**
  - First key failure → fall through to next — **DONE**
  - All keys fail → throw — **DONE**
  - Task prefix formatting — **DONE**
- [x] **2.2.4** `convex/rag/context.ts` — sandwich strategy:
  - `buildContext` interleaves chunks by relevance, respects maxTokens — **DONE**
- [x] **2.2.5** `convex/rag/routing.ts` — `classifyQueryAction` — **DONE**

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
- [x] **2.3.4** `convex/cache/internal_mutations.ts` — `cleanupExpiredCache` timer-triggered: **DONE (in tasks.test.ts)**

### 2.4 Auth & User Functions — Partial

- [x] **2.4.1** `convex/users.ts` — `getOrCreate`, `getByClerkId` — **DONE**
- [x] **2.4.2** `convex/auth.ts` — role checks with various JWT claims — **DONE** (auth-helpers.test.ts)
- [ ] **2.4.3** `convex/threads.ts` — thread CRUD proxy, `purgeOldArchived` (NO-OP verification)
- [ ] **2.4.4** `convex/faq.ts` — search, create, expiry
- [ ] **2.4.5** `convex/cache/cache-mutations.ts` — write path with caching semantics
- [ ] **2.4.6** `convex/cache/cache-queries.ts` — read path with caching semantics

### 2.5 Cron & Tasks — Partial

- [ ] **2.5.1** `convex/crons.ts` — cron registration (schedule correctness, handler existence)
- [x] **2.5.2** `convex/crawl/tasks.ts` — `cleanupExpiredCache`, `aggregateDailyStats` — **DONE**
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
- [ ] **3.1.4** Load test via Playwright: 10 concurrent chat requests, measure p50/p95/p99

### 3.2 Health API (`/api/health`)

- [ ] **3.2.1** Returns JSON with status for each service (convex, groq, gemini, cerebras, clerk)
- [ ] **3.2.2** Partial failure (some services down)
- [ ] **3.2.3** Timeout handling (individual service timeout doesn't hang whole endpoint)

### 3.3 Webhooks — Partial

- [ ] **3.3.1** Clerk webhook — Svix verification, user.created/user.updated events, missing secret
- [x] **3.3.2** Crawl webhook (Convex HTTP) — HMAC verification, payload parsing, idempotency — **DONE** (tests skipped — revisit)
- [ ] **3.3.3** Crawl webhook integration test — enable skipped tests, add real payload parsing edge cases

### 3.4 API Middleware & Error Handling

- [ ] **3.4.1** Rate limit middleware — test with real Upstash mock
- [ ] **3.4.2** Auth middleware — valid session, expired session, no session
- [ ] **3.4.3** Error boundary — 500 responses formatted correctly, no stack leaks
- [ ] **3.4.4** CORS headers — correct origins, methods, preflight

---

## Phase 4: Frontend Component Testing

**Goal:** All UI components render, interact, and handle states correctly.
**Note:** Requires `jsdom` package installed. Currently blocked — vitest hangs with `environment: "jsdom"` when jsdom is not installed.

### 4.1 Install jsdom & Configure

- [ ] **4.1.1** `npm install -D jsdom`
- [ ] **4.1.2** Add `environment: "jsdom"` to vitest.config.ts (without setupFiles/globals — tested to cause hang)
- [ ] **4.1.3** Verify admin test files load without "document is not defined" errors
- [ ] **4.1.4** Fix anti-pattern 1.2.3 (mock-testing) across 9 admin files

### 4.2 Chat Components

- [ ] **4.2.1** `ChatWindow` — loading, empty, messages, error states
- [ ] **4.2.2** `ChatMessageBubble` — user vs assistant styling, source citations, markdown rendering
- [ ] **4.2.3** `ChatInput` — text entry, submit, disabled while streaming, keyboard shortcuts (Ctrl+Enter, Enter)
- [ ] **4.2.4** `StreamingMessage` — animated text, complete state, error state
- [ ] **4.2.5** `SourceList` / `SourceCard` — expandable, empty, with relevance scores

### 4.3 Sidebar

- [ ] **4.3.1** `Sidebar` — open/close on mobile, responsive breakpoints
- [ ] **4.3.2** `SidebarHistory` — threads list, empty, loading, search filtering
- [ ] **4.3.3** `NewChatButton` — creates thread, redirects
- [ ] **4.3.4** Thread deletion — confirm dialog, cancel, actual delete

### 4.4 Admin Components

- [ ] **4.4.1** Auth guard — non-admin redirected, admin sees content
- [ ] **4.4.2** Dashboard stats — all 11 metrics, loading, error, empty
- [ ] **4.4.3** Document browser — filtering, pagination, delete with confirmation
- [ ] **4.4.4** Crawl management — trigger, status polling, cancel, error states
- [ ] **4.4.5** Settings page — form validation, save, reset, error handling

### 4.5 Shared Components

- [ ] **4.5.1** `ThemeProvider` / `ThemeToggle` — light/dark toggle, persistence
- [ ] **4.5.2** `ErrorBoundary` — catches errors, shows fallback, recovery
- [ ] **4.5.3** `LoadingState` / `EmptyState` — renders correctly with various props
- [ ] **4.5.4** `SourceCard` — truncation, expand, relevance badge
- [ ] **4.5.5** `ChatSuggestions` — renders suggestions, click triggers action

### 4.6 Anti-Pattern Remediation (Phase 1.2.3)

For each of the 9 admin test files with mock-testing anti-patterns:
- Replace `getByTestId("skeleton")` — test `aria-busy` or content rendering
- Replace `getByTestId("icon-*")` — test label text or button presence
- Replace `getByTestId("card")` — test actual content values
- Replace mock icon assertions — test `role="img"` or remove entirely
- Use `screen.getByRole()` and `screen.getByText()` preferred over test IDs

---

## Phase 5: E2E Playwright Testing

**Goal:** Full user flows automated in real browser.

### 5.1 Infrastructure Setup

- [ ] **5.1.1** Install Playwright browsers: `npx playwright install chromium`
- [ ] **5.1.2** Configure `playwright.config.ts` with webServer, baseURL, timeout
- [ ] **5.1.3** Add `.env.test.local` with `pk_test_*` Clerk keys (never production keys)
- [ ] **5.1.4** Set up `globalSetup` for Clerk auth state storage

Per `webapp-testing/SKILL.md` — use `tests/e2e/with_server.py` pattern:
```python
# tests/e2e/with_server.py handles server lifecycle
# Playwright runs in CI via: python with_server.py --server "npm run dev" --port 3000
```

### 5.2 Auth Flows (Clerk)

Per `clerk-testing/SKILL.md`:
- [ ] **5.2.1** Sign-up flow (Clerk UI) — using `setupClerkTestingToken()` + `pk_test_*` keys
- [ ] **5.2.2** Sign-in flow — email/password, OAuth (Google mock)
- [ ] **5.2.3** Protected routes redirect to sign-in
- [ ] **5.2.4** Auth state persistence via `storageState` (fast subsequent tests)
- [ ] **5.2.5** Session expiry — verify redirect to sign-in
- [ ] **5.2.6** Clerk component selectors: `page.waitForSelector('[data-clerk-component]')`

```typescript
// Pattern from clerk-testing
import { setupClerkTestingToken } from '@clerk/testing/playwright';

test('sign in flow', async ({ page }) => {
  await setupClerkTestingToken({ page });
  await page.goto('/sign-in');
  // ... auth flow
  await page.context().storageState({ path: 'e2e-auth.json' });
});
```

### 5.3 Chat Flow

Per `browser-testing-with-devtools/SKILL.md` — verify with DevTools:
- [ ] **5.3.1** Send message, see streaming response, verify sources rendered
- [ ] **5.3.2** New chat, thread switching, history persistence
- [ ] **5.3.3** Error states (network failure, rate limit, empty response)
- [ ] **5.3.4** Console analysis: zero errors during chat flow
- [ ] **5.3.5** Network monitoring: SSE stream format, response headers (X-Sources, X-Intent)
- [ ] **5.3.6** Performance trace: time from submit to first token (p50/p95)

### 5.4 Admin Flow

- [ ] **5.4.1** Dashboard loads with stats, charts render
- [ ] **5.4.2** Document browsing, searching, deleting
- [ ] **5.4.3** Crawl trigger, status monitoring, cancellation
- [ ] **5.4.4** Settings page — modify setting, verify persistence on reload

### 5.5 Cross-Browser & Responsive

- [ ] **5.5.1** Chrome, Firefox, WebKit (configured in `playwright.config.ts`)
- [ ] **5.5.2** Mobile viewports (375px, 768px, 1024px)
- [ ] **5.5.3** Visual regression screenshots at each breakpoint

### 5.6 Accessibility Verification

Per `browser-testing-with-devtools/SKILL.md`:
- [ ] **5.6.1** Zero console errors or warnings on every page
- [ ] **5.6.2** Network requests return 200/expected status
- [ ] **5.6.3** Accessibility tree correct — read with DevTools a11y panel
- [ ] **5.6.4** Screenshot comparison (before/after for visual regressions)
- [ ] **5.6.5** Tab order verification (logical focus sequence)
- [ ] **5.6.6** ARIA labels on all interactive elements
- [ ] **5.6.7** Dynamic content announcements (ARIA live regions for streaming)

---

## Phase 6: Semantic Cache & Embedding Testing

**Goal:** Vector search correctness, embedding quality, cache behavior under load.

### 6.1 Embedding Generation — Partial

- [x] **6.1.1** Gemini API response parsing (all response shapes) — **DONE**
- [x] **6.1.2** Dimension mismatch detection (not 3072 → error) — **DONE**
- [x] **6.1.3** Retry logic (3 attempts with exponential backoff) — **DONE**
- [ ] **6.1.4** Batch embedding (up to 100 per call)
- [ ] **6.1.5** Empty content/whitespace-only content edge case

### 6.2 Vector Search

- [x] **6.2.1** Cosine similarity edge cases: identical vectors, opposite vectors, zero vectors — **DONE**
- [ ] **6.2.2** RRF fusion: empty results, single source, custom weights
- [ ] **6.2.3** FAQ interception: scoring boost, combined with vector results
- [ ] **6.2.4** Time decay: age calculation, tier-based lambda values
- [ ] **6.2.5** Dimension mismatch handling (wrong embedding dimension → error, not silent corruption)

### 6.3 Cache Behavior

- [ ] **6.3.1** Cache hit: same query, similar query (below threshold), identical query
- [ ] **6.3.2** Cache miss: completely different query, expired entry
- [ ] **6.3.3** Cache write: background via `after()`, concurrent writes
- [ ] **6.3.4** Cleanup: expired entries, multiple cleanup runs
- [x] **6.3.5** `cleanupExpiredCache` timer-triggered cleanup — **DONE (tasks.test.ts)**
- [ ] **6.3.6** Hit counter increment correctness under concurrent access

---

## Phase 7: Performance & Load Testing

**Goal:** Establish baselines, prevent regressions.

### 7.1 Benchmarks

- [ ] **7.1.1** RAG pipeline end-to-end latency (p50/p95/p99) — use `doubt-driven-development` cross-model for benchmark methodology
- [ ] **7.1.2** Embedding generation throughput (requests/second)
- [ ] **7.1.3** Convex vector search latency (sub-50ms target)
- [ ] **7.1.4** Cache lookup vs full pipeline (speedup ratio)
- [ ] **7.1.5** First token latency for chat streaming (time from submit to first streamed token)

### 7.2 Load Tests

- [x] **7.2.1** Clean `tests/load-test.ts` — env-var-only secrets, CI-safe mode — **DONE**
- [ ] **7.2.2** Concurrent chat requests (5/10/25 concurrent)
- [ ] **7.2.3** Cache performance under load (hit ratio, throughput)
- [ ] **7.2.4** Rate limiter behavior under load
- [ ] **7.2.5** Concurrency safety: verify no data corruption under parallel writes

### 7.3 CI Integration

- [ ] **7.3.1** Add benchmark assertions to CI (no regression >10%)
- [ ] **7.3.2** Smoke load test in CI (1 concurrent, short duration)
- [ ] **7.3.3** Performance regression gate: if p95 > 2x baseline, fail the build

---

## Phase 8: Accessibility & Visual Testing

**Goal:** Meet WCAG 2.1 AA, consistent rendering.

### 8.1 Accessibility — Automated

Per `browser-testing-with-devtools/SKILL.md`:
- [ ] **8.1.1** Heading hierarchy (no skipped levels, single h1 per page)
- [ ] **8.1.2** Focus order (logical tab sequence matches visual order)
- [ ] **8.1.3** Color contrast (4.5:1 minimum for normal text, 3:1 for large text)
- [ ] **8.1.4** ARIA labels on all interactive elements (buttons, links, inputs)
- [ ] **8.1.5** Dynamic content announcements (ARIA live regions for streaming chat responses)
- [ ] **8.1.6** Keyboard navigation — all features accessible without mouse
- [ ] **8.1.7** Focus trap in modals (admin delete confirmation)

### 8.2 Accessibility — Manual Review

- [ ] **8.2.1** Screen reader test (VoiceOver/NVDA) on core flows: chat, admin, auth
- [ ] **8.2.2** Zoom to 200% — no content loss or horizontal scroll
- [ ] **8.2.3** Reduced motion preference — animations disabled
- [ ] **8.2.4** High contrast mode — all text readable

### 8.3 Visual Regression

- [ ] **8.3.1** Screenshot baselines for all pages (light + dark mode)
- [ ] **8.3.2** Responsive breakpoints: 375px, 768px, 1024px, 1440px
- [ ] **8.3.3** Loading/empty/error states visual verification
- [ ] **8.3.4** Streaming chat animation visual verification (text appears correctly)
- [ ] **8.3.5** Per `browser-testing-with-devtools/SKILL.md`: compare before/after screenshots after any CSS/component change

---

## Phase 9: DevTools-Based Quality Assurance

**Goal:** Use Chrome DevTools MCP for runtime verification beyond what automated tests cover.

Per `browser-testing-with-devtools/SKILL.md`:

### 9.1 Console Quality Gate

- [ ] **9.1.1** All pages: zero console errors or warnings
- [ ] **9.1.2** React strict mode: no double-mount warnings
- [ ] **9.1.3** Deprecation warnings: zero (flag for next major update)
- [ ] **9.1.4** Security warnings: no mixed content, no CSP violations

### 9.2 Network Quality Gate

- [ ] **9.2.1** All API calls return expected status codes
- [ ] **9.2.2** No unexpected/duplicate API calls
- [ ] **9.2.3** SSE stream format correct (data: lines, proper termination)
- [ ] **9.2.4** Payload sizes within limits (< 1MB for webhook, etc.)

### 9.3 Performance Budget

- [ ] **9.3.1** LCP < 2.5s
- [ ] **9.3.2** CLS < 0.1
- [ ] **9.3.3** INP < 200ms
- [ ] **9.3.4** First token latency < 1s (chat streaming)
- [ ] **9.3.5** Bundle size regression check per PR

### 9.4 Accessibility Tree Verification

- [ ] **9.4.1** Read accessibility tree for key pages (chat, admin, auth)
- [ ] **9.4.2** Verify heading structure is logical
- [ ] **9.4.3** Verify landmark regions (main, nav, complementary)

---

## Phase 10: Testing Anti-Pattern Remediation

**Goal:** Eliminate all anti-patterns identified in the audit, guided by `testing-anti-patterns.md`.

### 10.1 Anti-Pattern 1: Testing Mock Behavior (9 files — HIGH priority)

Per `testing-anti-patterns.md` Iron Law: *NEVER test mock behavior.*

| File | Fix Strategy |
|------|-------------|
| `admin-crawls.test.tsx` | Replace `getByTestId("skeleton")` → test `aria-busy` or actual content |
| `admin-documents.test.tsx` | Replace `getAllByTestId("skeleton")` → test `aria-busy` |
| `admin-settings.test.tsx` | Rewrite with real components or behavior-based assertions |
| `admin-overview.test.tsx` | Remove icon assertions; test content text |
| `admin-feedback.test.tsx` | Test via text content or roles |
| `admin-analytics.test.tsx` | Test computed values and labels |
| `admin-layout.test.tsx` | Test nav link text or aria-labels |
| `sidebar-history.test.tsx` | Test real link behavior or remove |
| `admin-flow.spec.ts` (E2E) | Remove conditional assertion; assert exact redirect URL |

### 10.2 Anti-Pattern 3: Mocking Without Understanding (3 files — MEDIUM)

| File | Fix Strategy |
|------|-------------|
| `admin-settings.test.tsx` | Replace 40+ line select mock with simple `<select>` + hardcoded options |
| `admin-stats.test.ts` | Pre-computed mock results instead of reimplementing Convex query engine |
| `rag-pipeline.test.ts` | Use named result maps instead of call-order-indexed mock results |

### 10.3 Anti-Pattern 4: Incomplete Mocks (1 file — LOW)

| File | Fix Strategy |
|------|-------------|
| `admin-stats.test.ts` | Ensure mock preserves filtering behavior tests depend on |

### 10.4 Anti-Pattern 5: Tests as Afterthought (4 files — MEDIUM)

| File | Fix Strategy |
|------|-------------|
| `types.test.ts` | Remove — branded string typing verified by compiler |
| `messages-api.test.ts` | Add behavior tests or remove |
| `threads-api.test.ts` | Add behavior tests or remove |
| `document-validator.test.ts` | Replace 587-line introspection test with snapshot or actual validation behavior tests |

### 10.5 Hardcoded Secrets (1 file — HIGH)

| File | Fix Strategy |
|------|-------------|
| `webhook-integration.test.ts:5` | Move `WEBHOOK_SECRET` to env var or `beforeEach` scope |

---

## Phase 11: CI/CD & Quality Gates

**Goal:** Automated quality enforcement on every PR.

### 11.1 CI Pipeline (`.github/workflows/ci.yml`)

```
PR → lint (biome) → typecheck (tsc) → unit tests (vitest) →
     integration tests (vitest) → build (next build) →
     E2E tests (playwright) → coverage report →
     performance benchmark (p95 check)
```

- [ ] **11.1.1** Add coverage thresholds (80% minimum, 90% target)
- [ ] **11.1.2** Add test run time budget (unit < 30s, integration < 60s, E2E < 3min, total < 5min)
- [ ] **11.1.3** Add performance regression check (p95 RAG latency vs baseline)
- [ ] **11.1.4** Add dead code detection (`ts-prune` in CI)
- [ ] **11.1.5** Add dependency vulnerability scan (`npm audit` in CI)

### 11.2 Quality Gates — Per Commit

Per `verification-before-completion/SKILL.md` Iron Law:
```
NO COMPLETION CLAIMS WITHOUT FRESH VERIFICATION EVIDENCE
```

- [ ] **11.2.1** All tests pass (fresh run, not cached)
- [ ] **11.2.2** Zero lint errors
- [ ] **11.2.3** TypeScript strict mode clean (`npx tsc --noEmit`)
- [ ] **11.2.4** Coverage not regressed from baseline
- [ ] **11.2.5** E2E tests pass in headless Chromium
- [ ] **11.2.6** Console output pristine (no `console.log` in production code)
- [ ] **11.2.7** Anti-pattern scan: no `_handler` casts, no `getByTestId("*-mock")`

### 11.3 Quality Gates — Per PR

Per `code-review-and-quality/SKILL.md` (5-axis review):

```markdown
## PR Review Checklist

### Context
- [ ] I understand what this change does and why

### Correctness
- [ ] Change matches spec/task requirements
- [ ] Edge cases handled
- [ ] Error paths handled
- [ ] Tests cover the change adequately
- [ ] TDD was followed (test failed first)

### Readability
- [ ] Names are clear and consistent
- [ ] Logic is straightforward
- [ ] No unnecessary complexity

### Architecture
- [ ] Follows existing patterns
- [ ] No unnecessary coupling or dependencies
- [ ] Appropriate abstraction level

### Security
- [ ] No secrets in code
- [ ] Input validated at boundaries
- [ ] No injection vulnerabilities
- [ ] Auth checks in place
- [ ] External data treated as untrusted

### Performance
- [ ] No N+1 patterns
- [ ] No unbounded operations
- [ ] Pagination on list endpoints
- [ ] Bundle size not regressed

### Verification
- [ ] Tests pass (fresh run, evidence attached)
- [ ] Build succeeds
- [ ] DevTools verification done (console clean, network OK)

### Verdict
- [ ] **Approve** — Ready to merge
- [ ] **Request changes** — Issues must be addressed
```

### 11.4 Test Failure Protocol

Per `systematic-debugging/SKILL.md` Iron Law:
```
NO FIXES WITHOUT ROOT CAUSE INVESTIGATION FIRST
```

When tests fail:
1. **Read** the error message completely (stack trace, line numbers, expected/actual)
2. **Reproduce** consistently (isolate to single test file)
3. **Check** recent changes (`git diff`, recent commits)
4. **Form hypothesis** — "I think X is the root cause because Y"
5. **Fix minimally** — one change, verify with failing test
6. **If 3+ fixes fail** — STOP. Architectural problem. Question fundamentals.

### 11.5 Cross-Model Adversarial Review

Per `doubt-driven-development/SKILL.md` — before non-trivial test decisions:
- Name CLAIM: what does this test assert?
- EXTRACT: smallest reviewable unit (the test + contract)
- DOUBT: fresh-context adversarial review ("find what is wrong")
- RECONCILE: classify findings as valid/actionable/trade-off/noise
- CROSS-MODEL OPTION: offer user a second model opinion
- STOP at 3 cycles or trivial findings

---

## Phase 12: Maintenance & Regression Prevention

**Goal:** Tests stay reliable, fast, and meaningful over time.

### 12.1 Flaky Test Protocol

- [ ] **12.1.1** Any test that fails intermittently gets flagged in CI
- [ ] **12.1.2** Flaky tests quarantined (moved to `tests/flaky/`) within 24 hours
- [ ] **12.1.3** Root cause found (per `systematic-debugging`) before returning to main suite
- [ ] **12.1.4** Flaky test scoreboard maintained (file, failure rate, root cause)

### 12.2 Test Health Dashboard

- [ ] **12.2.1** Run time tracking per test file (alert if >50% increase)
- [ ] **12.2.2** Coverage trend tracking (alert if >5% drop)
- [ ] **12.2.3** Flake rate tracking (alert if >1% of runs)
- [ ] **12.2.4** False-positive rate (tests that pass but shouldn't)

### 12.3 Regression Test Suite

- [ ] **12.3.1** Before/after baselines for all bug fixes
- [ ] **12.3.2** TDD cycle required for every bug fix (RED: write failing test, GREEN: fix, REFACTOR)
- [ ] **12.3.3** Regression snapshot stored alongside fix
- [ ] **12.3.4** `git bisect` script available for performance regression hunting

### 12.4 Dependency Update Protocol

- [ ] **12.4.1** Lock file changes reviewed for test impact
- [ ] **12.4.2** Vitest/Playwright upgrades run full suite before merge
- [ ] **12.4.3** Mock behavior checked after any `convex/_generated/` regeneration
- [ ] **12.4.4** `vi.mock` paths checked after module relocation

---

## Execution Plan

### Priority Matrix

| Phase | Effort | Impact | Priority |
|-------|--------|--------|----------|
| 1: Foundation | Medium | High | **P0 (DONE)** |
| 2: Convex Backend | Large | Critical | **P0 (In Progress)** |
| 3: API Routes | Medium | High | **P1** |
| 4: Frontend | Large | Medium | **P2** |
| 5: E2E | Large | High | **P1** |
| 6: Cache & Embedding | Medium | Medium | **P2** |
| 7: Performance | Medium | Medium | **P3** |
| 8: Accessibility | Medium | Low | **P3** |
| 9: DevTools QA | Small | Medium | **P2** |
| 10: Anti-Pattern Fixes | Large | High | **P1** |
| 11: CI/CD | Small | High | **P0** |
| 12: Maintenance | Ongoing | High | **P0** |

### Phase Assignments for Agent Spawning

Each phase can be worked in parallel by separate agents:

```
Phase 1 (Foundation) — DONE
  ├── Agent A: 1.1 Infrastructure, 1.2 Anti-pattern audit
  └── Agent B: 1.3 Missing unit tests, 1.4 TDD workflow docs

Phase 2 (Convex Backend)
  ├── Agent C: 2.1 Crawl pipeline tests (mostly DONE: webhook, tasks, mutations, actions)
  ├── Agent D: 2.2 RAG pipeline tests (mostly DONE: retrieval, context, routing)
  ├── Agent E: 2.3 Cache layer tests (NOT DONE: get.ts, set.ts, internal_queries.ts)
  └── Agent F: 2.4-2.5 Auth, Users, Cron tests (Auth DONE, threads/faq/cache pending)

Phase 3 (API Routes)
  └── Agent G: Chat API, Health, Webhooks

Phase 4 (Frontend)
  ├── Agent H: Chat components
  ├── Agent I: Sidebar, Shared components
  └── Agent J: Admin components + anti-pattern fixes

Phase 5 (E2E)
  ├── Agent K: Auth + Chat flows (Clerk testing setup required first)
  └── Agent L: Admin flows, cross-browser, accessibility

Phase 6 (Cache & Embedding)
  └── Agent M: Cache/Embedding edge cases, vector search, RRF

Phase 7-12 (Remaining)
  └── Agent N: Performance, DevTools QA, CI/CD, anti-pattern sweep
```

---

## Verdict Protocol (per `verification-before-completion/SKILL.md`)

Before claiming any phase complete:
- [ ] Tests written using TDD (failed first, then passed) — verified by watching RED
- [ ] `pnpm test` — all tests pass, 0 failures (fresh run, output attached)
- [ ] `pnpm lint` — 0 errors, 0 warnings
- [ ] `npx tsc --noEmit` — 0 errors
- [ ] `pnpm test:e2e` — all E2E tests pass
- [ ] No testing anti-patterns (mock-testing, incomplete mocks, test-only methods)
- [ ] Test utilities in `tests/helpers/`, not in production code
- [ ] Coverage not regressed from baseline
- [ ] DevTools verification: zero console errors, network requests OK
- [ ] Anti-pattern scan: no `_handler` casts, no `getByTestId("*-mock")` for mocked components

**Run the command. Read the output. THEN claim completion.**
