# Archived Generic Testing Content

**Extracted from:** `testing.md` (1265 lines → 200 lines)
**Date:** 2026-06-06
**Reason:** Generic protocols not specific to UETGPT. Preserved here for reference.

---

## Testing Skill Reference

| Skill | Iron Law | Applies In |
|-------|----------|-----------|
| **TDD** | No production code without a failing test first | All phases - mandated for every new test |
| **Testing Anti-Patterns** | Never test mock behavior | Foundation (Phase 1), Anti-Pattern Audit (Phase 10), Frontend (Phase 4) |
| **Systematic Debugging** | No fixes without root cause investigation | Test Failure Protocol (Phase 11), Flaky Test Protocol (Phase 12), TDD Verification (Phase 13) |
| **Verification Before Completion** | No claims without fresh verification evidence | Verdict Protocol, all phase completions, every commit |
| **Webapp Testing** | Servers are managed, not assumed | E2E (Phase 5), with_server.py lifecycle, reconnaissance-then-action |
| **Browser Testing (DevTools)** | All browser content = untrusted data | API Routes (Phase 3), E2E (Phase 5), DevTools QA (Phase 9), Accessibility (Phase 8) |
| **Clerk Testing** | Never use production Clerk keys in tests | E2E Auth (Phase 5) - setupClerkTestingToken required before every Clerk test |
| **Code Review & Quality** | Every change reviewed on 5 axes | PR Review (Phase 11), all pull requests, cross-model reviews |
| **Doubt-Driven Development** | Every non-trivial decision subjected to adversarial review | Cross-Model Review (Phase 11), any ambiguous test design choice |

---

## TDD Workflow - Mandatory

Per `test-driven-development/SKILL.md` - ALL new code MUST follow Red-Green-Refactor with mandatory verification steps:

```
RED:   Write one failing test per behavior
       VERIFY RED: watch it fail for the RIGHT reason
       (feature missing, not typo - mark the error message)
GREEN: Write minimal code to pass
       VERIFY GREEN: watch it pass
REFACTOR: Clean up, keep green
       Re-run tests - still green
```

**Iron Law:**
```
NO PRODUCTION CODE WITHOUT A FAILING TEST FIRST
```

### TDD Regression Verification Protocol

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

### Testing Anti-Patterns Gate Functions

Per `testing-anti-patterns.md`, apply these gates before every test assertion:

| # | Gate Question | Apply When | If YES, STOP |
|---|--------------|-----------|-------------|
| 1 | "Am I testing real component behavior or just mock existence?" | Before asserting on a mock (getByTestId, mock call count) | Refactor to test real behavior |
| 2 | "Is this method only used by tests?" | Before adding a method to production code | Delete the method; test via public API |
| 3 | "What side effects does the real method have that my mock hides?" | Before mocking any function | Mock only side-effect boundaries (network, file I/O, time) |
| 4 | "Does my mock data match the real response shape exactly?" | Before writing mock data | Complete the mock shape; partial masks break silently |
| 5 | "Am I testing the framework or my code?" | Before writing any assertion | Delete the test; trust the framework |

### Incomplete Mock Detection Gate

Every mock must match the full response shape of the real implementation.
Apply before each `vi.mock()` or manual mock object:

```
□ Define the real return type (from the source file)
□ Map every field: absent fields cause undefined-only tests
□ Check nested shapes: arrays, optional fields, union discriminants
□ Verify mock side effects match real side effects (cache writes, DB calls)
□ If the mock is complex → consider whether an integration test is better
```

### Verification Gate for Every Commit

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

### Rationalizations That Mean STOP

- "I'll test after" - No. Test first or delete code.
- "Already manually tested" - No. Manual is ad-hoc. Automated catches regressions.
- "Too simple to test" - Simple code breaks too. Test takes 30 seconds.
- "The mock is close enough" - No. Incomplete mocks mask real failures.
- "I'll skip the VERIFY RED step" - No. Without reverting you haven't proven the test works.

---

## Phase 1: Foundation & Standards (Completed)

### 1.1 Fix Test Setup & Infrastructure - Partial

