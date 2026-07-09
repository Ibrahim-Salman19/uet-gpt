# Phase 1.2: Anti-Pattern Audit Report

**Date:** 2026-05-30
**Scope:** All 37 test files in `tests/`
**Reference:** `testing-anti-patterns.md`

---

## Files Audited

| # | File | Lines | Verdict |
|---|------|-------|---------|
| 1 | `tests/convex/crawl/webhook.test.ts` | 106 | CLEAN |
| 2 | `tests/unit/search.test.ts` | 58 | CLEAN |
| 3 | `tests/unit/document-validator.test.ts` | 587 | ANTI-PATTERN |
| 4 | `tests/unit/embeddings-generate.test.ts` | 95 | CODE SMELL |
| 5 | `tests/unit/rag-context.test.ts` | 74 | CODE SMELL |
| 6 | `tests/unit/next-config.test.ts` | 16 | CLEAN |
| 7 | `tests/unit/feedback-submit.test.ts` | 61 | CODE SMELL |
| 8 | `tests/unit/types.test.ts` | 10 | ANTI-PATTERN |
| 9 | `tests/unit/admin-stats.test.ts` | 492 | ANTI-PATTERN |
| 10 | `tests/unit/auth-helpers.test.ts` | 213 | CLEAN |
| 11 | `tests/unit/schema.test.ts` | 55 | CLEAN |
| 12 | `tests/unit/tailwind-config.test.ts` | 23 | CLEAN |
| 13 | `tests/unit/use-local-storage.test.ts` | 45 | CLEAN |
| 14 | `tests/unit/clerk-webhook.test.ts` | 27 | CLEAN |
| 15 | `tests/unit/messages-api.test.ts` | 11 | ANTI-PATTERN |
| 16 | `tests/unit/threads-api.test.ts` | 15 | ANTI-PATTERN |
| 17 | `tests/unit/utils.test.ts` | 24 | CLEAN |
| 18 | `tests/integration/rag-pipeline.test.ts` | 221 | ANTI-PATTERN |
| 19 | `tests/integration/embeddings-integration.test.ts` | 141 | CODE SMELL |
| 20 | `tests/integration/chat-api.test.ts` | 100 | CLEAN |
| 21 | `tests/integration/webhook-integration.test.ts` | 150 | ANTI-PATTERN |
| 22 | `tests/load-test.ts` | 96 | ANTI-PATTERN |
| 23 | `tests/unit/admin-crawls.test.tsx` | 209 | ANTI-PATTERN |
| 24 | `tests/unit/admin-documents.test.tsx` | 248 | ANTI-PATTERN |
| 25 | `tests/unit/admin-settings.test.tsx` | 441 | ANTI-PATTERN |
| 26 | `tests/unit/admin-overview.test.tsx` | 153 | ANTI-PATTERN |
| 27 | `tests/unit/admin-feedback.test.tsx` | 414 | ANTI-PATTERN |
| 28 | `tests/unit/admin-analytics.test.tsx` | 285 | ANTI-PATTERN |
| 29 | `tests/unit/admin-layout.test.tsx` | 88 | ANTI-PATTERN |
| 30 | `tests/unit/sidebar-history.test.tsx` | 54 | ANTI-PATTERN |
| 31 | `tests/unit/chat-suggestions.test.tsx` | 35 | CLEAN |
| 32 | `tests/unit/empty-state.test.tsx` | 33 | CLEAN |
| 33 | `tests/unit/loading-state.test.tsx` | 31 | CLEAN |
| 34 | `tests/unit/source-card.test.tsx` | 51 | CLEAN |
| 35 | `tests/e2e/home.spec.ts` | 12 | CLEAN |
| 36 | `tests/e2e/chat-flow.spec.ts` | 19 | CLEAN |
| 37 | `tests/e2e/admin-flow.spec.ts` | 21 | ANTI-PATTERN |
| 38 | `tests/e2e/auth-flow.spec.ts` | 11 | CLEAN |

---

## Findings Grouped by Anti-Pattern Type

