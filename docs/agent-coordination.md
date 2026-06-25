# Agent Coordination — Testing Infrastructure

**Purpose:** This document defines the boundary between the backend/testing agent and the frontend agent. Both agents operate on the same codebase and have stepped on each other's changes. Read this before making any change to `vitest.config.ts`, `tests/`, or any test file.

---

## 1. Current State (What the Testing Agent Has Done)

### 1.1 Root Cause Discovery

**Problem:** `vitest@4.1.7` hangs at startup under two conditions:

| Condition | Symptom | Root Cause |
|-----------|---------|-----------|
| `environment: "jsdom"` in vitest.config.ts | vitest hangs before any test runs | jsdom 29.1.1 incompatibility with vitest 4.1.7 on this WSL distro. The `jsdom` package is installed but hangs during initialization. |
| `resolve.alias` with a bare `__dirname` reference | vitest hangs during config resolution | vitest 4 + ESM has no `__dirname`; use absolute paths derived portably via `fileURLToPath(import.meta.url)`. **Never hard-code a machine-specific path.** |

### 1.2 Config Fixed

Current `vitest.config.ts` (verified working):

```ts
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Portable absolute paths — resolved from this config file's own location,
// so the config works on any checkout (Windows, WSL, CI) without edits.
const root = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@": `${root}src`,
      "convex/_generated/api": `${root}convex/_generated/api.js`,
    },
  },
  test: {
    environment: "node",
    globals: true,
    setupFiles: ["./tests/setup.ts"],
    exclude: ["node_modules", "dist", "tests/e2e/**/*", "tests/unit/**/*.test.tsx"],
  },
});
```

