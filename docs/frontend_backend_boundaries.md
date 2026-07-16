# Frontend / Backend Boundary Guidelines

**Purpose:** Define the line between `src/` (Next.js frontend) and `convex/` (Convex backend) so the two agents never duplicate, contradict, or leak responsibilities into each other.

> **Single Source of Truth for code organisation:** `architecture.md` §3 (Directory Structure) and §5–§7 (RAG, Crawl, Security).
> **Single Source of Truth for runtime contract:** generated types in `convex/_generated/`.
> If this file ever contradicts `architecture.md`, treat `architecture.md` as authoritative and update this file.

---

## 1. Ownership Map - Who Owns What

### 1.1 Backend (`convex/`) - Owned by the Backend Agent

| Concern | File(s) | Notes |
|---|---|---|
| Database schema, indexes, vector indexes | `convex/schema.ts` | **Sacred - filter field names on `vectorIndex` and `embeddingDimension` are FORBIDDEN to change.** |
| Queries, mutations, actions | `convex/**/*.ts` | All public surface lives behind generated `api`/`internal` |
| Cron jobs | `convex/crons.ts` | 7 scheduled jobs; cron bodies are pure Convex |
| HTTP actions (webhooks) | `convex/http.ts`, `convex/crawl/webhook.ts` | HMAC + bearer auth are FORBIDDEN to weaken |
| Auth helpers | `convex/auth.ts`, `convex/auth.config.ts` | `getUserId`, `isAuthenticated`, `isAdmin`, `requireAuth`, `requireAdmin` |
| RBAC enforcement on data | every mutation/query | `await requireAdmin(ctx)` or `requireAuth(ctx)` first thing |
| Rate limiting (Convex side) | `convex/rateLimit.ts` (`rateLimits` table) | 10 msg/user/min, 100K tokens global/min |
| RAG orchestration | `convex/rag/**` | `instance.ts` (768d), `retrieval.ts` (orchestrator), `routing.ts`, `context.ts`, `prompts.ts` |
| Embedding generation | `convex/embeddings/generate.ts` | Gemini `gemini-embedding-2` (768d) only - no other model |
| Search / reranking | `convex/embeddings/search.ts`, `convex/reranking/rerank.ts` | RRF (k=60), FlashRank rerank (topK=4) |
| Cache get/set/cleanup | `convex/cache/**` | Cosine threshold `0.92` from `convex/constants.ts` |
| Crawl pipeline | `convex/crawl/**` | Webhook + mutations + actions + workpools + workflow |
| Component configuration | `convex/convex.config.ts` | rag, agent, workpool (2), workflow |
| Feedback, threads, messages, users, FAQ, settings | `convex/feedback/**`, `convex/threads.ts`, `convex/messages.ts`, `convex/users.ts`, `convex/faq.ts`, `convex/admin/**` | |
| Emergency stop | `convex/emergencyStop.ts` | Draining in-flight jobs |

### 1.2 Frontend (`src/`) - Owned by the Frontend Agent

| Concern | File(s) | Notes |
|---|---|---|
| Pages & routing | `src/app/**` | App Router (`(main)`, `admin`, `api`, `sign-in`, `sign-up`, `unauthorized`) |
| React components | `src/components/**` | `chat/`, `sidebar/`, `auth/`, `shared/`, `ui/`, `markdown.tsx`, `providers.tsx` |
| Client state & data hooks | `src/hooks/**` | `use-chat.ts`, `use-messages.ts`, `use-threads.ts`, `use-admin.ts`, `use-sources.ts`, `use-stable-query.ts` |
| Public types (no Convex-specific types) | `src/lib/types.ts` | Mirrors backend validators as plain TS interfaces |
| Design tokens, App constants | `src/lib/constants.ts` | `UET_CRAWL_CONFIG`, `UET_COLORS`, `SPACING`, `ELEVATION`, `DURATION` |
| Frontend utilities | `src/lib/utils.ts`, `analytics.ts`, `retry.ts` | |
| Clerk client glue | `src/lib/auth.ts`, `src/lib/clerk-claims.ts`, `src/lib/clerk-theme.ts` | Server-side Clerk helpers only |
| Upstash Redis rate-limit client | `src/lib/rate-limit.ts` | Used **only** in `src/app/api/**` routes, not inside Convex |
| Convex client wiring | `src/lib/convex.ts`, `src/components/providers.tsx` | |
| Middleware (route protection, CSP) | `src/middleware.ts` | `clerkMiddleware` + per-request CSP nonce |
| API routes (Next.js, not Convex HTTP) | `src/app/api/**` | `/api/chat` streams LLM, `/api/cron` proxies to Convex, `/api/webhooks/clerk` ingests Clerk events |
| LLM model fallback chain | `src/lib/llm-models.ts` | `LLM_FALLBACK_CHAIN` (Groq → Cerebras → Groq → Gemini) - frontend owns which SDK to call |
| LLM streaming, prompt assembly | `src/app/api/chat/route.ts` | The actual `streamText` happens here, never inside Convex |
| Sentry instrumentation | `src/instrumentation.ts`, `sentry.*.config.ts` | |
| Next config (headers, redirects, image hosts) | `next.config.ts` | |

