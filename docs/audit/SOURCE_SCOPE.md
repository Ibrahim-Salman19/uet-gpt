# UET Taxila — Host & Content-Scope Registry

Reference: `docs/audit/SNAPSHOT_20260726T094113Z.json` (live probes 2026-07-26).

## Host registry

| Host | Scope state | Evidence | Crawl status |
|---|---|---|---|
| `web.uettaxila.edu.pk` | **Included official public source** | SSR HTML, all content visible without JS; in `includePatterns` | Crawled (seed + 23 sections) |
| `uettaxila.edu.pk` | **Included official public source** | SSR HTML; identical content to `web.` (canonicalization concern — see below); in `includePatterns` | Crawled |
| `www.uettaxila.edu.pk` | **Discovery-only / alias of `web.`** | Live probe: same nav menu, relative+absolute URL mix proves single-site-across-hosts; NOT explicitly in `includePatterns` but reachable via link graph | Reachable; canonicalization needed |
| `admissions.uettaxila.edu.pk` | **Included official public source** | SSR HTML, Fall 2026 admissions content; in `includePatterns`; 6 deep links seeded (Fees, Procedure, Schedule, Seats, Merit, Prospectus) | Crawled |
| `fms.uettaxila.edu.pk` | **Unknown / requiring review — GAP** | Faculty profile pages (research, publications, contacts) linked from crawled `departmentfaculty?departmentId=N` pages (verified live: Dr. Muhammad Yaqub, Dr. Usman Ali Naeem etc.); NOT in `includePatterns` | **NOT crawled — orphaned** |
| `uet-gpt.vercel.app` | **Application host (not a crawl source)** | The deployed chatbot | N/A |
| `*.convex.cloud` / `*.convex.site` | **Operational system (excluded from crawl)** | Backend | N/A |

### Excluded operational / authenticated systems (policy — never crawl)
LMS, MIS, ERP, AMSYS, Outlook, authenticated admissions accounts, e-filing, student portals, email systems, internal file-tracking. Per spec §1.1: excluded unless a particular public route is demonstrably intended for public indexing.

## Route families verified live (2026-07-26)

| Pattern | Example | Page type | Parser | Extractable |
|---|---|---|---|---|
| `.asp` | `web.uettaxila.edu.pk/BWD/tenders.asp` | Legacy ASP | trafilatura | ✅ SSR |
| `.aspx` | `web.uettaxila.edu.pk/Sports.aspx`, `departmentfaculty?departmentId=N` | Legacy ASPX | trafilatura | ✅ SSR |
| `.aspx?id=` | (in constants.ts Path B config) | Parameter route | trafilatura | ✅ SSR |
| `.php` | `admissions.uettaxila.edu.pk/Fees.php` | Admissions PHP | trafilatura | ✅ SSR (fee table verified) |
| `?departmentId=N` | `web.uettaxila.edu.pk/departmentfaculty?departmentId=1` | Query-param route | trafilatura | ✅ SSR (faculty verified) |
| Extensionless | `web.uettaxila.edu.pk/academics/` | Modern route | trafilatura | ✅ SSR |
| `.pdf` | `admissions.uettaxila.edu.pk/Downloads/UET-Prospectus-2024.pdf` | Document | pymupdf4llm | ⚠️ DLQ'd (HTTP 500/timeout) |
| `.htm` | `web.uettaxila.edu.pk/aboutQEC.htm` | Legacy | trafilatura | ❌ 404 (in crawler.log) |

## Discovery channels

| Channel | Status | Notes |
|---|---|---|
| `robots.txt` | ✅ Fetched, respected | Comment-only on `web.` and `admissions.` — no Disallow, **no Sitemap directive** |
| XML sitemap | ❌ Absent | `uettaxila.edu.pk/sitemap.xml` and `web.uettaxila.edu.pk/sitemap.xml` both 404 |
| HTML navigation (BFS) | ✅ Primary | Crawler's main discovery mechanism; maxDepth 4 |
| Footer/sidebar links | ✅ Via BFS | Captured in trafilatura extraction |
| PDF links | ✅ Via BFS | Homepage exposes UET-Prospectus-2024/2025, Rule-Book-2023, Prospectus-PG-2021-onwards, Varsity-News — all discoverable |
| `departmentfaculty?departmentId=1-25` | ✅ Auto-seeded | `departmentFacultyRange` in crawl_config |

## Canonicalization concern (R1 amendment — per-document, not blanket host collapse)

`www.uettaxila.edu.pk` and `web.uettaxila.edu.pk` serve identical content (verified: same 11-item nav menu, relative URLs + absolute `web.` URLs coexisting). However, per the critique's amendment, this must NOT become a blanket host-wide normalization. Phase 3 implements **per-document canonical clusters** using redirect chain + `<link rel=canonical>` + normalized content hash + SimHash + title/heading/attachment similarity + effective date + manual override. Every alias URL preserved for citations.

## robots.txt per host

| Host | Disallow | Sitemap | Notes |
|---|---|---|---|
| `web.uettaxila.edu.pk` | none (comment-only) | none declared | Effectively allow-all |
| `admissions.uettaxila.edu.pk` | none (comment-only) | none declared | Effectively allow-all |
| `uettaxila.edu.pk` | not probed | none (sitemap 404) | Assumed same |

## Critical source families (Phase 2 authority matrix inputs)

| Family | Primary authority | Current coverage | Gap |
|---|---|---|---|
| Undergrad admissions | `admissions.uettaxila.edu.pk` + current prospectus | Fees/Seats/Schedule/Merit/Procedure pages seeded | Prospectus 2024/2025 PDFs DLQ'd |
| Postgrad admissions | `admissions.` + PG prospectus | Partial | PG prospectus is "2021 onwards" (stale) |
| Faculty | `web./departmentfaculty` + `fms./Profile/*` | Listing pages crawled | **`fms.` profiles out of scope** |
| Examinations | `web./examinations/` | Seeded | Date sheets link to generic `/Examinations/Results` |
| Departments | `web./departments/` + per-dept `.asp` indexes | Seeded | Many short pages skipped (minWordCount=80) |
| Policies/rules | Rule Book PDF | Link present | Rule-Book-2023 (stale relative to 2026) |

## Freshness signals observed (contradictory — R3 amendment)

| Signal | Value | Reliability |
|---|---|---|
| Admissions portal banner | "Fall 2026" | Low — banner ≠ content year |
| Fee page heading | "Undergraduate Admissions Fall - 2025" | High — section heading |
| Fee page footer | "© 2026" | Low — footer ≠ content year |
| Prospectus availability page | Lists 2024 + 2025 prospectuses under Fall 2026 banner | Conflicting |
| Rules page | Links 2023 undergrad + older PG prospectus | Historical |

**Implication:** freshness cannot be derived from banner/footer/crawl-date alone. Phase 2/3 bitemporal metadata + temporal resolver required.
