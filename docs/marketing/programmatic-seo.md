# Programmatic SEO Strategy — UET GPT

_Date: 2026-07-16 · Skill: programmatic-seo v2.0.0_

## Asset: Proprietary Data
UET GPT's RAG pipeline already ingests official UET Taxila documents (prospectus, website, schedules). This is **proprietary/derived data** — the strongest defensibility tier. Use it to populate templated pages with real, grounded content (not swapped variables).

## Playbooks That Fit (in priority order)

### 1. Directory — Department Pages (HIGH)
14 departments across 6 faculties. One page each, populated from official data.
- **URL**: `/uet-taxila/departments/[slug]` (e.g. `/uet-taxila/departments/electrical-engineering`)
- **Title**: `UET Taxila [Department] - Admissions, Scope & Faculty | UET GPT`
- **Content**: intro (unique per dept), degree programs (UG/PG/PhD), intake/seats if available, career scope, faculty count, how UET GPT helps
- **Schema**: `CollegeOrUniversity` / `Course` + BreadcrumbList
- **Internal links**: link to `/uet-taxila/programs`, `/uet-taxila/admissions`, sibling departments
- **Why**: captures "[department] UET Taxila" long-tail; competitors have thin pages.

### 2. Comparisons — UET Taxila vs [University] (HIGH)
High-intent queries students actually search.
- **URL**: `/uet-taxila/compare/[slug]` (e.g. `/uet-taxila/compare/nust`, `/compare/fast`, `/compare/pieas`, `/compare/comsats`, `/compare/uet-lahore`)
- **Title**: `UET Taxila vs [X] - Which Engineering University? | UET GPT`
- **Content**: comparison table (ranking, fees, entry test, programs, location, HEC recognition), balanced pros/cons, FAQ
- **Schema**: `FAQPage` + comparison `ItemList`/table
- **Why**: comparison articles = ~33% of AI citations; currently no grounded comparison exists.

### 3. Glossary — "What is [term]" (MEDIUM)
UET/pakistan-specific terms.
- **URL**: `/glossary/[term]` (e.g. `/glossary/ecat`, `/glossary/merit-formula`, `/glossary/hec`, `/glossary/washington-accord`)
- **Content**: definition (40-60 words, extractable), related links, FAQ
- **Schema**: `DefinedTerm` / `FAQPage`
- **Why**: "what is ECAT" / "how is UET merit calculated" are high-volume informational queries.

### 4. Personas — "UET GPT for [audience]" (LOW)
- `/uet-gpt/for/prospective-students`, `/for/parents`, `/for/current-students`
- **Why**: captures use-case queries; lower volume but high conversion to chat.

## URL Structure Rules
- Subfolders only (consolidate authority), no subdomains.
- Lowercase, hyphenated, keyword-rich.
- Add all to `sitemap.ts`; BreadcrumbList on each.

## Quality Safeguards (avoid penalties)
- Each page must have **unique intro + real data** from the prospectus, not just swapped variables.
- Noindex only genuinely thin variations.
- Cap initial launch at ~25-30 pages; expand after indexing confirmed.

## Implementation Order
1. Department template + 14 pages (data from `prospectus.txt` / RAG).
2. Comparison template + 5 university pages.
3. Glossary template + 4 terms.
4. Submit new sitemap; request indexing in batches.

## Effort Estimate
Templates: ~3 components. Data: already in RAG corpus. This is the highest-leverage ranking play after indexation.
