# Reference (Cross-Cutting)

> **Audience.** AI / agent developers working on changes that span frontend + backend (auth, env, types, errors, observability).
>
> **Index.** See [`reference.md`](./reference.md) §6.3 (env var index) and §6.4 (error code index). Full details and matrices live here.
>
> **Companion.** Forbidden actions in [`frontend_backend_boundaries.md`](./frontend_backend_boundaries.md). Side-specific signatures in [`reference.backend.md`](./reference.backend.md) and [`reference.frontend.md`](./reference.frontend.md).

---

## Table of Contents

1. [How to Use This File](#1-how-to-use-this-file)
2. [Environment Variables](#2-environment-variables)
3. [Auth & Authorization Matrix](#3-auth--authorization-matrix)
4. [Type Mirrors (FE ↔ BE)](#4-type-mirrors-fe--be)
5. [Error Handling](#5-error-handling)
6. [Logging](#6-logging)
7. [Rate-Limit Layer Picker](#7-rate-limit-layer-picker)
8. [Caching Layers](#8-caching-layers)
9. [Observability](#9-observability)
10. [Webhook Auth Cheatsheet](#10-webhook-auth-cheatsheet)
11. [Cross-Boundary State Machine](#11-cross-boundary-state-machine)
12. [Cross-Reference to Boundary Doc Caveats](#12-cross-reference-to-boundary-doc-caveats)

---

## 1. How to Use This File

**Read by intent:**

| If you want to… | Jump to |
| --- | --- |
| Add or rename an env var | §2 (Env Vars) — both sides + docs |
| Change who can call what | §3 (Auth Matrix) — check both Clerk role AND Convex role |
| Add a union type used on both sides | §4 (Type Mirrors) — must change in 3 places |
| Standardize error responses | §5 (Error Handling) — codes + shapes |
| Add a new log destination | §6 (Logging) |
| Decide which rate limit layer to use | §7 (Layer Picker) |
| Add a new cache layer or change TTL | §8 (Caching) |
| Add Sentry/Vercel instrumentation | §9 (Observability) |
| Add a new webhook | §10 (Webhook Cheatsheet) |

---

## 2. Environment Variables

### 2.1 Master table (verified against `.env.local.example` + actual readers)

| Var | Side | Where read | Owner | Required? | Lifetime |
| --- | --- | --- | --- | --- | --- |
| `NEXT_PUBLIC_CONVEX_URL` | FE | providers.tsx (inline ConvexReactClient) + chat/route.ts (inline ConvexHttpClient) | platform | yes | build + runtime |
| `CONVEX_SITE_URL` | BE + Python | `convex/crawl/actions.ts:92` + `scripts/crawler.py`, `scripts/ingest_pdf.py` | platform | yes | runtime |
| `CONVEX_DEPLOYMENT` | BE | Convex CLI | platform | yes | deploy (NOT `CONVEX_DEPLOY_KEY`; `.env.local` uses `CONVEX_DEPLOY_KEY=dev:fleet-kingfisher-646` literally) |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | FE | `src/app/api/health/route.ts:131` + `<ClerkProvider>` (auto-reads `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` from env) | platform | yes | build + runtime (NOT an alias of `CLERK_PUBLISHABLE_KEY` — that var is not referenced anywhere) |
| `CLERK_SECRET_KEY` | FE server | Implicitly read by `@clerk/nextjs/server` `auth()` / `currentUser()` (NOT by `src/lib/auth.ts` — that file does not import it) | platform | yes | runtime |
| `CLERK_JWT_ISSUER` | BE | `convex/auth.config.ts:4` | platform | yes | runtime (NOT `CLERK_JWT_KEY`) |
| `CLERK_SIGNING_SECRET` | FE | `src/app/api/webhooks/clerk/route.ts:6` (svix) | platform | yes | runtime (NOT `CLERK_WEBHOOK_SECRET`) |
| `CRAWL_WEBHOOK_SECRET` | BE | `convex/crawl/webhook.ts:89` + `convex/crawl/actions.ts:108` (HMAC primary) | platform | yes | runtime |
| `CRAWL_WEBHOOK_SECRET_NEW` | BE | `convex/crawl/webhook.ts:90` + `convex/crawl/actions.ts:109` (HMAC secondary, for key rotation; NOT in `.env.local.example` — docs only) | platform | optional | runtime |
| `CRAWL4AI_URL` | BE | `convex/crawl/actions.ts:99` (PRIMARY — `CRAWL4AI_BASE_URL` is the fallback) | platform | optional | runtime |
| `CRAWL4AI_BASE_URL` | BE | `convex/crawl/actions.ts:99` (fallback for `CRAWL4AI_URL`; throws if neither set; default `http://localhost:11235` is in `.env.local.example` only, not in code) | platform | yes | runtime |
| `CRAWL4AI_JWT_TOKEN` | BE | `convex/crawl/actions.ts:119` (sets `Authorization` header on Crawl4AI requests when present) | platform | optional | runtime |
| `CONVEX_AUTH_TOKEN` | BE | `convex/http.ts:7` (start guard) + `convex/crawl/webhook.ts:299,334` (Bearer for `/ingest`, `/api/reset`) | platform | yes | runtime |
| `WEBHOOK_SECRET` | BE + FE | `convex/users.ts:18` (dual auth on getOrCreate) + `src/app/api/webhooks/clerk/route.ts:50` | platform | yes | runtime (shared secret for Clerk→Convex user sync) |
| `CRON_SECRET` | FE | `src/app/api/cron/route.ts:9` + `health/route.ts:51` (Bearer) | platform | yes | runtime |
| `GROQ_API_KEY` | FE server | `src/app/api/chat/route.ts:34,51` (NOT in `src/lib/llm-models.ts` — that file is static) | platform | yes | runtime |
| `CEREBRAS_API_KEY` | FE server | `src/app/api/chat/route.ts:39,53` | platform | yes | runtime |
| `GEMINI_API_KEY` | FE server + BE | `src/app/api/chat/route.ts:36,55` (Gemini step 4) + `convex/embeddings/generate.ts:105` (primary in 4-key rotation) | platform | yes | runtime |
| `GOOGLE_GENERATIVE_AI_API_KEY` | BE | `convex/embeddings/generate.ts:108` (rotation fallback — 4th key) + `convex/crawl/webhook.ts:171,400` (AI document summarization during ingest) — **NOT** read by `chat/route.ts` (that file uses only `GEMINI_API_KEY`) | platform | yes | runtime |
| `GEMINI_API_KEY_1` | BE | `convex/embeddings/generate.ts:106` (rotation key 2) | platform | yes | runtime |
| `GEMINI_API_KEY_2` | BE | `convex/embeddings/generate.ts:107` (rotation key 3) | platform | yes | runtime |
| `UPSTASH_REDIS_REST_URL` | FE server | `src/lib/rate-limit.ts:14` | platform | yes | runtime |
| `UPSTASH_REDIS_REST_TOKEN` | FE server | `src/lib/rate-limit.ts:15` | platform | yes | runtime |
| `RERANKER_URL` | BE | `convex/reranking/rerank.ts:15` (graceful fallback to position-based) | platform | optional | runtime |
| `OPENROUTER_API_KEY` | BE | `convex/embeddings/generate.ts:111` (read for presence check only — actual OpenRouter fallback was removed to prevent vector space incompatibility) | platform | optional | runtime |
| `SENTRY_DSN` | FE server | `src/sentry.server.config.ts:3` (NOT `instrumentation.ts`) | platform | optional | runtime |
| `NEXT_PUBLIC_SENTRY_DSN` | FE client | `src/sentry.client.config.ts:3` (with `SENTRY_DSN` fallback) + `src/sentry.edge.config.ts:3` (NOT in `.env.local.example`) | platform | optional | build + runtime |
| `NEXT_PUBLIC_APP_URL` | FE server | `src/app/api/chat/route.ts:265` (CSRF origin check; NOT in `src/lib/constants.ts`) | platform | yes | runtime |

> **`ADMIN_BOOTSTRAP_EMAIL`** is referenced in `convex/users.ts` (both `getOrCreate` and `upsertFromWebhook`). On first user creation, if the user's email matches this env var, they are auto-promoted to `admin`. Bootstrap only applies on creation — deliberate demotion is NOT reverted. There is **NO** `ADMIN_EMAILS` env var in code; `.env.local.example` uses `ADMIN_BOOTSTRAP_EMAIL` (singular).

> **The 4-key Gemini rotation** in `convex/embeddings/generate.ts` reads: `GEMINI_API_KEY` → `GEMINI_API_KEY_1` → `GEMINI_API_KEY_2` → `GOOGLE_GENERATIVE_AI_API_KEY` (as last-resort fallback). All four MUST be set for production.

> ⚠️ **The boundary doc has caveats** around `GEMINI_API_KEY` — the code reads `GEMINI_API_KEY` for the primary embedding key, but `.env.local.example` and the 4-key rotation also use `GEMINI_API_KEY_1`, `GEMINI_API_KEY_2`, and `GOOGLE_GENERATIVE_AI_API_KEY` (as last-resort fallback). For production, set ALL FOUR. See `convex/embeddings/generate.ts` for the rotation order.

### 2.5 Python tooling env vars (separate from Next.js/Convex)

The Python scripts in `scripts/` (`crawler.py`, `ingest_pdf.py`, `run_eval.py`) read their own env vars, mostly from `.env.local` (not `.env.local.example`):

| Var | Read by | Purpose | Required? |
| --- | --- | --- | --- |
| `CONVEX_SITE_URL` | `crawler.py`, `ingest_pdf.py` | Ingest endpoint (falls back to `NEXT_PUBLIC_CONVEX_URL` with `.convex.cloud` → `.convex.site` swap) | yes |
| `CONVEX_URL` | `run_eval.py` | Eval harness Convex URL (NOT `NEXT_PUBLIC_CONVEX_URL` despite what AGENTS.md says) | yes |
| `CONVEX_AUTH_TOKEN` | `crawler.py`, `ingest_pdf.py` | Bearer for `/ingest` (falls back to `CRAWL_WEBHOOK_SECRET` in `ingest_pdf.py`) | optional (warns if missing) |
| `GEMINI_API_KEY` | `ingest_pdf.py` | VLM model `gemini-2.0-flash` | yes (4-step fallback) |
| `GOOGLE_API_KEY` | `ingest_pdf.py` | VLM fallback (1st in 4-step) | no |

> The Python scripts **do not** read `NEXT_PUBLIC_CONVEX_SITE_URL`; they read `CONVEX_SITE_URL`. Architecture.md §18.1 lists `CONVEX_SITE_URL` as required.

### 2.2 By owner

#### Platform (deployment-level)

- All `CLERK_*` — set once, used everywhere
- All `CONVEX_*` — Convex dashboard
- `GROQ_API_KEY`, `CEREBRAS_API_KEY`, `GEMINI_API_KEY` — provider dashboards
- `UPSTASH_*` — Upstash console
- `SENTRY_DSN` — Sentry project settings
- `CRAWL_WEBHOOK_SECRET`, `CONVEX_AUTH_TOKEN`, `CRON_SECRET` — generated by ops

#### Per-developer (for local dev)

- All of the above, in `.env.local` (gitignored)
- Mirror keys from a teammate for collaborative debugging

### 2.3 Lifecycle

| Lifetime | When set | Examples |
| --- | --- | --- |
| `build` | At `next build` | `NEXT_PUBLIC_*` |
| `runtime` | Each request | All others |
| `deploy` | Once per Convex deploy | `CONVEX_DEPLOYMENT` (NOT `CONVEX_DEPLOY_KEY`) |

**`NEXT_PUBLIC_*` inlining:** Next.js replaces these at build time. Changing the value requires a rebuild. Don't use for values that change often.

### 2.4 Adding a new env var

1. **Decide the side.** Server-only or client-exposed?
   - If client-exposed → prefix `NEXT_PUBLIC_` and add to §2.1.
   - If server-only → no prefix; ensure no client file imports it.
2. **Update `.env.local.example`** with a placeholder and a comment.
3. **Document the owner** in the table above.
4. **Add a start-up check** for required server-only vars (fail fast).
5. **Update `reference.cross-cutting.md`** (this file) — not just one side.

---

## 3. Auth & Authorization Matrix

### 3.1 Identity sources

| Source | Where | What it provides |
| --- | --- | --- |
| Clerk | FE | Session cookie, JWT |
| Convex auth.config | BE | Verifies Clerk JWT, derives `ctx.auth` |
| Convex `users.role` | BE | Role for FE↔BE decisions |
| Convex `adminAuditLog` | BE | Trail of admin actions |

### 3.2 RBAC matrix

| Action | FE guard | Convex guard | Cross-check |
| --- | --- | --- | --- |
| Read public page | `clerkMiddleware` allows | (not called) | none |
| Read authed page (e.g. `/chat`) | `auth()` in server component | (not called directly) | `useUser()` |
| Call `messages.insert` | (client can't bypass) | `requireAuth` | Clerk session |
| Read own feedback | `useUser()` is owner | filter `by_userId` in `feedback/list` | both must agree |
| Read all feedback | n/a (admin page) | `requireAdmin` | Clerk role + DB role |
| Modify `appSettings` | admin page | `requireAdmin` | Clerk role + DB role |
| Trigger crawl | admin page | `requireAdmin` | Clerk role + DB role |
| Receive Clerk webhook | n/a | Svix signature | Svix verify on FE |
| Receive crawl webhook | n/a | HMAC-SHA256 | `CRAWL_WEBHOOK_SECRET` |
| Run cron | n/a | n/a | `CRON_SECRET` on FE route |
| Read health | n/a | n/a | `CRON_SECRET` on FE route |

### 3.3 Role sync (verified)

`Clerk public metadata.role` ↔ `convex.users.role` (values: `user` | `admin` | `superadmin`). Synced via Clerk webhook.

1. **First sign-in:** `UserSync` (inline in `src/components/providers.tsx`) calls `convex/users.ts::getOrCreate` with `role: "user"` by default. If `ADMIN_BOOTSTRAP_EMAIL` matches the user's email, they are created as `role: "admin"` instead. (Note: `users.ts` has 3 public functions: `getOrCreate`, `getByClerkId`, `updatePreferences`; see `reference.backend.md` §4.2.)

2. **Admin grant:** Via the admin UI (`/admin/users`) which calls Clerk Backend API server actions (`src/app/admin/users/actions.ts`). The role change in Clerk triggers a `user.updated` webhook, which is processed by `convex/clerk/webhook.ts` → `convex/users.ts::upsertFromWebhook`, which syncs the role to Convex and logs a `role.change` entry to `adminAuditLog`.

3. **Clerk webhook:** Handles `user.created`, `user.updated`, and `user.deleted` events. The Convex handler (`convex/clerk/webhook.ts`) is an `httpAction` with Bearer token auth (constant-time comparison). Role extraction from `public_metadata.role` includes string normalization (`.toLowerCase().trim()`) and validation against the allowlist `["user", "admin", "superadmin"]`. The webhook calls `internal.users.upsertFromWebhook` (which syncs name, email, image, and role) or `internal.users.deleteFromWebhook`.

4. **Role change audit:** `upsertFromWebhook` detects role changes by comparing `existing.role` before patching. If the role changed, an `adminAuditLog` entry with action `"role.change"`, `oldValue`, and `newValue` is inserted.

**Don't trust Clerk metadata alone on the BE.** The Convex `users.role` is the source of truth for `requireAdmin` (`convex/auth.ts:30,51` checks DB role, not Clerk claims). The Clerk metadata is for FE convenience (so we don't have to round-trip).

### 3.4 Token verification

```
FE: Clerk session cookie (set by Clerk)
     ↓
   /api/chat (Next.js route handler)
     ↓ calls Convex via ConvexHttpClient
     ↓ adds Authorization: Bearer <Clerk JWT>
     ↓
BE: Convex auth.config verifies JWT against Clerk public key
     ↓ extracts userId from "sub" claim
     ↓ calls requireAuth/requireAdmin (looks up users.role)
     ↓
   returns result
```

**No service-to-service auth.** All BE calls go through Clerk.

---

## 4. Type Mirrors (FE ↔ BE)

### 4.1 Why mirrors

Convex generates `Doc<"tableName">` and `Id<"tableName">` types in `convex/_generated/dataModel.d.ts`. These are accurate but verbose for app code. We mirror them in `src/lib/types.ts` for ergonomics and to avoid pulling Convex types into non-Convex files.

### 4.2 Mirror table

| Mirror | Convex source | File | Notes |
| --- | --- | --- | --- |
| `Id<T>` | branded string `string & { __tableName: T }` | `src/lib/types.ts:1` | NOT a `ConvexId<T>` re-export — no such symbol exists |
| `UserRole` | `users.role` union | `src/lib/types.ts:3` | 3 values: `user`/`admin`/`superadmin` |
| `DocumentStatus` | `documents.status` | `src/lib/types.ts:5` | Mirror now has 7 values (added `active`, `pending_embed`); in sync with validator |
| `CrawlStatus` | `crawlJobs.status` | `src/lib/types.ts:7` | matches `schema.ts:57-63` |
| `CrawlTrigger` | `crawlJobs.trigger` | `src/lib/types.ts` | |
| `FeedbackRating` | `feedback.rating` | `src/lib/types.ts` | |
| `FeedbackCategory` | `feedback.category` | `src/lib/types.ts` | |
| `MessageRole` | `messages.role` | `src/lib/types.ts:15` | 2 values: `user`/`assistant` (NO `system`) |
| `QueryCategory` | 7-way intent enum | `src/lib/types.ts:17-24` | |
| `Source` | `sourceValidator` | `src/lib/types.ts:26-44` | Mirror uses `relevanceScore` (not `score`), matching the validator. Extra fields: `id`, `type`, `sourceType`, `providerOptions`. |
| `TokenCount` | `{ prompt, completion, total }` object | `src/lib/types.ts:46-50` | **NOT a `number` alias** — it's a 3-field object |
| `CrawlConfig` | `UET_CRAWL_CONFIG` | `src/lib/types.ts:52-58` | matches `src/lib/constants.ts:1-42` |
| `CrawlStats` | `crawlStats` row | `src/lib/types.ts:60-68` | Shape now matches schema: `statsId`/`totalDocuments`/`indexedDocuments`/`processingDocuments`/`failedDocuments`/`pendingDocuments`/`lastUpdatedAt` |
| `ChatMessage` | custom interface | `src/lib/types.ts:70-78` | `{ role, content }` (NOT a Vercel AI SDK `UIMessage` literal shape) |
| `Thread` | hand-rolled shape | `src/lib/types.ts:80-86` | `{ _id, userId, title, createdAt, updatedAt }` (NOT a literal `Doc<"agent.threads">`) |

> **Do NOT exist in `src/lib/types.ts`:** `ChatRequest`, `ChatRequestSchema`. The chat route does NOT use zod — it does manual `JSON.parse` + `Array.isArray` + length checks.

### 4.3 Sync rules

**If you change a Convex union, change the mirror in the same PR.** No exceptions.

| Convex change | Mirror change |
| --- | --- |
| Add literal to `users.role` | Add to `UserRole` |
| Add status to `crawlJobs` | Add to `CrawlStatus` |
| Add field to `crawledChunks` | Add to `Source` (if it appears in source shape) |
| Change `embeddingDimension` | N/A (no mirror — but see below) |

**`embeddingDimension` change** triggers:

1. `convex/rag/instance.ts` config change (the RAG component owns the vector index — `convex/schema.ts` does NOT have a vector index on `crawledChunks`; only `semanticCache` has one at `schema.ts:120`).
2. Re-embed the corpus (crawl all docs).
3. ~~Update `EMBEDDING_DIM` constant in `convex/constants.ts`~~ — **DOES NOT EXIST.** `convex/constants.ts` has only one line: `export const CACHE_SIMILARITY_THRESHOLD = 0.92`.
4. Update `embeddingDimension` in `convex/rag/instance.ts:20`.
5. Update `outputDimensionality: 768` in `convex/embeddings/generate.ts:57,82` (NOT a field named `dimensions`).
6. No FE mirror change (the dimension is server-side).

### 4.4 Where types are used

- **Convex functions** import from `convex/_generated/dataModel` directly. No mirror needed.
- **FE lib utilities** use mirrors (avoid pulling `_generated` into non-Convex files).
- **FE components** use mirrors; pass IDs as `Id<"users">` (mirror) so component code reads naturally.
- **API responses** — JSON over the wire. Convex serializes Doc/Id; FE re-parses via `Doc<>` from `convex/react` or via the mirror.

---

## 5. Error Handling

> ⚠️ **The codebase has NO structured error code system.** There is no enum, no string constant table, and no `{ code, message, details }` object shape. `grep` for `UNAUTHENTICATED`, `FORBIDDEN`, `RATE_LIMITED`, `INVALID_INPUT`, `HMAC_INVALID`, `HMAC_EXPIRED`, `WEBHOOK_DUPLICATE`, `EMBEDDING_FAILED`, `CRAWL_NOT_FOUND`, `SETTINGS_LOCKED`, `LLM_FAILED`, `WORKFLOW_NOT_FOUND` returns zero matches. All `ConvexError` calls use plain string messages, and FE route handlers return ad-hoc JSON. The table below is what the code actually does, not a target shape.

### 5.1 Actual error sites (verified by grep)

| Where | Mechanism | Message(s) | Surfaced as |
| --- | --- | --- | --- |
| `convex/auth.ts:35` | `throw new Error(...)` | `"Authentication required"` | Function error (string) |
| `convex/auth.ts:40` | `throw new Error(...)` | `"Admin access required"` | Function error (string) |
| `convex/auth.ts:46` | `throw new Error(...)` | `"Superadmin access required"` | Function error (string) |
| `convex/auth.ts:52` | `throw new Error(...)` | `"User not found"` | Function error (string) |
| `convex/rateLimit.ts:92,101` | `throw new ConvexError(\`...\`)` | template strings (no code field) | Function error (string) |
| `convex/crawl/webhook.ts:86` | HTTP `new Response("Request timestamp expired", { status: 400 })` | `"Request timestamp expired"` | **400** (NOT 401 as §5.2 says) |
| `convex/crawl/webhook.ts:102` | HTTP `new Response("Invalid signature", { status: 401 })` | `"Invalid signature"` | **401** |
| `convex/crawl/webhook.ts:119-122` | HTTP `new Response(JSON.stringify({ ok: true, deduped: true }), { status: 200 })` | `{ ok: true, deduped: true }` | **200** (idempotent) |
| `convex/embeddings/generate.ts:114,137,151` | `throw new Error(\`...\`)` | plain string | Function error (string) |
| `convex/crawl/trigger.ts:26` | `throw new Error(\`...\`)` | plain string | Function error (string) |
| `src/app/api/chat/route.ts:294` | HTTP `new Response("Invalid request body", { status: 400 })` | invalid JSON | **400** |
| `src/app/api/chat/route.ts:312-315` | HTTP `new Response("Rate limit exceeded", { status: 429 })` | Upstash hit | **429** |
| `src/app/api/chat/route.ts:362` | HTTP `new Response("Convex not configured", { status: 500 })` | missing Convex URL | **500** |
| `src/app/api/chat/route.ts:393` | HTTP `new Response("No AI providers configured", { status: 500 })` | no API keys | **500** |
| `src/app/api/chat/route.ts:435-439` | HTTP `new Response("An unexpected error occurred", { status: 500 })` | catch-all | **500** |
| `src/app/api/chat/route.ts:265-285` | HTTP `new Response("Forbidden", { status: 403 })` | CSRF origin mismatch | **403** |
| `src/app/api/webhooks/clerk/route.ts` | HTTP `new Response("ok", { status: 200 })` | always 200 (svix errors are 400) | **200** |

> **There is no `CRAWL_NOT_FOUND`, `SETTINGS_LOCKED`, `WORKFLOW_NOT_FOUND`, or `EMBEDDING_FAILED` error code.** These were fabricated. The closest analogs are plain string `throw new Error(...)` calls with no machine-readable code.

### 5.2 HTTP status codes (FE route handlers — actual)

| Status | When (verified) |
| --- | --- |
| `200` | Default success; also for webhook dedup (`{ ok: true, deduped: true }`) |
| `400` | Invalid JSON body, webhook timestamp skew (Crawl4AI HMAC) |
| `401` | Svix/HMAC signature fail, missing CRON_SECRET bearer |
| `403` | CSRF origin mismatch on `/api/chat` |
| `429` | Upstash rate limit (NOT in-memory — there is no in-memory layer) |
| `500` | Convex unconfigured, no AI providers, generic catch |

> **There is no `503` path in the code.** The "Emergency stop" toggle is `convex/emergencyStop.ts::stopAll` which mutates rows (see §11.4), not a flag that returns 503.

### 5.3 Error response shape (actual)

**FE route handlers** return one of:
- `new Response("string message", { status: 4xx|5xx })` (most cases)
- `new Response(JSON.stringify(obj), { status: ..., headers: { "Content-Type": "application/json" } })` (for dedup ack, sometimes)
- `new Response(stream, { status: 200, headers })` (chat success)

**There is NO canonical `{ error, code, details }` shape** — string-only.

**Convex functions** throw `new ConvexError(stringOrTemplate)` or `new Error(string)`. **There is NO object-form `ConvexError({ code, message, details })`** anywhere in the codebase.

### 5.4 Client error handling pattern (suggested)

```tsx
// client component
const { data, error } = useQuery(api.foo.bar, args);
if (error) {
  // error is a string, not an object
  if (error.message?.includes("Authentication")) router.push("/sign-in");
  else if (error.message?.includes("Rate limit")) toast.error("Slow down!");
  else toast.error("Something went wrong");
  return null;
}
```

**Never swallow errors silently.** At minimum, log to Sentry and surface a user-friendly message.

### 5.5 Server error handling pattern (actual)

```ts
// Convex mutation (verified pattern)
try {
  await doSomething();
} catch (e) {
  ctx.logger.error("doSomething failed", { error: e, args });
  throw new Error("Operation failed");  // plain string, NOT ConvexError({ code, message, details })
}
```

**Log first, throw second.** Don't leak raw error messages to clients — they may include stack traces or internal details.

---

## 6. Logging

### 6.1 Where logs go

| Source | Destination | Sampled? |
| --- | --- | --- |
| Convex `ctx.logger` | Convex dashboard | No (always logged) |
| `console.log` in FE | Vercel runtime logs (if server) / browser console (if client) | No |
| Sentry | Sentry dashboard | `tracesSampleRate: 0.1` server, `0.1` client (replays session 0.1 / on-error 1.0) |
| ~~Vercel Analytics~~ | ~~Vercel analytics dashboard~~ | **NOT INTEGRATED** (see §9 caveat) |

### 6.2 What to log

| Event | Where |
| --- | --- |
| Mutation start | Convex `ctx.logger.info(...)` |
| Mutation error | Convex `ctx.logger.error(...)` + Sentry |
| LLM call | `src/app/api/chat/route.ts` server log (no PII) |
| Webhook received | Convex `ctx.logger.info(...)` w/ webhookId |
| Rate limit hit | Convex `ctx.logger.warn(...)` + Upstash dashboard |
| Emergency stop toggle | Convex `ctx.logger.warn(...)` + `adminAuditLog` |

### 6.3 PII rules

| Data | Log it? |
| --- | --- |
| User ID (`Id<"users">`) | Yes |
| Email | No |
| Name | No |
| Query text | Yes (it's the user's question) |
| LLM response | No (may be long; sample instead) |
| Stack traces | Yes (in Sentry only) |
| API keys | **NEVER** (Sentry has scrubbers; don't bypass) |

### 6.4 Structured logging

Convex `ctx.logger` accepts an object:

```ts
ctx.logger.info("crawl completed", { jobId, duration, totalUrls, failedUrls });
```

This surfaces in Convex dashboard as searchable JSON.

### 6.5 Sampling

- **Sentry server:** `tracesSampleRate: 0.1` prod / `1.0` dev (10% / 100%)
- **Sentry client:** `tracesSampleRate: 0.1` prod (10%) — **NOT 0.05** (the earlier doc had this wrong)
- **Sentry client replays:** `replaysSessionSampleRate: 0.1` (10%) / `replaysOnErrorSampleRate: 1.0` (100%)
- **Vercel Analytics:** ~~automatic, ~10% of events~~ — **NOT INTEGRATED**; the line is a stale carryover from the planned observability stack

**Bump sampling for incident debugging**, but revert when done. Long-term high-sampling = Sentry bill.

---

## 7. Rate-Limit Layer Picker (verified)

**Two layers, no in-memory layer.** Applied in order. The first that triggers blocks the request.

```
Request → [Upstash] → [Convex] → Backend
```

> The previous draft of this section described a 3-layer in-memory → Upstash → Convex stack. **That was wrong.** The verified `src/app/api/chat/route.ts` has NO in-memory rate limit. The only Next.js rate limit is Upstash (`src/lib/rate-limit.ts`).

### 7.1 Layer 1: Upstash (Next.js)

**File:** `src/lib/rate-limit.ts`

| Tier | Limit | Used when |
| --- | --- | --- |
| `anon` | 10 / 1h | No Clerk session |
| `user` | 50 / 1h | Default for authed user |
| `admin` | 200 / 1h | Admin role |

**Failure mode:** `checkChatRateLimit` returns `null` if Upstash is unavailable (i.e. **fails open** — the request continues and the Convex layer applies). The chat route treats `null` as pass-through (does NOT 429 on null). There is no `safeLimit` symbol in the codebase.

**Use for:** global per-user limits across pods.

### 7.2 Layer 2: Convex (BE)

**File:** `convex/rateLimit.ts`

| Aspect | Value |
| --- | --- |
| Per-user | 10 msg / 60s sliding (per `enforceRateLimit` default `tokenEstimate=1000`) |
| Global token | 100K tokens / 60s sliding |
| Storage | `rateLimits` table |
| Failure | Throws plain-string `new ConvexError(\`Rate limit exceeded: ...\`)` (NO `RATE_LIMITED` code — see §5.1) |

**Use for:** the authoritative per-user + global cap, visible to Convex.

### 7.3 When to add a new layer

Don't. Two is enough. If you need a third constraint (e.g. per-feature), add a key dimension to Layer 2 (Convex).

### 7.4 Bypass rules

- **`/api/chat`** — both layers apply.
- **`/api/cron`** — no rate limit (CRON_SECRET is the auth).
- **`/api/webhooks/*`** — no rate limit (signature is the auth).
- **Admin functions** — Layer 1 admin tier, Layer 2 still applies.
- **Health probe** — no rate limit.

---

## 8. Caching Layers

### 8.1 Layer inventory

| Layer | Where | TTL | Invalidation |
| --- | --- | --- | --- |
| **Browser cache** | Next.js Image, static assets | Long (1y) | Content-hash URL |
| **Next.js full-page cache** | App Router | Per revalidate | Manual revalidate |
| **Convex query cache** | Convex reactive | N/A | Auto-invalidated by mutation |
| **Semantic cache** | `convex/cache/*` | high=7d, medium=2d, low=1d | Cron `cleanupExpiredCache` |
| **Embedding cache** | gemini-embedding-2 (provider-side) | Provider | N/A |
| **Vercel edge cache** | Vercel CDN | Per revalidate | Manual purge |

### 8.2 Semantic cache (deep dive)

**File:** `convex/cache/*`

| Field | Value |
| --- | --- |
| Hit threshold | `cosineSimilarity(query, cached) >= 0.92` |
| Tier | `high` (factual) / `medium` (default) / `low` (volatile) |
| TTL | 7d / 2d / 1d |
| Sources | Stored on insert; returned on hit |
| Hit count | Incremented; `lastHitAt` updated |
| Cleanup | Cron `daily-cleanup-expired-cache` (01:00 UTC) cleans BOTH `semanticCache` AND `processedWebhooks`. Cron `daily-cleanup-expired-v2` (13:00 UTC) cleans ONLY `semanticCache`. |

**Hit flow:**

```
Chat request
  → generateEmbeddings(query)
  → vectorSearch("semanticCache", "by_queryEmbedding", { limit: 1 })   // NOT 5
  → if candidate.cosine >= 0.92 AND expiresAt > now?
    yes → incrementHit, return cached.response + cached.sources
    no  → fall through to RAG + LLM
```

**Cache miss is not an error.** It's the normal path.

**Cache poisoning:** if a malicious user can get their response cached with high tier, all similar queries would get the malicious answer. Mitigation: tier selection logic in `cache/set.ts` should err on the side of `low` tier; consider admin override for high tier.

### 8.3 When to use which cache

| Use case | Layer |
| --- | --- |
| Repeated identical UI | Browser cache (Cache-Control headers) |
| Expensive query, infrequent changes | Convex query cache (reactive) |
| Reused LLM response | Semantic cache |
| Static image | Vercel edge + browser |
| Embedding the same text | Provider-side (free) |

### 8.4 Bypassing cache

- **Force fresh LLM response:** add a per-request nonce, or check `cache-control: no-store` on the FE.
- **Force fresh Convex query:** call the query with a different key.
- **Clear semantic cache:** `admin/reset` mutation (DESTRUCTIVE — see below).

### 8.5 Destructive: cache reset

**There is NO `api.crawl.reset` (admin) function** in the verified code. The destructive reset is exposed at `convex/crawl/reset.ts::resetDLQ` (public, cap 500 — see `reference.backend.md` §5 and `reference.backend.md` §10) and `convex/crawl/reset_ops.ts::resetAbandonedDLQ` (internal, paginated, for cron). Neither wipes the semantic cache or processed webhooks.

**To wipe state for a full re-crawl scenario:** do it manually via the Convex dashboard. Partial cache reset is not exposed via a public mutation.

**Use only for full re-crawl scenarios.** Partial cache reset is not supported; do it manually via Convex dashboard.

---

## 9. Observability

### 9.1 Stack

| Tool | Surface | Init |
| --- | --- | --- |
| Sentry (server) | FE route handlers, server actions | `src/sentry.server.config.ts` (NOT `instrumentation.ts`) |
| Sentry (client) | Browser errors, perf | `src/sentry.client.config.ts` (NOT `instrumentation-client.ts`) |
| ~~Vercel Analytics~~ | ~~Page views, custom events~~ | **NOT INTEGRATED** — `src/lib/analytics.ts` is a `console.log` shim only |
| ~~Vercel Speed Insights~~ | ~~Web Vitals~~ | **NOT INTEGRATED** — `<SpeedInsights />` is not rendered |
| Convex dashboard | All Convex functions + logger | Auto |
| Vercel logs | FE server logs | Auto |

### 9.2 Sentry init (verified)

**Server (`src/sentry.server.config.ts`):**

```ts
import * as Sentry from "@sentry/nextjs";
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
  environment: process.env.NODE_ENV,
});
```

**Edge (`src/sentry.edge.config.ts`):** similar but for edge runtime.

**Client (`src/sentry.client.config.ts`):**

```ts
import * as Sentry from "@sentry/nextjs";
Sentry.init({
  dsn: process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN,  // server DSN as fallback
  tracesSampleRate: 0.1,  // prod; 1.0 in dev
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
});
```

**`src/instrumentation.ts` is a thin `register()` wrapper** that conditionally imports the right Sentry config based on `NEXT_RUNTIME`:

```ts
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}
```

> **`instrumentation-client.ts` (root) does NOT exist** in the verified code. The client init is at `src/sentry.client.config.ts`.

**Sampling rationale:** server is 10% prod / 100% dev (we trust the BE more); client adds replays (session 0.1, error 1.0) for bug reports.

### 9.3 Vercel Analytics events — **NOT INTEGRATED** (verified)

> ⚠️ **The actual `src/lib/analytics.ts` does NOT import from `@vercel/analytics`.** It is a 73-line dev-only `console.log` shim. The "real" implementation shown below is a **template** for when (or if) the integration is added. See `reference.frontend.md` §7.9 for the verified signatures.

**Template (when integration is added):**

```ts
// NOT YET in the codebase — add when integrating Vercel Analytics
import { track } from "@vercel/analytics";

export function trackEvent(name: string, props?: Record<string, string | number | boolean>) {
  if (process.env.NODE_ENV === "production") {
    track(name, props);
  }
}
```

**Allowed props:** string, number, boolean. **No arrays, no nested objects, no functions.**

### 9.4 Convex logging

```ts
ctx.logger.info("message", { key: "value" });   // structured
ctx.logger.warn("warning");
ctx.logger.error("error", { err });
```

**Convex dashboard** shows logs in the "Logs" tab. Searchable by function name and key.

### 9.5 Alerting

| Signal | Where | Who |
| --- | --- | --- |
| Sentry spike | Sentry alerts | Dev on-call |
| Vercel error rate | Vercel monitoring | Dev on-call |
| Convex function failure | Convex dashboard | Dev on-call |
| Emergency stop toggle | Sentry + Convex | Admin |

**Don't set up alerts in this repo** — they're operator-configured in dashboards.

### 9.6 Debugging steps (canonical order)

1. Reproduce locally (`npm run dev`).
2. Check Convex dashboard logs for the failing function.
3. Check Vercel logs for the route handler.
4. Check Sentry for the corresponding error.
5. Check `adminAuditLog` for any recent admin changes.
6. There is **no** `appSettings.emergencyStop` flag. To stop all running work, use `convex/emergencyStop.ts::stopAll` directly from the Convex dashboard.

---

## 10. Webhook Auth Cheatsheet

| Webhook | Auth scheme | Secret env var | Skew tolerance | Idempotency table |
| --- | --- | --- | --- | --- |
| `/api/webhooks/clerk` (Next.js) | svix signature | `CLERK_SIGNING_SECRET` (NOT `CLERK_WEBHOOK_SECRET`) | N/A (svix-managed) | none (svix handles) |
| `/api/webhook/crawl` (Convex) | HMAC-SHA256 | `CRAWL_WEBHOOK_SECRET` | ±5 min | `processedWebhooks` |
| `/ingest` (Convex) | Bearer | `CONVEX_AUTH_TOKEN` | N/A | N/A |
| `/api/reset` (Convex) | Bearer | `CONVEX_AUTH_TOKEN` | N/A | N/A |
| `/api/cron` (Next.js) | Bearer OR query | `CRON_SECRET` | N/A | N/A |
| `/api/health` (Next.js) | Bearer | `CRON_SECRET` | N/A | N/A |

### 10.1 Adding a new webhook

1. Choose auth scheme (HMAC for external; Bearer for internal; Svix for SaaS like Clerk).
2. Add a route in `convex/http.ts`.
3. Add the secret to §2.1.
4. Add the idempotency check via `processedWebhooks`.
5. Document in `reference.backend.md` §6 and in this file.
6. Update the FE `src/middleware.ts` public matcher if it's at `/api/webhooks/...`.

---

## 11. Cross-Boundary State Machine

### 11.1 `crawlJobs` state machine

```
        ┌──────────────┐
        │   pending    │ ←── trigger (admin) | kickoffDailyCrawl (cron)
        └──────┬───────┘
               │ executeCrawlJob (action) — there is NO `startCrawl` or `enqueueCrawlJob` symbol
               ▼
        ┌──────────────┐
        │   running    │ ←── updates processedUrls, failedUrls
        └──────┬───────┘
               │
       ┌───────┼───────┬──────────┐
       ▼       ▼       ▼          ▼
 ┌────────┐ ┌──────┐ ┌────────┐ ┌────────┐
 │completed│ │failed│ │cancelled│ │running │
 │       │ │      │ │        │ │(stuck) │
 └────────┘ └──┬───┘ └────────┘ └────┬───┘
              │                      │ fail-stuck cron (>2h)
              ▼                      ▼
         ┌────────┐              ┌────────┐
         │ dead   │              │ failed │
         │ letter │              │        │
         └────────┘              └────────┘
              │ retry cron (4h)
              ▼
         (back to pending, attempts++)
```

**State transitions are server-only.** Never set `crawlJobs.status` directly from a client. See `reference.backend.md` §5.2 and §6 for the actual mutations.

### 11.2 `documents` state machine (verified)

```
pending → processing → indexed
   ↓          ↓
failed    pending_embed → indexed
              ↓
            failed
            active ↔ stale
```

**`documentValidator` has 19 fields** (per `convex/doc/validator.ts`): `_id`, `_creationTime`, `url`, `title`, `entryId`, `contentHash`, `source`, `category`, `subcategory`, `metadata`, `status` (7 literals), `chunkCount`, `chunksEmbedded`, `crawlSessionId`, `freshnessTier`, `isStale`, `crawledAt`, `updatedAt`, `error`.

### 11.3 User role state

```
user (default, on first sign-in) → admin (via /admin/users UI → Clerk Backend API → webhook sync → upsertFromWebhook; bootstrap via ADMIN_BOOTSTRAP_EMAIL on first creation)
```

**There is no `convex/users.ts::updateRole` public mutation.** Admin role changes are performed via Clerk Backend API server actions (`src/app/admin/users/actions.ts`). The Clerk webhook syncs `publicMetadata.role` to Convex via `upsertFromWebhook`, which also logs to `adminAuditLog`. First-admin bootstrap via `ADMIN_BOOTSTRAP_EMAIL` env var works on both `getOrCreate` and `upsertFromWebhook` (creation only). See §3.3.

### 11.4 Emergency stop

```
N/A — there is NO `appSettings.emergencyStop` flag
```

> `convex/emergencyStop.ts` is a **batch mutator** (not a flag check). `stopAll` is an `internalAction` that loops `stopBatch`, which mutates `documents.processing`→`failed` and `crawlJobs.running`→`cancelled` in 500-row batches. Invoke it directly from the Convex dashboard to stop running work.

---

## 12. Cross-Reference to Boundary Doc Caveats

`frontend_backend_boundaries.md` §21 contains caveats that span both sides. Summary:

| # | Caveat | Files affected |
| --- | --- | --- |
| 21.1 | Don't change `embeddingDimension: 768` | `convex/rag/instance.ts` (RAG component config — `convex/schema.ts` does NOT have a vector index on `crawledChunks`) |
| 21.2 | Don't change `filterNames: ["category", "source"]` | `convex/rag/instance.ts` (NOT `convex/schema.ts`) |
| 21.3 | Clerk `applicationID` must match | `convex/auth.config.ts`, Clerk dashboard |
| 21.4 | Don't weaken HMAC verify | `convex/crawl/webhook.ts` |
| 21.5 | Don't remove start-up env guard | `convex/http.ts` |
| 21.6 | LLM fallback chain must keep ≥1 step | `src/lib/llm-models.ts` |
| 21.7 | `requireAuth`/`requireAdmin` not optional | `convex/auth.ts` |
| 21.8 | Don't bypass type mirrors | `src/lib/types.ts` |
| 21.9 | Don't import server-only into client | Next.js build will fail |
| 21.10 | Sentry scrubbers don't catch everything | Never log API keys |
| 21.11 | Don't `git push --force` | git policy |
| 21.12 | Don't `git add -A` | git policy |
| 21.13 | No direct commits to `main` | git policy (per `AGENTS.md` system reminder) |
| 21.14 | Don't edit `convex/_generated/*` or `src/generated/*` | gitignored; Convex/Next regenerates |
| 21.15 | `node_modules` is read-only | n/a |
| 21.16 | `convex/_generated/*` is gitignored | n/a |
| 21.17 | `src/generated/*` is gitignored | n/a |
| 21.18 | `convex/crawl/reset.ts::resetDLQ` is destructive (patches `abandoned`→`pending_retry`) | require admin |
| 21.19 | `crawl.trigger` (`convex/crawl/trigger.ts`) should be admin-only | layout + BE check |
| 21.20 | Semantic cache tier selection in `cache/set.ts` | err on `low` |
| 21.21 | 4-key Gemini rotation `GEMINI_API_KEY` → `GEMINI_API_KEY_1` → `GEMINI_API_KEY_2` → `GOOGLE_GENERATIVE_AI_API_KEY` | set all four for production |
| 21.22 | Reranker URL is optional (graceful fallback to position-based) | `convex/reranking/rerank.ts` |
| 21.23 | `maxParallelism=3` for `embeddingWorkpool` | verify Gemini quota |
| 21.24 | Public matcher in `src/middleware.ts` must include `/sign-in(.*)`, `/sign-up(.*)`, `/api/webhooks(.*)` | auth reachability |
| 21.25 | **REMOVED** — there is no `appSettings.emergencyStop` flag in the verified code; use `convex/emergencyStop.ts::stopAll` instead | n/a |
| 21.26 | Real Sentry init is in `src/sentry.{client,server,edge}.config.ts`; `src/instrumentation.ts` is a thin `register()` wrapper | observability |
| 21.27 | The Python `scripts/` directory is the **offline tooling** layer (crawler, PDF ingest, eval harness) | not a Next.js concern; `AGENTS.md` mentions it |
| 21.28 | `convex/eval/` subdirectory has only stubs — BUT the legacy top-level `convex/eval.ts` (55 lines) DOES contain real `getChunksByRagIds` (internalQuery) and `evaluateSearch` (public action). Both are registered in `convex/_generated/api.d.ts:47,114`. | eval is partially implemented |
| 21.29 | The eval harness (`scripts/eval/run_eval.py`) calls the real `api.eval.evaluateSearch` (registered in the legacy `convex/eval.ts`). It does NOT fail with `Function not found`. The harness output keys are `recall_at_5` (primary), `fragment_hit_rate`, `recall_at_k` (alias), `top_k`, `total_pairs`, `elapsed_seconds`, `per_category`, `failures`, `eval_error`. | eval works for the legacy path |
| 21.30 | Eval regression threshold: `recall_at_5` drop > 0.5% (`delta < -0.005`) → exit code 2 (regression); `delta > 0.005` → "improved"; else "stable" | `scripts/eval/run_eval.py` |
| 21.31 | The golden set is 50 pairs (NOT 75 as AGENTS.md states, NOT 100 as architecture.md §20.2 states). `state.md` and `progress_log.md` both confirm 50 | per `wc -l scripts/eval/golden_set.jsonl` |
| 21.32 | The eval harness reads `CONVEX_URL` (NOT `NEXT_PUBLIC_CONVEX_URL`). The Python tooling does NOT read `NEXT_PUBLIC_CONVEX_SITE_URL`; it reads `CONVEX_SITE_URL` | env var mismatch |
| 21.33 | Test status as of 2026-05-30: 297/515 pass, 218 fail. Test suite was broken due to jsdom/vitest config issues; emergency protocol invoked | per `.agent/state.md` |
| 21.34 | `.gitignore` DOES exist in the monorepo (verified at `uet-gpt/.gitignore`) — the earlier claim of it being missing was wrong. | hygiene |
| 21.35 | `src/lib/analytics.ts` is a dev-only `console.log` shim — there is NO Vercel Analytics or Speed Insights integration in the codebase | no telemetry today |
| 21.36 | `src/app/(main)/chat/page.tsx` is the NEW-THREAD landing page (not a thin wrapper around `ChatThreadClient`); it calls `api.threads.create` and navigates to `/chat/[threadId]?q=...` | routing |
| 21.37 | `convex/crawl/reset.ts::resetDLQ` (public, cap 500) and `convex/crawl/reset_ops.ts::resetAbandonedDLQ` (internal, paginated) overlap in purpose but are not duplicates | the public one is for the admin UI button; the internal one is for cron |
| 21.38 | `convex/doc/list.ts` declares `cursor` arg but IGNORES it — pagination is not actually implemented | known gap |
| 21.39 | `convex/doc/validator.ts` has 7 status literals and `convex/doc/create.ts::updateStatus` now accepts all 7 (added `"active"` and `"pending_embed"`) | validator/mutator now in sync |

When in doubt, the boundary doc wins. The reference docs may lag.
