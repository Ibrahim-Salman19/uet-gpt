# UET GPT — Comprehensive SEO Audit Report

**Date:** 2026-09-01  
**Site:** https://uet-gpt.vercel.app  
**Stack:** Next.js 16.2.6, React 19, Convex, Clerk, Vercel  
**Pages Audited:** 9 public routes + global schemas + sitemap + robots.txt  
**Agents Deployed:** 20 specialized audit agents  

---

## Executive Summary

**Overall Health: B+ (8.3/10 average page score)**

UET GPT has strong technical SEO foundations — structured data, AI bot allowlisting, llms.txt, clean URLs, and solid metadata on most pages. The site ranks well for its niche but has critical gaps that prevent it from reaching its full potential.

### Top 5 Priority Issues

| # | Issue | Severity | Impact |
|---|-------|----------|--------|
| 1 | **Homepage (`route.ts`) bypasses Next.js metadata pipeline** — no OG, no Twitter, no canonical, no JSON-LD, no `<main>` landmark | CRITICAL | Homepage is the #1 entry point but invisible to social sharing and missing rich results |
| 2 | **No legal pages** — zero privacy policy, terms of service, about page, or contact page | CRITICAL | YMYL trust signal failure; no way for users to verify legitimacy |
| 3 | **BreadcrumbList last item includes URL** — violates Google's explicit guidance on all 7 pages | HIGH | Breadcrumb rich results may be suppressed |
| 4 | **`/uet` vs `/uet-taxila` cannibalization** — near-identical titles targeting "UET Taxila" | HIGH | Google splits ranking signals between two pages |
| 5 | **Organization entity has only 1 sameAs link** (GitHub) | HIGH | Knowledge panel eligibility blocked; weak entity signals |

### Quick Wins (implementable in <1 hour)

1. Add `<main>` landmark + skip-to-content to `route.ts`
2. Add FAQPage JSON-LD to homepage
3. Add `SearchAction` to WebSite schema
4. Fix BreadcrumbList last-item URL
5. Add OG image to learn term pages
6. Fix `/uet-taxila` "Fee Structure" card link (points to `#admissions` instead of `/uet-taxila/fee-structure`)

---

## Issue Inventory

### CRITICAL (Blocking indexation/ranking)

| # | Issue | Pages Affected | Agent Source |
|---|-------|---------------|--------------|
| C1 | Homepage `route.ts` has zero OG/Twitter/canonical tags | `/` | Metadata Audit |
| C2 | Homepage has no JSON-LD schema (FAQPage, Organization missing) | `/` | Schema Validation |
| C3 | No privacy policy, terms of service, about page, or contact page | Site-wide | E-E-A-T Audit |
| C4 | No cookie consent mechanism | Site-wide | E-E-A-T Audit |
| C5 | `/about` referenced in `press-kit.md` but route doesn't exist (404) | `press-kit.md` | Technical SEO Audit |
| C6 | No custom `not-found.tsx` — generic 404 with no recovery | Site-wide | Technical SEO Audit |

### HIGH (Significant ranking impact)

| # | Issue | Pages Affected | Agent Source |
|---|-------|---------------|--------------|
| H1 | BreadcrumbList last item has URL (violates Google spec) | All 7 content pages | Schema Validation |
| H2 | Article schema on learn terms missing `image` and `mainEntityOfPage` | `/learn/[slug]` | Schema Validation |
| H3 | `/uet` vs `/uet-taxila` title tag cannibalization | `/uet`, `/uet-taxila` | Cannibalization Audit |
| H4 | `/learn/fee-structure` vs `/uet-taxila/fee-structure` duplicate H1 | `/learn/fee-structure`, `/uet-taxila/fee-structure` | Cannibalization Audit |
| H5 | Organization sameAs has only 1 link (GitHub) | Global schema | Entity Audit |
| H6 | CollegeOrUniversity entity missing `numberOfStudents`, `department`, `faculty`, `telephone`, `geo` | Global schema | Entity Audit |
| H7 | Homepage links to almost nothing — no links to `/learn`, `/uet`, `/uet-gpt`, or sub-pages | `/` | Internal Linking Audit |
| H8 | `/uet-gpt` near-orphan — 1 incoming link | `/uet-gpt` | Internal Linking Audit |
| H9 | Sibling pages (admissions, fee-structure, programs) never cross-link | `/uet-taxila/*` | Internal Linking Audit |
| H10 | Hero text starts invisible (`opacity: 0`) gated on Three.js loading | `/` | Core Web Vitals Audit |
| H11 | Three.js loaded from CDN (~600KB) blocks main thread on landing page | `/` | Core Web Vitals Audit |
| H12 | Learn term pages have no OG image | `/learn/[slug]` | Metadata Audit |
| H13 | `twitter:site` missing everywhere | All pages | Metadata Audit |

