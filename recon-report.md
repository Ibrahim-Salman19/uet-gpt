# Recon Report

## Threat Model Status
**File**: `THREAT_MODEL.md` is essentially empty (contains only `# DRY RUN: threat-model`).
**Finding**: No threat model is defined. The analysis below is derived entirely from code review.

## Entry Points
| Endpoint | Method | Auth | File |
|----------|--------|------|------|
| `/api/chat` | POST | Protected (Clerk session) | `src/app/api/chat/route.ts` |
| `/api/webhooks/clerk` | POST | Unprotected (Svix signature) | `src/app/api/webhooks/clerk/route.ts` |
| `/api/health` | GET | Protected (CRON_SECRET Bearer) | `src/app/api/health/route.ts` |
| `/api/health/heartbeat` | GET | Unprotected | `src/app/api/health/heartbeat/route.ts` |
| `/api/cron` | GET | Protected (CRON_SECRET Bearer) | `src/app/api/cron/route.ts` |
| `/api/webhook/crawl` | POST | Protected (HMAC signature) | `convex/crawl/webhook.ts` |
| `/ingest` | POST | Protected (CONVEX_AUTH_TOKEN Bearer) | `convex/crawl/webhook.ts` |
| `/api/reset` | POST | Protected (CONVEX_AUTH_TOKEN Bearer) | `convex/crawl/webhook.ts` |
| `/api/webhook/clerk` | POST | Protected (CLERK_WEBHOOK_SECRET Bearer) | `convex/clerk/webhook.ts` |
| `threads.create` | mutation | Protected (Clerk identity) | `convex/threads.ts` |
| `threads.list` | query | Protected (Clerk identity) | `convex/threads.ts` |
| `threads.rename` | mutation | Protected (Clerk identity + thread owner) | `convex/threads.ts` |
| `threads.remove` | mutation | Protected (Clerk identity + thread owner) | `convex/threads.ts` |
| `messages.insert` | mutation | Protected (requireAuth + rate limit) | `convex/messages.ts` |
| `messages.list` | query | Protected (requireAuth + thread owner) | `convex/messages.ts` |
| `users.getOrCreate` | mutation | Protected (Clerk identity + clerkId match) | `convex/users.ts` |
| `users.getByClerkId` | query | Protected (Clerk identity + admin/self) | `convex/users.ts` |
| `users.deactivateUser` | mutation | Protected (Clerk identity + clerkId match) | `convex/users.ts` |
| `users.updatePreferences` | mutation | Protected (Clerk identity) | `convex/users.ts` |
| `users.upsertFromWebhook` | internalMutation | Internal only | `convex/users.ts` |
| `users.deleteFromWebhook` | internalMutation | Internal only | `convex/users.ts` |
| `feedback.submit` | mutation | Protected (Clerk identity + active user) | `convex/feedback/submit.ts` |
| `feedback.list` | query | Protected (Clerk identity) | `convex/feedback/list.ts` |
| `faq.addFaq` | mutation | Protected (requireAdmin) | `convex/faq.ts` |
| `faq.removeFaq` | mutation | Protected (requireAdmin) | `convex/faq.ts` |
| `faq.listFaqs` | query | **UNPROTECTED** | `convex/faq.ts` |
| `admin/settings.getSettings` | query | Protected (isAdmin) | `convex/admin/settings.ts` |
| `admin/settings.upsertSetting` | mutation | Protected (requireAdmin) | `convex/admin/settings.ts` |
| `admin/settings.resetSettings` | mutation | Protected (requireSuperadmin) | `convex/admin/settings.ts` |
| `admin/stats.documentStats` | query | Protected (requireAdmin) | `convex/admin/stats.ts` |
| `admin/stats.userStats` | query | Protected (requireAdmin) | `convex/admin/stats.ts` |
| `admin/stats.feedbackStats` | query | Protected (requireAdmin) | `convex/admin/stats.ts` |
| `admin/stats.crawlStats` | query | Protected (requireAdmin) | `convex/admin/stats.ts` |
| `admin/stats.deleteDocument` | mutation | Protected (requireAdmin) | `convex/admin/stats.ts` |
| `crawl.trigger` | mutation | Protected (requireAdmin) | `convex/crawl/trigger.ts` |
| `doc.search` | query | Protected (requireAuth) | `convex/doc/search.ts` |
| `doc.remove` | mutation | Protected (requireAdmin) | `convex/doc/remove.ts` |
| `health.heartbeat` | query | **UNPROTECTED** | `convex/health.ts` |
| `health.healthCheck` | query | Protected (requireAdmin) | `convex/health.ts` |
| `rateLimit.checkRateLimit` | mutation | Protected (Clerk identity) | `convex/rateLimit.ts` |
| `rag.retrieval.retrieveContext` | action | Protected (INTERNAL_API_SECRET) | `convex/rag/retrieval.ts` |
| `cache/set.setFromServer` | action | Protected (INTERNAL_API_SECRET or admin) | `convex/cache/set.ts` |
| `cache/get.get` | action | **UNPROTECTED** | `convex/cache/get.ts` |
| `embeddings/generate.generate` | action | **UNPROTECTED** | `convex/embeddings/generate.ts` |
| `embeddings/search.searchDocumentsAction` | action | **UNPROTECTED** | `convex/embeddings/search.ts` |
| `eval.evaluateSearch` | action | Protected (requireAdmin) | `convex/eval.ts` |
| `people/queries.getCount` | query | Protected (requireAdmin) | `convex/people/queries.ts` |
| `observability.getObservabilityData` | query | Protected (isAdmin) | `convex/observability/dashboard.ts` |

