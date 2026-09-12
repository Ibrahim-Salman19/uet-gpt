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
It has been fixed in code and pushed to `main` (commit `4df3811`) — **but as of this
writing it is not yet live**. See "Deploy Status" below: a pre-existing, unrelated CI
failure is currently blocking the normal deploy pipeline for every commit, not just
this one. Beyond the cloaking bug, the site's on-page technical SEO is genuinely
strong — the Sep-1 remediation plan was fully implemented and shipped. The open work
that remains is (a) getting this fix actually deployed, (b) closing two smaller live
defects also found during this audit (also pushed, also pending deploy), and
(c) content expansion, since almost everything else code-addressable is done.

### Deploy Status — the fix is not live yet

`4df3811` (this session's fix) is on `main` but **not served by production** as of
this writing: `curl -A "<Chrome UA>" https://uet-gpt.vercel.app/academics` still
returns `307` to `/sign-in`, and `sitemap.xml` does not yet list the new
`/uet-taxila/compare/*` pages. The GitHub Actions `Deploy` workflow for this commit
failed at its `Generate Convex types` step with `No CONVEX_DEPLOYMENT set` — and
critically, **this is not new**: the same step failed the same way on the two commits
pushed immediately before this session touched the repo (`8f96be2`, Sep 10 16:04 UTC;
`cbd1949`, Sep 9 17:07 UTC). This is a pre-existing, unrelated infrastructure gap —
a missing/expired `CONVEX_DEPLOYMENT` repo secret — not something introduced by this
session's changes, and not something this session can fix: the value has to come from
whoever holds the Convex dashboard/deploy key, so it's listed in the human-gated table
below. Once that secret is restored (or someone deploys manually with the right
context on the working tree — see note there), `4df3811` will ship on the next
successful run without any further changes needed.

### What was found and fixed in this pass (committed, pending deploy)

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

- **Five UET Taxila vs. peer-university comparison pages**
  (`/uet-taxila/compare/{uet-lahore,nust,fast,pieas,comsats}`) — the one item from
  `docs/marketing/competitors.md`'s programmatic-SEO plan that was still unbuilt.
  Each page has its own title/canonical/FAQ schema (independent from the existing
  `/admissions?tab=compare` table, which shares one canonical URL and cannot rank
  per-competitor on its own), sourced 2026 tuition/entry-test/ranking data cross-checked
  against each university's admissions pages, and is cross-linked from the admissions
  comparison tab and included in the sitemap.
- **`/uet-taxila/ecat-guide`** — the subject-wise high-yield topics, marking scheme,
  and 3-pass time-management strategy previously only existed inside the interactive
  simulator at `/admissions?tab=ecat` (same shared-canonical problem as the comparison
  table). This is a different search intent than `/learn/ecat`'s "what is ECAT"
  definition page, so it's additive rather than cannibalizing. Reuses the exact
  verified facts already shipped in the admissions tab rather than introducing new claims.
- **`/uet-taxila/bus-routes`, `/uet-taxila/hostels`, `/uet-taxila/academic-calendar`** —
  same fix applied to `CampusLifeHub`'s `hostels`/`transport` tabs and `AcademicsHub`'s
  `calendar` tab. Each page imports the underlying data array (`BUS_ROUTES`, `HOSTELS`,
  `CALENDAR_EVENTS` — now exported from their hub components as the single source of
  truth) rather than retyping the facts, so the page and the interactive tab can't drift
  apart. Caught one real inaccuracy while building these: the site's own UI badge and
  the comparison-page copy both say "25+ Routes," but `BUS_ROUTES` only has 6 entries.
  The new bus-routes page uses the verified count (6) instead of repeating the
  unsupported figure — the badge/copy elsewhere is unchanged (pre-existing, out of this
  pass's scope) but worth a follow-up fix or removal.
- **`/uet-taxila/closing-merit`** — 4 years of real Category A closing merit
  (2022-2025) plus 2025 Category S, across all 15 disciplines, extracted from
  `/tools?tab=archive`. The richest dataset extracted this pass (60 real data points)
  and a distinct query from `/learn/merit-formula` (calculation method vs. historical
  cutoffs). Same inaccuracy pattern found again: the tab claimed "5-Year (2021-2025)"
  and "14 disciplines" while the actual data (`MERIT_ARCHIVE_DATA`) has 4 years and 15
  entries — fixed the tab's own header text while editing it for the cross-link, but
  left the tab-selector badge (a separate, untouched block making the same "2021-2025"
  claim) alone, logged here rather than silently patched, matching how the bus-routes
  badge was handled.

All 9 new pages follow the same fix: rich content that already existed but was trapped
behind a shared tab URL and couldn't independently rank got its own page. Every tab
across `admissions-hub.tsx`, `academics-hub.tsx`, `campus-life-hub.tsx`, and
`tools-hub.tsx` was screened as a candidate before deciding what to build:

| Screened candidate | Verdict | Why |
|---|---|---|
| `/learn/scholarships` (vs. `?tab=scholarships`) | **Dropped** | Already a full "types & application" guide (4 sections, 4 FAQs) — a separate page would cannibalize it |
| `/admissions?tab=overview`, `?tab=fees` | **Dropped** | Already the core identity/title of the `/admissions` pillar page itself, not a trapped side-topic |
| `/academics?tab=resources` | **Dropped** | Thin (2 short lists) and overlaps `/learn/obe-framework` |
| `/academics?tab=programs` | **Dropped** | Already has 14 dedicated `/uet-taxila/programs/[slug]` pages |
| `/tools?tab=merit`, `?tab=gpa` | **Dropped** | The calculation methodology is already `/learn/merit-formula` and `/learn/cgpa-system`; the tab is purely the interactive tool |
| `/campus-life?tab=societies`, `?tab=directory` | **Left for later** | Real underlying data (`SOCIETIES_DATA`, `DIRECTORY_DATA`, both already exported), but noticeably lower organic search intent than fees/hostel/transport/calendar/merit |
| `?tab=hostels`, `?tab=transport`, `?tab=calendar`, `?tab=archive` | **Built** | See above |

Worth running any future "still codeable" candidate through this same screen before building it.

---

## Verified Live State (as of this audit)

Checks below were run directly against production with `curl` (multiple user agents)
and `WebSearch`, not inferred from source code — this report only asserts what was
observed live.

- **All 39 sitemap URLs live at the time of that check returned HTTP 200** for a
  Googlebot user agent (verified by fetching every `<loc>` and checking status +
  scanning for internal links). `src/app/sitemap.ts` now defines 46 URLs after this
  pass's additions (`/uet-taxila/programs` index, 5 comparison pages, and 5 extracted
  content pages) — **none of the new ones are verified live yet**; re-run the same
  check once the pending deploy (see "Deploy Status") ships.
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
project. Confirmed again by running the two highest-intent target queries the site is
built for — `"UET Taxila fee structure 2026"` and `"UET Taxila admission requirements
merit calculator"` — neither returned UET GPT anywhere; both are dominated by
third-party content sites (Maqsad Blog, CampusAxis, eduvision.edu.pk, ilmkidunya) that
this site's own content (fee simulator, merit calculator, admissions guide) is a
stronger, more interactive answer to than what currently ranks. That gap is content
competitors to study, not a reason to doubt the site's content quality. Two
explanations for the indexation gap itself, not mutually exclusive:

1. **The cloaking bug above.** If Googlebot had been crawling the bot-only view for a
   while and then Google's algorithms detected the human/bot mismatch, that alone can
   suppress ranking independent of on-page quality. This should improve once the fix
   (pushed, not yet deployed — see "Deploy Status") actually reaches production.
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
- Legal/trust pages (`/privacy`, `/terms`, `/about`, `/contact`) exist and (once this
  pass's fix deploys) will be reachable by real visitors again
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
| **Restore the `CONVEX_DEPLOYMENT` GitHub Actions secret** (blocks every commit in this pass from deploying at all — reconfirmed still failing as of `fe923e3` on 2026-09-11, same `No CONVEX_DEPLOYMENT set` error since at least `cbd1949` on 2026-09-09) | The value comes from the Convex dashboard/deploy key, which only the account holder has; guessing or fabricating it is not an option. Repo → Settings → Secrets and variables → Actions. This session found a valid, unexpired Vercel CLI credential already present in the environment and deliberately did **not** use it to force a manual `vercel --prod` deploy around this gate — the current working tree has uncommitted, mid-edit RAG changes from a concurrent session, and the failing `Deploy Convex Backend` step sits upstream of `Deploy Frontend` in the pipeline for a reason this session doesn't have visibility into. Once the secret is fixed, every commit in this pass will deploy on its own on the next push or workflow re-run — no further code changes needed. | — |
| Custom domain purchase + DNS | Requires a purchase and registrar/DNS access | — |
| Wikidata item, Crunchbase profile, LinkedIn company page | Account creation + email OTP | `LAUNCH.md` (field-by-field values) |
| 40+ directory submissions (BetaList, TAAFT, SaaSHub, etc.) | Account creation per directory | `LAUNCH.md` (tiered list, copy variants) |
| Google Search Console Coverage/Performance check | Needs the verified account holder's login | Verification file already present; just needs someone to log in and look |
| Media/backlink outreach (SAMAA TV, ProPakistani, etc.) | Requires a real contact relationship | `SEO-AUDIT-REPORT.md` Phase 4.5 (prior version), `docs/marketing/` |

## Remaining Work — Still Codeable (not done in this pass, lower priority than the cloaking fix)

- Urdu/Roman Urdu content cluster (Phase 4.10 from the original plan) — large effort, not started
- Broader ECAT-prep blog cluster beyond the one guide page shipped this pass (Phase 4.3) —
  e.g. subject-specific deep-dives, past-paper analysis — not started
- ~~Scholarship guide as a dedicated page~~ — checked and dropped: `/learn/scholarships`
  already covers this (see "New content shipped this pass")
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