### 1.3 Shared (read-only, both sides reference)

| File | Owner | What both sides may read | What neither side may mutate |
|---|---|---|---|
| `convex/_generated/api.d.ts` | Convex codegen (never hand-edit) | `api.<module>.<func>` and `internal.<module>.<func>` references | Anything |
| `convex/_generated/dataModel.d.ts` | Convex codegen | `Doc<"table">`, `Id<"table">` types | Anything |
| `convex/_generated/server.d.ts` | Convex codegen | `query`, `mutation`, `action`, `internalMutation`, etc. | Anything |
| `convex/constants.ts` (`CACHE_SIMILARITY_THRESHOLD = 0.92`) | Backend | `src/lib/constants.ts` re-exports it for read-only display | Do not split into a frontend copy with a different value |
| `architecture.md` | Both (must read first) | | Treat as authoritative |

---

## 2. The Line - What Each Side May NEVER Do

### 2.1 The Frontend Agent Must NOT

| # | Forbidden | Reason |
|---|---|---|
| F-1 | Import from `convex/values`, `convex/server`, `convex/_generated/server`, or any non-API/internal generated module in client-shipped code | These are server-only Convex Isolate APIs - bundling them crashes the client. Use only `api` from `_generated/api`. |
| F-2 | Call `ctx.db.*`, `ctx.runQuery`, `ctx.runMutation`, `ctx.vectorSearch`, `ctx.auth.getUserIdentity`, or any Convex `ctx` API from anywhere in `src/` | These APIs exist only inside Convex functions. The frontend must use `useQuery` / `useMutation` / `ConvexHttpClient` or call the Next.js API routes. |
| F-3 | Define new tables or add fields to `convex/schema.ts` | Schema is backend-owned. If a UI change needs new data, **ask the backend agent** to add it. |
| F-4 | Run embeddings, vector search, or RAG orchestration | All of this is in `convex/rag/**` and `convex/embeddings/**`. The frontend only calls `api.rag.retrieval.retrieveContext`. |
| F-5 | Call LLM providers (`@ai-sdk/groq`, `@ai-sdk/google`, `@ai-sdk/cerebras`) from any component or non-API code | LLM streaming is centralised in `src/app/api/chat/route.ts` so the fallback chain, source headers, and cache write live in one place. |
| F-6 | Write directly to `semanticCache` | Reads happen through the Convex action. The Next.js chat route only triggers a cache write via `api.cache.set.set` after streaming completes. |
| F-7 | Sign webhook payloads (HMAC, Svix) anywhere other than the dedicated route file | Webhook verification belongs to one file per webhook: `convex/crawl/webhook.ts` for crawl/ingest/reset, `src/app/api/webhooks/clerk/route.ts` for Clerk. |
| F-8 | Bypass middleware or `requireAuth` / `requireAdmin` | Auth checks must happen at **every** backend entry point and on every Next.js API route that touches user data. Never trust the client UI alone. |
| F-9 | Duplicate the LLM fallback chain, RRF config, or RAG pipeline stages in frontend code | Single source: `src/lib/llm-models.ts` for SDKs, `convex/rag/retrieval.ts` for the pipeline. If a new provider is added, edit one file. |
| F-10 | Use `process.env.*` for secrets in any client-shipped file | Only `NEXT_PUBLIC_*` env vars reach the browser. Server secrets (`GROQ_API_KEY`, `GEMINI_API_KEY`, `CRAWL_WEBHOOK_SECRET`, `CONVEX_AUTH_TOKEN`, `CRON_SECRET`, `UPSTASH_REDIS_REST_TOKEN`, `CLERK_SIGNING_SECRET`, `RERANKER_URL`) must live in `src/app/api/**` or `src/middleware.ts`. |
| F-11 | Reimplement rate limiting logic | Two implementations exist on purpose: Convex `enforceRateLimit` for in-mutation limits (`convex/rateLimit.ts`), Upstash sliding window for HTTP API limits (`src/lib/rate-limit.ts`). Pick the one whose boundary you're inside. Do not roll a third. |
| F-12 | Add new HTTP routes to `convex/http.ts` | That's backend territory. Frontend HTTP entry points live under `src/app/api/`. |