## Auth Model

### Layer 1: Clerk Middleware (Next.js Edge)
- File: `src/proxy.ts`
- Scope: All Next.js routes (page + API)
- Public routes: `/`, `/unauthorized`, `/sign-in*`, `/sign-up*`, `/api/webhooks/clerk*`, `/api/health*`, `/api/cron*`
- Admin routes: `/admin/*` requires `sessionClaims.metadata.role` to be `"admin"` or `"superadmin"`
- All other routes require Clerk session (`auth.protect()`)

### Layer 2: Clerk JWT Verification (Convex)
- File: `convex/auth.config.ts`
- Convex verifies Clerk JWTs via `CLERK_JWT_ISSUER` env var
- Identity: `ctx.auth.getUserIdentity()` returns Clerk `subject` (clerkId)

### Layer 3: Convex Authorization (Server-side)
- File: `convex/auth.ts`
- Functions:
  - `requireAuth(ctx)` -- verifies Clerk identity + user exists + isActive
  - `requireAdmin(ctx)` -- requires admin or superadmin role
  - `requirePermission(ctx, perm)` -- RBAC permission check
  - `isAuthenticated(ctx)`, `isAdmin(ctx)` -- boolean checks

### Layer 4: Webhook Authentication (Separate Secrets)
- Crawl webhook: HMAC-SHA256 signature with `CRAWL_WEBHOOK_SECRET` (+ optional `CRAWL_WEBHOOK_SECRET_NEW` for rotation), timestamp-based replay protection (5-min window)
- Clerk webhook (Convex): Bearer token using `CLERK_WEBHOOK_SECRET` or `CONVEX_AUTH_TOKEN`, constant-time comparison
- Clerk webhook (Next.js): Svix signature verification using `CLERK_SIGNING_SECRET`
- Ingest endpoint: Bearer token using `CONVEX_AUTH_TOKEN`
- Reset endpoint: Bearer token using `CONVEX_AUTH_TOKEN`
- RAG retrieval: `INTERNAL_API_SECRET` check
- Cache write: `INTERNAL_API_SECRET` check or admin auth

