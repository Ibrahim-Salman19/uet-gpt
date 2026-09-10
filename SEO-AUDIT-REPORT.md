# UET GPT — SEO Audit Report (Verified Current State)

**Date:** 2026-09-10
**Site:** https://uet-gpt.vercel.app
**Stack:** Next.js 16.2.6, React 19, Convex, Clerk, Vercel
**Supersedes:** The 2026-09-01 version of this report, which described a pre-restructure
site (`/uet-taxila/admissions`, `/uet-taxila/fee-structure`, a `route.ts` homepage) that
no longer exists. All 49 issues from that report (C1-C6, H1-H13, M1-M30, L1-L23) were
resolved in the commit history between 2026-09-01 and 2026-09-08 — see `git log --grep=seo`.
This report re-audits the **live, restructured site** with reproducible checks rather than
re-describing the old one.

---

## Executive Summary

**Headline finding: a live cloaking bug was hiding the site's four main content
pages from every real visitor while still showing them to search-engine bots.**
It has been found and fixed in this pass (see below). Beyond that, the site's
on-page technical SEO is genuinely strong — the Sep-1 remediation plan was fully
implemented and shipped. The open work that remains is (a) verifying the fix in
production, (b) closing two smaller live defects also found during this audit, and
(c) content expansion, since almost everything else code-addressable is done.

### What was found and fixed in this pass