### 2.2 The Backend Agent Must NOT

| # | Forbidden | Reason |
|---|---|---|
| B-1 | Import from `next/*`, `next/server`, `@clerk/nextjs`, or anything from `src/app` or `src/components` | Convex functions run in V8 Isolate or Node, not in the Next.js runtime. Cross-boundary imports break deployment. |
| B-2 | Use the `ai` SDK's `streamText` / `generateText` directly inside a Convex action for the user-facing chat | Streaming + headers + cache write are coordinated in `src/app/api/chat/route.ts`. Convex provides retrieval + cache lookup only. (Exception: the LLM calls in `convex/crawl/webhook.ts` for chunk contextualisation - those are for embedding, not user chat.) |
| B-3 | Validate a Clerk session by calling `auth()` from `@clerk/nextjs` | Use `ctx.auth.getUserIdentity()` plus the helpers in `convex/auth.ts`. Clerk JWT validation is wired via `convex/auth.config.ts`. |
| B-4 | Use Upstash Redis | That's the frontend's HTTP-API rate-limit store. Inside Convex, the `rateLimits` table is the only rate-limit source. |
| B-5 | Mutate the `threads` or `messages` tables directly | They are owned by the `@convex-dev/agent` component. Always go through `components.agent.threads.*` and `components.agent.messages.*`. |
| B-6 | Call `fetch` to the Next.js app, the Convex HTTP actions, or any internal Convex URL | The HTTP action surface is `convex/http.ts`. Anything else is a circular boundary. |
| B-7 | Change `embeddingDimension` or `filterNames` on the RAG instance | Mismatched dimensions silently break every cached embedding and every live query. |
| B-8 | Remove or weaken the HMAC timestamp+signature guard in `convex/crawl/webhook.ts`, the Svix verification in `src/app/api/webhooks/clerk/route.ts`, the Bearer-token check in `crawl/ingest` and `crawl/reset`, or the `convex/http.ts` startup guard that requires at least one of `CONVEX_AUTH_TOKEN` / `CRAWL_WEBHOOK_SECRET` | Any of these is a security boundary. Removing them is a P0 incident. |
| B-9 | Emit UI markup (JSX, HTML strings) from a Convex function | Convex returns plain data. Render on the frontend. |
| B-10 | Store provider secrets in `convex/schema.ts`, hard-coded constants, or string literals | All secrets come from `process.env`. The `convex/http.ts` startup throws if neither webhook secret is set - do not turn that off. |
| B-11 | Write to `users.preferences.model` from anywhere except the user's own session | The user picks the model; the chat route reads it. No cross-user write. |
| B-12 | Add new environment variables without listing them in `architecture.md` §8.2 and updating `.env.example` | If a feature needs a new secret, both docs move together. |

### 2.3 Both Sides Must NOT (shared taboos)