### Layer 5: Role-Based Access Control (RBAC)
- Server source of truth: `convex/auth.ts`
- Client mirror: `src/lib/permissions.ts`
- Roles: `user` -> `admin` -> `superadmin` (hierarchical)
- Permissions:
  - `user`: `chat:send`, `doc:read`
  - `admin`: + `crawl:trigger`, `crawl:list`, `doc:delete`, `settings:manage`, `users:manage`
  - `superadmin`: + `emergency:stop`
- Role source: Clerk `publicMetadata.role` synced to Convex `users.role` via webhook

### Layer 6: Rate Limiting (Dual System)
1. Next.js layer (`src/lib/rate-limit.ts`): Upstash Redis sliding window
   - User: 50 req/hr
   - Admin: 200 req/hr
   - Anonymous: 10 req/hr
2. Convex layer (`convex/rateLimit.ts`): Native DB-based sliding window
   - Per-user: 30 messages/min
   - Per-admin: 100 messages/min
   - Global: 200,000 tokens/min

## Data Flows

### Flow 1: User Chat Message
```
User Browser -> Clerk Session Cookie
  -> src/proxy.ts (edge middleware: auth.protect())
    -> POST /api/chat (src/app/api/chat/route.ts)
      -> CSRF check (Origin/Referer validation)
      -> Zod schema validation (body, max 100KB)
      -> Clerk auth() -> get userId + sessionClaims
      -> Resolve role from JWT metadata
      -> Upstash rate limit check
      -> ConvexHttpClient -> api.rag.retrieval.retrieveContext (INTERNAL_API_SECRET)
        -> scanForInjection(query) -- injection regex block
        -> classifyUserIntent -> Gemini/LLM
        -> enrichQuery (rewrite + HyDE)
        -> generateQueryEmbedding -> Gemini API
        -> semanticCache check (vector search)
        -> vector search -> @convex-dev/rag
        -> full-text search (Convex search index)
        -> cascade rerank (word overlap + optional Cohere)
        -> CRAG evaluation (Groq LLM)
        -> buildResponseContext (confidence tier instructions)
      -> streamText (LLM provider chain: Groq/Cerebras/Gemini)
      -> SSE stream back to client
      -> [after()]: write to semantic cache
```

### Flow 2: Crawl Webhook Ingestion
```
Crawl4AI Provider
  -> POST /api/webhook/crawl (convex/http.ts)
    -> Check ?type=state (skip state-change notifications)
    -> Content-length check (10MB max)
    -> Read body with size verification
    -> Verify HMAC headers (x-crawl-timestamp + x-crawl-signature)
    -> Verify HMAC signature (CRAWL_WEBHOOK_SECRET, 5-min skew)
    -> Parse payload, extract taskId + results
    -> Mark processed (deduplication via processedWebhooks)
    -> For each result:
      -> canonicalizeUrl, extract content
      -> normalizeContent, compute contentHash
      -> generateChunks (3000-char chunks)
      -> assignFreshnessTier
      -> queueChunksForEmbedding -> crawl.mutations
    -> finalizeJob (update crawlJobs stats)
```

### Flow 3: Clerk User Sync
```
Clerk (user.created/updated/deleted)
  -> POST /api/webhooks/clerk (src/app/api/webhooks/clerk/route.ts)
    -> Svix signature verification (CLERK_SIGNING_SECRET)
    -> Forward to POST {convex_site}/api/webhook/clerk (convex/clerk/webhook.ts)
      -> Bearer token check (CLERK_WEBHOOK_SECRET or CONVEX_AUTH_TOKEN)
      -> Constant-time token comparison
      -> Parse JSON payload
      -> Dispatch: user.created/updated -> users.upsertFromWebhook (internalMutation)
      -> Dispatch: user.deleted -> users.deleteFromWebhook (internalMutation)
        -> Syncs role from Clerk publicMetadata
        -> Audit logs role changes
```

