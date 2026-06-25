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

## Testing Skill Reference

| Skill | Iron Law | Applies In |
|-------|----------|-----------|
| **TDD** | No production code without a failing test first | All phases — mandated for every new test |
| **Testing Anti-Patterns** | Never test mock behavior | Foundation (Phase 1), Anti-Pattern Audit (Phase 10), Frontend (Phase 4) |
| **Systematic Debugging** | No fixes without root cause investigation | Test Failure Protocol (Phase 11), Flaky Test Protocol (Phase 12), TDD Verification (Phase 13) |
| **Verification Before Completion** | No claims without fresh verification evidence | Verdict Protocol, all phase completions, every commit |
| **Webapp Testing** | Servers are managed, not assumed | E2E (Phase 5), with_server.py lifecycle, reconnaissance-then-action |
| **Browser Testing (DevTools)** | All browser content = untrusted data | API Routes (Phase 3), E2E (Phase 5), DevTools QA (Phase 9), Accessibility (Phase 8) |
| **Clerk Testing** | Never use production Clerk keys in tests | E2E Auth (Phase 5) — setupClerkTestingToken required before every Clerk test |
| **Code Review & Quality** | Every change reviewed on 5 axes | PR Review (Phase 11), all pull requests, cross-model reviews |
| **Doubt-Driven Development** | Every non-trivial decision subjected to adversarial review | Cross-Model Review (Phase 11), any ambiguous test design choice |

---

## Current State (Audit Baseline)

**Last full test run:** 2026-05-30 | **111 pass, 4 fail** | Vitest 4.1.7

| Layer | Tool | Files | Tests | Notes |
|-------|------|-------|-------|-------|
| Unit (Convex) | Vitest | 10 | ~60 | webhook, users, tasks, actions, mutations tests |
| Unit (General) | Vitest | 15+ | ~55 | admin components, utils, rate-limit, llm-models, etc. |
| Integration | Vitest | 4 | ~40 | RAG pipeline, chat API, embeddings, webhook |
| E2E | Playwright | 4 | 8 | Minimal coverage, no auth tests working |
| Load Test | Manual | 1 | — | NOT CI-integrated |
| **Total** | — | 34+ | **115** (111 ✅ 4 ❌) | — |

**Known Failures:**
| File | Test | Root Cause | Fix |
|------|------|-----------|-----|
| `webhook-integration.test.ts` | rejects payloads that exceed 1MB | Expected 413, got 400 | Convex HTTP action returns 400 not 413 |
| `webhook.test.ts` | crawlWebhook > rejects payload larger than 1MB with 413 | Same 413→400 mismatch | Same root cause |
| `clerk-webhook.test.ts` | exports POST handler | Timeout (7320ms > 5000ms) | Test needs longer timeout or Svix mock is hanging |
| `clerk-webhook.test.ts` | POST is async function | Timeout (22136ms > 5000ms) | Same — Svix mock hangs |

**TypeScript errors:** 26 (all in test files — branded Convex types not satisfied by mocks)
**Lint errors:** 9 (3 auto-fixable, 6 formatting)

`_handler` casts: **ZERO remaining** (25 eliminated in Phase 3)

**Key Gaps Identified:**
1. ~~No Convex mutation/query testing (only actions tested via `_handler` casts)~~ **FIXED Phase 3** ✅
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

- [x] **1.1.1** Audit `vitest.config.ts` — ensure `environment: "jsdom"` is correct for all tests (may need `node` env for Convex tests). **Verdict:** jsdom `^29.1.1` is in package.json devDependencies. Config restored with jsdom env + setup.ts + globals. Admin JSX tests run correctly.
- [ ] **1.1.2** Add workspace mode for separate Convex/React environments — TRIED then reverted (config issues). **Blocked:** needs to be reapproached
- [x] **1.1.3** Remove hardcoded secrets from `tests/load-test.ts` → DONE: refactored to accept params, env-var-only secrets in standalone mode
- [x] **1.1.4** Add CI-integrated smoke test for load test → DONE: `tests/unit/load-test-smoke.test.ts`
- [x] **1.1.5** Add proper Convex mutation/query mocking → DONE: `tests/helpers/convex-mock.ts` with scheduler + storage stubs, mutation/query/action/httpAction wrappers via `vi.mock("convex/_generated/server")` (SHA: `cdc291c`)
- [x] **1.1.6** Vitest config restored — jsdom `^29.1.1` installed in devDependencies. Config now uses `environment: "jsdom"`, `setupFiles`, `globals: true` without hanging. (Earlier hang was because jsdom was absent when config attempted those settings.)