| # | Forbidden |
|---|---|
| X-1 | Edit anything inside `convex/_generated/**`. It is regenerated by `npx convex dev`. |
| X-2 | Duplicate an enum/string union across the boundary. Define it in one place: `convex/schema.ts` (Convex validators) and `src/lib/types.ts` (plain TS). Update both only when the contract genuinely changes. |
| X-3 | Bypass `convex/auth.ts` to fetch a user. The helpers exist so role checks stay consistent. |
| X-4 | Skip `architecture.md` updates when changing the public surface. A change not in `architecture.md` did not happen. |
| X-5 | Commit directly to `main` / `master`. Use a branch like `agent/YYYY-MM-DD-<topic>`. |
| X-6 | Run `pnpm install` from WSL on the shared directory. Windows owns `node_modules` (see architecture §17). |
| X-7 | Add an npm dependency without checking it exists in the existing `package.json` and is not already declared elsewhere with a conflicting version. |

---

## 3. Contract Rules - How the Two Sides Talk

### 3.1 The only legal ways for `src/` to reach `convex/`

1. **`useQuery(api.x.y, args)` / `useMutation(api.x.y)` / `useAction(api.x.y)`** - reactive client glue. Generated `api` is the only legal import path. (`src/hooks/use-admin.ts`, `src/hooks/use-messages.ts`, etc.)
2. **`ConvexHttpClient` (`src/lib/convex.ts`)** - server-side, in Next.js API routes, when you need to call Convex from a route handler that itself is invoked via HTTP. (`src/app/api/cron/route.ts`, `src/app/api/webhooks/clerk/route.ts`, `src/app/api/chat/route.ts`.)
3. **Convex HTTP webhooks** (`/api/webhook/crawl`, `/ingest`, `/api/reset`) - server-to-server only. Never call these from a browser.
4. **Internal cross-table Convex calls** - only inside `convex/`, via `internal.<module>.<func>` (e.g. `internal.cache.internal_queries.getCacheEntry`). Never expose `internal.*` to the frontend.

### 3.2 The only legal ways for `convex/` to reach `src/`-side concerns

1. **Auth identity** - Convex reads `ctx.auth.getUserIdentity()` which is populated from the Clerk JWT validated by `convex/auth.config.ts`. There is no other auth channel.
2. **Component APIs** - Convex uses `components.agent.*` and `components.rag.*`. The agent component is the only writer for `threads` and `messages`.
3. **External services** - Groq, Cerebras, Google (Gemini), and the reranker endpoint are called from Convex actions where they belong (`convex/rag/routing.ts`, `convex/embeddings/generate.ts`, `convex/reranking/rerank.ts`). The Next.js chat route calls Groq/Cerebras/Google directly for streaming - these two sets of LLM calls do not overlap and must not.

### 3.3 Public API contract checklist (use this when adding a new function)

When the backend agent adds a new `query`, `mutation`, or `action`:

- [ ] `args` are declared with `v.*` validators (no `v.any` except where data is genuinely dynamic, with a comment).
- [ ] `returns` is declared (never omit).
- [ ] Auth is enforced: either call `requireAuth` / `requireAdmin` or document why a public function is safe to be unauthenticated.
- [ ] If the function is exposed to the browser, the frontend agent is informed so the hook / call site is added.
- [ ] If the function is internal-only, mark it `internalQuery` / `internalMutation` / `internalAction` and reach it through `internal.<module>.<func>`.
- [ ] Error handling: throw `ConvexError("…")` for user-visible failures; let unexpected errors bubble.
- [ ] The new function is referenced in `architecture.md` if it changes the public surface.

When the frontend agent adds a new call to Convex:

- [ ] The hook / call site imports only `api` from `convex/_generated/api`.
- [ ] All arg keys are exactly the validator names. (The linter will catch a mismatch - do not bypass it with `as any`.)
- [ ] The UI handles `undefined` (loading) and the `ConvexError` rejection (failure) states.
- [ ] If the call may return data the UI must render but the schema doesn't cover, **ask the backend agent** to add the field - never widen a returned value client-side.

### 3.4 Type mirroring rules