### MEDIUM (Moderate impact)

| # | Issue | Pages Affected | Agent Source |
|---|-------|---------------|--------------|
| M1 | CSP uses `unsafe-inline` in script-src | Global | Security Audit |
| M2 | CSP `connect-src` uses wildcard `https:` | Global | Security Audit |
| M3 | Missing `Permissions-Policy` header | Global | Security Audit |
| M4 | `dateModified` hardcoded across 12 files (~35 date strings) | All schemas | Freshness Audit |
| M5 | Admissions page title says "2025" but site year is 2026 | `/uet-taxila/admissions` | Content Audit |
| M6 | `/learn/ecat` vs `/uet-taxila/admissions` ECAT keyword overlap | `/learn/ecat`, `/uet-taxila/admissions` | Cannibalization Audit |
| M7 | `/learn/merit-formula` vs `/uet-taxila/admissions` merit overlap | `/learn/merit-formula`, `/uet-taxila/admissions` | Cannibalization Audit |
| M8 | No shared header/footer component — each page has its own | All pages | Internal Linking Audit |
| M9 | Fee-structure page title exceeds 60 chars (66 chars) | `/uet-taxila/fee-structure` | Metadata Audit |
| M10 | Programs page title exceeds 60 chars (62 chars) | `/uet-taxila/programs` | Metadata Audit |
| M11 | `/learn` index page has no OG image | `/learn` | Metadata Audit |
| M12 | `/uet-taxila/admissions`, `/fee-structure`, `/programs` missing OG image | 3 sub-pages | Metadata Audit |
| M13 | WebSite schema missing `SearchAction` (Sitelinks Searchbox) | Global schema | SERP Features Audit |
| M14 | No `Viewport-fit=cover` for notched devices | Global | Mobile Audit |
| M15 | Mobile nav buttons below 44x44px touch target | Global | Mobile Audit |
| M16 | Logo in JSON-LD declares 512x512 but actual file is 148x148 | Global schema | Image Audit |
| M17 | 5 unused SVG files in `/public` | `public/` | Image Audit |
| M18 | No `next/image` usage for logo or content images | All pages | Image Audit |
| M19 | Zero content images across entire site | All pages | Image Audit |
| M20 | No image sitemap entries | `sitemap.ts` | Image Audit |
| M21 | Cross-page `@id` references don't resolve across `<script>` blocks | All schemas | Schema Validation |
| M22 | Article author uses "UET GPT Team" but Organization is "UET GPT" | `/learn/[slug]` | Entity Audit |
| M23 | FAQPage `dateModified` inconsistent (2026-07-16 vs 2026-07-21) | All FAQ pages | Freshness Audit |
| M24 | No author bylines anywhere — all content published anonymously | All pages | E-E-A-T Audit |
| M25 | No outbound links to `web.uettaxila.edu.pk` for E-E-A-T | All pages | E-E-A-T Audit |
| M26 | No testimonials or student stories | Site-wide | E-E-A-T Audit |
| M27 | SoftwareApplication missing `screenshot`, `downloadUrl`, `featureList` | Global schema | Entity Audit |
| M28 | `www` vs non-www not configured (duplicate content risk) | Site-wide | Crawl Audit |
| M29 | `/learn` cluster is isolated — no incoming links from main site | `/learn` | Internal Linking Audit |
| M30 | Homepage has no `<main>` landmark | `/` | Accessibility Audit |

### LOW (Minor impact)

