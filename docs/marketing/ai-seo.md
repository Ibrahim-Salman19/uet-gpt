# AI SEO (GEO/AEO) Audit — UET GPT

_Audit date: 2026-07-16 · Skill: ai-seo v2.0.0_

## Goal
Get UET GPT cited by AI systems (ChatGPT, Perplexity, Claude, Gemini, Google AI Overviews, Copilot) for "UET", "UET Taxila", "UET GPT" queries.

## AI Bot Access Check (Pillar 3 foundation)
Verified in `robots.txt`:
- `GPTBot`, `ChatGPT-User` → Allowed ✓
- `PerplexityBot` → Allowed ✓
- `ClaudeBot`, `anthropic-ai` → Allowed ✓
- `Google-Extended` → Allowed ✓
- `CCBot` (Common Crawl, training-only) → Blocked (correct middle ground)

**Verdict: AI crawlers can cite the site. PASS.**

## Machine-Readable Files (already done)
- `public/llms.txt` — comprehensive, machine-readable overview, links to chat/pricing/GitHub. Excellent. ✓
- `public/pricing.md` — structured Free tier + planned Pro/Enterprise. ✓

## Content Extractability (Pillar 1)
| Check | Status | Evidence |
|-------|--------|----------|
| Definition in first paragraph | PASS | Each page leads with a direct definition |
| Self-contained answer blocks | PASS | FAQ + prose blocks |
| Comparison tables | PARTIAL | UET GPT vs generic GPT not explicitly tabled |
| FAQ with natural-language Qs | PASS | FAQPage JSON-LD present on key pages |
| Schema (FAQ/Product/Org) | PASS | Organization, WebSite, SoftwareApplication, FAQPage |
| Heading matches query patterns | PASS | H2/H3 mirror "UET Taxila admissions" etc. |
| AI bots allowed | PASS | See above |

## Authority (Pillar 2) — GAPS
Princeton GEO research: cite sources (+40%), statistics (+37%), quotations (+30%), authoritative tone (+25%).

| Gap | Impact | Fix |
|-----|--------|-----|
| No "Last updated" date visible on pages | Medium | Add `Last updated: 2026-07` to footer/page |
| Few inline citations to sources on public pages | Medium | Link claims to `web.uettaxila.edu.pk` / prospectus inline |
| No named author/expert attribution | Medium | Add author/team bio + credentials block |
| No statistics with dated sources | Low | Add e.g. "5,000+ students", "6 faculties, 14 departments" with source |

## Presence (Pillar 3) — where AI looks
Third-party sources drive 6.5x more citations than own domain.
| Channel | Status | Action |
|---------|--------|--------|
| Wikipedia / Wikidata | PENDING | Create Wikidata item (draft ready) |
| GitHub | DONE | Repo public, README links site |
| Reddit | PENDING | Post in r/UET, r/KE, r/Islamabad (authentic, non-spam) |
| dev.to article | PENDING | Publish (draft ready, no em dashes) |
| Free AI directories | IN PROGRESS | The Next AI + Toolsland.ai submitted; ToolScout.ai, AIToolSync pending |
| YouTube | FUTURE | How-to video for "UET Taxila admissions" |

## Content Types That Get Cited (prioritize)
Comparison articles (~33%), definitive guides (~15%), original data (~12%), best-of (~10%).
→ UET GPT should create: "UET Taxila vs other engineering universities Pakistan" (comparison, high-intent) and "UET Taxila admissions guide 2025" (definitive).

## Action Plan
1. Add visible "Last updated" date to public pages (footer component).
2. Add 1-2 inline source citations per page (link to official UET pages).
3. Add author/team attribution block.
4. Create Wikidata entity (highest-leverage third-party signal).
5. Publish dev.to article + Reddit posts.
6. Submit remaining free directories (ToolScout.ai, AIToolSync).
7. Monthly DIY monitoring: test 20 queries in ChatGPT/Perplexity/Google post-indexing.

## Verdict
Strong AI-SEO foundation (bots allowed, llms.txt, pricing.md, schema, FAQ). The differentiator now is **authority + third-party presence**, both addressable this week.