- `convex/schema.ts` is authoritative for shapes. The `v.*` validators there are the contract.
- `src/lib/types.ts` mirrors the **publicly visible** subset (e.g. `Source`, `ChatMessage`, `Thread`) as plain TypeScript interfaces. Do not import Convex `Doc<>` types into `src/` - they leak `Id<"…">` strings and confuse the bundler.
- If `convex/messages/validator.ts` (the `messageValidator`, `sourcesValidator`, `tokenCountValidator`) changes, regenerate the mirrors in `src/lib/types.ts` in the same PR.

### 3.5 Auth boundary matrix (who checks what, where)

| Route / Function | Layer that enforces auth | How |
|---|---|---|
| `/`, `/chat`, `/explore`, `/settings` | `src/middleware.ts` | `clerkMiddleware` + `auth.protect()` |
| `/admin/*`, `/api/admin/*` | `src/middleware.ts` | `clerkMiddleware` + admin role (UI guard) |
| `/api/chat` | `src/app/api/chat/route.ts` | `const { userId } = await auth()` then 401 on null |
| `/api/cron` | `src/app/api/cron/route.ts` | `CRON_SECRET` Bearer header or `?cron_secret=` |
| `/api/webhooks/clerk` | `src/app/api/webhooks/clerk/route.ts` | Svix signature via `svix` |
| `/api/webhooks/convex*` (none today) | n/a | - |
| `/ingest` (Convex) | `convex/crawl/webhook.ts` | `Authorization: Bearer CONVEX_AUTH_TOKEN` |
| `/api/webhook/crawl` (Convex) | `convex/crawl/webhook.ts` | HMAC-SHA256 + 5-minute timestamp skew |
| `/api/reset` (Convex) | `convex/crawl/webhook.ts` | `Authorization: Bearer CONVEX_AUTH_TOKEN` |
| All Convex queries / mutations | `convex/auth.ts` helpers | `requireAuth(ctx)` / `requireAdmin(ctx)` / `ctx.auth.getUserIdentity()` |
| `/api/webhooks/crawl` (Convex) | `convex/crawl/webhook.ts` | HMAC-SHA256 + timestamp |

**Rule:** every row above must be enforced. Removing a check to "make the test pass" is a P0.

---

## 4. Data Flow Reference

### 4.1 Chat flow (the most important boundary in the app)

```
Browser                          Next.js                              Convex
───────                          ────────                             ──────
useChat.sendMessage()
  └─ convex.mutation(api.users.getOrCreate)  ───────────────────────►  users.getOrCreate
  └─ convex.query  (api.messages.list)        ───────────────────────►  messages.list
  └─ fetch /api/chat POST  ────────────────►
                                    check auth, CSRF, body size
                                    check rate limit (Upstash)
                                    ConvexHttpClient.action(api.rag.retrieval.retrieveContext)
                                                                      ─► rag.retrieval.retrieveContext
                                                                         ├─► routing.classifyQueryAction
                                                                         ├─► routing.rewriteQueryAction
                                                                         ├─► routing.hydeQueryAction
                                                                         ├─► embeddings.generate.generate
                                                                         ├─► cache.get.get
                                                                         ├─► embeddings.search.searchDocumentsAction
                                                                         ├─► reranking.rerank.rerank
                                                                         └─► rag.context.buildContext
                                    ConvexHttpClient.query(api.users.getByClerkId)
                                                                      ─► users.getByClerkId
                                    streamText(LLM_FALLBACK_CHAIN)  ◄────  (LLM is called from Next.js, NOT Convex)
                                    stream SSE back
  └─ reader.read() ◄────────────────
  └─ convex.mutation(api.messages.insert)   ────────────────────────►  messages.insert
                                                                          (enforces rate limit via
                                                                           convex/rateLimit.ts)
                                    after(): cache.set.set (async)  ───►  cache.set.set
```

Key boundary points:
1. **LLM call lives in `src/app/api/chat/route.ts`**, not Convex. Convex only does retrieval + cache lookup.
2. **Cache write** happens in Next.js (`after()` callback) - but uses the Convex `cache.set.set` action.
3. **Rate limit is enforced twice**: Upstash in the API route, Convex `enforceRateLimit` in `messages.insert`. They protect different layers.
4. **`useChat.handleSend` is the only place** that calls `fetch /api/chat`. Do not duplicate this fetch elsewhere.