### Flow 4: Ingest (Direct Document Ingestion)
```
Internal Service (Python crawler)
  -> POST /ingest (convex/http.ts)
    -> Bearer token check (CONVEX_AUTH_TOKEN)
    -> Domain allowlist check (uettaxila.edu.pk only)
    -> Parse & validate fields (url, markdown, contentHash, crawlSessionId, sourceType)
    -> upsertDocument (internalMutation)
    -> processIngestContent -> generateChunks -> enqueueDocumentChunks
```

## Trust Boundaries

### Boundary 1: Internet <-> Next.js Server
- Protection: HTTPS, CORS, CSP (report-only), HSTS, X-Frame-Options: DENY
- Middleware: Clerk session validation for non-public routes
- Edge checks: Admin role check via JWT claims at middleware level
- Rate limiting: Upstash Redis at Next.js layer

### Boundary 2: Next.js Server <-> Convex Backend
- Protection: Clerk JWT tokens (Convex verifies via CLERK_JWT_ISSUER)
- Internal actions: Protected by `INTERNAL_API_SECRET` (shared secret)
- HTTP webhooks: Protected by bearer tokens (CONVEX_AUTH_TOKEN, CLERK_WEBHOOK_SECRET)
- Convex mutations: Server-side auth checks (requireAuth, requireAdmin, requirePermission)

### Boundary 3: Crawl Provider <-> Convex
- Protection: HMAC-SHA256 signature verification
- Replay protection: 5-minute timestamp window
- Deduplication: processedWebhooks table prevents reprocessing
- Payload limits: 10MB max for crawl webhooks, 4MB for /ingest
- Domain allowlist: Only uettaxila.edu.pk for /ingest

### Boundary 4: Convex <-> External LLM Providers
- Protection: API keys in environment variables only
- Failover: Multi-key rotation for Gemini (GEMINI_API_KEY, _1, _2, GOOGLE_GENERATIVE_AI_API_KEY)
- No cross-provider embedding fallback (different latent spaces would break similarity)

### Boundary 5: Database Access
- Protection: Convex's built-in row-level security (all queries/mutations run as authenticated users or internal)
- Internal mutations: Only callable from Convex server context, never exposed to HTTP
- Schema validation: Convex v() validators on all inputs

## New/Changed Files
Since last recon (HEAD~10):
- `THREAT_MODEL.md` (empty)
- `convex/admin/settings.ts`
- `convex/admin/stats.ts`
- `convex/cache/get.ts`
- `convex/cache/internal_queries.ts`
- `convex/cache/set.ts`
- `convex/clerk/webhook.ts`
- `convex/crawl/actions.ts`
- `convex/crawl/chunking.ts`
- `convex/crawl/mutations.ts`
- `convex/crawl/queries.ts`
- `convex/crawl/reset_ops.ts`
- `convex/crawl/staleness.ts`
- `convex/crawl/webhook.ts`
- `convex/crons.ts`
- `convex/doc/create.ts`
- `convex/doc/list.ts`
- `convex/doc/remove.ts`
- `convex/doc/search.ts`
- `convex/embeddings/doc_queries.ts`
- `convex/embeddings/generate.ts`
- `convex/embeddings/search.ts`
- `convex/emergencyStop.ts`
- `convex/eval.ts`
- `convex/faq.ts`
- `convex/feedback/list.ts`
- `convex/feedback/submit.ts`
- `convex/health.ts`
- `convex/http.ts`
- `convex/messages.ts`
- `convex/people/queries.ts`
- `convex/rag/context.ts`
- `convex/rag/crag.ts`
- `convex/rag/retrieval.ts`
- `convex/rag/routing.ts`
- `convex/rateLimit.ts`
- `convex/reranking/rerank.ts`
- `convex/schema.ts`
- `convex/threads.ts`
- `convex/users.ts`
- `src/app/(main)/chat/[threadId]/page.tsx`
- `src/app/(main)/chat/page.tsx`
- `src/app/(main)/explore/page.tsx`
- `src/app/(main)/settings/page.tsx`
- `src/app/admin/analytics/page.tsx`
- `src/app/admin/documents/page.tsx`
- `src/app/admin/page.tsx`
- `src/app/admin/settings/page.tsx`
- `src/app/admin/users/actions.ts`
- `src/app/admin/users/page.tsx`
- `src/app/api/chat/route.ts`
- `src/app/api/health/heartbeat/route.ts`
- `src/app/api/health/route.ts`
- `src/components/auth/auth-guard.tsx`
- `src/components/chat/chat-messages.tsx`
- `src/components/chat/message-actions.tsx`
- `src/components/chat/source-card.tsx`
- `src/components/preferences-provider.tsx`
- `src/components/providers.tsx`
- `src/components/sidebar/history.tsx`
- `src/components/sidebar/index.tsx`
- `src/components/sidebar/new-chat-button.tsx`
- `src/hooks/use-debounce.ts`
- `src/hooks/use-messages.ts`
- `src/hooks/use-stable-query.ts`
- `src/hooks/use-user-data.ts`
- `src/lib/constants.ts`
- `src/lib/rate-limit.ts`
- `src/proxy.ts`
- `vercel.json`

