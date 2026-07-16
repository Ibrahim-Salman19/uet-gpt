# Schema / Structured Data Audit — UET GPT

_Audit date: 2026-07-16 · Skill: schema / schema-markup_

## Verdict: STRONG (above average for a small open-source project)

Live JSON-LD confirmed on key pages (`@graph` with 4 node types):

| Schema Type | Present | Notes |
|-------------|---------|-------|
| `Organization` | ✓ | name, logo, foundingDate 2025 (sameAs intentionally omitted per request) |
| `WebSite` | ✓ | + `SearchAction` (chat?q= template) — enables sitelinks search box |
| `SoftwareApplication` | ✓ | operatingSystem Web, `offers` price 0 USD, `about: CollegeOrUniversity`, `license: AGPL-3.0` |
| `FAQPage` | ✓ | Matches visible FAQ (single-source via `FAQ_ITEMS`) |

## Why this matters for ranking
- Content with proper schema shows **30-40% higher AI visibility** (per ai-seo skill).
- `sameAs` was intentionally omitted (per request) since the code repo is not to be referenced publicly; the entity graph still resolves via the official website.
- `offers price:0` makes the free tier machine-readable for AI agents (pairs with `/pricing.md`).

## Recommendations (minor)
1. **BreadcrumbList** on deep pages (`/uet-taxila/admissions`, `/programs`, `/fee-structure`) — helps Google understand hierarchy and can show breadcrumb SERP trails. Low effort in Next.js `metadata`.
2. **Validate post-indexing** with Google Rich Results Test (renders JS): https://search.google.com/test/rich-results — confirm FAQ + SoftwareApplication rich results are eligible.
3. **Add `dateModified`** to SoftwareApplication / Article nodes once pages update (freshness signal for AI).

## No action required
Schema is already implemented correctly and extractable. Do NOT add more types than the content supports (over-schema can look spammy).