- [x] **1.1.1** Audit `vitest.config.ts` - ensure `environment: "jsdom"` is correct for all tests (may need `node` env for Convex tests). **Verdict:** jsdom `^29.1.1` is in package.json devDependencies. Config restored with jsdom env + setup.ts + globals. Admin JSX tests run correctly.
- [ ] **1.1.2** Add workspace mode for separate Convex/React environments - TRIED then reverted (config issues). **Blocked:** needs to be reapproached
- [x] **1.1.3** Remove hardcoded secrets from `tests/load-test.ts` → DONE: refactored to accept params, env-var-only secrets in standalone mode
- [x] **1.1.4** Add CI-integrated smoke test for load test → DONE: `tests/unit/load-test-smoke.test.ts`
- [x] **1.1.5** Add proper Convex mutation/query mocking → DONE: `tests/helpers/convex-mock.ts` with scheduler + storage stubs, mutation/query/action/httpAction wrappers via `vi.mock("convex/_generated/server")` (SHA: `cdc291c`)
- [x] **1.1.6** Vitest config restored - jsdom `^29.1.1` installed in devDependencies. Config now uses `environment: "jsdom"`, `setupFiles`, `globals: true` without hanging. (Earlier hang was because jsdom was absent when config attempted those settings.)

### 1.2 Standardize Test Patterns (Anti-Pattern Audit) - Complete

- [x] **1.2 Audit** DONE: `docs/anti-pattern-audit-report.md` created - 24 issues across 16 files found
- [ ] **1.2.1** Fix incomplete mocks - search test mocks missing full response shapes (1 file: `admin-stats.test.ts` Convex query mock)
- [x] **1.2.2** Remove `_handler` casts - add proper Convex test helpers instead → **DONE:** 25 `_handler` casts replaced across 10 test files via `vi.mock("convex/_generated/server")` wrappers (SHA: `cdc291c`):
  - `webhook.test.ts`, `users.test.ts`, `tasks.test.ts`, `embeddings-integration.test.ts`
  - `rag-pipeline.test.ts`, `webhook-integration.test.ts`, `embeddings-generate.test.ts`
  - `feedback-submit.test.ts`, `rag-context.test.ts`
  - convex-mock.ts updated with scheduler + storage stubs
- [ ] **1.2.3** Assert on real behavior, not mock calls - 9 admin test files assert on mock skeletons/icons. **HIGH priority:** these tests pass/fail based on mock existence, not component correctness
- [x] **1.2.4** Ensure test utilities live in `tests/helpers/` - DONE: `convex-mock.ts`, `README.md`
- [x] **1.2.5** Verify no test-only methods in production - Verified clean
- [x] **1.2.6** Fix env var leaks between tests - DONE: `users.test.ts` uses `vi.stubEnv`/`vi.unstubAllEnvs` scoped per-describe
- [x] **1.2.7** Fix missing `afterEach` imports (vitest 4.x requires explicit imports when `globals: false`) - DONE: added to `webhook.test.ts`, `users.test.ts`
- [x] **1.2.8** Fix missing `vi.mock` for `_generated/api` in `tasks.test.ts` - DONE
- [x] **1.2.9** Fix stale production imports in tests (`llm-models.test.ts` was referencing non-existent exports) - DONE

### 1.3 Add Missing Unit Tests - Partial

- [ ] **1.3.1** `convex/rag/context.ts` - `buildContext` sandwich strategy - NOT YET DONE (existing test uses `_handler` pattern, now fixed)
- [ ] **1.3.2** `convex/rag/routing.ts` - `classifyQueryAction` - NOT YET DONE
- [ ] **1.3.3** `convex/cache/get.ts` - cache hit/miss/expiry - NOT YET DONE
- [ ] **1.3.4** `convex/cache/set.ts` - cache write, TTL - NOT YET DONE
- [x] **1.3.5** `src/lib/rate-limit.ts` - DONE: `tests/unit/rate-limit.test.ts` (6 tests)
- [x] **1.3.6** `convex/auth.ts` - role checks - DONE (auth-helpers.test.ts existed, extended)
- [x] **1.3.7** `src/lib/llm-models.ts` - DONE: `tests/unit/llm-models.test.ts` (5 tests)

---

## Phase 2: Convex Backend Testing (In Progress)

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

The `_handler` cast pattern is now deprecated - use the vi.mock wrapper above and call
`handler(ctx, args)` directly in tests. This ensures the handler receives the real ctx shape.

#### Condition-Based Waiting for Async Operations