| # | Issue | Severity | Fix |
|---|-------|----------|-----|
| 1 | **`/academics`, `/admissions`, `/campus-life`, `/tools`, `/about`, `/privacy`, `/terms`, `/contact` returned 200 for bot user agents but HTTP 307→`/sign-in` for real browsers** — a textbook cloaking pattern, and it made every organic click-through from Google to the site's core content (merit calculator, ECAT guide, fee simulator, admissions, academics, campus life, legal/trust pages) land on a login wall instead of content | **CRITICAL** | Added the 8 routes to `isPublicRoute` in `src/middleware.ts` (they were omitted when the site was restructured from `/uet-taxila/*` sub-pages into top-level pillar pages — none of them read auth state, so this was a matcher-list omission, not a design choice) |
| 2 | Homepage meta description was 172 characters — Google truncates around 155-160, so the SERP snippet was being cut mid-word | MEDIUM | Shortened to 147 chars in `src/app/page.tsx` (title/OG/Twitter description) |
| 3 | `tests/unit/json-ld-schema.test.ts` asserted `organizationSchema.sameAs` must have ≥2 entries — the only way to satisfy that honestly would be inventing a Twitter/LinkedIn account that doesn't exist yet (per `LAUNCH.md`: "N/A — no official UET GPT account exists") | LOW (test hygiene) | Relaxed the assertion to ≥1 and documented why; did **not** fabricate social profiles |
| 4 | `SCHEMA_DATE_MODIFIED` was hardcoded to `2026-09-01`, 9 days stale relative to real content changes | LOW | Bumped to `2026-09-10` in `src/lib/dates.ts` |
| 5 | `/uet-taxila/programs` (the program index page, live and linked from every one of the 14 program pages' breadcrumbs) was missing from `sitemap.xml` | LOW | Added to `src/app/sitemap.ts` |

### Why the cloaking bug escaped the existing E2E suite

`tests/e2e/seo-audit-compliance.spec.ts` runs with `PLAYWRIGHT_TEST=true`, which
`src/middleware.ts` uses as an unconditional bypass of *all* auth logic (line 31-32).
The suite therefore never exercised the real anonymous-user code path — it always saw
the bot/authenticated view. If this suite is extended, add a run **without** that env
var against a plain Chrome UA to catch this class of regression going forward.

### New content shipped this pass

Five UET Taxila vs. peer-university comparison pages
(`/uet-taxila/compare/{uet-lahore,nust,fast,pieas,comsats}`) — the one item from
`docs/marketing/competitors.md`'s programmatic-SEO plan that was still unbuilt.
Each page has its own title/canonical/FAQ schema (independent from the existing
`/admissions?tab=compare` table, which shares one canonical URL and cannot rank
per-competitor on its own), sourced 2026 tuition/entry-test/ranking data cross-checked
against each university's admissions pages, and is cross-linked from the admissions
comparison tab and included in the sitemap.

---

## Verified Live State (as of this audit)

Checks below were run directly against production with `curl` (multiple user agents)
and `WebSearch`, not inferred from source code — this report only asserts what was
observed live.

- **All 39 sitemap URLs return HTTP 200** for a Googlebot user agent (verified by
  fetching every `<loc>` and checking status + scanning for internal links).
- **No orphaned or broken internal links** were found across the sitemap's pages.
- **`robots.txt`, `sitemap.xml`, `llms.txt`, `llms-full.txt`, `manifest.webmanifest`**
  all serve 200 with correct content-types.
- **JSON-LD on the homepage** (fetched live, not from source) confirmed present and
  well-formed: `Organization`, `WebSite` (with `SearchAction`), `SoftwareApplication`,
  `CollegeOrUniversity`, and `FAQPage`.
- **`/chat`** (the `SearchAction` target and primary product CTA) correctly requires
  sign-in for anonymous users — this is intentional, since it's the product, not a
  content page. It does not need to be crawlable for the Sitelinks Searchbox
  `query-input` template to function.
- **Google Search Console verification file is present** (`public/google073b31a41ad1bb3d.html`),
  meaning site ownership was already verified by whoever holds that account. This
  session has no way to check the Coverage/Performance report itself — that requires
  a login only the account holder has. If indexing still looks thin after the cloaking
  fix propagates, check Coverage there first.

### The one finding this session cannot fully resolve: indexation looks near-zero

`WebSearch` for `site:uet-gpt.vercel.app` and for the bare brand name `"UET GPT"`
returned **no results from the domain at all** — every hit was an unrelated GPT/Vercel
project. Two explanations, not mutually exclusive:

1. **The cloaking bug above.** If Googlebot had been crawling the bot-only view for a
   while and then Google's algorithms detected the human/bot mismatch, that alone can
   suppress ranking independent of on-page quality. This should improve now that it's fixed.
2. **`uet-gpt.vercel.app` is a shared subdomain, not an owned domain.** `vercel domains ls`
   on the linked Vercel project returns **0 custom domains**, and no
   `NEXT_PUBLIC_SITE_URL` override exists in any env file. Shared platform subdomains
   (`*.vercel.app`, `*.netlify.app`, `*.github.io`) are indexed inconsistently by Google
   and carry no independent domain authority. This is a structural ceiling that no
   further on-page/schema work can fix.

**This is the highest-leverage remaining lever, and it's the one item in this audit
that isn't a code change**: buying a custom domain (e.g. `uetgpt.com` / `.pk`) and
pointing it at the Vercel project would very likely matter more for indexation than
any further metadata tuning. It requires a purchase decision and DNS access, so it's
noted here rather than done — everything else in this report is either fixed or is a
code-only content-expansion item.

---

## What's Already Strong (confirmed live, not just in source)

- Full Next.js metadata pipeline on every page: canonical, OG, Twitter, robots directives
- Rich, valid JSON-LD across Organization, WebSite+SearchAction, SoftwareApplication,
  CollegeOrUniversity, Article, FAQPage, BreadcrumbList (last-item URL omission per
  Google's spec)
- AI bot allowlisting (GPTBot, ClaudeBot, PerplexityBot, etc.) plus `llms.txt`/`llms-full.txt`
- 14 program pages, 8 glossary terms, and now 5 comparison pages — no thin orphan content
- Legal/trust pages (`/privacy`, `/terms`, `/about`, `/contact`) exist and (after this
  pass's fix) are actually reachable by real visitors
- Old `/uet-taxila/admissions` and `/uet-taxila/fee-structure` URLs 308-redirect
  correctly to their new pillar-page locations (`/admissions?tab=...`) — no link equity
  lost in the restructure
- Custom 404, cookie consent, `viewport-fit: cover`, security headers, clean sitemap/robots

## Remaining Work — Human-Gated (cannot be done autonomously from this session)

These need a real account under a real identity, email OTP verification, or a purchase
decision — creating them on someone's behalf without that person present is an identity
and reversibility risk this session won't take on unprompted. Everything else
code-addressable in the original 49-issue audit and this pass's findings has been done.

| Item | Why it's gated | Where the ready-to-paste copy already lives |
|---|---|---|
| Custom domain purchase + DNS | Requires a purchase and registrar/DNS access | — |
| Wikidata item, Crunchbase profile, LinkedIn company page | Account creation + email OTP | `LAUNCH.md` (field-by-field values) |
| 40+ directory submissions (BetaList, TAAFT, SaaSHub, etc.) | Account creation per directory | `LAUNCH.md` (tiered list, copy variants) |
| Google Search Console Coverage/Performance check | Needs the verified account holder's login | Verification file already present; just needs someone to log in and look |
| Media/backlink outreach (SAMAA TV, ProPakistani, etc.) | Requires a real contact relationship | `SEO-AUDIT-REPORT.md` Phase 4.5 (prior version), `docs/marketing/` |

## Remaining Work — Still Codeable (not done in this pass, lower priority than the cloaking fix)

- Urdu/Roman Urdu content cluster (Phase 4.10 from the original plan) — large effort, not started
- Blog / ECAT-prep content cluster (Phase 4.3) — not started
- Scholarship guide as a dedicated page (partially covered today by `/admissions?tab=scholarships`,
  but not as an independently-titled, independently-rankable page)
- Nonce-based CSP migration to drop `unsafe-inline` (security hardening, not ranking-critical)

---

## Methodology

Everything asserted "live" above was checked this session via: `curl` against
`https://uet-gpt.vercel.app` with a Googlebot UA, a plain Chrome UA, and a default
curl UA (to isolate cloaking); a Python-based sitemap→internal-link diff across all
sitemap URLs; `WebSearch` for indexation and brand-visibility signals; `vercel domains ls`
for custom-domain status; and `pnpm typecheck` + the project's existing Vitest suites
(`tests/unit/*seo*`, `json-ld-schema`, `dates`, `homepage-seo`, `legal-pages`,
`subpages-seo`, `accessibility-seo`) after every change in this pass.
