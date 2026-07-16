# SEO Audit — UET GPT (uet-gpt.vercel.app)

_Audit date: 2026-07-16 · Skill: seo-audit v2.0.0_

## Executive Summary

**Overall health: Strong foundation, not yet indexed.**

The site is technically sound: clean crawlability, correct canonicals, descriptive URLs, presence of JSON-LD structured data, and a valid XML sitemap. The single blocking issue is that Google has **not yet indexed** the domain — expected, since the sitemap and first URL were submitted to Search Console today. The remaining work is authority/link-building and getting the other 5 URLs crawled.

**Top priority issues**
1. **Not indexed** (Critical) — waiting on Google crawl; request indexing for all 6 URLs (1 done, 5 pending quota).
2. **Zero backlinks / authority** (High) — new domain, no external links pointing in.
3. **No Google Business Profile / local entity** (Medium) — UET Taxila is a local institution; entity signals help.
4. **No Analytics installed** (Medium) — can't measure organic traffic or confirm crawl.

**Quick wins**
- Request Google indexing for the 5 pending URLs (daily quota).
- Submit to Bing Webmaster Tools (import from GSC, pending).
- Publish dev.to article + free directory listings (in progress).

## Technical SEO Findings

### Crawlability
| Check | Status | Evidence |
|-------|--------|----------|
| robots.txt | PASS | Allows `/`, sitemap referenced, GPTBot/ClaudeBot/PerplexityBot allowed, CCBot blocked |
| XML Sitemap | PASS | 6 URLs, submitted to GSC, canonical & indexable |
| URL structure | PASS | Readable, hyphenated, keyword-rich (`/uet-taxila/fee-structure`) |
| Site architecture | PASS | All pages <3 clicks from home, internal links present |

### Indexation
| Check | Status | Evidence |
|-------|--------|----------|
| site: query | FAIL | `site:uet-gpt.vercel.app` returns 0 results (not indexed yet) |
| Canonical tags | PASS | Self-referencing canonicals on all 6 pages |
| Noindex | PASS | No noindex on important pages |
| HTTPS | PASS | Vercel HTTPS, valid cert |

### On-Page SEO
| Page | Title (len) | Meta Desc (len) | H1 | Canonical |
|------|-----------|-----------------|-----|-----------|
| `/` | UET GPT - Your AI Guide to UET Taxila (38) | ~155 chars | UET GPT | self |
| `/uet-taxila` | UET Taxila - University of Engineering... (52) | ~145 | UET Taxila | self |
| `/uet-taxila/admissions` | UET Taxila Admissions 2025... (49) | ~165 | UET Taxila Admissions | self |
| `/uet-taxila/programs` | UET Taxila Programs & Departments... (53) | ~155 | (h1 not captured) | self |
| `/uet-taxila/fee-structure` | UET Taxila Fee Structure... (52) | ~165 | (h1 not captured) | self |
| `/uet-gpt` | UET GPT - AI Guide to UET Taxila (37) | ~155 | UET GPT | self |

All titles 37–53 chars (target 50–60, slightly short but fine). All meta descriptions 145–165 chars (target 150–160). Unique per page. Keyword near beginning. **PASS.**

### Structured Data
- 1 JSON-LD block per page detected in static HTML (Next.js metadata). Contains Organization, WebSite, SoftwareApplication, FAQPage per the implementation.
- **Note:** web_fetch/curl cannot fully validate JS-injected schema. Validate with Rich Results Test once indexed: https://search.google.com/test/rich-results

### Speed & Mobile
- Vercel Next.js static/edge delivery → fast TTFB expected.
- Recommend confirming Core Web Vitals via PageSpeed Insights post-indexing.

## Prioritized Action Plan

1. **Critical:** Get indexed — request indexing for all 6 URLs in Search Console (1 done, quota reset daily).
2. **High:** Build authority — free directory submissions (The Next AI, Toolsland.ai submitted; ToolScout.ai, AIToolSync pending), dev.to article, GitHub backlinks.
3. **Medium:** Entity signals — Wikidata item, Bing Webmaster Tools, Google Business Profile for UET Taxila.
4. **Medium:** Install analytics (GA4 / Plausible) to measure organic traffic.
5. **Long-term:** Programmatic SEO pages for long-tail UET queries, internal linking from blog content.

## Verdict
Technically index-ready. The bottleneck is crawl/index timing + authority, not code. Next skills (ai-seo, schema, directory-submissions, programmatic-seo) directly address the remaining gaps.