Never use `setTimeout` to wait for async Convex operations. Use polling with `waitFor`:

```typescript
// BAD - flaky, slow
await new Promise(r => setTimeout(r, 1000));

// GOOD - condition-based, fast
import { waitFor } from '@testing-library/react';

await waitFor(() => {
  expect(mockDb.insert).toHaveBeenCalledTimes(1);
}, { timeout: 5000, interval: 50 });
```

#### Defense-in-Depth: Mock at the Correct Level

| Layer | What to Mock | What NOT to Mock | Rationale |
|-------|-------------|-----------------|-----------|
| Handler input | `ctx`, `args` shape | Internal helper logic | Test the orchestration, not the helpers |
| Database | `db.query`, `db.insert`, `db.patch` | Query chain behavior | Mock the CRUD boundary |
| External API | `fetch`, `OpenAI`, `Gemini` | Response parsing | Real API = slow, brittle; keep parsing tested |
| Side effects | `scheduler`, `storage` stubs | Callback logic | Stub the side effect, test the callback separately |

### 2.1 Crawl Pipeline - Partial

- [x] **2.1.1** `convex/crawl/webhook.ts` - `chunkMarkdown` edge cases - **DONE**
- [x] **2.1.2** `convex/crawl/actions.ts` - `embedSingleChunk` - **DONE**
- [x] **2.1.3** `convex/crawl/mutations.ts` - core data logic (709 lines) - **DONE**
- [ ] **2.1.4** `convex/crawl/workflow.ts` - `kickoffDailyCrawl` - NOT DONE
- [x] **2.1.5** `convex/crawl/webhook.ts` - HMAC verification - **DONE**
- [x] **2.1.6** `convex/crawl/tasks.ts` - `cleanupExpiredCache`, `aggregateDailyStats` - **DONE**
- [x] **2.1.7** Webhook HTTP action (`crawlWebhook`, `ingestWebhook`) with mocks - **DONE**

### 2.2 RAG Pipeline - Partial

- [x] **2.2.1** `convex/rag/retrieval.ts` - `retrieveContext` full orchestration - **DONE**
- [ ] **2.2.2** `convex/embeddings/search.ts` - hybrid search - NOT DONE
- [x] **2.2.3** `convex/embeddings/generate.ts` - key rotation - **DONE**
- [x] **2.2.4** `convex/rag/context.ts` - sandwich strategy - **DONE**
- [x] **2.2.5** `convex/rag/routing.ts` - `classifyQueryAction` - **DONE**

### 2.3 Cache Layer

- [ ] **2.3.1** `convex/cache/get.ts` - NOT DONE
- [ ] **2.3.2** `convex/cache/set.ts` - NOT DONE
- [ ] **2.3.3** `convex/cache/internal_queries.ts` - NOT DONE
- [x] **2.3.4** `convex/cache/internal_mutations.ts` - `cleanupExpiredCache` timer-triggered: **DONE (in tasks.test.ts)**

### 2.4 Auth & User Functions - Partial

- [x] **2.4.1** `convex/users.ts` - `getOrCreate`, `getByClerkId` - **DONE**
- [x] **2.4.2** `convex/auth.ts` - role checks with various JWT claims - **DONE**
- [ ] **2.4.3** `convex/threads.ts` - thread CRUD proxy, `purgeOldArchived` - NOT DONE
- [ ] **2.4.4** `convex/faq.ts` - search, create, expiry - NOT DONE
- [ ] **2.4.5** `convex/cache/cache-mutations.ts` - write path with caching semantics - NOT DONE
- [ ] **2.4.6** `convex/cache/cache-queries.ts` - read path with caching semantics - NOT DONE

### 2.5 Cron & Tasks - Partial

- [ ] **2.5.1** `convex/crons.ts` - cron registration - NOT DONE
- [x] **2.5.2** `convex/crawl/tasks.ts` - `cleanupExpiredCache`, `aggregateDailyStats` - **DONE**
- [ ] **2.5.3** `src/app/api/cron/route.ts` - CRON_SECRET auth, handler delegation - NOT DONE

---

## Phase 3: API Route Testing

### 3.1 Chat API (`/api/chat`)