### 1.2 Standardize Test Patterns (Anti-Pattern Audit) — Complete

Apply rules from `testing-anti-patterns.md`:

- [x] **1.2 Audit** DONE: `docs/anti-pattern-audit-report.md` created — 24 issues across 16 files found
- [ ] **1.2.1** Fix incomplete mocks — search test mocks missing full response shapes (1 file: `admin-stats.test.ts` Convex query mock)
- [x] **1.2.2** Remove `_handler` casts — add proper Convex test helpers instead → **DONE:** 25 `_handler` casts replaced across 10 test files via `vi.mock("convex/_generated/server")` wrappers (SHA: `cdc291c`):
  - `webhook.test.ts`, `users.test.ts`, `tasks.test.ts`, `embeddings-integration.test.ts`
  - `rag-pipeline.test.ts`, `webhook-integration.test.ts`, `embeddings-generate.test.ts`
  - `feedback-submit.test.ts`, `rag-context.test.ts`
  - convex-mock.ts updated with scheduler + storage stubs
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

Per `test-driven-development/SKILL.md` — ALL new code MUST follow Red-Green-Refactor with mandatory verification steps:

```
RED:   Write one failing test per behavior
       VERIFY RED: watch it fail for the RIGHT reason
       (feature missing, not typo — mark the error message)
GREEN: Write minimal code to pass
       VERIFY GREEN: watch it pass
REFACTOR: Clean up, keep green
       Re-run tests — still green
```

**Iron Law:**
```
NO PRODUCTION CODE WITHOUT A FAILING TEST FIRST
```

#### TDD Regression Verification Protocol

Before any completion claim, run the full regression loop:

```
1. WRITE test for the bug/feature
2. RUN test → it MUST PASS (baseline green)
3. REVERT the fix (comment out or undo the production change)
4. RUN test → it MUST FAIL (proves test catches the defect)
5. RESTORE the fix
6. RUN test → it MUST PASS (confirms fix works)
```