### 4.2 Crawl flow (backend-internal)

```
Python crawler (scripts/crawler.py)
  └─ POST /ingest  ──►  ingestWebhook (Bearer CONVEX_AUTH_TOKEN)
                          └─ internal.crawl.mutations.upsertDocument
                          └─ chunkMarkdown, normalizeContent, contextual summary
                          └─ internal.crawl.mutations.enqueueDocumentChunks
                              └─ workpool.embeddingWorkpool
                                  └─ convex/crawl/actions.ts:embedSingleChunk
                                      └─ rag.add (768d)
                                      └─ internal.crawl.mutations.saveEmbedding

External crawl4AI service
  └─ POST /api/webhook/crawl  ──►  crawlWebhook (HMAC)
                                     └─ (same workpool path as above)
```

The frontend never participates in crawl ingestion.

### 4.3 Admin dashboard (frontend → Convex, no middleware components)

```
/admin/*
  └─ clerkMiddleware (auth + role)        ── src/middleware.ts
  └─ useAdminStats()                       ── src/hooks/use-admin.ts
       └─ useQuery(api.admin.stats.dashboardStats, {})   ◄── requires admin in Convex
       └─ useAdminCrawl() / triggerCrawl   ── api.crawl.trigger (admin-guarded)
       └─ useAdminDocuments() / delete      ── api.admin.stats.deleteDocument
       └─ useAdminFeedback()                ── api.feedback.list, api.admin.stats.deleteFeedback
```

**Invariant:** the Convex query/mutation is the authoritative gate. The middleware UI check is cosmetic - the Convex function must independently call `requireAdmin(ctx)` and throw on failure.

---

## 5. Cross-Cutting Concerns

### 5.1 Environment Variables (who reads what)

