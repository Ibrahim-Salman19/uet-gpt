# UET Taxila GPT - Threat Model

> Scope: this is a paper threat model for the UET Taxila GPT RAG application.
> It enumerates assets, trust boundaries, and threats (STRIDE + OWASP LLM Top 10)
> and maps each to the mitigation that exists in code (or to an open item).
> For implementation detail, defer to `architecture.md` §7 (Security) and the
> referenced source files. Keep this file in sync when the security posture changes.

Last reviewed: 2026-06-25

---

## 1. Assets

| Asset | Why it matters |
|-------|----------------|
| User chat data / threads / messages | User-owned content; IDOR / cross-tenant read risk |
| Crawled corpus + embeddings (`documents`, `crawledChunks`, semantic cache) | Integrity of answers; poisoning risk |
| Admin functions (crawl trigger, settings, document delete, reset) | Privileged operations; privilege-escalation target |
| Third-party API keys (Groq, Gemini, Cerebras, Upstash, Clerk, Convex) | Cost + account compromise if leaked |
| Webhook secrets (`CLERK_WEBHOOK_SECRET`, `CRAWL_WEBHOOK_SECRET`, `INTERNAL_API_SECRET`) | Forgery of trusted server-to-server calls |
| AI inference budget (Gemini embedding + LLM tokens) | Direct financial exposure to abuse |

## 2. Trust Boundaries

- **Browser ↔ Next.js / Convex** - authenticated via Clerk session JWT; Convex functions re-verify identity.
- **Public webhooks ↔ backend** - Clerk events (`/api/webhooks/clerk`, `convex/clerk/webhook.ts`) and crawl/ingest (`convex/http.ts`, `convex/crawl/webhook.ts`). Unauthenticated network origin; trust established only by signature/secret.
- **Backend ↔ third-party AI providers** - outbound; keys held server-side only.
- **Crawler ↔ public web** - inbound untrusted content (SSRF + prompt-injection source).

## 3. STRIDE Enumeration

| Threat | Vector | Mitigation (code) | Status |
|--------|--------|-------------------|--------|
| **Spoofing** | Forged Clerk webhook | Svix/HMAC signature over the **raw** request body verified with `constantTimeCompare` (`convex/crawl/utils.ts`); secret env `CLERK_WEBHOOK_SECRET` | Implemented |
| **Spoofing** | Forged crawl/ingest webhook | `CRAWL_WEBHOOK_SECRET` checked with `constantTimeCompare`; `processedWebhooks` table for replay/idempotency | Implemented |
| **Spoofing** | Forged server-to-server cache writes | `INTERNAL_API_SECRET` checked with `constantTimeCompare` (`convex/cache/set.ts`) | Implemented |
| **Tampering** | Corpus / cache poisoning via crawled content | Content normalization + dedup (`convex/crawl/chunking.ts`, `deduplication.ts`); robots audit (`docs/crawl-robots-audit.md`) | Partial |
| **Repudiation** | Admin actions not traceable | `adminAuditLog` table records privileged operations (architecture.md §4.5) | Implemented |
| **Information disclosure** | API keys / secrets leaking to client | Keys read from `process.env` server-side only; never sent to client | Implemented |
| **Information disclosure** | IDOR across users' threads/feedback | Convex functions enforce `requireAuth` / ownership checks; admin-only data behind `requireAdmin` (`convex/auth.ts`) | Implemented |
| **Denial of service** | Inference-cost abuse | Dual rate limiting: native Convex sliding window (`convex/rateLimit.ts`) + Upstash Redis (`src/lib/rate-limit.ts`); see architecture.md §7.3 | Implemented |
| **Denial of service** | Rate limiter fail-open during Redis outage | Defense-in-depth via the native Convex limiter; review fail-closed policy for the Upstash layer | Open (see §5) |
| **Elevation of privilege** | Non-admin calling admin functions | `requireAdmin` / role check (`user`/`admin`/`superadmin`) at the top of admin functions | Implemented |
| **Elevation of privilege** | Auth enforced only in middleware/proxy | Middleware is intercept-only; authorization is also enforced inside each Convex function and route handler (defense in depth; CVE-2025-29927 class) | Implemented |

## 4. OWASP LLM Top 10 (selected)

| ID | Risk | Mitigation | Status |
|----|------|-----------|--------|
| LLM01 | Prompt injection via crawled pages | Retrieved context is treated as untrusted data; system prompt instructs the model to answer only from UET context (`convex/rag/prompts.ts`); intent classification gates off-topic queries | Partial |
| LLM02 | Insecure output handling | Markdown rendered client-side without raw HTML injection; sources surfaced for verification | Implemented |
| LLM04 | Model DoS / cost | Rate limiting + token budget cap (100K tokens/global/min) | Implemented |
| LLM06 | Sensitive info disclosure | No PII logged server-side; corpus is public university content | Implemented |
| LLM08 | Excessive agency / SSRF in crawler | Crawler restricted to configured seed scope (`scripts/crawl_config.json`); respects robots; no arbitrary URL fetch from user input | Partial |

## 5. Open Items / Residual Risk

- [ ] Define and implement an explicit **fail-closed vs fail-open** policy for the Upstash rate limiter during Redis outages.
- [ ] Establish a documented **webhook secret rotation** procedure for `CLERK_WEBHOOK_SECRET`, `CRAWL_WEBHOOK_SECRET`, and `INTERNAL_API_SECRET`.
- [ ] Strengthen prompt-injection defenses (LLM01) with output validation / content provenance tagging.
- [ ] Harden crawler SSRF controls (LLM08): enforce an allowlist of resolved hosts before fetch.

> Note: any concrete, currently-exploitable weaknesses must be triaged in a
> private security tracker, not in version-controlled docs.