### Anti-Pattern 1: Testing Mock Behavior

Assertions on mock elements (`getByTestId` on mocked components) or tests that pass/fail based on mock existence rather than real behavior.

| File | Lines | Problem | Recommendation |
|------|-------|---------|----------------|
| `tests/unit/admin-crawls.test.tsx` | 77-78 | `screen.getAllByTestId("skeleton")` — asserts on mock Skeleton component | Test real loading state via aria-busy or remove skeleton test; check actual content rendering instead |
| `tests/unit/admin-crawls.test.tsx` | 26-34, 99-101 | `getByTestId("icon-globe")`, `getByTestId("icon-play")`, etc. — asserts on mocked lucide-react icons | Remove icon-existence assertions; test label text or button presence instead |
| `tests/unit/admin-documents.test.tsx` | 38, 83-84, 211-214 | `getAllByTestId("skeleton")`, `getAllByTestId("icon-trash")`, `getByTestId("icon-externallink")` | Test via role queries or aria-labels, not mock test IDs |
| `tests/unit/admin-settings.test.tsx` | 23-31, 36-98, 101-146 | Entire mock layer for lucide-react, Card, Button, Switch, Label, Input, Separator, Badge, Select — all 30+ assertions via `getByTestId` on mock components | Replace with integration tests using real components; or test behavior (onClick, onChange) not mock DOM structure |
| `tests/unit/admin-overview.test.tsx` | 17-25, 151 | `getByTestId("icon-*")` assertions on mock icons | Remove icon assertions; test content text |
| `tests/unit/admin-feedback.test.tsx` | 16-22, 58-60, 113, 122, 353-356 | `getAllByTestId("skeleton")`, `getAllByTestId("card")`, `getByTestId("badge")` | Test via text content or roles |
| `tests/unit/admin-analytics.test.tsx` | 14-23, 38, 96-97, 103-104, 252-253, 272-273, 280-281 | `getAllByTestId("skeleton")`, `getAllByTestId("card")`, `getByTestId("badge")`, `getByTestId("separator")` | Test computed values and labels, not mock DOM structure |
| `tests/unit/admin-layout.test.tsx` | 10-18, 83-87 | `getByTestId("icon-*")` on mock icons | Test via nav link text or aria-labels |
| `tests/unit/sidebar-history.test.tsx` | 20-24, 46-53 | `getAllByTestId("mock-link")` — explicitly testing mock existence; class-name assertions on mock links | Test real Link behavior (click navigation) or remove; use role="link" queries |
| `tests/e2e/admin-flow.spec.ts` | 7-13 | Conditional assertion (`if (url.includes("/admin")) expect(url).toContain("/admin") else ...`) — test can never fail | Remove conditional; assert exactly one expected redirect URL |

### Anti-Pattern 2: Test-Only Methods in Production

No issues found. All test helpers live in test files, not production code.

### Anti-Pattern 3: Mocking Without Understanding

Mocks that break test logic by removing necessary side effects, or over-mocking "to be safe."

| File | Lines | Problem | Recommendation |
|------|-------|---------|----------------|
| `tests/unit/admin-settings.test.tsx` | 101-146 | Select mock has 40+ lines of recursive child-flattening logic to extract `<option>` values — over-engineered mock tightly coupled to component internals | Use a simpler mock that just renders `<select>` with hardcoded options, or test via real rendering |
| `tests/unit/admin-stats.test.ts` | 20-87 | `makeChain` implements actual filtering logic inside `withIndex` (lines 23-57) attempting to simulate Convex query behavior — mocking Convex's internal query engine | Use pre-computed mock results; don't reimplement Convex's query language |
| `tests/integration/rag-pipeline.test.ts` | 4-32 | `createMockCtx` prescribes exact results per `runAction` call index (result `0` = classify, `1` = rewrite, `2` = HyDE, etc.) — tightly couples test to implementation call order | Use named result maps or mock at a higher abstraction level |

### Anti-Pattern 4: Incomplete Mocks