- [ ] POST handler - mock Convex HTTP client: SSE streaming, rate limit (429), unauthorized, LLM fallback chain, cache write, response headers (X-Sources, X-Intent)
- [ ] Edge cases: empty question, very long question, non-text content
- [ ] SSE stream format correctness (data: lines, proper termination)
- [ ] Load test via Playwright: 10 concurrent chat requests, measure p50/p95/p99

### 3.2 Health API (`/api/health`)

- [ ] Returns JSON with status for each service
- [ ] Partial failure handling
- [ ] Timeout handling

### 3.3 Webhooks - Partial

- [ ] Clerk webhook - Svix verification, user.created/user.updated events
- [x] Crawl webhook (Convex HTTP) - HMAC verification, payload parsing, idempotency - **DONE (tests skipped)**
- [ ] Crawl webhook integration test - enable skipped tests

### 3.4 API Middleware & Error Handling

- [ ] Rate limit middleware - test with real Upstash mock
- [ ] Auth middleware - valid/expired/missing session
- [ ] Error boundary - 500 responses formatted correctly
- [ ] CORS headers

---

## Phase 4: Frontend Component Testing

### 4.0 Frontend Testing Standards

NEVER assert on mock existence:

```typescript
// BAD - tests mock existence, not real behavior
expect(screen.getByTestId("skeleton")).toBeInTheDocument();

// GOOD - test real behavior
expect(screen.getByRole("region", { busy: true })).toBeInTheDocument();
```

Accessibility tree verification:
- Heading hierarchy: one h1, no skipped levels
- All interactive elements have accessible names
- Focus order matches visual layout
- ARIA live regions for dynamic content
- Color contrast: WCAG 2.1 AA (4.5:1 normal, 3:1 large)

### 4.1 Install jsdom & Configure

- [ ] `npm install -D jsdom`
- [ ] Add `environment: "jsdom"` to vitest.config.ts
- [ ] Verify admin test files load without "document is not defined" errors
- [ ] Fix anti-pattern 1.2.3 (mock-testing) across 9 admin files

### 4.2 Chat Components

- [ ] ChatWindow, ChatMessageBubble, ChatInput, StreamingMessage, SourceList/SourceCard

### 4.3 Sidebar

- [ ] Sidebar, SidebarHistory, NewChatButton, Thread deletion

### 4.4 Admin Components

- [ ] Auth guard, Dashboard stats, Document browser, Crawl management, Settings page

### 4.5 Shared Components

- [ ] ThemeProvider/ThemeToggle, ErrorBoundary, LoadingState/EmptyState, SourceCard, ChatSuggestions

### 4.6 Anti-Pattern Remediation (Phase 1.2.3)

Replace `getByTestId("skeleton")` → test `aria-busy` or actual content.
Replace `getByTestId("icon-*")` → test label text or button presence.
Use `screen.getByRole()` and `screen.getByText()` preferred over test IDs.

---

## Phase 5: E2E Playwright Testing

### 5.0 E2E Testing Standards

#### Server Lifecycle (with_server.py)

```
Is the page static HTML?
  YES → No server needed. Open file:// directly.
  NO  → Dynamic webapp. Use with_server.py.

with_server.py usage:
  python tests/e2e/with_server.py \
    --server "npm run dev" \
    --port 3000 \
    --timeout 30
```

#### Reconnaissance-Then-Action Pattern

```
1. NAVIGATE to page URL
2. Await networkidle
3. SCREENSHOT full page
4. INSPECT DOM
5. IDENTIFY correct selectors
6. ACT (click, fill, submit)
7. VERIFY result (assertion + screenshot)
```

### 5.1 Infrastructure Setup

- [ ] Install Playwright browsers: `npx playwright install chromium`
- [ ] Configure `playwright.config.ts`
- [ ] Add `.env.test.local` with `pk_test_*` Clerk keys
- [ ] Set up `globalSetup` for Clerk auth state storage

### 5.2 Auth Flows (Clerk)

`setupClerkTestingToken()` must be called BEFORE every Clerk-authenticated test.
Use `pk_test_*` prefix - NEVER `pk_live_*`.
Use `storageState` for auth persistence.

| Anti-Pattern | Why It's Wrong | Fix |
|-------------|---------------|-----|
| Using `pk_live_*` keys | Charges real account | Use `pk_test_*` |
| Calling UI sign-in in every test | Slow (3-5s), fragile | Use `storageState` |
| Skipping `setupClerkTestingToken()` | Auth uses production limits | Always call before Clerk tests |
| Hardcoding Clerk API key | Secret leak in VCS | Use `.env.test.local` |
| Testing with real OAuth providers | Slow, non-deterministic | Use Clerk's test OAuth mocks |

