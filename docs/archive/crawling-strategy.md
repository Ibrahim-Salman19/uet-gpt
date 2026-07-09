# Crawling Strategy

> Authoritative detail in `architecture.md` §6 (Ingestion). Keep this in sync
> with `scripts/crawler.py` and `scripts/crawl_config.json`.

## Pipelines

- **Primary: Python async BFS crawler** (`scripts/crawler.py`) — uses `curl_cffi`,
  `trafilatura`, and `markdownify`; pushes extracted content to the `/ingest`
  webhook. This is the path that runs in production.
- **Secondary (disabled): Crawl4AI** — an external Crawl4AI/Flask service posting
  to `/api/webhook/crawl`. The Crawl4AI cron is **DISABLED** (service unreachable),
  so treat it as optional/secondary.

## Scope

Seed URLs and path scope are defined in `scripts/crawl_config.json` (the single
source of truth — do not hard-code counts in prose). Primary target:
`https://web.uettaxila.edu.pk/`.

- Admission pages (programs, fee structures, schedules)
- Department pages (faculty, courses, research)
- Campus life (events, facilities, policies)
- Official notices and announcements

## Exclusions

- External links (unless explicitly included in the seed config)
- File downloads (PDFs handled separately via `scripts/ingest_pdf.py`)
- Login-protected pages

## Implemented Controls

- Crawl job orchestration in Convex (`convex/crawl/`)
- Rate limiting / politeness delays and incremental re-crawl handling (see CHANGELOG)
- robots.txt handling via `urllib.robotparser` (see `docs/crawl-robots-audit.md`)
- Deduplication and staleness flagging (`convex/crawl/deduplication.ts`, `staleness.ts`)

## Open Items

- [ ] Crawl status monitoring UI
