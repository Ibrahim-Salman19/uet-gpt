# Security

> Current security overview. Detailed implementation lives in `architecture.md` §7
> (Security) and the threat model in `../THREAT_MODEL.md`. This doc summarizes the
> *implemented* controls — keep it in sync when the posture changes.

Last reviewed: 2026-07-05

## Auth

- **Provider:** Clerk (`@clerk/nextjs`)
- **Session management:** Clerk middleware/proxy + Convex auth (JWT verified in Convex)
- **Authorization:** enforced inside Convex functions via `requireAuth` / `requireAdmin`
  (`convex/auth.ts`) — middleware is intercept-only, not the sole authZ layer (architecture.md §7.1)
- **RBAC roles:** user, admin, superadmin

## Webhook Verification

- **Clerk events:** signature verified over the **raw** request body
  (env `CLERK_SIGNING_SECRET`).
- **Crawl / ingest:** secret verified with constant-time comparison
  (`constantTimeCompare` in `convex/crawl/utils.ts`, env `CRAWL_WEBHOOK_SECRET`);
  `processedWebhooks` provides replay/idempotency protection.
- **Internal server-to-server:** `INTERNAL_API_SECRET` checked with constant-time comparison.

## API Security

- HTTP action CORS restricted to the app origin (production).
- **Rate limiting (implemented):** dual-layer — native Convex sliding-window limiter
  (`convex/rateLimit.ts`, 10 msg/user/min + 100K tokens/global/min) plus Upstash Redis
  (`src/lib/rate-limit.ts`, admin 200/hr, user 50/hr, anon 10/hr). See architecture.md §7.3.
- **CSP headers (implemented):** configured in the Next.js middleware/`next.config.ts`
  (architecture.md §7.4).
- Input validation via Convex `v.*` validators.

## Data Protection

- No PII logged server-side.
- API keys stored as environment variables, read server-side only (never exposed to client).
- **Admin audit logging (implemented):** privileged operations recorded in the
  `adminAuditLog` table (architecture.md §4.5).
- **Semantic cache TTLs (tiered):** freshness-based, not a flat 24h — high 7d,
  medium 2d, low 1d (`convex/cache/set.ts`; architecture.md §6.6 / §11).

## Open Items

- [ ] Document a webhook secret rotation policy (`CLERK_SIGNING_SECRET`,
      `CLERK_WEBHOOK_SECRET`, `CRAWL_WEBHOOK_SECRET`, `INTERNAL_API_SECRET`).
- [ ] Define an explicit fail-closed vs fail-open policy for the Upstash rate
      limiter during Redis outages.
- [ ] Strengthen prompt-injection and crawler SSRF defenses (see `../THREAT_MODEL.md` §5).