| Env var | Read by | Never read by |
|---|---|---|
| `NEXT_PUBLIC_CONVEX_URL` | Frontend (browser), `src/lib/convex.ts`, `src/app/api/**`, `src/components/providers.tsx` | - (frontend-only) |
| `NEXT_PUBLIC_APP_URL` | `src/app/api/chat/route.ts` (CSRF) | Backend |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | `src/components/providers.tsx`, `src/middleware.ts` | Backend |
| `CLERK_SECRET_KEY` | `src/middleware.ts`, `src/lib/auth.ts`, `src/lib/clerk-claims.ts` | Backend |
| `CLERK_SIGNING_SECRET` | `src/app/api/webhooks/clerk/route.ts` (Svix) | Backend |
| `CLERK_JWT_ISSUER` | `convex/auth.config.ts` | Frontend |
| `CONVEX_DEPLOYMENT` | Convex runtime | Frontend |
| `CONVEX_AUTH_TOKEN` | `convex/crawl/webhook.ts` (`/ingest`, `/api/reset`) | Frontend |
| `CRAWL_WEBHOOK_SECRET` (+ `_NEW`) | `convex/crawl/webhook.ts` (`/api/webhook/crawl`) | Frontend |
| `CRON_SECRET` | `src/app/api/cron/route.ts` | Backend |
| `WEBHOOK_SECRET` | `src/app/api/webhooks/clerk/route.ts` → passed as `secret` to `users:getOrCreate` | Anywhere else |
| `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` | `src/lib/rate-limit.ts` | Backend |
| `GROQ_API_KEY` | `src/app/api/chat/route.ts`, `convex/rag/routing.ts` | - |
| `GEMINI_API_KEY` (and `_1`, `_2`) | `src/app/api/chat/route.ts`, `convex/crawl/webhook.ts` (contextual summary), `convex/embeddings/generate.ts` | - |
| `GOOGLE_GENERATIVE_AI_API_KEY` | `convex/embeddings/generate.ts` (key rotation #3), `convex/crawl/webhook.ts` | - |
| `CEREBRAS_API_KEY` | `src/app/api/chat/route.ts` | Backend |
| `RERANKER_URL` | `convex/reranking/rerank.ts` | Frontend |
| `SENTRY_ORG`, `SENTRY_PROJECT` | `next.config.ts` (`withSentryConfig`) | Backend |
| `CONVEX_SITE_URL` | Convex (callbacks) | Frontend |
| `OPENROUTER_API_KEY` | **Currently unused** (fallback removed in `convex/embeddings/generate.ts` to prevent vector-space incompatibility) | Anywhere new |

### 5.2 Logging, errors, observability

- **Frontend errors** → `console.error` + Sentry (browser). Toast via `sonner` for user-visible errors.
- **Next.js API route errors** → `console.error` + return shaped `Response` (`{ error: "..." }`). Sentry captures uncaught.
- **Convex function errors** → `console.error` / `console.warn` + throw `ConvexError` for user-facing failures. Sentry captures uncaught Convex errors automatically.
- **Prompt-injection events** → `console.warn("[SECURITY] …")` inside `convex/rag/retrieval.ts:scanForInjection`. Do not change the log prefix - alerts may key on it.
- **Cache hit events** → `console.log("Semantic Cache Hit!")` - keep the exact string for log greps.

### 5.3 Rate limiting - pick one layer, do not mix

| Layer | When to use it | How |
|---|---|---|
| Per-user **mutation** limit (10/min) | Inside a Convex mutation that performs a write the user could spam | `await enforceRateLimit(ctx, identity.subject, tokenEstimate)` in `convex/rateLimit.ts` |
| Global **token** budget (100K/min) | Inside a Convex mutation that costs the system money (LLM calls, embedding generation) | Same call with the user's token estimate |
| Per-user **HTTP API** limit (50/hr) | Inside `src/app/api/**` route handlers | `await checkChatRateLimit(userId, role)` in `src/lib/rate-limit.ts` |
| Per-admin **HTTP API** limit (200/hr) | Same, for admin-only routes | Same call with `role: "admin"` |

Do not call `enforceRateLimit` from a frontend component. Do not call `checkChatRateLimit` from a Convex function.

### 5.4 Adding a new feature - checklist

1. **Read `architecture.md` first.** Find the section that owns the change.
2. **Decide which side owns it.** If it stores, mutates, or queries data, it belongs backend. If it renders, navigates, or streams, it belongs frontend. If it does both, split along the seam.
3. **If a new Convex function is needed**, follow the §3.3 checklist. Add a corresponding hook in `src/hooks/` if the function is called from multiple components.
4. **If a new env var is needed**, add it to `architecture.md` §8.2 and to `.env.example` (and Vercel project if applicable).
5. **If the user-facing contract changes** (new field, new endpoint, new role), update `src/lib/types.ts`, `convex/schema.ts`, and the relevant `architecture.md` section in one PR.
6. **Tests**: backend changes get unit tests under `tests/convex/` and `tests/unit/`. Frontend changes get component tests under `tests/unit/components/` and Playwright under `tests/e2e/`. New APIs need at least one happy-path test and one auth-failure test.
7. **Verify locally**: `pnpm test` (Vitest), `pnpm typecheck` (`tsc --noEmit`), `npx convex dev --dry-run` (must pass with zero TypeScript errors). These are the AGENTS.md quality gate.
8. **Update this file** if the change introduces a new boundary rule, a new shared concern, or a new env var.

---

## 6. Anti-Patterns to Watch For

These are the patterns that have already caused bugs or near-misses in this project. If you see one, stop and refactor.

| # | Anti-pattern | Why it's wrong | Fix |
|---|---|---|---|
| AP-1 | Frontend reads `convex/schema.ts` to infer types | Couples the client bundle to server-only files | Generate a plain TS interface in `src/lib/types.ts` |
| AP-2 | Backend uses `any` to avoid typing Convex args | Defeats the validator contract | Define a `v.object({…})` validator and use `Infer<typeof v>` if you need a TS shape |
| AP-3 | Both sides implement the same `assignTier` / `assignFreshnessTier` (this exists today) | The function in `convex/crawl/chunking.ts` and the one in `src/app/api/chat/route.ts` must stay in sync | If you must keep two copies, add a single test in `tests/unit/` that asserts they return the same value for the same URL. Otherwise, move both to a shared helper. |
| AP-4 | Frontend mutation call missing `await` | React 19 surfaces these as silent failures | Always `await` mutations. Use `useMutation` with a wrapper that logs and toasts on rejection. |
| AP-5 | `convex/action` that performs multiple writes via `ctx.runMutation` | Actions are not transactional; partial failure is possible | Use a `mutation` for any multi-write flow. Actions are for: external API calls, long-running work, `workpool` tasks. |
| AP-6 | Reading from `convex/_generated/api` in a way that hard-codes a function name as a string (e.g. `client.mutation("users:getOrCreate", …)`) | The `api` object already provides the function reference; the string is fragile | Use `client.mutation(api.users.getOrCreate, {…})`. The Clerk webhook route is the one historical exception - it is acceptable there. |
| AP-7 | Reading `process.env` at module top-level in a Convex file | Convex deploys isolate the runtime; some env vars aren't set until the first call | Read env vars inside the handler, or guard with a clear startup assertion (see `convex/http.ts` for the pattern). |
| AP-8 | Adding a custom Convex HTTP route to handle something the frontend could do with `useMutation` | Adds an unnecessary auth surface | Use `useMutation(api.x.y, args)` for user-driven writes. Reserve `convex/http.ts` for external integrations (crawlers, webhooks). |
| AP-9 | Wrapping a Convex query in a Next.js API route just to add a header | Doubles the network hop, doubles the failure modes | Call the Convex query from the client directly; add the header at the call site if needed. |
| AP-10 | Putting business logic in `src/lib/utils.ts` | Mixes UI helpers with domain rules | Domain logic belongs in `convex/lib/` (backend) or in a `convex/<domain>/` module. `src/lib/utils.ts` is for pure functions like `cn(...)`. |
| AP-11 | Editing a generated file by hand | The next `npx convex dev` overwrites it | Edit the source that produces the generated file (e.g. `convex/schema.ts`). |
| AP-12 | Long-running task inside a Convex `mutation` | Mutations are time-limited and transactional | Use `action` + `workpool` for >10s work. See `convex/crawl/workpools.ts` for the pattern. |
| AP-13 | Frontend catching a `ConvexError` and switching to a different transport | One transport per concern. Convex for data, Next.js routes for streaming, Clerk webhooks for identity sync. | Catch `ConvexError`, surface the message, and let the user retry. |

---

## 7. Quick Decision Tree - Where Does This Code Go?

```
Is it React / JSX / Tailwind / Next.js routing / streaming / browser-only?
  └─ YES → src/
  └─ NO ↓

Does it touch the database, auth identity, embeddings, vector search, RAG, 
caching, rate limiting (mutation side), or run inside a cron?
  └─ YES → convex/
  └─ NO ↓

Is it a shared contract that both sides need to reference by name?
  └─ YES → backend in convex/schema.ts, mirror in src/lib/types.ts
  └─ NO ↓

Is it an environment variable, a deploy setting, or a secret?
  └─ YES → architecture.md §8.2 (both must agree)
  └─ NO ↓

If you got here, ask in the PR description. Both agents must agree.
```

---

## 8. Onboarding Checklist (for either agent)

When a new contributor (human or agent) joins:

1. Read this file end to end.
2. Read `architecture.md` end to end.
3. Read `AGENTS.md` for the operational rules.
4. Read `convex/_generated/ai/guidelines.md` (Convex coding rules) and `docs/security.md` (security rules).
5. Run the build: `pnpm install` (Windows only), `npx convex dev --dry-run`, `pnpm typecheck`, `pnpm test`.
6. Open the smallest PR you can: a one-line change to a file on your side of the boundary, and verify the other side still works.
7. When you break something, add the lesson to this file's "Anti-Patterns" or "Quick Decision Tree" section.

---

**Document owner:** Backend Agent for §1.1, §2.2, §3, §5; Frontend Agent for §1.2, §2.1, §3, §5. **Joint ownership** for §2.3, §4, §6, §7, §8.
**Review cadence:** every PR that touches the boundary (schema, env vars, auth, API surface) must update this file.
**Last updated:** 2026-06-05.