## File List

### Next.js Application Layer (`src/`)
- `src/proxy.ts`
- `src/app/api/chat/route.ts`
- `src/app/api/webhooks/clerk/route.ts`
- `src/app/api/health/route.ts`
- `src/app/api/health/heartbeat/route.ts`
- `src/app/api/cron/route.ts`
- `src/app/admin/users/actions.ts`
- `src/lib/rate-limit.ts`
- `src/lib/permissions.ts`
- `src/lib/clerk-claims.ts`
- `src/lib/prompt.ts`
- `src/lib/llm-models.ts`
- `src/lib/constants.ts`
- `src/lib/types.ts`
- `src/lib/retry.ts`
- `src/lib/utils.ts`
- `src/lib/clerk-theme.ts`
- `src/hooks/use-chat.ts`
- `src/hooks/use-messages.ts`
- `src/hooks/use-threads.ts`
- `src/hooks/use-user-data.ts`
- `src/hooks/use-stable-query.ts`
- `src/hooks/use-debounce.ts`
- `src/hooks/stream-registry.ts`
- `src/instrumentation.ts`
- `next.config.ts`

### Convex Backend Layer (`convex/`)
- `convex/http.ts`
- `convex/schema.ts`
- `convex/auth.ts`
- `convex/auth.config.ts`
- `convex/users.ts`
- `convex/threads.ts`
- `convex/messages.ts`
- `convex/rateLimit.ts`
- `convex/emergencyStop.ts`
- `convex/health.ts`
- `convex/faq.ts`
- `convex/eval.ts`
- `convex/crons.ts`
- `convex/constants.ts`
- `convex/convex.config.ts`
- `convex/clerk/webhook.ts`
- `convex/crawl/webhook.ts`
- `convex/crawl/actions.ts`
- `convex/crawl/trigger.ts`
- `convex/crawl/mutations.ts`
- `convex/crawl/chunking.ts`
- `convex/crawl/jobs.ts`
- `convex/crawl/tasks.ts`
- `convex/crawl/queries.ts`
- `convex/crawl/workflow.ts`
- `convex/crawl/workpools.ts`
- `convex/crawl/staleness.ts`
- `convex/crawl/deduplication.ts`
- `convex/crawl/backfill.ts`
- `convex/crawl/reset.ts`
- `convex/crawl/reset_ops.ts`
- `convex/crawl/status.ts`
- `convex/crawl/list.ts`
- `convex/rag/retrieval.ts`
- `convex/rag/context.ts`
- `convex/rag/routing.ts`
- `convex/rag/crag.ts`
- `convex/rag/faithfulness.ts`
- `convex/rag/instance.ts`
- `convex/rag/testing.ts`
- `convex/rag/prompts.ts`
- `convex/rag/constants.ts`
- `convex/reranking/rerank.ts`
- `convex/reranking/cascade.ts`
- `convex/reranking/groqRerank.ts`
- `convex/embeddings/generate.ts`
- `convex/embeddings/search.ts`
- `convex/embeddings/contextualize.ts`
- `convex/embeddings/contextualizeCron.ts`
- `convex/embeddings/idf.ts`
- `convex/embeddings/metadata.ts`
- `convex/embeddings/chunkTextSearch.ts`
- `convex/embeddings/doc_queries.ts`
- `convex/cache/get.ts`
- `convex/cache/set.ts`
- `convex/cache/internal_queries.ts`
- `convex/cache/multiVector.ts`
- `convex/doc/create.ts`
- `convex/doc/search.ts`
- `convex/doc/remove.ts`
- `convex/doc/list.ts`
- `convex/doc/get.ts`
- `convex/doc/index.ts`
- `convex/doc/validator.ts`
- `convex/admin/settings.ts`
- `convex/admin/stats.ts`
- `convex/people/queries.ts`
- `convex/feedback/submit.ts`
- `convex/feedback/list.ts`
- `convex/observability/dashboard.ts`
- `convex/observability/metrics.ts`
- `convex/observability/metricsAggregator.ts`
- `convex/observability/staleness.ts`
- `convex/observability/internal.ts`
- `convex/observability/index.ts`
- `convex/users/validator.ts`
- `convex/threads/validator.ts`
- `convex/messages/validator.ts`