### 5.3 Chat Flow

Console clean check, network monitoring (SSE format), a11y tree verification, visual regression.

### 5.4 Admin Flow

Dashboard stats, document browsing, crawl management, settings persistence.

### 5.5 Cross-Browser & Responsive

Chrome, Firefox, WebKit. Mobile viewports (375px, 768px, 1024px). Visual regression screenshots.

### 5.6 Accessibility Verification

Zero console errors, network requests return 200, a11y tree correct, screenshot comparison, tab order, ARIA labels, dynamic content announcements.

---

## Phase 6: Semantic Cache & Embedding Testing

### 6.0 Devil's Advocate Reviews

Every non-trivial test decision in Phases 6-12 MUST go through adversarial review before implementation.

A decision is **non-trivial** if any of:
- It involves mocking a new dependency (embedding model, vector DB, LLM)
- The test assertion requires a floating-point tolerance or similarity threshold
- There are multiple valid approaches (e.g., unit vs integration, mock vs real API)
- The test adds >50 lines of setup for <5 lines of assertions
- You find yourself writing a "test helper" that reimplements production logic

### 6.1 Embedding Generation - Partial

- [x] Gemini API response parsing, dimension mismatch detection, retry logic - **DONE**
- [ ] Batch embedding, empty content edge cases - NOT DONE

### 6.2 Vector Search

- [x] Cosine similarity edge cases - **DONE**
- [ ] RRF fusion, FAQ interception, time decay, dimension mismatch handling - NOT DONE

### 6.3 Cache Behavior

- [ ] Cache hit/miss/write, cleanup, hit counter - NOT DONE
- [x] `cleanupExpiredCache` timer-triggered cleanup - **DONE (tasks.test.ts)**

---

## Phase 7: Performance & Load Testing

### 7.1 Benchmarks

- [ ] RAG pipeline e2e latency (p50/p95/p99)
- [ ] Embedding throughput
- [ ] Convex vector search latency (<50ms target)
- [ ] Cache lookup vs full pipeline speedup
- [ ] First token latency for chat streaming

### 7.2 Load Tests

- [x] Clean `tests/load-test.ts` - env-var-only secrets - **DONE**
- [ ] Concurrent chat requests (5/10/25)
- [ ] Cache performance under load
- [ ] Rate limiter behavior under load
- [ ] Concurrency safety verification

### 7.3 CI Integration

- [ ] Benchmark assertions in CI (no regression >10%)
- [ ] Smoke load test in CI (1 concurrent, short duration)
- [ ] Performance regression gate (p95 > 2x baseline → fail build)

---

## Phase 8: Accessibility & Visual Testing

### 8.1 Accessibility - Automated

- [ ] Heading hierarchy, focus order, color contrast, ARIA labels, dynamic content, keyboard nav, focus trap

### 8.2 Accessibility - Manual Review

- [ ] Screen reader test (VoiceOver/NVDA), zoom 200%, reduced motion, high contrast

### 8.3 Visual Regression

- [ ] Screenshot baselines (light + dark), responsive breakpoints, loading/empty/error states, streaming animation

---

## Phase 9: DevTools-Based Quality Assurance

### 9.1 Console Quality Gate

- [ ] Zero console errors/warnings on all pages, zero deprecation warnings, no CSP violations

### 9.2 Network Quality Gate

- [ ] All API calls return expected status, no duplicate calls, SSE format correct, payload sizes within limits

### 9.3 Performance Budget

- [ ] LCP < 2.5s, CLS < 0.1, INP < 200ms, first token < 1s, bundle size regression check

### 9.4 Accessibility Tree Verification

- [ ] Read a11y tree for key pages, verify heading structure, verify landmark regions

---

## Phase 10: Testing Anti-Pattern Remediation

### 10.1 Anti-Pattern 1: Testing Mock Behavior (9 files - HIGH)