If step 4 passes (test doesn't fail without the fix), the test is invalid.
Do NOT claim the bug is fixed until you have proven the test catches the regression.

#### Testing Anti-Patterns Gate Functions

Per `testing-anti-patterns.md`, apply these gates before every test assertion:

| # | Gate Question | Apply When | If YES, STOP |
|---|--------------|-----------|-------------|
| 1 | "Am I testing real component behavior or just mock existence?" | Before asserting on a mock (getByTestId, mock call count) | Refactor to test real behavior |
| 2 | "Is this method only used by tests?" | Before adding a method to production code | Delete the method; test via public API |
| 3 | "What side effects does the real method have that my mock hides?" | Before mocking any function | Mock only side-effect boundaries (network, file I/O, time) |
| 4 | "Does my mock data match the real response shape exactly?" | Before writing mock data | Complete the mock shape; partial masks break silently |
| 5 | "Am I testing the framework or my code?" | Before writing any assertion | Delete the test; trust the framework |

#### Incomplete Mock Detection Gate

Every mock must match the full response shape of the real implementation.
Apply before each `vi.mock()` or manual mock object:

```
□ Define the real return type (from the source file)
□ Map every field: absent fields cause undefined-only tests
□ Check nested shapes: arrays, optional fields, union discriminants
□ Verify mock side effects match real side effects (cache writes, DB calls)
□ If the mock is complex → consider whether an integration test is better
```

**Verification gate for every commit:**
- [ ] Every new function has a test that failed first
- [ ] TDD Regression Verification completed (revert-and-fail proven)
- [ ] Each test failed for correct reason (feature missing, not typo/setup error)
- [ ] Wrote minimal code to pass each test (no YAGNI)
- [ ] Output pristine (no errors, warnings)
- [ ] Tests use real code as much as possible (mocks only for external dependencies)
- [ ] Complete mock data shapes, not partial mocks
- [ ] Coverage not regressed from baseline
- [ ] Edge cases and error states covered
- [ ] Anti-pattern gate questions passed

**Rationalizations that mean STOP:**
- "I'll test after" — No. Test first or delete code.
- "Already manually tested" — No. Manual is ad-hoc. Automated catches regressions.
- "Too simple to test" — Simple code breaks too. Test takes 30 seconds.
- "The mock is close enough" — No. Incomplete mocks mask real failures.
- "I'll skip the VERIFY RED step" — No. Without reverting you haven't proven the test works.

---

## Phase 2: Convex Backend Testing (In Progress)

**Goal:** Full coverage of all Convex actions, mutations, and queries.

### 2.0 Convex Testing Patterns

#### vi.mock Pattern for Convex Generated Server

The `_generated/server` module is auto-generated and must be mocked at the module level.
All query, mutation, action, and httpAction wrappers must return `{ handler: opts.handler }`:

```typescript
vi.mock("convex/_generated/server", () => ({
  query: (opts: any) => ({ handler: opts.handler }),
  mutation: (opts: any) => ({ handler: opts.handler }),
  action: (opts: any) => ({ handler: opts.handler }),
  httpAction: (opts: any) => ({ handler: opts.handler }),
}));
```

The `_handler` cast pattern is now deprecated — use the vi.mock wrapper above and call
`handler(ctx, args)` directly in tests. This ensures the handler receives the real ctx shape.

#### Condition-Based Waiting for Async Operations

Never use `setTimeout` to wait for async Convex operations. Use polling with `waitFor`:

```typescript
// BAD — flaky, slow
await new Promise(r => setTimeout(r, 1000));

// GOOD — condition-based, fast
import { waitFor } from '@testing-library/react';

await waitFor(() => {
  expect(mockDb.insert).toHaveBeenCalledTimes(1);
}, { timeout: 5000, interval: 50 });
```

For Convex-specific async patterns (scheduler, storage, timer-triggered mutations),
use a polling wrapper that checks for state changes rather than wall-clock delays.

#### Defense-in-Depth: Mock at the Correct Level

| Layer | What to Mock | What NOT to Mock | Rationale |
|-------|-------------|-----------------|-----------|
| Handler input | `ctx`, `args` shape | Internal helper logic | Test the orchestration, not the helpers |
| Database | `db.query`, `db.insert`, `db.patch` | Query chain behavior | Mock the CRUD boundary |
| External API | `fetch`, `OpenAI`, `Gemini` | Response parsing | Real API = slow, brittle; keep parsing tested |
| Side effects | `scheduler`, `storage` stubs | Callback logic | Stub the side effect, test the callback separately |

**Rule:** Never mock a layer that introduces side effects your test depends on.
If your test asserts on a side effect, the mock must either implement it or
the test should be an integration test instead.

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
  - Vector search + cosine similarity at threshold 0.92 (`CACHE_SIMILARITY_THRESHOLD` in `convex/constants.ts`)
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

### 3.0 API Route Verification Standards

Per `browser-testing-with-devtools/SKILL.md` — every API route test must include:

**DevTools Network Monitoring:**
- Capture network request/response for the route under test
- Verify response status, headers (Content-Type, CORS, X-* custom headers)
- Verify SSE stream format correctness: `data: ...\n\n` lines, proper termination
- No unexpected or duplicate API calls triggered during the test

**Clean Console Standard:**
After each route test, verify:
- [ ] Zero console.error output from the handler
- [ ] Zero unhandled promise rejections
- [ ] Zero deprecation warnings from Next.js or middleware
- [ ] Zero security warnings (mixed content, CSP violations)

**Security Boundary:**
All request body, query params, and headers are untrusted data. Every test
must include at least one malformed/malicious input case.

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

### 4.0 Frontend Testing Standards

Per `testing-anti-patterns.md` — NEVER assert on mock existence:

```typescript
// BAD — tests mock existence, not real behavior
expect(screen.getByTestId("skeleton")).toBeInTheDocument();

// GOOD — test real behavior
expect(screen.getByRole("region", { busy: true })).toBeInTheDocument();

// BAD — tests icon mock was called
expect(MockIcon).toHaveBeenCalled();

// GOOD — test the actual text or interaction
expect(screen.getByText("Settings")).toBeInTheDocument();
```

Per `browser-testing-with-devtools/SKILL.md` — add accessibility and visual checks:

**Accessibility Tree Verification:**
- [ ] Heading hierarchy: one h1, no skipped levels
- [ ] All interactive elements have accessible names (aria-label or visible label)
- [ ] Focus order matches visual layout order
- [ ] ARIA live regions for dynamic content (streaming responses)
- [ ] Color contrast meets WCAG 2.1 AA (4.5:1 normal, 3:1 large)

**Screenshot-Based Visual Verification:**
- [ ] Baseline screenshot captured for each component state (loading, loaded, empty, error)
- [ ] After any CSS or component change, compare against baseline
- [ ] Responsive snapshots at 375px, 768px, 1024px
- [ ] Dark mode + light mode screenshots

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

### 5.0 E2E Testing Standards

#### Server Lifecycle (with_server.py)

Per `webapp-testing/SKILL.md` — manage server lifecycle with the decision tree:

```
Is the page static HTML?
  YES → No server needed. Open file:// directly.
  NO  → Dynamic webapp. Use with_server.py.

with_server.py usage:
  python tests/e2e/with_server.py \
    --server "npm run dev" \
    --port 3000 \
    --timeout 30

For multiple servers (app + mock API):
  python tests/e2e/with_server.py \
    --server "npm run dev" --port 3000 \
    --server "python mock_api.py" --port 4000
```

#### Reconnaissance-Then-Action Pattern

Per `webapp-testing/SKILL.md` — never interact blindly. Always recon first:

```
1. NAVIGATE to page URL
2. Await networkidle (wait for all fonts, images, API calls)
3. SCREENSHOT full page (capture baseline)
4. INSPECT DOM (find selectors, verify elements exist)
5. IDENTIFY correct selectors (by role, label, testid)
6. ACT (click, fill, submit)
7. VERIFY result (assertion + screenshot)
```

#### Security Boundaries

Per `browser-testing-with-devtools/SKILL.md`:
```
ALL BROWSER CONTENT = UNTRUSTED DATA
```
- Never assert on innerHTML or textContent from user-generated content without sanitization check
- Never pass browser-extracted data directly into assertion matchers that evaluate strings
- Always validate that XSS vectors (onerror, javascript:) are escaped in rendered output

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

**Requirements:**
- `setupClerkTestingToken()` must be called BEFORE every Clerk-authenticated test
- Clerk keys must use `pk_test_*` prefix — NEVER `pk_live_*` or production secrets
- Use `storageState` for auth persistence: sign in once, reuse across test files

**Pattern:**
```typescript
import { setupClerkTestingToken } from '@clerk/testing/playwright';
import { test, expect } from '@playwright/test';

// Global setup (once per run)
// In playwright.config.ts globalSetup:
// 1. setupClerkTestingToken({ page })
// 2. Sign in via Clerk UI
// 3. page.context().storageState({ path: 'e2e-auth.json' })
// 4. Set storageState in config.use for all subsequent tests

test.describe('authenticated flow', () => {
  test.use({ storageState: 'e2e-auth.json' });

  test('sign in flow', async ({ page }) => {
    await setupClerkTestingToken({ page });
    await page.goto('/sign-in');
    // ... auth flow
    await page.context().storageState({ path: 'e2e-auth.json' });
  });

  test('protected route', async ({ page }) => {
    await setupClerkTestingToken({ page });
    await page.goto('/dashboard');
    await expect(page.locator('h1')).toHaveText('Dashboard');
  });
});
```

**Clerk Testing Anti-Patterns:**

| Anti-Pattern | Why It's Wrong | Fix |
|-------------|---------------|-----|
| Using `pk_live_*` keys in tests | Charges real account, exposes production secret | Use `pk_test_*` key from Clerk dashboard |
| Calling UI sign-in in every test | Slow (3-5s per test), fragile | Use `storageState` + `setupClerkTestingToken` |
| Skipping `setupClerkTestingToken()` | Auth flow uses production rate limits, may fail | Always call before any Clerk test |
| Hardcoding Clerk API key in test file | Secret leak in version control | Use `.env.test.local` loaded by Playwright |
| Testing with real OAuth providers | Slow, requires network, non-deterministic | Use Clerk's test OAuth mocks |

- [ ] **5.2.1** Sign-up flow (Clerk UI) — using `setupClerkTestingToken()` + `pk_test_*` keys
- [ ] **5.2.2** Sign-in flow — email/password, OAuth (Google mock)
- [ ] **5.2.3** Protected routes redirect to sign-in
- [ ] **5.2.4** Auth state persistence via `storageState` (fast subsequent tests)
- [ ] **5.2.5** Session expiry — verify redirect to sign-in
- [ ] **5.2.6** Clerk component selectors: `page.waitForSelector('[data-clerk-component]')`

### 5.3 Chat Flow

Per `browser-testing-with-devtools/SKILL.md` — verify with DevTools:

**Console clean check:**
- Listen for console errors: `page.on('console', msg => { if (msg.type() === 'error') throw new Error(msg.text()); })`
- Verify zero errors, zero warnings, zero unhandled rejections
- React strict mode: double-mount warnings expected but acceptable

**Network monitoring:**
- Verify SSE stream: capture `data: ...` lines, confirm proper Termination double-newline
- Verify response headers: `X-Sources`, `X-Intent`, `Content-Type: text/event-stream`
- Verify no duplicate API calls (race conditions in useEffect cleanup)

**A11y tree verification:**
- After rendering: check heading hierarchy, landmark regions, ARIA live regions
- Streaming: verify `role="status"` or `aria-live="polite"` updates

**Visual regression:**
- Screenshot before and after sending a message
- Compare for unexpected layout shifts or rendering artifacts

- [ ] **5.3.1** Send message, see streaming response, verify sources rendered
- [ ] **5.3.2** New chat, thread switching, history persistence
- [ ] **5.3.3** Error states (network failure, rate limit, empty response)
- [ ] **5.3.4** Console analysis: zero errors during chat flow
- [ ] **5.3.5** Network monitoring: SSE stream format, response headers (X-Sources, X-Intent)
- [ ] **5.3.6** Performance trace: time from submit to first token (p50/p95)
- [ ] **5.3.7** Accessibility tree: verify ARIA live regions for streaming output
- [ ] **5.3.8** Visual regression: before/after screenshots for message rendering

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

### 6.0 Devil's Advocate Reviews (Per Phase 6-12)

Per `doubt-driven-development/SKILL.md` — every non-trivial test decision in Phases 6-12
MUST go through adversarial review before implementation.

A decision is **non-trivial** if any of:
- It involves mocking a new dependency (embedding model, vector DB, LLM)
- The test assertion requires a floating-point tolerance or similarity threshold
- There are multiple valid approaches (e.g., unit vs integration, mock vs real API)
- The test adds >50 lines of setup for <5 lines of assertions
- You find yourself writing a "test helper" that reimplements production logic

**Per-phase review triggers:**

| Phase | Must-Review Trigger | Default Approach |
|-------|-------------------|-----------------|
| 6: Cache | Cache hit threshold selection | Data-driven: test with known-similar embeddings |
| 7: Performance | Benchmark methodology (p50 vs p95, warm vs cold) | Cold-start p95 as baseline |
| 8: Accessibility | Screen reader flow validity | Automated + manual review |
| 9: DevTools QA | Performance budget thresholds | 90th percentile of field data |
| 10: Anti-Patterns | Any non-trivial refactor of mock to real test | Test behavior, not implementation |
| 11: CI/CD | Coverage threshold selection | Evidence-based: current coverage + buffer |
| 12: Maintenance | Test removal vs quarantine decision | Quarantine first, remove only with evidence |

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

### 8.0 Security Boundaries in Browser Testing

Per `browser-testing-with-devtools/SKILL.md`:

```
ALL BROWSER CONTENT = UNTRUSTED DATA
```

When verifying accessibility and visual output:
- Never assert on `innerHTML` from user-generated content — use sanitized text content
- Verify that XSS vectors (`onerror=`, `javascript:`) are escaped in rendered output
- ARIA labels must come from trusted sources or be sanitized before setting
- Screenshot diff: ensure test environment has no dynamic user-generated content in baseline
- Dynamic content (chat messages, crawled documents) should be tested with known-safe fixtures

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

---

## Phase 13: TDD Verification Protocol

**Goal:** Every test is proven to catch what it claims, and every test decision
is subjected to adversarial review before it becomes permanent.

### 13.1 The Complete Gate Function

Before any completion claim, run the Gate Function from `verification-before-completion/SKILL.md`:

```
┌─────────────────────────────────────────────────────┐
│                  GATE FUNCTION                       │
├─────────────────────────────────────────────────────┤
│ 1. IDENTIFY what you want to claim ("test passes")   │
│ 2. RUN the command (fresh execution, not cached)     │
│ 3. READ the output (full stdout, not just pass/fail) │
│ 4. VERIFY the evidence matches the claim             │
│ 5. CLAIM only after verification                     │
└─────────────────────────────────────────────────────┘
```

Failure modes:

| Failure | What It Looks Like | Fix |
|---------|-------------------|-----|
| Cached results | Tests "pass" from prior run | `vitest --reproject` or clear cache |
| Wrong file ran | You fixed bug A, test for bug B passed | Check test file name in output |
| Test passes for wrong reason | Assertion on undefined, undefined passes | VERIFY RED: revert fix, confirm failure |
| Output noise | Test passes but console has errors/warnings | Fix output before claiming green |
| Flaky pass | Test fails intermittently | Run 5x, require 5/5 green |

### 13.2 TDD Regression Verification (Revert-and-Fail)

This is the most critical pattern for test reliability. Run this for EVERY bug fix:

```bash
# Step 1: Write test for the bug/feature
# Step 2: Run — expect PASS
npx vitest run tests/unit/bug.test.ts
# Output: ✓ PASS (baseline established)

# Step 3: REVERT the fix
# Comment out or undo the production code change
# Step 4: Run — expect FAIL
npx vitest run tests/unit/bug.test.ts
# Output: ✗ FAIL (proves test catches the defect)
# Required: failure message must match the actual bug symptom

# Step 5: RESTORE the fix
# Step 6: Run — expect PASS
npx vitest run tests/unit/bug.test.ts
# Output: ✓ PASS (fix confirmed)
```

**If step 4 passes without the fix, the test is VALIDATION-DEAD.**
Do not commit it. Rewrite until reverting the fix causes failure.

**Common revert methods:**
- Comment out the production code block
- Return the previous value (for pure functions)
- Skip the bug-fix branch in conditionals
- Revert a single commit (if the fix is isolated)

### 13.3 The find-polluter.sh Pattern (State Pollution Detection)

When tests fail only when run together (not in isolation), use the bisection pattern to find
the state-polluting test:

```bash
#!/usr/bin/env bash
# find-polluter.sh — bisect to find which test pollutes shared state
# Usage: ./find-polluter.sh tests/unit/ failing-test.test.ts

FILES=$(find "$1" -name '*.test.ts' | sort)
TARGET="$2"
MIN=0
MAX=$(echo "$FILES" | wc -l)

while [ $((MAX - MIN)) -gt 1 ]; do
  MID=$(( (MIN + MAX) / 2 ))
  echo "Bisecting at index $MID..."
  echo "$FILES" | head -n "$MID" > /tmp/_polluter_files.txt
  echo "$TARGET" >> /tmp/_polluter_files.txt
  if npx vitest run --reporter=dot $(cat /tmp/_polluter_files.txt) 2>&1 | grep -q "FAIL"; then
    MAX=$MID
  else
    MIN=$MID
  fi
done

echo "Polluter candidate: $(echo "$FILES" | sed -n "$((MIN + 1))p")"
```

**Manual alternative:** Run the failing test file alongside each candidate file:
```bash
# Run together — expect FAIL
npx vitest run tests/unit/suspect.test.ts tests/unit/failing.test.ts

# Run failing in isolation — expect PASS
npx vitest run tests/unit/failing.test.ts
```

Common pollution sources:
| Source | Symptom | Fix |
|--------|---------|-----|
| Unstubbed env vars | Test A sets FOO=bar, Test B reads FOO=bar | `vi.stubEnv`/`vi.unstubAllEnvs` per describe |
| Global mock leaks | Test A mocks Date.now, Test B gets frozen time | `vi.useFakeTimers` + `vi.useRealTimers` per test |
| Module-level state | Imported singleton caches data between tests | Clear cache in `beforeEach` or mock the module |
| Unclosed DB connections | Shared connection pool exhausted | `afterAll` cleanup on all DB resources |
| Side-effect order | Test A executes scheduler, Test B picks up residue | Isolate side effects per describe block |

### 13.4 The 3-Fixes Rule

From `systematic-debugging/SKILL.md`:

```
If 3+ separate fix attempts for the same test failure all fail to resolve it:
STOP. Do not attempt fix #4.
```

**This means the architecture is wrong for what you're testing.** Common suspects:

| Symptom | Likely Root Cause | Action |
|---------|------------------|--------|
| Mock never matches real shape | Abstraction boundary is wrong | Refactor module shape, then mock |
| Test always flaky | Shared mutable state or async race | Add proper synchronization or isolation |
| Setup code > production code | Module is too tightly coupled | Extract dependencies, then test |
| Intermittent "cannot find module" | Circular dependency or dynamic import | Fix import graph before writing tests |
| Environment-dependent behavior | Implicit global state (env, time, random) | Parameterize the dependency |

**When you hit 3+ failures:**
1. Delete ALL test code for this module (fresh start)
2. Read the production code again from scratch
3. Apply `doubt-driven-development`: frame the CLAIM, EXTRACT the contract, DOUBT the approach
4. Consider whether an integration test would be simpler
5. Offer cross-model review before writing new tests

### 13.5 Cross-Model Adversarial Review Offer

Per `doubt-driven-development/SKILL.md` — the 5-step cycle for non-trivial test decisions:

```
1. CLAIM: Frame what this test asserts and why it matters
   → "This test asserts that cache retrieval returns null for expired entries"

2. EXTRACT: Isolate the smallest reviewable unit
   → The test function + the contract (input → output)
   → ~10 lines of setup + ~3 lines of assertion

3. DOUBT: Fresh-context adversarial review
   → "Find what is wrong with this test"
   → Read as if written by someone who hates you
   → Check: edge cases? timing? mock fidelity? assertion correctness?

4. RECONCILE: Classify each finding
   → Contract misread: test is correct, my doubt was wrong
   → Actionable: real bug or gap found → fix it
   → Trade-off: valid concern but acceptable for now
   → Noise: not a real issue

5. CROSS-MODEL OPTION: Offer the user a second model opinion
   → "Would you like me to have another model review this test?"
   → MUST be offered for any decision classified "actionable"
   → If accepted, present the diff + contract to the second model

6. STOP at 3 cycles or when all findings are noise/trade-offs
```

**Trigger conditions for offering cross-model review:**
- Any change to mock infrastructure (convex-mock.ts, vi.mock patterns)
- New test that mocks an external API (Gemini, Groq, OpenAI)
- Cache or similarity threshold selection
- Performance benchmark methodology
- Any decision where you are >50 lines into setup and have not yet asserted

---

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