Partial mock data structures missing fields that downstream code uses, or mock responses that don't mirror real API completeness.

| File | Lines | Problem | Recommendation |
|------|-------|---------|----------------|
| `tests/unit/admin-stats.test.ts` | 20-87 | `makeChain` omits several Convex query builder methods (`filter`, `order` return `chain` without actually applying filters/ordering). Mock returns unfiltered data. | Ensure mock preserves behavior tests depend on (e.g., filtered queries return filtered data) |

### Anti-Pattern 5: Tests as Afterthought

Implementation without tests, tests that pass without first failing, or tests that don't assert meaningful behavior.

| File | Lines | Problem | Recommendation |
|------|-------|---------|----------------|
| `tests/unit/types.test.ts` | 4-7 | Single assertion that `typeof docId === "string"` — tests TypeScript type, not runtime behavior. Adds coverage noise. | Remove; branded string typing is verified by the compiler |
| `tests/unit/messages-api.test.ts` | 4-10 | Only checks module exports exist. No behavior testing. | Add actual behavior tests for `insert` and `list`, or remove |
| `tests/unit/threads-api.test.ts` | 4-14 | Only checks module exports exist. No behavior testing. | Add actual behavior tests for CRUD operations, or remove |
| `tests/unit/document-validator.test.ts` | 1-587 | 587 lines testing validator introspection (field types, optionality, JSON serialization) — reads like auto-generated coverage. Tests object shape, not validation behavior. | Replace with snapshot test; or test actual validation: `documentValidator.parse(input)` with valid/invalid inputs |
| `tests/integration/webhook-integration.test.ts` | 5-6 | `WEBHOOK_SECRET` hardcoded at module level — leaks to other tests and hardcodes secret in source | Move to env var or `beforeEach`; only set per-test |
| `tests/load-test.ts` | 1-96 | No assertions, no CI integration, manual script. Hardcoded Convex URL (line 3). | Add env-var-only secrets, add CI smoke mode with mock response |

### Code Smell: `_handler` Casts (Cross-Cutting)

The testing plan (1.2.2) specifically calls out removing `_handler` casts via proper Convex test helpers.

| File | Lines | Usage |
|------|-------|-------|
| `tests/unit/embeddings-generate.test.ts` | 37-40, 68-73, 87-93 | `(generate as unknown as { _handler: ... })._handler(...)` |
| `tests/unit/rag-context.test.ts` | 19-29, 58-68 | `(buildContext as unknown as { _handler: ... })._handler(...)` |
| `tests/unit/feedback-submit.test.ts` | 50-54 | `(submit as unknown as { _handler: ... })._handler(...)` |
| `tests/integration/rag-pipeline.test.ts` | 66-68, 83, 116, 147, 165, 195, 212 | `(retrieveContext as any)._handler(...)` |
| `tests/integration/embeddings-integration.test.ts` | 41, 60, 80, 93, 106, 121, 134 | `(generate as any)._handler(...)` |
| `tests/integration/webhook-integration.test.ts` | 45, 65, 85, 120, 142 | `(crawlWebhook as any)._handler(...)` |

---

## Summary

| Anti-Pattern | Count | Severity |
|---|---|---|
| AP1: Testing Mock Behavior | 9 files | HIGH — admin tests assert on mock skeletons/icons, tests can't fail on real regressions |
| AP2: Test-Only Methods in Production | 0 files | None found ✓ |
| AP3: Mocking Without Understanding | 3 files | MEDIUM — over-complex mocks, call-order coupling |
| AP4: Incomplete Mocks | 1 file | LOW — minor missing query chain methods |
| AP5: Tests as Afterthought | 5 files | MEDIUM — export-only tests, auto-generated validator test, load test without assertions |
| Code Smell: `_handler` casts | 6 files | MEDIUM — documented in plan 1.2.2 for removal |
| Hardcoded secrets | 1 file | HIGH — `webhook-integration.test.ts:5` |

**Total: 24 issues across 16 test files.** 12 files are CLEAN.