| # | Issue | Pages Affected | Agent Source |
|---|-------|---------------|--------------|
| L1 | Missing `Bingbot`, `DuckDuckBot` explicit rules in robots.txt | `robots.ts` | Crawl Audit |
| L2 | No `Crawl-delay` for bots | `robots.ts` | Crawl Audit |
| L3 | `theme-color` mismatch between layout (`#070708`) and route.ts (`#07080a`) | `/` | Metadata Audit |
| L4 | `/uet-gpt` meta description slightly short (121 chars) | `/uet-gpt` | Metadata Audit |
| L5 | `/` has no explicit `alternates.canonical` | `/` | Metadata Audit |
| L6 | Generic anchor text "Ask UET GPT" used 15+ times | All pages | Internal Linking Audit |
| L7 | `founder` type is Person but name is "UET GPT Team" (org) | Global schema | Schema Validation |
| L8 | `operatingSystem: "Web"` not in Schema.org enum | Global schema | Schema Validation |
| L9 | CollectionPage missing `mainEntity`/`ItemList` | `/learn` | Schema Validation |
| L10 | FAQPage schemas lack `@id` | All FAQ pages | Schema Validation |
| L11 | `markdown.tsx` fallback produces empty alt on AI-generated images | Chat UI | Accessibility Audit |
| L12 | `auth-guard.tsx` ShieldAlert icon lacks `aria-hidden` | Auth modal | Accessibility Audit |
| L13 | `select.tsx` Radix Select trigger relies on consumer for `aria-label` | UI component | Accessibility Audit |
| L14 | `switch.tsx` has no visible or programmatic label | UI component | Accessibility Audit |
| L15 | No `apple-mobile-web-app-capable` meta tag | Global | Mobile Audit |
| L16 | `highlight.js` CSS imported globally on all pages | Global | Core Web Vitals Audit |
| L17 | Sentry loaded on landing page where it has minimal value | `/` | Core Web Vitals Audit |
| L18 | Clerk loaded on all pages including unauthenticated landing | All pages | Core Web Vitals Audit |
| L19 | No preconnect hints for Clerk/Sentry origins | Global | Core Web Vitals Audit |
| L20 | Missing PWA icon sizes (192x192, 512x512) | `manifest.ts` | Mobile Audit |
| L21 | No `X-XSS-Protection: 0` header | Global | Security Audit |
| L22 | `/learn/eligibility-criteria` vs `/uet-taxila/admissions` overlap | 2 pages | Cannibalization Audit |
| L23 | `/` vs `/uet-gpt` brand keyword overlap | 2 pages | Cannibalization Audit |

---

## Prioritized Action Plan

### Phase 1: Critical Fixes (Week 1)

**Goal:** Fix blocking issues that prevent proper indexing and trust.

| # | Task | Files | Effort | Impact |
|---|------|-------|--------|--------|
| 1.1 | **Convert `route.ts` to `page.tsx`** or add meta tags to HTML template — enables full metadata pipeline (canonical, OG, Twitter, JSON-LD, font optimization) | `src/app/route.ts` | HIGH | Fixes C1, C2, H10, M30 |
| 1.2 | **Add FAQPage JSON-LD to homepage** for the 5 visible FAQ items | `src/app/route.ts` or `page.tsx` | LOW | Fixes C2 |
| 1.3 | **Add `<main>` landmark + skip-to-content** to landing page | `src/app/route.ts` | LOW | Fixes M30, H10 |
| 1.4 | **Create Privacy Policy page** (`/privacy`) | `src/app/privacy/page.tsx` | MEDIUM | Fixes C3 |
| 1.5 | **Create Terms of Service page** (`/terms`) | `src/app/terms/page.tsx` | MEDIUM | Fixes C3 |
| 1.6 | **Create About page** (`/about`) or fix `press-kit.md` broken link | `src/app/about/page.tsx` or `public/press-kit.md` | LOW | Fixes C5 |
| 1.7 | **Create `not-found.tsx`** with branded 404, internal links, and search | `src/app/not-found.tsx` | LOW | Fixes C6 |
| 1.8 | **Add cookie consent banner** | `src/components/cookie-consent.tsx` + layout | MEDIUM | Fixes C4 |

### Phase 2: High-Impact Improvements (Week 2)

