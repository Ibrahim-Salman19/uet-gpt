# Phase 0–1 Verify & Align Design

**Goal:** Verify and fill gaps in Phase 0 scaffolding and Phase 1 schema alignment for `uet-gpt`, strictly following `todo.md` and Path A (strict free tier) constraints.

**Scope:**
- In scope: Phase 0 verification + gap fixes, Phase 1 schema alignment to Convex components.
- Out of scope: Phase 2+ crawling, RAG pipeline features, UI wiring beyond necessary schema/function alignment.

---

## Context Summary (Current State)

- Next.js 16.2 + strict TS configured (`tsconfig.json`).
- Biome configured; ESLint present.
- Convex initialized; `convex.config.ts` registers `@convex-dev/rag` and `@convex-dev/agent` components.
- `src/components/providers.tsx` wraps Clerk + Convex + Theme.
- Tailwind v4 is configured via `globals.css` and PostCSS plugin, but **no `tailwind.config.ts` exists**.
- Schema currently defines `documents`, `chunks`, `threads`, `messages` manually (conflicts with component‑managed rule).
- HTTP chat action exists (`convex/http.ts`) and uses AI SDK streaming.
- Missing Phase 0 deliverables: docs set (`docs/architecture.md`, `docs/crawling-strategy.md`, `docs/chunking-strategy.md`, `docs/embedding-strategy.md`, `docs/rag-pipeline.md`, `docs/evaluation.md`, `docs/security.md`, `docs/deployment.md`), scripts (`scripts/seed.ts`, `scripts/validate-urls.ts`, `scripts/migrate-schema.ts`), workflows (`.github/workflows/ci.yml`, `.github/workflows/deploy.yml`), robots.txt audit, Clerk webhook route.

---

## Design Decisions

### D1 — Path A Free‑Tier Constraints
- All rate limits and fallbacks assume **Groq free tier (no card)**.
- Binding constraint: **1,000 RPD** on Groq Scout/70B.
- Semantic cache is mandatory; degrade gracefully on rate limits.

### D2 — Schema: Component‑Managed Tables
- `documents` + `chunks` are **owned by `@convex-dev/rag`**.
- `threads` + `messages` are **owned by `@convex-dev/agent`**.
- No manual definitions or indexes for those tables in `convex/schema.ts`.
- Extend with custom fields via component configuration only.

### D3 — Vector Search in Actions Only
- All calls to `ctx.vectorSearch` remain in **actions** only.
- Queries use `searchIndex` where applicable; cross‑table enrichment via internal queries.

### D4 — Providers Pattern
- Existing provider wrapper (`src/components/providers.tsx`) is retained.
- If `src/providers/*` is required by the todo, introduce thin wrappers that delegate to existing provider component to avoid duplication.

---

## Phase 0: Verification + Gap Fix Strategy

### 0.1 Project Initialization
- Verify installed dependencies and scripts match the todo list.
- Add missing dev dependency: `convex-test`.

### 0.1.4 Tailwind v4 Config
- Create `tailwind.config.ts` with UET brand colors and `darkMode: "class"`.
- Ensure tokens align with `globals.css` variables.

### 0.1.7 Next.js Config
- Add `redirects()` to route `/` → `/chat`.
- Add `headers()` with CSP/CORS/security headers.
- Add `output: "standalone"`.

### 0.1.12 Robots Audit
- Fetch `https://web.uettaxila.edu.pk/robots.txt`.
- Document allow/disallow rules in `docs/crawl-robots-audit.md`.
- Reconcile include/exclude patterns with the audit.

### 0.1.13 Docs Scaffolding
- Add documentation files required by the todo:
  - `docs/architecture.md`
  - `docs/crawling-strategy.md`
  - `docs/chunking-strategy.md`
  - `docs/embedding-strategy.md`
  - `docs/rag-pipeline.md`
  - `docs/evaluation.md`
  - `docs/security.md`
  - `docs/deployment.md`

### 0.1.14 Scripts Scaffolding
- Add script stubs required by the todo:
  - `scripts/seed.ts`
  - `scripts/validate-urls.ts`
  - `scripts/migrate-schema.ts`

### 0.1.15 CI/CD Workflows
- Add workflow files required by the todo:
  - `.github/workflows/ci.yml`
  - `.github/workflows/deploy.yml`

### 0.2 shadcn/ui
- Verify `components.json` matches todo choices (Tailwind v4, CSS variables, neutral scale).
- Install missing shadcn components if any are absent.

### 0.3 Convex Setup
- Confirm `convex/auth.config.ts` matches Clerk JWT issuer.
- Create missing `convex/auth.ts` helpers if required by todo.
- Ensure Convex client wiring uses `NEXT_PUBLIC_CONVEX_URL`.

### 0.4 Clerk Auth Setup
- Add Clerk webhook route under `src/app/api/webhooks/clerk/route.ts`.
- Ensure middleware route protection matches todo.

---

## Phase 1: Schema Alignment

### 1.0 Component Alignment
- Remove manual definitions for `documents`, `chunks`, `threads`, `messages` in `convex/schema.ts`.
- Move any custom fields for those tables into component config as supported by `@convex-dev/rag` and `@convex-dev/agent`.

### 1.1 Non‑Component Tables
- Keep `users`, `feedback`, `crawlJobs`, `semanticCache`, `adminAuditLog`, `notifications` with required indexes.
- Confirm vector index dimensions are **768** and stored as `v.array(v.float64())`.

### 1.2 Function Alignment
- Refactor Convex functions that insert/list threads/messages to use component APIs where applicable.
- Ensure search logic stays in actions and queries are free of vector calls.

---

## Error Handling & Safety

- Missing API keys must return explicit, user‑friendly responses.
- Embedding failures should fall back to empty vector; skip vector search in that case.
- Cache lookups must respect TTL and similarity threshold.

---

## Verification Gates

After **each** discrete step:

```
pnpm run typecheck && pnpm run lint && pnpm vitest --run && npx next build
```

No step proceeds without a passing verification run.

---

## Risks & Mitigations

- **Schema mismatch with components**: Remove manual tables and use component configs.
- **Rate‑limit exhaustion**: enforce semantic cache and fallback chain.
- **Vector search misuse**: keep vector search in actions only.
- **Missing Tailwind config**: add `tailwind.config.ts` to formalize tokens.

---

## Out of Scope

- Crawl pipeline, chunking logic, embeddings, or RAG evaluation (Phase 2+).
- UI feature wiring beyond necessary provider alignment.
