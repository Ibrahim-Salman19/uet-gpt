# Reference (Frontend)

> **Audience.** AI / agent developers adding/changing UI, route handlers, components, hooks, lib utilities, middleware, or build config.
>
> **Index.** See [`reference.md`](./reference.md) §6.1 for the file-to-purpose index and §6.2 for the symbol index. Deep signatures live here.
>
> **Companion.** Forbidden actions in [`frontend_backend_boundaries.md`](./frontend_backend_boundaries.md) and narrative in [`architecture.md`](./architecture.md). Backend signatures in [`reference.backend.md`](./reference.backend.md). Cross-boundary facts in [`reference.cross-cutting.md`](./reference.cross-cutting.md).

---

## Table of Contents

1. [How to Use This File](#1-how-to-use-this-file)
2. [Annotated Directory Tree (Full)](#2-annotated-directory-tree-full)
3. [App Router](#3-app-router)
4. [Route Handlers (`src/app/api/*`)](#4-route-handlers-srcappapi)
5. [Components](#5-components)
6. [Hooks](#6-hooks)
7. [Lib Utilities](#7-lib-utilities)
8. [Middleware](#8-middleware)
9. [Build Config (`next.config.ts`)](#9-build-config-nextconfigts)
10. [Styling & Theme](#10-styling--theme)
11. [Observability (Sentry only)](#11-observability-sentry-only--vercel-analytics-is-not-integrated)
12. [Environment Variables (FE surface)](#12-environment-variables-fe-surface)

---

## 1. How to Use This File

**Read by intent:**

| If you want to… | Jump to |
| --- | --- |
| Add a new page | §3 (App Router) - copy an existing pattern |
| Add a new API route | §4 (Route Handlers) - copy a protected or webhook route |
| Add a new client component | §5 (Components) - read providers.tsx first |
| Add a new hook | §6 (Hooks) - keep server/client boundaries clean |
| Add a new lib helper | §7 (Lib) - decide server vs client vs mixed |
| Change auth/redirect rules | §8 (Middleware) - public matcher list |
| Add a webpack/turbopack alias | §9 (Build Config) |
| Change theme/colors | §10 (Styling & Theme) - CSS variables, not JS |
| Add observability | §11 (Sentry only; no Vercel Analytics integration) |

**Conventions:**

- **RBAC:** `public` (no auth) · `auth` (Clerk session) · `admin` (Clerk session + admin role) · `webhook` (signature-verified) · `cron` (Vercel cron secret) · `internal` (server-only, never exposed).
- **Runtime:** Next.js 16 server runtime. `route.ts` = server-only by default. Page files = server unless `"use client"` directive.
- **Forbidden:** don't import server-only modules from client components. Don't bypass `requireUser`/`requireAdmin` in `route.ts`.

---

## 2. Annotated Directory Tree (Full)

```
uet-gpt/
├── package.json                    # Deps, scripts (dev, build, lint, typecheck)
├── next.config.ts                  # Aliases, Sentry wrap, security headers, images
├── tsconfig.json                   # TS paths, strict mode
├── postcss.config.mjs              # Tailwind 4 PostCSS plugin
├── tailwind.config.ts              # Tailwind 4 config (exists - not minimal/missing)
├── .gitignore                      # Standard Next.js gitignore (verified)
│
├── src/
│   ├── app/
│   │   ├── layout.tsx              # Root layout, fonts, providers
│   │   ├── globals.css             # Tailwind 4 + CSS variables (theme)
│   │   ├── page.tsx                # Server component: `redirect("/chat")` (NOTE: redirects here, NOT only in next.config.ts)
│   │   ├── (main)/                 # **Authed route group**
│   │   │   ├── layout.tsx          # App shell (sidebar + main) - NO auth() call (middleware handles it)
│   │   │   ├── chat/
│   │   │   │   ├── page.tsx        # NEW-THREAD landing (creates thread + navigates to [threadId]?q=...)
│   │   │   │   ├── error.tsx
│   │   │   │   ├── loading.tsx
│   │   │   │   └── [threadId]/
│   │   │   │       ├── page.tsx    # Server: unwraps async params, renders <ChatThreadClient>
│   │   │   │       ├── client.tsx  # Client: ChatThreadClient - actual chat thread UI
│   │   │   │       ├── error.tsx
│   │   │   │       └── loading.tsx
│   │   │   ├── explore/
│   │   │   │   ├── page.tsx        # CLIENT ("use client") - browse index
│   │   │   │   ├── error.tsx
│   │   │   │   └── loading.tsx
│   │   │   └── settings/
│   │   │       ├── page.tsx        # CLIENT ("use client") - user settings
│   │   │       ├── error.tsx
│   │   │       └── loading.tsx
│   │   ├── admin/                  # Admin route group (role-gated)
│   │   │   ├── layout.tsx          # CLIENT ("use client") - has internal ClientOnly wrapper; does NOT call requireAdmin
│   │   │   ├── page.tsx            # CLIENT ("use client") - Overview dashboard (6 StatCards + recent jobs/feedback)
│   │   │   ├── analytics/page.tsx  # CLIENT ("use client")
│   │   │   ├── crawls/page.tsx     # CLIENT ("use client") - NOTE plural
│   │   │   ├── documents/page.tsx  # CLIENT ("use client")
│   │   │   ├── feedback/page.tsx   # CLIENT ("use client")
│   │   │   └── settings/page.tsx   # CLIENT ("use client")
│   │   ├── sign-in/[[...sign-in]]/page.tsx
│   │   ├── sign-up/[[...sign-up]]/page.tsx
│   │   ├── unauthorized/page.tsx
│   │   └── api/
│   │       ├── chat/route.ts       # LLM streaming (POST) - auth-protected, ConvexHttpClient + LLM_FALLBACK_CHAIN
│   │       ├── cron/route.ts       # verifyCronSecret (Bearer OR ?cron_secret=); calls crawl/tasks:aggregateDailyStats
│   │       ├── health/route.ts     # CRON_SECRET bearer, checks Convex/Groq/Gemini/Cerebras/Clerk
│   │       └── webhooks/clerk/route.ts  # svix Webhook.verify signature
│   │
│   ├── components/                 # 5 dirs + 3 root-level files
│   │   ├── providers.tsx           # Client provider orchestration + INLINE UserSync function (private, not exported)
│   │   ├── theme-provider.tsx      # ThemeProvider + useTheme (lowercase, hyphenated; no theme/ subdirectory)
│   │   ├── preferences-provider.tsx  # PreferencesProvider + usePreferences (5 accent themes, 4 modal states, audio synth)
│   │   ├── ui/                     # **23** Radix wrappers (Button, Dialog, Calendar, Form, …)
│   │   ├── auth/                   # 1 file: auth-guard.tsx (AuthGuard with requireAdmin prop)
│   │   ├── chat/                   # 9 files: chat-window, chat-messages, chat-message, chat-input-new, glass-portal, chat-suggestions, source-list, source-card, message-actions
│   │   ├── shared/                 # 4 files: loading-spinner, confirm-dialog, responsive-container, page-header
│   │   └── sidebar/                # 5 files: index (Sidebar), header, history, new-chat-button, search
│   │
│   ├── hooks/                      # 13 files (see §6 for full list)
│   │   ├── use-chat.ts             # LLM streaming via fetch /api/chat + streamRegistry
│   │   ├── use-threads.ts          # create/list/delete/rename via api.threads.*
│   │   ├── use-stable-query.ts     # Wraps useQuery with stable ref
│   │   ├── stream-registry.ts      # Subscribable streaming state
│   │   ├── use-debounce.ts, use-local-storage.ts, use-media-query.ts,
│   │   ├── use-messages.ts, use-mounted.ts, use-user-data.ts
│   │
│   ├── lib/
│   │   ├── auth.ts                 # requireUser/requireAdmin/getUserRole (Clerk server; throws Error)
│   │   ├── convex.ts               # [DELETED June 2026] - was ConvexReactClient + ConvexHttpClient; nothing imported them
│   │   ├── rate-limit.ts           # Upstash sliding window; checkChatRateLimit(identifier, role)
│   │   ├── constants.ts            # UET_CRAWL_CONFIG (23 seedUrls, maxPages=500, maxDepth=5) + re-exports CACHE_SIMILARITY_THRESHOLD
│   │   ├── types.ts                # Plain-TS type mirrors
│   │   ├── llm-models.ts           # LLM_FALLBACK_CHAIN (4 entries, no env reads)
│   │   ├── retry.ts                # **retryWithBackoff** (NOT `withRetry`) - exponential backoff
│   │   ├── utils.ts                # cn() helper
│   │   ├── analytics.ts            # Intentional no-op stubs (see architecture.md §21.15)
│   │   ├── prompt.ts               # buildSystemPrompt + extractText (shared by route.ts + tests)
│   │   ├── clerk-claims.ts         # ClerkSessionClaims + isAdminRole + ADMIN_ROLES
│   │   └── clerk-theme.ts          # UET Clerk appearance (uetClerkAppearance)
│   │
│   ├── sentry.{client,server,edge}.config.ts  # Real Sentry init (server: tracesSampleRate 0.1 prod / 1.0 dev; client: + replays session 0.1 / error 1.0)
│   ├── instrumentation.ts          # THIN register() wrapper (real Sentry init is in src/sentry.*.config.ts)
│   └── middleware.ts               # clerkMiddleware; public: /sign-in, /sign-up, /api/webhooks
│
├── public/                          # Static assets
│
├── scripts/                         # Python tooling (offline)
│   ├── crawler.py                  # Async BFS crawler (curl_cffi + trafilatura)
│   ├── ingest_pdf.py               # PDF ingestion (pymupdf4llm primary, Gemini VLM fallback)
│   └── eval/                       # **50-pair** golden set + run_eval.py harness (uses eval:evaluateSearch)
│
└── .agent/                          # Agent state (state.md, progress_log.md, incident_log.md)
```

> **There is NO `src/styles/` directory.** Tree drafts that include it are speculative.
> **`src/app/(main)/*/error.tsx` and `loading.tsx` exist for chat, explore, settings** but are omitted by some drafts.

---

## 3. App Router

Next.js 16 App Router. Each page is a Server Component by default. Client islands opt-in with `"use client"`.

### 3.1 Root

| File | Type | RBAC | Purpose |
| --- | --- | --- | --- |
| `src/app/layout.tsx` | layout (server) | public | HTML shell, fonts, `<Providers>` |
| `src/app/page.tsx` | page (server, `dynamic="force-dynamic"`) | public | 7-line `redirect("/chat")` (one of TWO redirect layers - also in `next.config.ts` `redirects()`) |
| `src/app/globals.css` | stylesheet | - | Tailwind 4 + CSS vars (theme tokens) |
| `src/app/unauthorized/page.tsx` | page (server, `dynamic="force-dynamic"`) | public | "Access Denied" card with shield SVG + links to `/chat` and `/` |

**`layout.tsx` is the only place to add `<html>`/`<body>`** and the provider tree.

### 3.2 `/(main)/chat/[threadId]`

| File | Type | RBAC | Purpose |
| --- | --- | --- | --- |
| `src/app/(main)/layout.tsx` | layout (server) | auth (via middleware) | App shell (sidebar + main) - **does NOT call `auth()` or `redirect("/sign-in")`**; middleware does the gate. Layout is just `BackdropWrapper` + `AmbientGlow` + `ConnectionStatus` + `ConvexReadyGate` + `MainShell` + `CommandPalette` + `PreferencesModal` + `VoiceModalWrapper`. |
| `src/app/(main)/chat/page.tsx` | page (**client**, `"use client"`) | auth | **NEW-THREAD landing** - welcome screen with 4 default suggestion chips; calls `api.threads.create`, waits 150ms, then `router.push(\`/chat/${threadId}?q=...\`)` |
| `src/app/(main)/chat/[threadId]/page.tsx` | page (server, async) | auth | Unwraps `params` + `searchParams` promises, renders `<ChatThreadClient threadId={threadId} initialMessage={q} />` |
| `src/app/(main)/chat/[threadId]/client.tsx` | client component | auth | **ChatThreadClient** - actual thread UI; uses `useMessages` + `useChat`; auto-fires `initialMessage` once via `useRef` guard |
| `src/app/(main)/explore/page.tsx` | page (**client**, `"use client"`) | auth | Browse index |
| `src/app/(main)/settings/page.tsx` | page (**client**, `"use client"`) | auth | User settings (fontSize, model) |

> The `(main)` route group is auth-gated by **`src/middleware.ts`**, NOT by the layout. The layout contains NO `auth()` call. The path segment `chat/[threadId]` is exposed; `(main)` is invisible in URLs.

**The middleware does the auth check (verified in `src/middleware.ts`):**

```ts
const isPublicRoute = createRouteMatcher([
  "/sign-in(.*)", "/sign-up(.*)", "/api/webhooks(.*)",
]);
export default clerkMiddleware((auth, req) => {
  if (!isPublicRoute(req)) auth().protect();
});
```

### 3.3 `/admin`

| File | Type | RBAC | Purpose |
| --- | --- | --- | --- |
| `src/app/admin/layout.tsx` | layout (**client**, `"use client"`) | admin | Has internal `ClientOnly` wrapper; sidebar with 6 nav items; **does NOT call `requireAdmin()`** (verified) |
| `src/app/admin/page.tsx` | page (**client**, `"use client"`) | admin | **Overview dashboard** - **6** `StatCard`s (3 primary: Total Documents / Active Users Today / Crawl Jobs; 3 secondary: Total Feedback / Cache Entries / Document Issues), document status progress bars, recent crawl jobs + feedback lists |
| `src/app/admin/analytics/page.tsx` | page (**client**, `"use client"`) | admin | Analytics dashboard (uses `useQuery` from hooks) |
| `src/app/admin/crawls/page.tsx` | page (**client**, `"use client"`) | admin | Crawl jobs (NOTE plural: `crawls`, not `crawl`) |
| `src/app/admin/documents/page.tsx` | page (**client**, `"use client"`) | admin | Document browser |
| `src/app/admin/feedback/page.tsx` | page (**client**, `"use client"`) | admin | Feedback list |
| `src/app/admin/settings/page.tsx` | page (**client**, `"use client"`) | admin | appSettings editor |

**`requireAdmin` is in `src/lib/auth.ts`** - see §7.1. **The admin layout does NOT actually call it.** There is no admin route in the codebase that calls `requireAdmin()`. The middleware lets authed users reach `/admin/*`; the BE Convex functions re-check with `requireAdmin`. This is a **known gap** - if a non-admin authed user navigates to `/admin/*`, they will see the layout but data calls will fail with `FORBIDDEN` from Convex.

### 3.4 `/sign-in`, `/sign-up`, `/unauthorized`

Clerk catch-all routes. Read by `[[...sign-in]]` and `[[...sign-up]]`.

| File | Purpose |
| --- | --- |
| `src/app/sign-in/[[...sign-in]]/page.tsx` | Wraps `<SignIn />` from `@clerk/nextjs` - passes `appearance={uetClerkAppearance}` (from `src/lib/clerk-theme.ts`) |
| `src/app/sign-up/[[...sign-up]]/page.tsx` | Wraps `<SignUp />` |
| `src/app/unauthorized/page.tsx` | Custom 403 page (e.g. for non-admins hitting `/admin/*`) |

**`src/lib/clerk-theme.ts` IS the source of truth** for Clerk appearance, and `sign-in/page.tsx` imports + passes it (`appearance={uetClerkAppearance}` at line 30). The earlier "Don't pass appearance props here" advice was self-contradictory - the file does pass it. Edit `clerk-theme.ts` to change Clerk's look; sign-in/page.tsx consumes that export.

### 3.5 `/api/*` (route handlers)

See §4.

---

## 4. Route Handlers (`src/app/api/*`)

### 4.1 `POST /api/chat` - LLM streaming (verified)

**File:** `src/app/api/chat/route.ts` · RBAC: **auth** (Clerk session required; `if (!userId) return 401` at line 297–300). NOT public.

**Pre-flight checks (verified):**
- **CSRF** (lines 262–285): validates `Origin` + `Referer` against `NEXT_PUBLIC_APP_URL` (and `http://localhost:3000` in dev). Returns `403` on mismatch.
- **DoS guard** (lines 287–334): body size ≤ 100 KB; per-message content ≤ 8000 chars.

**Request:**

```ts
{
  messages: { role: "user" | "assistant", content: string }[],   // NO zod validation
}
```

The route uses `ConvexHttpClient` (NOT Convex hooks) for the RAG retrieval call, has `MODEL_MAPPING` (3 Groq models: llama-4-scout, llama-3.3-70b, llama-3.1-8b), and `LLM_FALLBACK_CHAIN` rotation. `getAvailableModels` rotates the preferred + chain.

**Flow:**

1. CSRF origin check (403 on fail)
2. Body size + content length check
3. `auth()` - return 401 if no Clerk session
4. `checkChatRateLimit(identifier, role)` (Upstash sliding window) - see §4.1.1; returns 429 on hit, fails open on null
5. **Single** Convex call: `convex.action(api.rag.retrieval.retrieveContext, { question })` (line 367) - this is the cache lookup + RAG retrieval + injection scan, all in one (NOT split into 3 separate steps)
6. `streamText` against `LLM_FALLBACK_CHAIN`
7. On success, write sources into `X-Sources` response header (base64-encoded JSON)
8. Stream back to client via `use-chat.ts::handleSend`

> **The user message is inserted via `use-chat.ts`** (line 59–63) using `useMutation(api.messages.insert)` - NOT from this route. The route only streams the assistant response.
> **The Convex `enforceRateLimit` is NOT called from this route** - it lives in `convex/rateLimit.ts` and is invoked from `convex/messages.ts` (called by the messages insert on the BE).

**Response:** Server-Sent Events via Vercel AI SDK `streamText`. Each chunk is a token delta. Sources are in the `X-Sources` header (NOT in the stream body).

**Error responses (actual):**

| Code | When (verified) |
| --- | --- |
| `400` | Invalid JSON body, per-message content > 8000 chars |
| `403` | CSRF origin mismatch |
| `401` | No Clerk session |
| `429` | Upstash rate limit hit (returns `{ error: "Rate limit exceeded" }`) |
| `500` | Convex unconfigured (no URL), no AI providers configured, all-providers-failed (caught and re-thrown as "An unexpected error occurred"), or any other unhandled error |

#### 4.1.1 Upstash rate limit (FE layer - only one Next.js layer)

`src/lib/rate-limit.ts` - Upstash sliding window (`Ratelimit.slidingWindow`, `analytics: true`). Tiers: `user=50/h`, `admin=200/h`, `anon=10/h`. **There is no in-memory rate limit layer in the verified code.**

**API (verified):**
- `checkChatRateLimit(identifier: string, role: "user" | "admin" | "superadmin" | "anonymous"): Promise<RatelimitResponse | null>` - returns the response, or `null` if Upstash is unreachable (fails open).
- `getChatRateLimitRemaining(identifier, role): Promise<number | null>` - for UI display.

`checkChatRateLimit` returns `null` if Upstash is unavailable (i.e. **fails open** - the request continues and the Convex layer applies). The chat route treats `null` as pass-through (no 429 on null). There is **no `safeLimit` symbol** in the codebase.

### 4.2 `GET /api/cron` - Vercel cron entry

**File:** `src/app/api/cron/route.ts` · RBAC: cron

Auth: `Authorization: Bearer ${CRON_SECRET}` header **OR** `?cron_secret=${CRON_SECRET}` query (verified, line 23 - NOT `?secret=`).

**The route is NOT a health check / ack** - it actually invokes work: `convex/crawl/tasks.ts::aggregateDailyStats` (line 52). It is the FE entry point for daily aggregation work. Convex-internal crons (in `convex/crons.ts`) run separately; this route is for Vercel cron.

### 4.3 `GET /api/health` - Health probe

**File:** `src/app/api/health/route.ts` · RBAC: internal

Auth: `Authorization: Bearer ${CRON_SECRET}` header (verified, line 51). Does NOT check `?cron_secret=` query param (unlike cron).

Returns 200 with service status JSON (or 503 when all 5 services are unreachable - "error" overall status). Pings **5 services**: Convex, Groq, Gemini, Cerebras, Clerk (NOT 3 as the earlier draft said). Used by:

- Vercel uptime monitor
- Internal canary checks
- Sentry release health

### 4.4 `POST /api/webhooks/clerk` - Clerk lifecycle

**File:** `src/app/api/webhooks/clerk/route.ts` · RBAC: webhook

Auth: svix signature (`CLERK_SIGNING_SECRET`, NOT `CLERK_WEBHOOK_SECRET`).

Handles events: `user.created` and `user.updated` ONLY (verified, line 35). **No `user.deleted` handler** - if a user is deleted in Clerk, the Convex `users` row is orphaned.

On success calls Convex `users:getOrCreate` via `client.mutation("users:getOrCreate", ...)` (line 58, using a string reference - functionally equivalent to `api.users.getOrCreate`). The shared `WEBHOOK_SECRET` is passed as a secret arg.

**There is NO admin role bootstrap** in this handler. `ADMIN_EMAILS` is not referenced. The code does NOT call `clerkClient.users.updateUserMetadata`. Admin role is a manual two-step process (Convex dashboard + Clerk dashboard); see `reference.cross-cutting.md` §3.3.

**Always returns 200 on success** (line 69: `return new Response("ok", { status: 200 })`) so Clerk doesn't retry.

---

## 5. Components

### 5.1 `src/components/providers.tsx` - the orchestrator

The single most important client component. Wraps every other page in the provider tree.

> **Earlier drafts of this section had an inaccurate code block.** The verified file is more nuanced:
> - `ConvexReactClient` is constructed **inline** in `useState` (line 58–61), NOT imported from `src/lib/convex.ts`. `src/lib/convex.ts` was deleted in June 2026 - it was dead code (nothing imported its exports).
> - If `convexClient` is `null` (URL missing), the `Providers` function returns ONLY `ThemeProvider > PreferencesProvider > content` (line 76–82) - no `ClerkProvider`, no `ConvexProviderWithClerk`, no `UserSync`. This is a fallback render path.
> - The mutation variable is `createUser`, not `getOrCreate`.
> - The mutation args are `{ clerkId, name, email, imageUrl }` (flat shape), NOT `{ clerkUser: { id, email, name } }` (nested).
> - The actual provider order is `ClerkProvider > ConvexProviderWithClerk > ThemeProvider > PreferencesProvider > UserSync > content > TooltipProvider > Toaster` (ThemeProvider and PreferencesProvider order swapped from earlier drafts).
> - There's a `console.log("Convex URL loaded on client:", convexUrl)` debug line at the top.

**Provider order (top → bottom, verified):**

1. `ClerkProvider` - session
2. `ConvexProviderWithClerk` - passes Clerk auth to Convex
3. `ThemeProvider` - light/dark (BEFORE PreferencesProvider in actual code)
4. `PreferencesProvider` - user prefs (theme, accent, etc.)
5. `UserSync` - sync Clerk user to Convex (inside the provider tree)
6. `TooltipProvider` - Radix tooltips
7. `Toaster` - notifications
8. `{children}` - app

**`UserSync` (inline, not exported):**

- Mutation variable: `createUser = useMutation(api.users.getOrCreate)`
- Args shape: `{ clerkId: user.id, name, email, imageUrl }` (FLAT, not nested)
- Retry: 3 attempts, exponential backoff (1s, 2s, 4s) via inline `1000 * 2 ** attempt` (verified lines 27–49; does **NOT** use `retryWithBackoff` from `src/lib/retry.ts` - that helper exists but is unused in the codebase).
- If all fail, error surfaces to Sentry; next mount retries.

### 5.2 Component directory guide (verified)

| Directory / File | Purpose | Style | Count |
| --- | --- | --- | --- |
| `src/components/providers.tsx` | Client provider orchestration + **INLINE** `UserSync` (NOT exported) | client; orchestrator | 1 |
| `src/components/theme-provider.tsx` | `ThemeProvider` + `useTheme` | client; localStorage + `prefers-color-scheme` | 1 |
| `src/components/preferences-provider.tsx` | `PreferencesProvider` + `usePreferences` (5 accent themes, 4 modal states, audio synth) | client; large context | 1 |
| `src/components/ui/` | Radix UI wrappers (Button, Dialog, Calendar, Form, …) | shadcn-style; stateless; themeable via CSS vars | **21** (avatar, badge, button, calendar, card, command, dialog, dropdown-menu, form, input, label, popover, scroll-area, select, separator, skeleton, sonner, switch, table, tabs, tooltip); sheet.tsx, textarea.tsx [DELETED Jun 2026] |
| `src/components/auth/auth-guard.tsx` | `AuthGuard` with `requireAdmin`/`isAdmin`/`isAdminLoading` props | client; 4 states (loading / unauth / forbidden / ok) | 1 |
| `src/components/chat/` | Chat-specific (ChatWindow, ChatMessageBubble, ChatInputNew, SourceList, SourceCard, MessageActions, ChatSuggestions, GlassPortal, ChatMessages) | mostly client; uses `useQuery`/`useMutation`; GlassPortal is server-render-safe | 9 |
| `src/components/shared/` | LoadingSpinner, ConfirmDialog, ResponsiveContainer, PageHeader | client | 4 |
| `src/components/sidebar/` | Sidebar (index), SidebarHeader, SidebarHistory (memo), NewChatButton, SidebarSearch | client; `Sidebar` owns `useThreads` + debounce | 5 |

**General rules:**

1. **Server by default.** Add `"use client"` only when you need hooks, state, or browser APIs.
2. **Co-locate client/server.** Split a component into `Foo.tsx` (server) and `Foo.client.tsx` (client) when the server component is just a thin shell.
3. **No direct Convex calls from server components.** Server components render UI; data fetching goes through hooks.

### 5.3 Component file pattern

Most components follow:

```tsx
// src/components/chat/MessageList.tsx
"use client";
import { useQuery } from "convex/react";
import { api } from "@/lib/convex";
import { Message } from "./Message";

export function MessageList({ threadId }: { threadId: string }) {
  const messages = useQuery(api.messages.list, { threadId });
  if (!messages) return <Skeleton />;
  return (
    <div>
      {messages.map(m => <Message key={m._id} message={m} />)}
    </div>
  );
}
```

---

## 6. Hooks

**Directory:** `src/hooks/`

Convex's `useQuery` and `useMutation` are the data layer. Custom hooks wrap them for app-specific patterns.

### 6.1 Common custom hooks (verified)

| Hook | File | Purpose | Returns |
| --- | --- | --- | --- |
| `useChat(threadId)` | `src/hooks/use-chat.ts` | Chat state (input, streaming, abort, retry) | `{ isLoading, error, sendMessage, stopGeneration, retry }` |
| `useThreads()` | `src/hooks/use-threads.ts` | List user's threads + create/delete/rename | `{ threads, isLoading, error, createThread, deleteThread, renameThread }` |
| `useStableQuery` | `src/hooks/use-stable-query.ts` | Wraps `useQuery` with a stable ref to prevent re-render churn | data from `useQuery` |

> **`api.users.currentUser` does NOT exist** - there is no `convex/users.ts::currentUser` (see backend reference §4.2). The auth helper `requireUser` is server-only and reads Clerk's `auth()` directly.
>
> The streaming state is exposed through a `streamRegistry` (subscribable) that is shared between `use-chat.ts` and the message list component.

**`use-chat.ts` (verified)**: uses `fetch("/api/chat", { signal: abortController.signal })`, parses `X-Sources` header (base64-decoded JSON), accumulates text via `decoder.decode`, and writes the final assistant message back via `api.messages.insert`. Auto-aborts after `CHAT_TIMEOUT_MS = 45_000` ms. On the first user message of a thread, it automatically renames the thread based on the first 40 characters of the message content.

**`use-threads.ts` (verified)**: uses `useStableQuery(api.threads.list, {})` with an 8s timeout → "Unable to load conversations". `rename` uses `api.threads.rename` directly (no `as any` cast needed - the generated `api.d.ts` includes it via `typeof threads`).

**Convex query pattern:**

```ts
const data = useQuery(api.foo.bar, args);
if (data === undefined) return <Loading />;
if (data === null) return <Empty />;
// use data
```

**`undefined` = loading.** `null` = loaded but empty. Distinguish them.

### 6.2 Hook file pattern

```ts
// src/hooks/useFoo.ts
"use client";
import { useQuery } from "convex/react";
import { api } from "@/lib/convex";
import { Id } from "@/lib/types";

export function useFoo(id: Id<"foos">) {
  return useQuery(api.foos.get, { id });
}
```

---

## 7. Lib Utilities

### 7.1 `src/lib/auth.ts` - server auth (verified)

| Function | Args | Returns | Throws |
| --- | --- | --- | --- |
| `requireUser()` | - | `string` (userId) | `Error("Unauthorized")` if no userId |
| `requireAdmin()` | - | `string` (userId) | `Error("Unauthorized")` or `Error("Forbidden")` |
| `getUserRole()` | - | `string \| null` (`"user" \| "admin" \| "superadmin"`) | - |

**Server-only.** These call `@clerk/nextjs/server`'s `auth()` and `currentUser()`. **They do NOT use `redirect()`** - they `throw new Error(...)`. Caller must catch (or the error will propagate to the nearest error boundary).

```ts
// src/lib/auth.ts (verified)
import { auth, currentUser } from "@clerk/nextjs/server";

export async function requireUser() {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");
  return userId;
}

export async function requireAdmin() {
  const user = await currentUser();
  if (!user) throw new Error("Unauthorized");
  const isAdmin =
    user.publicMetadata?.role === "admin" || user.publicMetadata?.role === "superadmin";
  if (!isAdmin) throw new Error("Forbidden");
  return user.id;
}
```

**Don't call these from client components.** Use `useUser` from `@clerk/nextjs` instead.

### 7.2 `src/lib/convex.ts` - [DELETED June 2026]

Deleted because nothing imported its exports. Each consumer creates its own client:
- `providers.tsx`: `new ConvexReactClient(convexUrl)` in `useState` (line 59)
- `chat/route.ts`: `new ConvexHttpClient(convexUrl)` inline (line 365)
- `cron/route.ts`: inline
- `webhooks/clerk/route.ts`: inline

> Historical note: the file exported `convexClient` (ConvexReactClient) and `convexHttpClient` (ConvexHttpClient) but both were zero-import.

### 7.3 `src/lib/rate-limit.ts` - Upstash sliding window

> ⚠️ **Earlier exports `rateLimit` and `rateLimitByKey` do NOT exist.** The actual exports are `checkChatRateLimit(identifier, role)` and `getChatRateLimitRemaining(identifier, role)`.

| Function | Args | Returns | Notes |
| --- | --- | --- | --- |
| `checkChatRateLimit` | `(identifier: string, role: "user" \| "admin" \| "superadmin" \| "anonymous")` | `Promise<RatelimitResponse \| null>` | Returns `null` on Upstash failure (fails open) |
| `getChatRateLimitRemaining` | `(identifier, role)` | `Promise<number \| null>` | For UI display |

```ts
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const userLimit = new Ratelimit.slidingWindow(50, "1 h");
const adminLimit = new Ratelimit.slidingWindow(200, "1 h");
const anonLimit = new Ratelimit.slidingWindow(10, "1 h");

export async function checkChatRateLimit(identifier: string, role: "user" | "admin" | "superadmin" | "anonymous") {
  const limiter = { user: userLimit, admin: adminLimit, superadmin: adminLimit, anonymous: anonLimit }[role];
  try {
    return await limiter.limit(identifier);
  } catch {
    return null;  // fails open
  }
}
```

**Fails open** if Upstash is unreachable. The chat route treats `null` as pass-through (no 429 on null). Don't tighten this without a fallback.

### 7.4 `src/lib/constants.ts` - shared constants (verified)

```ts
export const UET_CRAWL_CONFIG = {
  seedUrls: [...],   // **23 entries** - all `web.uettaxila.edu.pk/*` paths
  maxPages: 500,
  maxDepth: 5,
  allowExternalLinks: false,
  baseUrl: "https://web.uettaxila.edu.pk",  // also present
  includePaths: [...],  // 8 entries - also present
  excludePaths: [...],  // also present
};

export { CACHE_SIMILARITY_THRESHOLD } from "../../convex/constants";
```

> The verified file also exports `EVAL_ENABLED`, `APP_NAME`, `APP_TAGLINE`, `APP_DESCRIPTION`, `UET_COLORS`, `TASTE_BASELINE`, `SPACING`, `ELEVATION`, `DURATION` - earlier drafts that said "only exports UET_CRAWL_CONFIG" were wrong.

> **`MAX_QUERY_LEN` is NOT exported from this file** - it is local to `convex/rag/retrieval.ts`. The verified file only exports `UET_CRAWL_CONFIG` and re-exports `CACHE_SIMILARITY_THRESHOLD` from the BE.

**All numbers here are re-exports from `convex/constants.ts`** when they exist on the BE. Don't duplicate literal values.

### 7.5 `src/lib/types.ts` - type mirrors

> ⚠️ **Several rows in earlier drafts do NOT exist in `src/lib/types.ts`.** Specifically `Id<T>` is NOT a `ConvexId<T>` re-export (no such symbol exists), `TokenCount` is NOT a `number` alias (it's a 3-field object), `ChatRequest` and `ChatRequestSchema` do NOT exist (the route does manual `JSON.parse` + length checks, no zod).

| Type | Mirrors Convex | Notes |
| --- | --- | --- |
| `Id<T>` | branded string `string & { __tableName: T }` | NOT a `ConvexId<T>` re-export |
| `UserRole` | `users.role` union | 3 values |
| `DocumentStatus` | `documents.status` | Mirror has 7 values; in sync with validator |
| `CrawlStatus` | `crawlJobs.status` | |
| `CrawlTrigger` | `crawlJobs.trigger` | |
| `FeedbackRating` | `feedback.rating` | |
| `FeedbackCategory` | `feedback.category` | |
| `MessageRole` | `messages.role` | 2 values: `user`/`assistant` (NO `system`) |
| `QueryCategory` | one of 7 intents | |
| `Source` | `{ id?, type?, sourceType?, url, title, documentId?, chunkId?, relevanceScore, excerpt, providerOptions? }` | **NOT** `{ documentId, chunkId, title, url, score, excerpt }` - uses `relevanceScore` (not `score`) and has extra fields. Mirror shape differs from `convex/messages/validator.ts` `sourcesValidator`. |
| `TokenCount` | `{ prompt, completion, total }` object | **NOT** a `number` alias |
| `CrawlConfig` | subset of `UET_CRAWL_CONFIG` | |
| `CrawlStats` | `crawlStats` row | Matches schema: `statsId`/`totalDocuments`/`indexedDocuments`/`processingDocuments`/`failedDocuments`/`pendingDocuments`/`lastUpdatedAt` |
| `ChatMessage` | `{ role, content }` custom interface | NOT a Vercel AI SDK `UIMessage` literal |
| `Thread` | hand-rolled `{ _id, userId, title, createdAt, updatedAt }` | NOT a `Doc<"agent.threads">` literal |

> **`ChatRequest` and `ChatRequestSchema` are NOT in `src/lib/types.ts`.** The chat route does NOT use zod; it does manual `JSON.parse` + `Array.isArray` + length checks.

**Sync rule:** if you change a Convex validator, update the mirror here in the same PR. See `reference.cross-cutting.md` §4.2 for the full mirror table.

### 7.6 `src/lib/llm-models.ts` - LLM fallback chain (verified)

```ts
// src/lib/llm-models.ts (verified, 6 lines)
export const LLM_FALLBACK_CHAIN = [
  { id: "meta-llama/llama-4-scout-17b-16e-instruct", provider: "groq" },
  { id: "gpt-oss-120b", provider: "cerebras" },
  { id: "llama-3.1-8b-instant", provider: "groq" },
  { id: "gemini-2.5-flash", provider: "google" },
];
```

> **The verified file is a STATIC LIST.** It does NOT import `@ai-sdk/*` and does NOT read any env vars. The provider SDK initialization and env reads happen in `src/app/api/chat/route.ts` itself (the route uses `MODEL_MAPPING` to look up SDK constructors by provider name).

**Used by** `src/app/api/chat/route.ts` only. The chain is iterated; first success wins.

**Don't remove a step** unless the underlying provider is permanently gone.

### 7.7 `src/lib/retry.ts` - exponential backoff (verified)

```ts
// src/lib/retry.ts (verified, ~30 lines)
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options?: {
    maxRetries?: number;   // default 3
    baseDelayMs?: number;  // default 1000
    maxDelayMs?: number;   // default 10000
    onRetry?: (attempt: number, error: unknown) => void;
  }
): Promise<T>
```

> **The export is `retryWithBackoff` - NOT `withRetry`.** Any prior reference to `withRetry` from this module is **wrong**.

> **Used by** any client-side fetch wrapper that opts in. **`UserSync` does NOT use this helper** - it has its own inline retry loop (`1000 * 2 ** attempt`, lines 27–49 of `providers.tsx`). `retryWithBackoff` is currently unused in the codebase.

### 7.8 `src/lib/utils.ts` - `cn()`

```ts
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

**Use everywhere** you concatenate Tailwind classes. Avoids specificity bugs from `tailwind-merge`.

### 7.9 `src/lib/analytics.ts` - dev-only console.log wrappers (verified)

> ⚠️ **No real Vercel Analytics integration exists.** Despite the JSDoc claim of "Vercel Web Analytics", the file (verified, ~73 lines) only does `console.log` in `NODE_ENV === "development"` and silently returns in production. There is **no `import { track } from "@vercel/analytics"`** anywhere in the codebase. `src/app/layout.tsx` does **NOT** render `<Analytics />`.

| Export | Signature | Behavior |
| --- | --- | --- |
| `interface AnalyticsEvent` | `{ name: string; properties?: Record<string, string \| number \| boolean> }` | type only |
| `trackPageView` | `(path: string) => void` | dev: `console.log`; prod: no-op |
| `trackEvent` | `(event: AnalyticsEvent) => void` | dev: `console.log`; prod: no-op |
| `trackChatEvent` | `(action: "send" \| "complete" \| "error" \| "feedback" \| "stop", properties?) => void` | dev: `console.log`; prod: no-op |
| `trackCrawlEvent` | `(action: "start" \| "complete" \| "error" \| "cancel", properties?) => void` | dev: `console.log`; prod: no-op |
| `trackError` | `(errorType: string, properties?) => void` | dev: `console.log`; prod: no-op |

**Don't put PII in event props** - even though they're dev-only now, future integration may retain.

### 7.10 `src/lib/clerk-claims.ts` - ClerkSessionClaims helpers (verified)

```ts
// src/lib/clerk-claims.ts (verified, 53 lines)
export interface ClerkSessionClaims {
  sub?: string;
  sid?: string;
  org_id?: string;
  org_role?: string;
  metadata?: { role?: string; [key: string]: unknown };
}

export const ADMIN_ROLES = ["admin", "superadmin"] as const;

export function isAdminRole(role: string | undefined | null): boolean {
  return role === "admin" || role === "superadmin";
}

export function getRoleFromClaims(
  sessionClaims: Record<string, unknown> | null | undefined
): string | undefined {
  return (sessionClaims?.metadata as { role?: string } | undefined)?.role;
  // ↑ only reads metadata.role. The doc comment "walks sub → metadata → org_role fallback" is INCORRECT - the code does NOT walk sub or fallback to org_role.
}
```

> **The `isAdminRole` signature takes a `role: string`, NOT a `claims` object.** Any call site using `isAdminRole(claims)` is wrong; you must extract `claims?.metadata?.role` first.
> **The earlier doc comment "walks sub → metadata → org_role fallback" is wrong.** The actual implementation only reads `sessionClaims.metadata?.role` (lines 50–52). `org_role` is defined on the `ClerkSessionClaims` interface but is NOT consulted by `getRoleFromClaims`.

**Read `role` from `sessionClaims.metadata.role`** (Clerk public metadata). Don't trust client-side checks for server decisions.

### 7.11 `src/lib/clerk-theme.ts` - Clerk appearance

Exports a `ClerkAppearance` object applied to all `<ClerkProvider>` instances. Includes:

- Color variables
- Font
- Border radius
- Logo URL

**Single source of truth** for Clerk UI styling. Edit here, not in `sign-in/page.tsx`.

---

## 8. Middleware (verified)

**File:** `src/middleware.ts` (not in `src/app/`).

```ts
// src/middleware.ts (verified)
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

const isPublicRoute = createRouteMatcher([
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/api/webhooks(.*)",
]);

export default clerkMiddleware((auth, req) => {
  if (!isPublicRoute(req)) {
    auth().protect();
  }
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
```

**Public routes (no Clerk gate):**

- `/sign-in(.*)` - Clerk sign-in
- `/sign-up(.*)` - Clerk sign-up
- `/api/webhooks(.*)` - Clerk + crawl webhooks (their own auth)

**Protected by default.** Anything not in the public list requires a Clerk session.

**Admin protection** is three-layer defense-in-depth:
1. **Edge middleware** (`src/middleware.ts:23-29`) - checks `sessionClaims.metadata.role` before `/admin(.*)` routes load. Redirects non-admins to `/`. Logs a warning if the Clerk JWT template is not configured (metadata undefined).
2. **Client layout** (`src/app/admin/layout.tsx`) - `AuthGuard` component checks `getRoleFromClaims(sessionClaims)`.
3. **Server-side conventions** - all admin Convex functions call `requireAdmin(ctx)` which reads `users.role` from the DB (not Clerk claims).

**`/api/chat`, `/api/cron`, `/api/health`** are *not* in the public matcher. Cron/health use `CRON_SECRET` bearer; chat uses Clerk session via `auth().protect()` (or anon tier if you add anon support later). This is intentional - the public matcher is for routes that must be reachable without auth.

**Adding a new public route:** add to `isPublicRoute`. Be sure the route has its own auth (webhooks do; sign-in does).

---

## 9. Build Config (`next.config.ts`) (verified)

```ts
// next.config.ts (verified)
import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // NOTE: reactStrictMode is now enabled
  allowedDevOrigins: ["127.0.0.1"],
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**.convex.cloud" },
      { protocol: "https", hostname: "img.clerk.com" },
    ],
  },
  async redirects() {
    return [{ source: "/", destination: "/chat", permanent: false }];
  },
  async headers() {
    return [
      {
        source: "/(.*)",  // actual syntax, NOT "/:path*"
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "geolocation=(), microphone=(self), camera=()" },  // ← order matters; microphone=(self) allows mic in same origin
        ],
      },
    ];
  },
  turbopack: {
    resolveAlias: { ...convex aliases... },
  },
  webpack: (config) => {
    config.resolve.alias = { ...convex aliases... };
    return config;
  },
};

export default withSentryConfig(nextConfig, sentryOptions);
```

> **Two things were missing in earlier drafts:** (1) the `redirects()` rule `/` → `/chat` (configured here, not in `page.tsx`); (2) `X-Content-Type-Options: nosniff` (in addition to HSTS, X-Frame-Options, Referrer-Policy, Permissions-Policy).

### 9.1 Convex aliases

Both `turbopack.resolveAlias` and `webpack` resolver alias the same three paths so client and server code can `import { api } from "convex/_generated/api"` without going through relative paths.

| Alias | Resolves to | Used in |
| --- | --- | --- |
| `convex/_generated/api` | `./convex/_generated/api` | Almost all client Convex imports |
| `convex/_generated/server` | `./convex/_generated/server` | Server actions / Convex function defs |
| `convex/_generated/dataModel` | `./convex/_generated/dataModel` | `Doc<...>`, `Id<...>` types |

**Don't add new aliases** unless you have ≥3 files that benefit. Relative paths are fine for one-offs.

### 9.2 Security headers

| Header | Value | Why |
| --- | --- | --- |
| `X-Frame-Options` | `DENY` | Clickjacking |
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains; preload` | HSTS |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Privacy |
| `Permissions-Policy` | `geolocation=(), microphone=(self), camera=()` | Disables geolocation & camera; allows microphone in same origin |

### 9.3 Remote image patterns

- `**.convex.cloud` - Convex file storage URLs
- `img.clerk.com` - Clerk profile pictures

**Adding a new image source:** append to `images.remotePatterns`. Required for `<Image src={...}>` to work.

### 9.4 Sentry wrap (verified)

`withSentryConfig(nextConfig, ...)` wraps the entire config. Sentry injects:

- Server init via **`src/sentry.server.config.ts`** (NOT `instrumentation.ts` - that file is a thin `register()` wrapper)
- Client init via **`src/sentry.client.config.ts`** (NOT `instrumentation-client.ts` - that file does not exist; this is the canonical Next.js 16 location)
- Edge init via **`src/sentry.edge.config.ts`**
- Source map upload on build
- Performance tracing on `/api/*`

**`src/instrumentation.ts` is a thin wrapper** (verified) that conditionally imports the right Sentry config based on `NEXT_RUNTIME`:

```ts
// src/instrumentation.ts (verified)
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}
```

**Don't disable Sentry in production** unless you have a replacement observability stack.

### 9.5 `allowedDevOrigins`

`["127.0.0.1"]` - Next.js 16 dev origin allowlist. Required because Vercel preview deployments and other origins are blocked by default.

---

## 10. Styling & Theme

### 10.1 Tailwind 4

CSS-first config with CSS `@theme` blocks in `src/app/globals.css` that override/extend the JS config. A `tailwind.config.ts` IS present (84 lines) with theme tokens (colors, spacing, fonts, animations). Both files define theme tokens - edits should keep them in sync:

```css
@import "tailwindcss";

@theme {
  --color-primary: oklch(0.55 0.18 240);
  --color-background: oklch(0.99 0 0);
  --color-foreground: oklch(0.15 0 0);
  /* ... */
}

@media (prefers-color-scheme: dark) {
  @theme {
    --color-background: oklch(0.12 0 0);
    --color-foreground: oklch(0.95 0 0);
  }
}
```

**Don't use JS to switch colors** - use CSS variables. The `ThemeProvider` just toggles a `data-theme="light|dark"` attribute on `<html>`.

### 10.2 Theme switching

```tsx
// src/components/theme-provider.tsx (verified path - NO theme/ subdirectory)
"use client";
import { createContext, useContext, useEffect, useState } from "react";

const ThemeContext = createContext<...>(null);

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState<"light" | "dark" | "system">("system");
  useEffect(() => {
    // apply data-theme attr on <html>
  }, [theme]);
  return <ThemeContext.Provider value={{ theme, setTheme }}>{children}</ThemeContext.Provider>;
}
```

### 10.3 Radix UI

Used for accessible primitives (Dialog, Dropdown, Tooltip, etc.) wrapped in `src/components/ui/`.

**Wrapper pattern** (shadcn-style):

```tsx
// src/components/ui/Button.tsx
"use client";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva("inline-flex items-center justify-center rounded-md", {
  variants: {
    variant: { default: "bg-primary text-primary-foreground", outline: "border" },
    size: { sm: "h-9 px-3", md: "h-10 px-4", lg: "h-11 px-8" },
  },
  defaultVariants: { variant: "default", size: "md" },
});

export function Button({ className, variant, size, ...props }) {
  return <button className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}
```

**Always use `cn()` to merge classes** - never template-string them.

### 10.4 Aesthetic Standards & Anti-Slop Guidelines

UETGPT explicitly rejects "AI slop" aesthetics. When building or modifying UI components, you must adhere to the design principles located in the root-level skill directories:

- **`taste-skill/`**: Contains the **Anti-Slop Protocol**. Banned patterns include AI-purple gradients, infinite looping micro-animations, centered heroes over dark meshes, and thick gray pill skeletons. Skeletons must be hairline geometric frames matching the layout shape.
- **`ui-ux-pro-max-skill/`**: Contains comprehensive UI/UX guidelines for creating production-ready, highly polished spatial design and typography.

Consult these directories and `impeccable/skill/reference/anti-slop.md` before finalizing any frontend changes.

---

## 11. Observability (Sentry only - Vercel Analytics is NOT integrated)

### 11.1 Sentry (verified)

**Real init lives in `src/sentry.{client,server,edge}.config.ts`** - these are the canonical Next.js 16 Sentry init locations. `src/instrumentation.ts` is a thin `register()` wrapper that conditionally imports them.

**Server init:** `src/sentry.server.config.ts`

```ts
import * as Sentry from "@sentry/nextjs";
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
  // ...
});
```

**Edge init:** `src/sentry.edge.config.ts` (similar, edge runtime).

**Client init:** `src/sentry.client.config.ts`

```ts
import * as Sentry from "@sentry/nextjs";
const dsn = process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN;
if (dsn) {
  Sentry.init({
    dsn,
    tracesSampleRate: 0.1,  // prod; 1.0 in dev
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,
    environment: process.env.NODE_ENV || "development",
  });
} else {
  console.warn("[Sentry] SENTRY_DSN not configured. Error monitoring is disabled.");
}
```

**`src/instrumentation.ts` (verified):**

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

> **`instrumentation-client.ts` (root) does NOT exist** in the verified code. The client init is at `src/sentry.client.config.ts`. The `if (dsn)` guard means Sentry is gracefully disabled when no DSN is configured; the `else` branch logs a warning.

**Tracing:**

- Server: `withSentryConfig` adds tracing to `/api/*`.
- Client: `Sentry.startTransaction` or React Error Boundary.
- Convex: `ctx.logger` writes to Convex dashboard (not Sentry). Bridge via Sentry transport if needed.

### 11.2 Vercel Analytics - **NOT INTEGRATED** (verified)

> ⚠️ **The codebase does NOT use Vercel Web Analytics or Speed Insights.** Despite the file's JSDoc claim, `src/lib/analytics.ts` only `console.log`s in development and `src/app/layout.tsx` does **NOT** render `<Analytics />` or `<SpeedInsights />`. If you need real analytics, add `@vercel/analytics` to `package.json` and render `<Analytics />` in `src/app/layout.tsx`.

**What exists** is `src/lib/analytics.ts` - a dev-only `console.log` shim with 5 functions (`trackPageView`, `trackEvent`, `trackChatEvent`, `trackCrawlEvent`, `trackError`). All are no-ops in production. See §7.9 for the full signature table.

**Don't put PII in event props** - even though they're dev-only now, future integration may retain.

---

## 12. Environment Variables (FE surface)

The FE reads these env vars directly. For server-only vars, see `reference.cross-cutting.md` §2.1.

> ⚠️ **Several rows from earlier drafts are wrong or misleading:** `CLERK_SECRET_KEY` is not read by `src/lib/auth.ts` (Clerk's `auth()`/`currentUser()` reads it implicitly); `ADMIN_EMAILS` is NOT referenced anywhere; `GOOGLE_GENERATIVE_AI_API_KEY` is NOT read by `chat/route.ts` (the route only reads `GEMINI_API_KEY`); `NEXT_PUBLIC_APP_URL` is read by `chat/route.ts:265` (CSRF check), NOT by `src/lib/constants.ts`.

| Var | Where read | Required? | Purpose |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_CONVEX_URL` | providers.tsx (inline ConvexReactClient) + chat/route.ts (inline ConvexHttpClient) | yes | Convex deployment URL |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | `ClerkProvider` (auto-read) + `src/app/api/health/route.ts:131` | yes | Clerk |
| `NEXT_PUBLIC_APP_URL` | `src/app/api/chat/route.ts:265` (CSRF origin check) | yes | Public base URL (NOT in `src/lib/constants.ts`) |
| `CLERK_SECRET_KEY` | Implicitly by `@clerk/nextjs/server` `auth()` / `currentUser()` | yes | Clerk |
| `CLERK_JWT_ISSUER` | `convex/auth.config.ts:4` (BE) | yes | Clerk JWT issuer (NOT `CLERK_JWT_KEY`) |
| `CLERK_SIGNING_SECRET` | `webhooks/clerk/route.ts:6` | yes | svix (NOT `CLERK_WEBHOOK_SECRET`) |
| `GROQ_API_KEY` | `src/app/api/chat/route.ts:34,51` (server) | yes | Groq (steps 1, 3 in `LLM_FALLBACK_CHAIN`) |
| `CEREBRAS_API_KEY` | `src/app/api/chat/route.ts:39,53` (server) | yes | Cerebras (step 2) |
| `GEMINI_API_KEY` | `src/app/api/chat/route.ts:36,55` (server, Gemini step 4) + `convex/embeddings/generate.ts:105` (server, primary embedding) | yes | Gemini (chat step 4 + embedding primary) |
| `GOOGLE_GENERATIVE_AI_API_KEY` | `convex/embeddings/generate.ts:108` (rotation key 4) + `convex/crawl/webhook.ts:171,400` (AI document summarization) | yes | Embedding rotation key 4 + webhook summarization feature gate |
| `GEMINI_API_KEY_1` | `convex/embeddings/generate.ts:106` (server) | yes | Embedding rotation key 2 |
| `GEMINI_API_KEY_2` | `convex/embeddings/generate.ts:107` (server) | yes | Embedding rotation key 3 |
| `UPSTASH_REDIS_REST_URL` | `src/lib/rate-limit.ts:14` (server) | yes | Upstash |
| `UPSTASH_REDIS_REST_TOKEN` | `src/lib/rate-limit.ts:15` (server) | yes | Upstash |
| `CRON_SECRET` | `cron/route.ts:9`, `health/route.ts:51` (server, Bearer) | yes | Cron + health probe |
| `SENTRY_DSN` | `src/sentry.server.config.ts:3` (server) | optional | Sentry server (read by `register()` in `instrumentation.ts`) |
| `NEXT_PUBLIC_SENTRY_DSN` | `src/sentry.client.config.ts:3` (with `SENTRY_DSN` fallback) + `src/sentry.edge.config.ts:3` | optional | Sentry client + edge (NOT in `.env.local.example`) |
| `CRAWL4AI_BASE_URL` | `convex/crawl/actions.ts:99` (fallback for `CRAWL4AI_URL`; default `http://localhost:11235` is in `.env.local.example` only, NOT in code) | yes | Crawl4AI endpoint |
| `CRAWL4AI_URL` | `convex/crawl/actions.ts:99` (PRIMARY; `CRAWL4AI_BASE_URL` is fallback) | optional | Crawl4AI primary |
| `CRAWL4AI_JWT_TOKEN` | `convex/crawl/actions.ts:119` (sets `Authorization` header on Crawl4AI) | optional | Crawl4AI auth |
| `RERANKER_URL` | `convex/reranking/rerank.ts:15` (graceful fallback to position-based) | optional | External reranker |
| `WEBHOOK_SECRET` | `src/app/api/webhooks/clerk/route.ts:50` (server) + `convex/users.ts:18` (dual auth) | yes | Shared secret for Clerk→Convex user sync |
| `CONVEX_DEPLOYMENT` | Convex CLI | yes | Convex deployment key (NOT `CONVEX_DEPLOY_KEY`) |

> **`ADMIN_EMAILS` is NOT referenced anywhere in the codebase** (verified by grep). The Clerk webhook does NOT bootstrap admin role. See `reference.cross-cutting.md` §3.3 for the manual two-step admin promotion.

> **Missing from this table but present in `.env.local.example`:** `CRAWL_WEBHOOK_SECRET`, `CONVEX_AUTH_TOKEN` (BE only - see `reference.cross-cutting.md` §2.1 for full BE table).

**`NEXT_PUBLIC_*`** vars are exposed to the client. They are public by definition. The rest are server-only and must never be imported into a client component (Next.js will throw at build).

**`process.env` in client code:** only `NEXT_PUBLIC_*` vars are inlined at build. Others will be `undefined` at runtime.

**Adding a new env var:**

1. Add to `.env.local.example`.
2. Add to `reference.cross-cutting.md` §2.1.
3. Add to this table if FE reads it.
4. Document owner and lifecycle (build-time vs runtime).