**Goal:** Fix schema violations, cannibalization, and internal linking.

| # | Task | Files | Effort | Impact |
|---|------|-------|--------|--------|
| 2.1 | **Fix BreadcrumbList last-item URL** — remove `item` property from last entry | `src/lib/json-ld.tsx:107-112` | LOW | Fixes H1 (all 7 pages) |
| 2.2 | **Add `image` and `mainEntityOfPage` to Article schema** | `src/app/learn/[slug]/page.tsx` | LOW | Fixes H2 |
| 2.3 | **Add `SearchAction` to WebSite schema** | `src/lib/json-ld.tsx:27-38` | LOW | Fixes M13 |
| 2.4 | **301-redirect `/uet` → `/uet-taxila`** or noindex `/uet` | `next.config.mjs` redirects or `src/app/uet/page.tsx` | LOW | Fixes H3 |
| 2.5 | **Noindex or differentiate `/learn/fee-structure`** from `/uet-taxila/fee-structure` | `src/app/learn/[slug]/page.tsx` | LOW | Fixes H4 |
| 2.6 | **Add cross-links between sibling pages** — admissions ↔ fee-structure ↔ programs | `src/app/uet-taxila/*/page.tsx` | LOW | Fixes H9 |
| 2.7 | **Add contextual links from homepage** to `/learn`, `/uet-taxila/admissions`, `/uet-taxila/fee-structure`, `/uet-taxila/programs` | `src/app/route.ts` | LOW | Fixes H7 |
| 2.8 | **Add link to `/uet-gpt` from homepage** and footer of all pages | Multiple files | LOW | Fixes H8 |
| 2.9 | **Add OG image to learn term pages** | `src/app/learn/[slug]/page.tsx` | LOW | Fixes H12 |
| 2.10 | **Add `twitter:site`** to layout metadata | `src/app/layout.tsx` | LOW | Fixes H13 |
| 2.11 | **Enhance CollegeOrUniversity entity** — add `numberOfStudents`, `department`, `faculty`, `telephone`, `geo` | `src/lib/json-ld.tsx:64-86` | MEDIUM | Fixes H6 |
| 2.12 | **Add more sameAs links** to Organization (Twitter/X, LinkedIn, Product Hunt) | `src/lib/json-ld.tsx:24` | LOW | Fixes H5 |
| 2.13 | **Decouple hero text from Three.js** — start at `opacity: 1`, animate only if JS runs | `src/app/route.ts:107-108` | MEDIUM | Fixes H10 |
| 2.14 | **Lazy-load Three.js** behind viewport intersection | `src/app/route.ts` | MEDIUM | Fixes H11 |

### Phase 3: Medium-Impact Optimizations (Week 3)

**Goal:** Improve content quality, freshness, and SERP feature eligibility.