| File | Fix Strategy |
|------|-------------|
| `admin-crawls.test.tsx` | Replace `getByTestId("skeleton")` → test `aria-busy` |
| `admin-documents.test.tsx` | Replace `getAllByTestId("skeleton")` → test `aria-busy` |
| `admin-settings.test.tsx` | Rewrite with real components or behavior-based assertions |
| `admin-overview.test.tsx` | Remove icon assertions; test content text |
| `admin-feedback.test.tsx` | Test via text content or roles |
| `admin-analytics.test.tsx` | Test computed values and labels |
| `admin-layout.test.tsx` | Test nav link text or aria-labels |
| `sidebar-history.test.tsx` | Test real link behavior or remove |
| `admin-flow.spec.ts` (E2E) | Remove conditional assertion; assert exact redirect URL |

### 10.2 Anti-Pattern 3: Mocking Without Understanding (3 files - MEDIUM)

| File | Fix Strategy |
|------|-------------|
| `admin-settings.test.tsx` | Replace 40+ line select mock with simple `<select>` + hardcoded options |
| `admin-stats.test.ts` | Pre-computed mock results instead of reimplementing Convex query engine |
| `rag-pipeline.test.ts` | Use named result maps instead of call-order-indexed mock results |

### 10.3 Anti-Pattern 4: Incomplete Mocks (1 file - LOW)

| File | Fix Strategy |
|------|-------------|
| `admin-stats.test.ts` | Ensure mock preserves filtering behavior tests depend on |

### 10.4 Anti-Pattern 5: Tests as Afterthought (4 files - MEDIUM)

| File | Fix Strategy |
|------|-------------|
| `types.test.ts` | Remove - branded string typing verified by compiler |
| `messages-api.test.ts` | Add behavior tests or remove |
| `threads-api.test.ts` | Add behavior tests or remove |
| `document-validator.test.ts` | Replace 587-line introspection test with snapshot or actual validation behavior tests |

### 10.5 Hardcoded Secrets (1 file - HIGH)

| File | Fix Strategy |
|------|-------------|
| `webhook-integration.test.ts:5` | Move `WEBHOOK_SECRET` to env var or `beforeEach` scope |

---

## Phase 11: CI/CD & Quality Gates

### 11.1 CI Pipeline (`.github/workflows/ci.yml`)

```
PR → lint (biome) → typecheck (tsc) → unit tests (vitest) →
     integration tests (vitest) → build (next build) →
     E2E tests (playwright) → coverage report →
     performance benchmark (p95 check)
```

- [ ] Coverage thresholds (80% min, 90% target)
- [ ] Test run time budget (unit < 30s, integration < 60s, E2E < 3min, total < 5min)
- [ ] Performance regression check (p95 RAG latency vs baseline)
- [ ] Dead code detection (`ts-prune` in CI)
- [ ] Dependency vulnerability scan (`npm audit` in CI)

### 11.2 Quality Gates - Per Commit

- [ ] All tests pass (fresh run, not cached)
- [ ] Zero lint errors
- [ ] TypeScript strict mode clean
- [ ] Coverage not regressed
- [ ] E2E tests pass in headless Chromium
- [ ] Console output pristine
- [ ] Anti-pattern scan: no `_handler` casts, no `getByTestId("*-mock")`

### 11.3 Quality Gates - Per PR (5-axis review)

**Context:** Understand what the change does and why.
**Correctness:** Matches spec, edge cases handled, tests cover change, TDD followed.
**Readability:** Clear names, straightforward logic, no unnecessary complexity.
**Architecture:** Follows patterns, no unnecessary coupling, appropriate abstraction.
**Security:** No secrets, input validated, no injection, auth checks, untrusted data treated properly.
**Performance:** No N+1, no unbounded ops, pagination on lists, bundle not regressed.
**Verification:** Tests pass (fresh), build succeeds, DevTools verification done.

### 11.4 Test Failure Protocol

Per `systematic-debugging/SKILL.md` - no fixes without root cause investigation:
1. Read the error message completely
2. Reproduce consistently (isolate to single test file)
3. Check recent changes
4. Form hypothesis
5. Fix minimally
6. If 3+ fixes fail - STOP. Architectural problem.

### 11.5 Cross-Model Adversarial Review

Per `doubt-driven-development/SKILL.md` - before non-trivial test decisions:
1. CLAIM: what does this test assert?
2. EXTRACT: smallest reviewable unit
3. DOUBT: fresh-context adversarial review
4. RECONCILE: classify findings
5. CROSS-MODEL OPTION: offer second model opinion
6. STOP at 3 cycles or trivial findings