## Suspicious Patterns

### HIGH Priority
**H0. Missing Threat Model**
- File: `THREAT_MODEL.md`
- Issue: Threat model file is empty (`# DRY RUN: threat-model`). No trust boundaries, attack surface, or security assumptions documented.
- Risk: Security decisions made without formal threat analysis. New features may introduce unanticipated attack vectors.

**H1. Unprotected Heartbeat Endpoint**
- File: `src/app/api/health/heartbeat/route.ts`
- Issue: GET `/api/health/heartbeat` endpoint has NO authentication. Directly queries Convex backend without session validation.
- Risk: Information disclosure (Convex connectivity status). Could be used as oracle for Convex availability.

**H2. Unprotected Cache/Embedding/Search Actions**
- Files: `convex/cache/get.ts`, `convex/embeddings/generate.ts`, `convex/embeddings/search.ts`
- Issue: `cache/get.get`, `embeddings/generate.generate`, and `embeddings/search.searchDocumentsAction` actions have NO authentication checks.
- Risk: Unauthenticated users could embed arbitrary text (consuming Gemini API quota), search document index, and read cached responses.

**H3. Rate Limiter Fail-Open Design**
- Files: `src/lib/rate-limit.ts`, `convex/rateLimit.ts`
- Issue: Both rate limiters fail open. If Upstash Redis is unavailable, `checkChatRateLimit` returns null (allowing through).
- Risk: Complete rate limit bypass during Redis outages.

### MEDIUM Priority
**M1. Cron Endpoint Dev-Mode Bypass**
- File: `src/app/api/cron/route.ts`
- Issue: If `CRON_SECRET` is not set and `NODE_ENV=development`, cron endpoint allows all requests without authentication.
- Risk: If `NODE_ENV` is misconfigured in production, cron tasks are unprotected.

**M2. Health Check Exposes Service Details**
- File: `src/app/api/health/route.ts`
- Issue: Health endpoint reveals which AI providers are configured, their latency, error details, and `process.uptime()`.
- Risk: Information leakage about infrastructure to authenticated callers.

**M3. CORS Wildcard on Unrestricted Endpoints**
- File: `convex/http.ts`
- Issue: For `/api/webhook/crawl` and `/ingest` OPTIONS handlers, `Access-Control-Allow-Origin` reflects raw Origin header.
- Risk: Potential CORS misconfiguration enabling CSRF-like attacks from arbitrary origins if auth is bypassed.

## Coverage Matrix Note
Previous scans (2026-06-15 Iter 1 & 3) reported 0 findings for all attack classes. This recon identifies multiple HIGH and MEDIUM priority vulnerabilities not previously detected, indicating gaps in prior security analysis.