| # | Task | Files | Effort | Impact |
|---|------|-------|--------|--------|
| 3.1 | **Centralize date constants** — create `src/lib/dates.ts` with `SCHEMA_DATE` and `LEARN_TERMS_DATE` | New file + 12 files | MEDIUM | Fixes M4, M23 |
| 3.2 | **Update admissions title** from "2025" to current year or remove year | `src/app/uet-taxila/admissions/page.tsx` | LOW | Fixes M5 |
| 3.3 | **Differentiate title tags** for cannibalization pairs (learn/ecat, learn/merit-formula, learn/eligibility-criteria) | `src/lib/learn-terms.ts` | LOW | Fixes M6, M7, M22 |
| 3.4 | **Shorten page titles** for fee-structure and programs to ≤60 chars | `src/app/uet-taxila/fee-structure/page.tsx`, `programs/page.tsx` | LOW | Fixes M9, M10 |
| 3.5 | **Add `Viewport-fit=cover`** to viewport export | `src/app/layout.tsx` | LOW | Fixes M14 |
| 3.6 | **Increase mobile tap targets** to 44x44px | `src/components/main-shell.tsx` | LOW | Fixes M15 |
| 3.7 | **Replace logo** with 512x512 PNG/WebP | `public/uet-logo.jpg` → new file | LOW | Fixes M16 |
| 3.8 | **Delete 5 unused SVGs** from `/public` | `public/file.svg`, `globe.svg`, `next.svg`, `vercel.svg`, `window.svg` | LOW | Fixes M17 |
| 3.9 | **Add `images` config** to `next.config.mjs` with modern formats | `next.config.mjs` | LOW | Fixes M18 |
| 3.10 | **Add image sitemap entries** | `src/app/sitemap.ts` | LOW | Fixes M20 |
| 3.11 | **Add outbound links to `web.uettaxila.edu.pk`** on admissions, fee-structure, and programs pages | `src/app/uet-taxila/*/page.tsx` | LOW | Fixes M25 |
| 3.12 | **Add author bylines** (even team byline) to all content pages | All page files | LOW | Fixes M24 |
| 3.13 | **Fix CSP `connect-src`** — replace wildcard with explicit domains | `next.config.mjs` | MEDIUM | Fixes M2 |
| 3.14 | **Add `Permissions-Policy` header** | `next.config.mjs` | LOW | Fixes M3 |
| 3.15 | **Fix `www` vs non-www** redirect | Vercel settings or `next.config.mjs` | LOW | Fixes M28 |
| 3.16 | **Add `ItemList` schema** to `/learn` and `/uet-taxila` for departments | `src/app/learn/page.tsx`, `src/app/uet-taxila/page.tsx` | MEDIUM | Fixes L9, M27 |
| 3.17 | **Wrap how-to steps in `<ol><li>`** on admissions and uet-gpt pages | `src/app/uet-taxila/admissions/page.tsx`, `src/app/uet-gpt/page.tsx` | LOW | SERP snippet optimization |
| 3.18 | **Add definition paragraphs** ("What is X?") to fee-structure, programs, and `/uet` pages | Multiple page files | LOW | Featured snippet optimization |
| 3.19 | **Fix Organization name inconsistency** — use "UET GPT" everywhere (not "UET GPT Team") | `src/app/learn/[slug]/page.tsx` | LOW | Fixes M22 |
| 3.20 | **Fix `/learn` isolation** — add incoming links from `/`, `/uet-taxila`, `/uet-taxila/admissions` | Multiple page files | LOW | Fixes M29 |

### Phase 4: Long-Term Recommendations (Month 2+)

**Goal:** Build authority, expand content, and capture more SERP features.

| # | Task | Effort | Impact |
|---|------|--------|--------|
| 4.1 | **Create program-specific pages** (BS CS, BS SE, BS EE, etc.) — captures long-tail "UET Taxila CS admission" queries | HIGH | Keyword expansion |
| 4.2 | **Add interactive merit calculator** — linkable asset, high engagement | HIGH | Backlink magnet |
| 4.3 | **Build blog with ECAT prep content** — captures "ECAT 2026 preparation" queries | HIGH | Adjacent keyword capture |
| 4.4 | **Add comparison pages** (UET Taxila vs UET Lahore, vs NUST, vs FAST) | MEDIUM | Competitive keywords |
| 4.5 | **Pitch to SAMAA TV, ProPakistani, Dawn Tech** — media backlinks (PU Chatbot got 5+ outlets) | MEDIUM | Backlinks + authority |
| 4.6 | **Launch on Product Hunt + Hacker News** | MEDIUM | Backlinks + awareness |
| 4.7 | **Submit to PakAdmissions.com, education directories** | LOW | Directory backlinks |
| 4.8 | **Add student testimonials** with names and photos | MEDIUM | E-E-A-T + social proof |
| 4.9 | **Create Wikidata item** for "UET GPT" | LOW | Knowledge graph |
| 4.10 | **Add Urdu/Roman Urdu content** for local SEO reach | HIGH | Local SEO |
| 4.11 | **Add HowTo schema** to admissions page with numbered steps | LOW | Rich results |
| 4.12 | **Add `@id` to all FAQPage schemas** and resolve cross-block references | LOW | Schema completeness |
| 4.13 | **Nonce-based CSP migration** to remove `unsafe-inline` from script-src | HIGH | Security hardening |
| 4.14 | **Create scholarship guide page** | MEDIUM | Keyword expansion |
| 4.15 | **Create campus life guide** (hostels, transport, library) | MEDIUM | Content depth |
| 4.16 | **Add PWA icon sizes** (192x192, 512x512 PNG) with maskable purpose | LOW | PWA + mobile |
| 4.17 | **Gate Clerk/Sentry** to authenticated routes only | MEDIUM | Performance |
| 4.18 | **Self-host Three.js** instead of CDN import | MEDIUM | Performance + security |
| 4.19 | **Add FAQPage `@id`** to all pages for cross-reference resolution | LOW | Schema completeness |
| 4.20 | **Fix CollegeOrUniversity logo** to use actual UET Taxila seal | LOW | Entity accuracy |