Critical details:
- `environment: "node"` — NOT jsdom. If changed to jsdom, ALL tests hang.
- `resolve.alias` — must use **absolute** paths, derived portably via `fileURLToPath(import.meta.url)` (never a hard-coded `/mnt/c/...` or another machine's home directory).
- `exclude: ["tests/unit/**/*.test.tsx"]` — 12 tsx files excluded because they need a DOM.

### 1.3 Rewritten Tests

Two test files were rewritten to avoid importing framework modules that hang:

| File | What Was Wrong | What Was Done |
|------|---------------|---------------|
| `clerk-webhook.test.ts` | Imported Next.js route handler → pulled in `next/headers` + `svix` → hung | Tests env-var logic directly; does not import any Next.js or Svix module |
| `use-local-storage.test.ts` | Used `window.localStorage` → needed jsdom → hung | Uses in-memory mock storage; works with `environment: "node"` |

**Rule:** No test in `tests/unit/` may import a Next.js route handler (anything from `src/app/api/`), `next/headers`, `next/navigation` (outside mocks), or `svix`. These pull in Next.js runtime dependencies that hang under plain vitest.

### 1.4 Passing vs Excluded Tests

> **Test counts below are a historical snapshot, not the current baseline.** Other
> docs cite different totals (`testing.md`, `architecture.md §17.3`) because they
> were captured at different points. Do not treat any hard-coded number here as the
> regression gate — derive the current count from a real `pnpm test` run.

| Group | Count | Status | Environment Needed |
|-------|-------|--------|-------------------|
| `.test.ts` files | 19 files, 282 tests | **ALL PASS** | `node` |
| `.test.tsx` files | 12 files, ~? tests | **EXCLUDED** | DOM (`happy-dom` or `jsdom`) |
| **Total** | 31 files | 19 pass, 12 excluded | — |

### 1.5 Mock Infrastructure

- `tests/setup.ts` — imports `@testing-library/jest-dom/vitest` matchers; mocks `global.fetch`
- `tests/helpers/convex-mock.ts` — `createMockConvexCtx()` with auth/scheduler/storage stubs
- Convex tests use `vi.mock("convex/_generated/server")` to expose `.handler` — the `_handler` cast pattern is DEPRECATED

---

## 2. The Vitest + jsdom Hang (Detailed)

### Why It Happens

On this WSL environment (`/mnt/c/...` on Ubuntu/Debian under WSL2), jsdom 29.1.1 hangs during init inside vitest 4.1.7. The exact mechanism:

1. vitest detects `environment: "jsdom"` and tries to set up a DOM
2. jsdom 29.1.1 initializes an HTML document, Window, etc.
3. Some combination of WSL filesystem latency + jsdom's HTML parser + vitest's worker pool causes an infinite hang
4. No timeout helps — the process never returns

**jsdom is installed** (see `package.json` devDependencies). It just does not work at runtime. `happy-dom` is expected to work because it is lighter-weight and does not use the same initialization path.

### The Fix Path

```
┌──────────────────────────────────────────────────────────────────┐
│  1. pnpm add -D happy-dom                                        │
│  2. Add // @vitest-environment happy-dom to each .tsx test file  │
│  3. Remove "tests/unit/**/*.test.tsx" from vitest.config.ts exclude  │
│  4. pnpm test → 294 tests should all pass                       │
└──────────────────────────────────────────────────────────────────┘
```

**Do NOT skip step 1 and do step 3.** Without happy-dom, un-excluding tsx files will cause hangs (they try to render React which needs a DOM).

---

## 3. What the Frontend Agent Must NOT Do

### BLOCKED — Config Changes That Break Everything

| Action | Consequence |
|--------|------------|
| Change `environment: "node"` to `environment: "jsdom"` | ALL 282 passing tests hang |
| Use `path.resolve(__dirname, ...)` in vitest.config.ts `resolve.alias` | ALL tests hang |
| Delete `tests/setup.ts` | 282 tests fail (missing jest-dom matchers, undefined `fetch`) |
| Delete `tests/helpers/convex-mock.ts` | All Convex tests fail |
| Remove the exclude pattern without installing happy-dom first | tsx tests hang |
| Re-introduce `_handler` casts in Convex tests | Deprecated pattern; use `vi.mock("convex/_generated/server")` instead |

### BLOCKED — Import Patterns That Hang

| Import | Where It Hangs | Safe Alternative |
|--------|---------------|-----------------|
| `import handler from "@/app/api/chat/route"` | Pulls `next/headers`, `next/server`, `ai/sdk` | Test the logic function directly, not the route handler |
| `import { POST } from "@/app/api/clerk/webhook"` | Pulls `svix` | Test env-var logic directly |
| `import "next/headers"` | Requires Next.js runtime | Never import in unit tests |
| `import "svix"` | Requires network/WebAssembly | Mock at module boundary |

### BLOCKED — Direct Edits to These Files

| File | Why | Who Owns It |
|------|-----|------------|
| `vitest.config.ts` | Single point of failure for all 282 passing tests | **Coordination required** |
| `tests/setup.ts` | Global test setup | Do not delete |
| `tests/helpers/convex-mock.ts` | Convex mock factory | Do not delete |
| `tests/unit/clerk-webhook.test.ts` | Rewritten to avoid Next.js/Svix | Do not revert to old pattern |
| `tests/unit/use-local-storage.test.ts` | Rewritten to avoid jsdom | Do not revert to jsdom-dependent |

---

## 4. What the Frontend Agent SHOULD Do

### 4.1 Install happy-dom (Step 1, always first)

```bash
pnpm add -D happy-dom
```

Verify with `pnpm ls happy-dom` before proceeding.

### 4.2 Add Per-File Environment Annotation

For each of the 12 `.tsx` test files, add this as the **first line**:

```ts
// @vitest-environment happy-dom
```

The 12 files:
- `tests/unit/admin-analytics.test.tsx`
- `tests/unit/admin-crawls.test.tsx`
- `tests/unit/admin-documents.test.tsx`
- `tests/unit/admin-feedback.test.tsx`
- `tests/unit/admin-layout.test.tsx`
- `tests/unit/admin-overview.test.tsx`
- `tests/unit/admin-settings.test.tsx`
- `tests/unit/chat-suggestions.test.tsx`
- `tests/unit/empty-state.test.tsx`
- `tests/unit/loading-state.test.tsx`
- `tests/unit/sidebar-history.test.tsx`
- `tests/unit/source-card.test.tsx`

### 4.3 Remove the TSX Exclude

In `vitest.config.ts`, change:

```ts
exclude: ["node_modules", "dist", "tests/e2e/**/*", "tests/unit/**/*.test.tsx"],
```

To:

```ts
exclude: ["node_modules", "dist", "tests/e2e/**/*"],
```

### 4.4 Run All Tests

```bash
pnpm test
```

Expected: **294 tests pass** (282 existing + 12 tsx files' tests).

### 4.5 Fix Admin Test Anti-Patterns (High Priority)

The 9 admin `.tsx` test files have a known anti-pattern documented in `testing.md` Phase 10:

**The Problem:** Tests assert on **mock existence** instead of **component behavior**.

```tsx
// BAD — tests mock existence, not real component behavior
vi.mock("lucide-react", () => ({
  TrendingUp: () => <div data-testid="icon-trending-up">TrendingUp</div>,
}));
expect(screen.getByTestId("icon-trending-up")).toBeDefined();  // ← passes even if the component is broken
```

**The Fix:** Test real behavior:

```tsx
expect(screen.getByText("45")).toBeDefined();  // ← proves the component actually renders the data
```

Files to fix:
| File | Anti-Pattern | Fix Strategy |
|------|-------------|-------------|
| `admin-crawls.test.tsx` | `getByTestId("skeleton")` | Test `aria-busy` or actual content |
| `admin-documents.test.tsx` | `getAllByTestId("skeleton")` | Test `aria-busy` |
| `admin-settings.test.tsx` | Mock-icon assertions | Test text content or behavior |
| `admin-overview.test.tsx` | Icon assertions | Test content text |
| `admin-feedback.test.tsx` | `getByTestId("card")`, `getByTestId("icon-*")` | Test via text content |
| `admin-analytics.test.tsx` | `getByTestId("skeleton")`, icon assertions | Test computed values |
| `admin-layout.test.tsx` | `getByTestId("icon-*")` | Test nav link text |
| `sidebar-history.test.tsx` | Mock-list assertions | Test real link behavior |
| `loading-state.test.tsx` | `getByTestId("skeleton")` | Test `aria-busy` |

### 4.6 Write Real Frontend Component Tests

After fixing anti-patterns, write real tests for these components (see `testing.md` Phase 4):

| Priority | Component | What to Test |
|----------|-----------|-------------|
| P1 | `ChatWindow` | Loading, empty, messages, error states |
| P1 | `ChatMessageBubble` | User vs assistant styling, markdown, sources |
| P1 | `ChatInput` | Text entry, submit, disabled while streaming |
| P2 | `SidebarHistory` | Thread list, empty, loading, search |
| P2 | `ThemeToggle` | Light/dark toggle, persistence |
| P3 | `ErrorBoundary` | Catches errors, shows fallback |

Each test file must start with `// @vitest-environment happy-dom`.

### 4.7 Pattern for Mocking Next.js in TSX Tests

The 12 existing `.tsx` test files already use this pattern — preserve it:

```tsx
// Mock next/navigation (not next/headers — that hangs)
vi.mock("next/navigation", () => ({
  usePathname: vi.fn(() => "/admin"),
  useRouter: vi.fn(() => ({ refresh: vi.fn() })),
}));

// Mock convex/react (never import real convex/react in vitest)
vi.mock("convex/react", () => ({
  useQuery: vi.fn(),
  useMutation: vi.fn(),
}));
```

**Never mock `next/headers`** — importing it in mock or real code causes a hang.

---

## 5. Summary: Agent Boundary Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                    YOUR PROJECT ROOT                                 │
│                                                                     │
│  vitest.config.ts  ←── LOCKED (both agents coordinate)              │
│  tests/setup.ts    ←── LOCKED (do not delete)                       │
│  tests/helpers/    ←── LOCKED (do not delete)                       │
│                                                                     │
│  ┌─────────────────────┐    ┌─────────────────────────────────────┐ │
│  │  BACKEND/TEST AGENT  │    │        FRONTEND AGENT              │ │
│  │                      │    │                                     │ │
│  │  convex/             │    │  src/app/*.tsx                     │ │
│  │  convex/crawl/       │    │  src/components/*.tsx              │ │
│  │  convex/rag/         │    │  src/lib/*.ts                      │ │
│  │  convex/cache/       │    │                                    │ │
│  │  convex/auth/        │    │  tests/unit/*.test.tsx (12 FILES)  │ │
│  │  convex/embeddings/  │    │    ─ add happy-dom env annotation  │ │
│  │  convex/threads/     │    │    ─ fix anti-patterns             │ │
│  │  convex/faq/         │    │    ─ write new component tests     │ │
│  │                      │    │                                     │ │
│  │  tests/convex/       │    │  tests/e2e/ (Playwright)           │ │
│  │  tests/integration/  │    │                                     │ │
│  │  tests/helpers/      │    │                                     │ │
│  │                      │    │                                     │ │
│  │  tests/unit/*.ts     │    │                                     │ │
│  │  (19 files, 282 pass)│    │                                     │ │
│  └─────────────────────┘    └─────────────────────────────────────┘ │
│                                                                     │
│  SHARED (coordinate before touching):                               │
│    - vitest.config.ts                                               │
│    - package.json (adding deps like happy-dom)                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 6. Quick Reference: Common Mistakes

| Mistake | Why It's Wrong | Fix |
|---------|---------------|-----|
| `pnpm add -D jsdom` | Already installed; installing again doesn't fix the hang | Use happy-dom instead |
| `environment: "jsdom"` | Hangs at startup | Use `environment: "node"` globally + per-file `// @vitest-environment happy-dom` for tsx |
| A bare `__dirname` reference in alias | Not defined under ESM; breaks config resolution | Derive an absolute path with `fileURLToPath(new URL(".", import.meta.url))` |
| `vi.mock("next/headers")` | Importing `next/headers` at all (even in mock factory) hangs | Remove the import entirely |
| `import { POST } from "@/app/api/..."` in unit test | Pulls Next.js route dependencies that hang | Test the logic function directly |
| `getByTestId("skeleton")` | Tests mock existence, not component behavior | Test `aria-busy` or actual rendered content |
| `getByTestId("icon-*")` | Tests mock icon rendering, not real behavior | Test label text or button role instead |
| Removing tsx exclude without happy-dom | tsx tests hang at import time | Install happy-dom first, add per-file annotations, `then` remove exclude |

---

## 7. Verification Checklist

Before claiming any testing work is complete:

```
□ pnpm test runs without hanging
□ All 294 tests pass (282 .ts + 12 .tsx)
□ All 12 .tsx files have // @vitest-environment happy-dom as first line
□ vitest.config.ts still has environment: "node"
□ vitest.config.ts still uses absolute string paths (no __dirname)
□ No test file imports next/headers, next/server, svix, or Next.js route handlers
□ No test file re-introduces _handler casts
□ No test file uses getByTestId for skeleton/icon mocks (if anti-patterns fixed)
```
