# Programmatic SEO Plan — UET GPT

_Skill: programmatic-seo · Date: 2026-07-16 · Status: strategy (ready to build)_

## Recommended Playbook: Glossary ("what is [UET Term]")

Best fit for UET GPT because we already have **verified, sourced data** (the
UET Prospectus 2025 + web.uettaxila.edu.pk) and the audience (applicants,
parents, students) runs high-intent "what is X" searches.

Glossary pages capture long-tail queries that the current 6-page cluster does
not, e.g.:
- "what is ECAT for UET Taxila"
- "UET Taxila merit formula / aggregate marks"
- "UET Taxila eligibility criteria"
- "UET Taxila hostel allotment rules"
- "UET Taxila scholarship schemes"

## Guardrails (from the skill — do NOT violate)
- **Unique value per page** — every page must answer real intent, not just a
  swapped variable. Write a genuine 250-400 word explanation per term.
- **No thin content** — if a term can't fill ~300 words of real content,
  fold it into a parent page instead of publishing an orphan.
- **Accuracy** — only use figures traceable to the prospectus / official site.
  Do not invent fees, dates, or seat counts.
- **Nokeyword stuffing**, no doorway pages.
- **Internal linking** — each glossary page links to the relevant hub
  (`/uet-taxila/admissions`, `/uet-taxila/fee-structure`, `/uet-taxila/programs`)
  and to `/uet-gpt`. Hub-and-spoke.
- **Schema** — each page gets `Article` (datePublished/dateModified, author =
  UET GPT Team) + `FAQPage` + `BreadcrumbList`.

## Target Terms (Phase 1 — verified data already on site)
1. ECAT (entry test) — links to `/uet-taxila/admissions`
2. Merit Formula / Aggregate Marks (ECAT 33%, HSSC 50%, SSC 17%) — `/admissions`
3. Eligibility Criteria (60% / 50% floors) — `/admissions`
4. Hostel Allotment — `/uet-taxila` campus-life section
5. Scholarships — `/uet-taxila` scholarships section
6. Fee Structure Components (tuition, hostel, other) — `/uet-taxila/fee-structure`

## URL + Template
- URL: `/learn/[term]` (subfolder, not subdomain — consolidates authority)
- Title: `What is [Term] at UET Taxila? - UET GPT`
- Meta: 150-160 chars, includes the term + "UET Taxila"
- Body: definition (40-60 word lead) → how it works → who it applies to →
  common mistakes → FAQ → CTA to UET GPT
- `noindex` any stub < 300 words.

## Indexation
- Add `/learn/*` to `src/app/sitemap.ts`.
- Submit a fresh sitemap to GSC after launch.
- Verify in Rich Results Test (renders JS) before going live.

## Why not other playbooks
- **Comparisons** ("UET Taxila vs UET Lahore"): needs external facts we can't
  verify → skip to avoid inaccuracy.
- **Locations**: only one campus in scope → no pattern.
- **Templates/Examples**: not a fit for an informational chatbot.

## Next step
Build the `/learn/[term]` route from a typed term array (one data file) with
the template above. Keep it RSC (no `"use client"`) for crawlability.
