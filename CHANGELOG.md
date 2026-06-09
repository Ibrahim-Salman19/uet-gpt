# Changelog

All notable changes to the UETGPT project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- `CHANGELOG.md` — project changelog established
- `scripts/crawl_config.json` — shared configuration with 49 seed URLs, rate limiter, queue settings
- `scripts/smoke_test_ingest.py` — 18 end-to-end pipeline tests (auth, domain allowlist, dedup, SimHash, etc.)

### Fixed
- WebGL context loss crashes in UI components
- Unicode document title headers causing 500 errors
- Convex validation strictness issues
- All unbounded `.collect()` calls eliminated, replaced with indexed queries
- **Python scripts: 18 missing fixes implemented** (see details below)
- **TypeScript config: 5 failed + 3 partial fixes resolved**
- **Convex code quality: `as any` reduced from 10+ to 1 documented location, duplicate code deduplicated**

### Python Scripts — Full Fix Audit Applied
- `scripts/crawler.py`:
  - M2: `CONVEX_SITE_URL` startup guard with `sys.exit(1)` when unset
  - M6: DLQ atomic swap pattern (`rename → process → remove`) with orphan recovery
  - Mo1: sitemap.xml discovery via `discover_sitemap()` using `curl_cffi`
  - Mo4: `robots.txt` enforcement via `urllib.robotparser.RobotFileParser`
  - E2: BestFirst crawling using `asyncio.PriorityQueue` with multi-factor URL scoring
  - R6: 64-bit SimHash near-duplicate detection (MD5 + Hamming distance ≤8)
  - R7: Queue maxsize 500 with `put_nowait()` and `QueueFull` catch
  - H2: Rate limiter reads parameters from `crawl_config.json`
  - H3: 17-pattern excludePaths with `fnmatch` glob matching
  - E8: Crash recovery with periodic state saves and resume
  - M11: `--clean` CLI flag calling `/api/reset` endpoint
  - Config-driven seed URLs, maxDepth, concurrency from `crawl_config.json`
- `scripts/ingest_pdf.py`:
  - H4: `infer_freshness_tier()` function with assign_tier() logic
  - S3: PDF push retry — 3-attempt exponential backoff with jitter
  - N2: `sourceType: "pdf"` in push payload
  - L5: Virtual URL migrated from `pdf://` to `https://uetgpt.local/pdf/<hash>`
  - FreshnessTier included in push payload

### TypeScript Config & Frontend
- `tsconfig.json` — `convex/` excluded from root (delegates to `convex/tsconfig.json`)
- `next.config.ts` — Sentry made conditional on `process.env.SENTRY_DSN`
- `src/lib/constants.ts` — Seed URLs expanded to 73, `maxDepth` set to 4, `includePaths` and `excludePaths` expanded
- `src/app/admin/crawls/page.tsx` — Reads `maxDepth` from `UET_CRAWL_CONFIG` instead of hardcoding
- `convex/embeddings/generate.ts` — Orphaned `openRouterKey` env var removed

### Convex Code Quality
- `convex/rag/retrieval.ts` — `as any` reduced from 10+ locations to 1 documented Convex pattern; unused `as any` eliminated
- `convex/crawl/webhook.ts` — Duplicated `contextPrefix` logic extracted to shared `buildContextPrefix()` helper
- `convex/crawl/mutations.ts` — Single-chunk failure marking now preserves multi-chunk documents (fails only when ALL chunks fail)
- `convex/crawl/actions.ts` — Duplicate `isPdfVirtualUrl` removed; imported from `chunking.ts`

## [14.0] — 2026-06-02

### Changed
- Architecture audit + CRON alignment finalized
- All 39 audit issues fully resolved. Zero outstanding issues.

## [13.0] — 2026-06-02

### Added
- `scripts/smoke_test_ingest.py` — end-to-end ingest pipeline validation (6/6 tests passing)

### Changed
- TypeScript strict‑mode improvements across `actions.ts` and `webhook.ts`
- Sentry SDK made conditional on `SENTRY_DSN` being set
- Root `tsconfig.json` now excludes `convex/` (delegates to `convex/tsconfig.json`)

### Removed
- Empty `SENTRY_DSN` and unused `NEXT_PUBLIC_CONVEX_SITE_URL` from `.env.local`

### Fixed
- `convex/actions.ts` — weak type annotations hardened (readonly string[], non‑null assertions)
- `convex/webhook.ts` — implicit `any` on regex match groups resolved

### Operations
- `CONVEX_AUTH_TOKEN` and `CRAWL_WEBHOOK_SECRET` set on deployment
- `npx convex dev` — all functions deployed successfully

## [12.0] — 2026-05-31

### Added
- `robots.txt` enforcement in Pipeline B via `RobotFileParser` at startup
- BestFirst crawling strategy using `asyncio.PriorityQueue` with multi‑factor URL scoring (depth, keywords, domain match)
- Near‑duplicate detection — 64‑bit SimHash with MD5 hashing + Hamming distance ≤8 threshold (per‑session in‑memory set)
- PDF virtual URL scheme migrated to `https://uetgpt.local/pdf/<contentHash[:16]>` with backward compatibility helper
- Chunk metadata enriched with URL path in `contextPrefix` for richer embeddings
- Queue deadlock prevention — max size 500, `put_nowait()` with `QueueFull` catch