---

## Phase 12: Maintenance & Regression Prevention

### 12.1 Flaky Test Protocol

- [ ] Any test that fails intermittently gets flagged in CI
- [ ] Flaky tests quarantined (moved to `tests/flaky/`) within 24 hours
- [ ] Root cause found before returning to main suite
- [ ] Flaky test scoreboard maintained (file, failure rate, root cause)

### 12.2 Test Health Dashboard

- [ ] Run time tracking per test file (alert if >50% increase)
- [ ] Coverage trend tracking (alert if >5% drop)
- [ ] Flake rate tracking (alert if >1% of runs)
- [ ] False-positive rate (tests that pass but shouldn't)

### 12.3 Regression Test Suite

- [ ] Before/after baselines for all bug fixes
- [ ] TDD cycle required for every bug fix
- [ ] Regression snapshot stored alongside fix
- [ ] `git bisect` script available for performance regression hunting

### 12.4 Dependency Update Protocol

- [ ] Lock file changes reviewed for test impact
- [ ] Vitest/Playwright upgrades run full suite before merge
- [ ] Mock behavior checked after any `convex/_generated/` regeneration
- [ ] `vi.mock` paths checked after module relocation

---

## Phase 13: TDD Verification Protocol

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

```bash
# Step 1: Write test for the bug/feature
# Step 2: Run - expect PASS
npx vitest run tests/unit/bug.test.ts
# Output: ✓ PASS (baseline established)

# Step 3: REVERT the fix
# Comment out or undo the production code change
# Step 4: Run - expect FAIL
npx vitest run tests/unit/bug.test.ts
# Output: ✗ FAIL (proves test catches the defect)
# Required: failure message must match the actual bug symptom

# Step 5: RESTORE the fix
# Step 6: Run - expect PASS
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

When tests fail only when run together (not in isolation), use the bisection pattern:

```bash
#!/usr/bin/env bash
# find-polluter.sh - bisect to find which test pollutes shared state
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

This means the architecture is wrong for what you're testing.

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

The 5-step cycle for non-trivial test decisions:

```
1. CLAIM: Frame what this test asserts and why it matters
2. EXTRACT: Isolate the smallest reviewable unit
3. DOUBT: Fresh-context adversarial review ("find what is wrong")
4. RECONCILE: Classify each finding as valid/actionable/trade-off/noise
5. CROSS-MODEL OPTION: Offer the user a second model opinion
6. STOP at 3 cycles or when all findings are noise/trade-offs
```

**Trigger conditions for offering cross-model review:**
- Any change to mock infrastructure (convex-mock.ts, vi.mock patterns)
- New test that mocks an external API (Gemini, Groq, OpenAI)
- Cache or similarity threshold selection
- Performance benchmark methodology
- Any decision where you are >50 lines into setup and have not yet asserted

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

```
Phase 1 (Foundation) - DONE
Phase 2 (Convex Backend)
  ├── Agent C: 2.1 Crawl pipeline tests (mostly DONE)
  ├── Agent D: 2.2 RAG pipeline tests (mostly DONE)
  ├── Agent E: 2.3 Cache layer tests (NOT DONE)
  └── Agent F: 2.4-2.5 Auth, Users, Cron tests (Auth DONE, others pending)
Phase 3 (API Routes) → Agent G
Phase 4 (Frontend) → Agents H, I, J
Phase 5 (E2E) → Agents K, L
Phase 6 (Cache & Embedding) → Agent M
Phase 7-12 (Remaining) → Agent N
```

---

## Completion Checklist

Before claiming any phase complete:
- [ ] Tests written using TDD (failed first, then passed)
- [ ] `pnpm test` - all tests pass, 0 failures (fresh run)
- [ ] `pnpm lint` - 0 errors, 0 warnings
- [ ] `npx tsc --noEmit` - 0 errors
- [ ] `pnpm test:e2e` - all E2E tests pass
- [ ] No testing anti-patterns
- [ ] Test utilities in `tests/helpers/`, not in production code
- [ ] Coverage not regressed from baseline
- [ ] DevTools verification: zero console errors, network requests OK
- [ ] Anti-pattern scan: no `_handler` casts, no `getByTestId("*-mock")`

**Run the command. Read the output. THEN claim completion.**