---

## Scorecard by Page

| Page | Score | Grade | Key Issues |
|---|---|---|---|
| `/` (Homepage) | 6.8 | C+ | No OG/Twitter/canonical, no JSON-LD, no `<main>`, Three.js blocks LCP |
| `/learn` | 8.1 | B+ | No OG image, thin index content |
| `/learn/[slug]` | 8.8 | A | No OG image, Article missing `image`/`mainEntityOfPage` |
| `/uet` | 8.1 | B+ | Cannibalizes `/uet-taxila`, thin content |
| `/uet-taxila` | 8.7 | A | No images, fee card links to wrong anchor |
| `/uet-taxila/admissions` | 8.8 | A | Title says "2025", no OG image |
| `/uet-taxila/fee-structure` | 8.5 | A- | Title too long (66 chars), no OG image |
| `/uet-taxila/programs` | 8.2 | B+ | Title too long (62 chars), no OG image |
| `/uet-gpt` | 8.8 | A | Near-orphan, meta description short |

---

## Scorecard by Category

| Category | Score | Notes |
|---|---|---|
| **Schema Markup** | 7/10 | BreadcrumbList violation, Article missing fields, missing SearchAction |
| **Metadata (OG/Twitter)** | 6/10 | Homepage has none; learn/sub-pages missing images |
| **Content Quality** | 8/10 | Strong depth on admissions/fee-structure; thin on `/uet` and `/learn` |
| **Internal Linking** | 5/10 | Homepage links to nothing; orphans; siblings don't cross-link |
| **Technical SEO** | 8/10 | Clean sitemap, good robots.txt, CSP needs hardening |
| **E-E-A-T** | 4/10 | No legal pages, no authors, no testimonials, no contact info |
| **AI/LLM SEO** | 9/10 | Excellent llms.txt, AI bot allowlisting, structured data |
| **Mobile** | 7/10 | Responsive but missing viewport-fit, tap targets, PWA icons |
| **Core Web Vitals** | 6/10 | Three.js blocks main thread; hero text invisible until JS |
| **Image SEO** | 3/10 | Zero content images; logo mismatch; no next/image |
| **Entity/Knowledge Graph** | 4/10 | Thin sameAs; incomplete CollegeOrUniversity; no Wikipedia |
| **SERP Features** | 7/10 | Good FAQ/breadcrumb; missing SearchAction, HowTo, table snippets |
| **Security** | 7/10 | HSTS excellent; CSP has unsafe-inline; missing Permissions-Policy |
| **Content Freshness** | 5/10 | 35 hardcoded dates across 12 files; "2025" in title |

---

## What's Already Strong

- ✅ AI bot allowlisting (GPTBot, ClaudeBot, PerplexityBot all allowed)
- ✅ llms.txt and llms-full.txt for AI search visibility
- ✅ Rich structured data (Organization, WebSite, SoftwareApplication, CollegeOrUniversity, Article, FAQPage, BreadcrumbList)
- ✅ Properly excluded auth-gated/admin routes from sitemap
- ✅ Edge-level RBAC with Clerk middleware
- ✅ HSTS with preload and 2-year max-age
- ✅ Clean, semantic URL structure with no orphan pages (except `/uet-gpt`)
- ✅ Strong content depth on admissions, fee-structure, and programs pages
- ✅ FAQ schema on every content page
- ✅ Comprehensive meta descriptions on all pages
- ✅ Proper canonical tags on all pages except homepage
- ✅ Dynamic sitemap with `force-dynamic`
- ✅ Responsive design with Tailwind breakpoints
- ✅ Open-source transparency with RAG methodology explained