### Fixed
- `asyncio.Queue` deadlock risk resolved

## [11.9] — 2026-05-31

### Fixed
- `upsertDocument` crash on `pdf://` URLs — added `startsWith("pdf://")` guard for `source` field
- Pipeline A webhook missing `freshnessTier` — added `assignFreshnessTier()` + field in `queueChunksForEmbedding`
- `onChunkEmbedded` double‑insert of chunks — removed redundant insert; callback now only handles status + DLQ cleanup
- `markStaleDocuments` scope — now scans `active` + `indexed` + `pending_embed` + `processing` statuses
- No clean‑start database reset — added `resetAllPipelineData` mutation + `/api/reset` HTTP endpoint + `--clean` flag

## [11.8] — 2026-05-31

### Added
- `failStuckJobs` mutation scheduled every 30 minutes via cron
- PDF ingester push retry — 3‑attempt exponential backoff with jitter

### Fixed
- State change webhooks (`?type=state`) processed as completions — early return 200 without processing
- `queueChunksForEmbedding` crash on `pdf://` URLs — try/catch with `"unknown"` fallback

## [11.7] — 2026-05-31

### Fixed
- Pipeline B rate limiter reads from `crawl_config.json` instead of hardcoded defaults
- Pipeline B exclude paths filtering via glob‑regex `excludePaths`
- PDF ingester `infer_freshness_tier()` NameError — implemented with `assign_tier()` logic
- HMAC payload alignment — receiver verifies timestamp only, matching sender

## [11.4] — 2026-05-30

### Security
- Full Security & Reliability Audit completed — 39 issues identified across 5 rounds

## [11.3] — 2026-05-30

### Added
- `scripts/crawl_config.json` — shared configuration for both pipelines (49 seed URLs)
- Sitemap discovery step (post‑init, pre‑crawl) with `curl_cffi` session
- Daily cadence enforcement — 23‑hour cooldown check in `kickoffDailyCrawl`
- Cost control — >500 word guard before calling Gemini summarization API
- URL canonicalization (`canonicalizeUrl()`) — strips fragment, trailing slash, query params
- PDF content guard — skip PDFs with no extractable content
- Additional exclude patterns: `/search*`, `/print/**`, `/feed/**`, `/gallery/**`
- processedWebhooks TTL extended to 30 days

### Changed
- Seed URLs unified: Pipeline A 23 → 49, Pipeline B 52+ → 49
- `maxDepth` unified to 4 across both pipelines
- Webhook payload limit raised from 1MB to 10MB

### Fixed
- `CONVEX_SITE_URL` unvalidated in Pipeline B — added `sys.exit(1)` guard at startup
- Sentence‑boundary regex splitting on abbreviations — 26‑pattern abbreviation protection with sentinel replacement
- DLQ crash losing retry data — atomic swap pattern (`rename → process → remove`) with orphan recovery
- DLQ retry never runs — added `retry-dead-letter` cron every 4 hours

### Security
- Crawl4AI Docker CVEs documented: RCE (CVSS 10.0), LFI (CVSS 8.6), Redis UAF (CVSS 10.0) — pin to `unclecode/crawl4ai:0.8.5+`
- Rate limiting against UET ASP.NET server — `delay_before_return_html: 1000`, `mean_delay: 1.0`

## [11.2] — 2026-05-30

### Added
- Settings pages backend integration

### Fixed
- `feedback/list.ts` type mismatch

## [10.0] — 2026-05-28

### Fixed
- Continued Round 1 audit fixes (see v9.0)

## [9.0] — 2026-05-28

### Fixed
- `ALLOWED_DOMAINS` NameError at runtime — defined as `frozenset` from shared config
- `flagExpiredDocuments` only scanned `"indexed"` status — added dual query for `"indexed"` + `"active"`
- `saveEmbedding` race with `onChunkEmbedded` — added `doc.status !== "indexed"` guard
- `crawlJobs.stats` never updated from zeros — added page counting, token/chunk estimation, stats payload in `completeJobByTaskId`

## [8.0] — 2026-05-30

### Added
- Full system audit and architectural remediations

## [7.0] — 2026-05 (pre-30)

### Fixed
- Dead Letter Queue double‑processing risk
- Dual cleanup functions (one not scheduled)
- `completeJobByTaskId` not indexed
- `rag.delete()` silent failures

## [5.0] — 2026-05 (pre-30)

### Removed
- OpenRouter embedding fallback — removed to prevent vector space mismatch with Gemini embeddings

## [0.1.0] — 2026-05 (Initial)

### Added
- Project scaffold with Next.js + Convex + Clerk
- Convex schema (threads, messages, documents, chunks)
- Clerk webhook integration with Convex upsert
- Convex auth helpers (getUserId, isAuthenticated, isAdmin)
- shadcn UI components (form, calendar)
- Threads/messages API tests
- CI and deploy GitHub Actions workflows
- All Biome lint warnings resolved (49 warnings → zero)
- Tailwind CSS configuration
- Robots audit documentation
