# web-other capture shortlist — rationale

This document records how the 14-fixture `web-other` batch was selected from
the 207 successfully-ingested `web.uettaxila.edu.pk` URLs in
`crawl_ledger.sqlite3`. It exists so a future maintainer can audit *why* these
specific URLs were captured and *why* others were excluded — the directive is
explicit that selection must maximize structural diversity, not reward word
count alone.

## Selection method

1. **Pool**: the 207 ledger rows where
   `state='ingested' AND word_count > 50 AND host = web.uettaxila.edu.pk AND
   http_status IN 2xx AND path NOT LIKE '%.asp' AND path NOT LIKE '%.aspx'`.
   (`.asp` pages belong to the existing `legacy-asp` family; `.aspx` to
   `legacy-aspx`.)
2. **Stratification signals** (per the directive):
   - first one-or-two path components (route prefix)
   - word-count bucket: low (<300), med (300–800), high (>800)
   - presence of a query string (e.g. `departmentId=`, `StudyLevelId=`)
   - file extension (`.htm` legacy vs extension-less modern routes)
   - page shape (listing vs detail vs office vs lab)
3. **Exclusion rules**:
   - PDFs and other binary documents (`pdf-download` family)
   - login/session-dependent pages (`*/login*`, `*/logout*` — already in the
     crawler's `excludePatterns`)
   - near-duplicate templates captured elsewhere (e.g. ten faculty pages would
     add little over one; department-template variance is exercised by two
     distinct department IDs)
   - URLs whose real-crawl state was `failed_fetch` (e.g.
     `departmentId=4` returned 522 Cloudflare in the production crawl —
     captured success cannot be assumed, so it was swapped for `departmentId=2`,
     Mechanical, which ingested cleanly with wc=851)

## The 14 fixtures and their rationale

| # | URL | Route shape | WC bucket | Why included |
|---|---|---|---|---|
| 1 | `/dlsei` | standalone modern | med (483) | The directive explicitly cites DLSEI: modern nav, downloads, external links, images, 2026 footer — materially different from older templates |
| 2 | `/RTI` | standalone modern | med (545) | Right-to-Information government-style info page; distinct content type from DLSEI |
| 3 | `/departmentfaculty?departmentId=2` | query-param, table | high (851) | Mechanical faculty listing — table-heavy, server-rendered roster |
| 4 | `/departmentfaculty?departmentId=5` | query-param, table | med (644) | Software Eng faculty — same template, different department, lower wc; tests template stability across IDs |
| 5 | `/DownloadExaminationForms` | CMS/download hub | med (413) | Resource/link-heavy page with many download anchors — exercises typed-resource recall |
| 6 | `/NewsDetails/Celebrating-Pakistani-Researchers...` | path detail | med (396) | Single news detail article — prose-heavy, distinct from listings |
| 7 | `/Events/All` | aggregated listing | high (1317) | Largest events listing — high link density, navigation-heavy |
| 8 | `/21stConvocation2024` | standalone | high (2248) | Convocation — schedule, dates, registration links; critical-ish content |
| 9 | `/ITservices` | office/download | med (782) | IT-services office page with download links and contact info |
| 10 | `/TimeTables?DepartmentId=4&StudyLevelId=1` | query-param table | low (212) | Low-wc table-only page — exercises sparse-content extraction |
| 11 | `/swarmroboticslab/Publications` | lab sub-site | high (864) | Research-lab template, distinct from main university chrome |
| 12 | `/qec/aboutQEC.htm` | legacy `.htm` | med (649) | Pre-ASP `.htm` office page — older static-HTML shape |
| 13 | `/swarmroboticslab/AimandScope` | lab sub-site | low (194) | Low-wc edge case — diagnostic; sparse content, near-vacuous |
| 14 | `/pgAdmissions` | admissions-adjacent | med (347) | Postgraduate admissions process page — critical-adjacent content |

## Coverage of the directive's 8 page shapes

| Page shape (directive) | Fixture(s) |
|---|---|
| Modern non-ASP informational section | 1 (dlsei), 2 (RTI) |
| Department landing / academic page | 3 (Mech faculty), 4 (Software Eng faculty) |
| Faculty or staff listing | 3, 4 |
| Course/catalog/CMS-style page | 5 (Exam forms download) |
| News, events, projects, announcements | 6 (News), 7 (Events/All), 8 (Convocation) |
| Office/download-heavy page | 9 (ITservices) |
| Table-heavy or form-heavy page | 10 (TimeTables) |
| Malformed/unusual/low-confidence page | 13 (AimandScope) |

Plus two bonus structural axes not in the directive's list but valuable:
research-lab sub-template (11, 13), legacy `.htm` (12), and PG admissions
content (14).

## What was deliberately NOT captured (this batch)

- **40 `/DSA/SocietyEventDetails`** pages — a single template repeated 40×.
  One DSA event would add coverage; forty would not. Deferred to a future
  expansion batch only if within-family variance surfaces.
- **`/EventDetails/*`** (68 URLs) — same template, different titles. The
  `/NewsDetails/*` and `/Events/All` fixtures already exercise this shape.
- **27 `departmentfaculty` IDs** — two IDs (Mechanical, Software) sample the
  template; the rest are near-duplicates.
- **Conference micro-sites** (`/icame2024` wc=6484, `/1stICACEE` wc=2555) —
  high value but very large and a distinct shape (academic-conference
  landing); better suited to a dedicated expansion if a lab/conference
  cluster gap is later identified.

## Re-expansion criteria

Per the directive, expand toward 25–30 `web-other` fixtures only when:
- a large template cluster remains unrepresented (e.g. if DSA events prove
  structurally distinct from the Events/All listing), or
- a distinct page structure appears in failures, or
- a critical content category is absent, or
- failures indicate meaningful within-family variance.

This batch is the deliberate 14-fixture first pass.
