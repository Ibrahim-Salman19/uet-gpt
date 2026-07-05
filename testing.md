# UETGPT Testing — Quick Reference

**Last updated:** 2026-06-06 | **Baseline:** 111 pass, 4 fail (Vitest 4.1.7)

---

## Test Commands

| Command | Purpose |
|---------|---------|
| `pnpm vitest run` | Run all unit + integration tests |
| `pnpm vitest run tests/unit/` | Unit tests only |
| `pnpm vitest run tests/integration/` | Integration tests only |
| `pnpm vitest run tests/convex/` | Convex function tests only |
| `npx playwright test` | Run E2E tests |
| `npx playwright test --project=chromium` | E2E on Chromium only |
| `npx tsc --noEmit` | Typecheck (must be zero errors) |
| `pnpm lint` | Lint (must be zero errors) |

---

## Test File Inventory

| Directory | Tool | Files | Tests | Coverage |
|-----------|------|-------|-------|----------|
| `tests/convex/` | Vitest | 5 | ~60 | webhook, users, tasks, actions, mutations |
| `tests/unit/` | Vitest | 34 | ~55 | admin components, utils, rate-limit, llm-models, search, feedback, embeddings, RAG context |
| `tests/integration/` | Vitest | 4 | ~40 | RAG pipeline, chat API, embeddings, webhook |
| `tests/e2e/` | Playwright | 12 | 8 | Minimal — no auth tests working |
| `tests/helpers/` | — | 2 | — | `convex-mock.ts`, `README.md` |
| `tests/load-test.ts` | Manual | 1 | — | NOT CI-integrated |
| **Total** | — | **55+** | **~115** | 111 pass, 4 fail |

---

## Current Phase Status

| Phase | Status | Notes |
|-------|--------|-------|
| 1: Foundation & Standards | **Complete** | jsdom installed, `_handler` casts eliminated (25→0), env leak fixes |
| 2: Convex Backend | **In Progress** | Crawl pipeline DONE, RAG retrieval/context/routing DONE. Cache get/set/pending. Threads/faq/crons pending |
| 3: API Routes | **Not started** | Chat API, Health, Webhooks, middleware |
| 4: Frontend Components | **Not started** | Chat, sidebar, admin, shared components |
| 5: E2E Playwright | **Not started** | Auth flows, chat flow, admin flow, cross-browser |
| 6: Cache & Embedding | **Partial** | Embedding generation DONE, cosine similarity DONE. RRF, FAQ boost, cache hit/miss/write pending |
| 7: Performance & Load | **Partial** | Load test cleaned (env-var-only). Benchmarks, concurrent tests pending |
| 8: Accessibility | **Not started** | Automated a11y, manual review, visual regression |
| 9: DevTools QA | **Not started** | Console/network/performance gates |
| 10: Anti-Pattern Remediation | **Not started** | 24 issues found across 16 files (see `docs/archive/anti-pattern-audit-report.md`) |
| 11: CI/CD & Quality Gates | **Not started** | Coverage thresholds, performance regression gates |
| 12: Maintenance | **Not started** | Flaky test protocol, health dashboard |
| 13: TDD Verification Protocol | **Not started** | Gate function, revert-and-fail, find-polluter |

**Blocking items:**
- Phase 4 blocked until jsdom confirmed working with Vitest (currently `node` env)
- Phase 5 blocked until Clerk `pk_test_*` keys + `setupClerkTestingToken()` configured

---

## Vitest Configuration

```typescript
// vitest.config.ts (summary)
environment: "node"        // NOTE: jsdom hangs — see Phase 1.1.2
testTimeout: 30000         // WSL needs 30s+ for setup
globals: true
setupFiles: ["./tests/setup.ts"]  // jest-dom + global fetch mock
resolve.alias: {
  "@/": "<rootDir>/src/",
  "convex/": "<rootDir>/convex/"
}
```

- jsdom `^29.1.1` installed in devDependencies but NOT used in config (causes hangs)
- Convex tests mock `convex/_generated/server` via `vi.mock()` wrapper pattern
- `tests/helpers/convex-mock.ts` provides scheduler + storage stubs

---

## Playwright Configuration

```typescript
// playwright.config.ts (summary)
projects: [
  { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  { name: "mobile-chrome", use: { ...devices["Pixel 5"] } }
]
// Firefox and WebKit NOT configured
```

---

## Known Failures

| File | Test | Root Cause |
|------|------|-----------|
| `webhook-integration.test.ts` | rejects payloads >1MB | Expects 413, Convex returns 400 |
| `webhook.test.ts` | crawlWebhook > rejects payload >1MB with 413 | Same 413→400 mismatch |
| `clerk-webhook.test.ts` | exports POST handler | Timeout (7320ms > 5000ms) — Svix mock hangs |
| `clerk-webhook.test.ts` | POST is async function | Timeout (22136ms > 5000ms) — same Svix mock issue |

**Other issues:**
- TypeScript errors: 26 (all in test files — branded Convex types not satisfied by mocks)
- Lint errors: 9 (3 auto-fixable, 6 formatting)

---

## Key Testing Patterns

### Convex Mock Pattern

```typescript
vi.mock("convex/_generated/server", () => ({
  query: (opts: any) => ({ handler: opts.handler }),
  mutation: (opts: any) => ({ handler: opts.handler }),
  action: (opts: any) => ({ handler: opts.handler }),
  httpAction: (opts: any) => ({ handler: opts.handler }),
}));
```

### Clerk E2E Auth Pattern

```typescript
import { setupClerkTestingToken } from '@clerk/testing/playwright';

// Requires: pk_test_* keys (NEVER pk_live_*)
// Requires: storageState for auth persistence across tests
await setupClerkTestingToken({ page });
```

---

## Reference

- **Detailed testing architecture:** `architecture.md` §12 (lines 696–731)
- **Anti-pattern audit:** `docs/archive/anti-pattern-audit-report.md`
- **Archived detailed phase plans:** `docs/archive/testing-generic-content.md`
