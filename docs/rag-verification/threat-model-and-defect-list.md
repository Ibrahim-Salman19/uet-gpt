# Threat Model & Prioritized Defect List

**Branch:** agent/2026-07-29-full-rag-verification
**Date:** 2026-08-02
**Status:** Consolidated from 5 parallel code audits + direct verification; fixes to be implemented test-first, in priority order.

## 1. Scope

Crawl + RAG ingestion pipeline: `scripts/crawler.py` (orchestrator, ~5,258 lines), `scripts/uet_crawler/*` (url_policy 883 L, robots_rules, browser_renderer 1,430 L, crawl_ledger 972 L, html_extractor 3,872 L, gemini_response, image_normalization), `scripts/ingest_pdf.py` (2,116 L), `scripts/pdf_markdown_cleaner.py` (1,051 L), Convex backend (`convex/schema.ts`, `convex/crawl/*`, `convex/embeddings/*`, `convex/doc/*`), offline test suite under `scripts/`.

## 2. Assets

| Asset | Location | Notes |
|---|---|---|
| Crawl state | `crawler_state.json` (project root) | crash-resume state, STATE_VERSION 5 |
| Coverage | `crawl_coverage.json` / `.csv` | final deliverable |
| SQLite ledger | `crawl_ledger.sqlite3` (+WAL/SHM/journal) | recovery/coverage artifact; journal_mode=WAL, synchronous=FULL |
| DLQ | `dlq.jsonl`, `dlq_dead.jsonl`, `dlq_malformed.jsonl`, `dlq*.processing.*.jsonl` | retry bookkeeping |
| Documents | Convex `documents` table | url = dedup key (`by_url` index, not unique), contentHash (client sha256), freshnessTier 14/60/180 d, isStale never cleared |
| Chunks/vectors | Convex `crawledChunks`, `ragId` | embedding pipeline |
| Secrets | `.env.local` (gitignored) | CONVEX_AUTH_TOKEN, CRAWL_WEBHOOK_SECRET, GEMINI_API_KEY(_1/_2) |

## 3. Trust boundaries & threat model

| # | Threat | Mitigation | Status |
|---|---|---|---|
| T1 | SSRF: crawler fetches internal/private addresses via DNS rebinding or redirects | OWASP SSRF Cheat Sheet: resolve → validate → pin. `RawHttpClient` (crawler.py:1283–1462): per-hop `is_network_target` re-check (L1364), DNS pinning via `CurlOpt.RESOLVE` + FRESH_CONNECT/FORBID_REUSE (L1304, L1314–1321), `trust_env=False` (L1380), manual redirect chain w/ loop detection (L1395–1420). Browser renderer re-runs `canonicalize` + `is_network_target` + DNS `is_safe` per route (browser_renderer.py `_route_request`). | VERIFIED GOOD |
| T2 | Robots evasion / crawling non-permitted scope | `RobotsPolicy` (crawler.py:1481–1690) RFC 9309-compliant; protego 0.6.2 (fixes CVE-2026-55520 wildcard ReDoS); 429-denies; no-store staleness. URL policy mutation-route filter (`_MUTATION_NAMES`/`_MUTATION_QUERY_KEYS`). | VERIFIED GOOD |
| T3 | Prompt injection into Gemini VLM | VLM_SYSTEM_INSTRUCTION declares untrusted DATA, forbids instruction following (ingest_pdf.py). Image normalization + markdown cleaning. | VERIFIED GOOD |
| T4 | Memory/DoS: unbounded page size, redirect loops, render storms | 64KiB header cap, 64/256 header count caps, streamed size caps + MAXFILESIZE_LARGE, redirect loop detection, `RenderLimitReached` cap on render attempts (browser_renderer.py:1102–1108), response byte caps, PDF page-count cap (ingest_pdf.py:806). | VERIFIED GOOD (but see D3) |
| T5 | XML/HTML entity expansion | defusedxml installed; Python expat SetBillionLaughsAttackProtection defaults (8 MiB activation threshold). | VERIFIED GOOD |
| T6 | PDF parsing vulnerabilities | pymupdf 1.28.0 (CVE-2026-3029 fixed in 1.26.7; we are above), pymupdf4llm RAG mode. | VERIFIED GOOD |
| T7 | Persistent I/O budget breach (mandate: 500 MiB hard cap) | `IoBudgetMonitor` sums ledger+sidecars, state, DLQ, coverage files; soft 450 MiB / stop 480 MiB / hard 500 MiB; fail-fast validation of thresholds. | **DEFECT D1** |
| T8 | Data loss on crash/power loss | Ledger: WAL + synchronous=FULL + BEGIN IMMEDIATE + fsync; DLQ atomic append/compaction; processing-file crash recovery; orphan processing-file recovery. | VERIFIED GOOD |
| T9 | Race on dedup (two workers same URL) | Convex mutations serializable/atomic (OCC); dedup in-process frontier + content-hash dedupe with reservation/release. `documents.by_url` index is NOT unique — correctness relies on single-mutation lookup+insert. | VERIFIED GOOD |
| T10 | Stale content served as fresh | freshnessTier TTL + daily flagger; freshness clock = `crawledAt`. | VERIFIED GOOD |
| T11 | Secrets leakage | .env.local gitignored; no logging of keys (spot-checked). | VERIFIED GOOD |
| T12 | Cost blowup (Gemini/Convex) | page_needs_vlm gating, dedupe before push, DLQ attempt caps, render cap. | VERIFIED GOOD (see D3) |

## 4. Research decisions (sources)

1. **Protego pin `==0.6.2`** — fixes CVE-2026-55520 / GHSA-wjmf-p669-5m5p (exponential backtracking ReDoS on robots.txt URL wildcards). Confirmed installed.
2. **pymupdf `1.28.0`** — above 1.26.7 which fixed CVE-2026-3029 (path traversal via `embedded_get`). Confirmed installed.
3. **SSRF defense** follows OWASP SSRF Prevention Cheat Sheet (resolve → validate → pin). Already implemented; no change needed.
4. **Robots**: RFC 9309 (Sept 2022) is the standards-track REP; crawler implements it.
5. **Convex atomicity**: mutations are serializable and auto-retried on conflict — lookup-then-insert dedup in one mutation is race-safe. Documented; no change needed.
6. **Playwright**: `serviceWorkers: "block"` is the documented API for network-interception containment; `route_web_socket` added for WS closure. Correct as implemented.
7. **expat**: billion-laughs protections active by default (activation threshold 8 MiB) in Python 3.10. No change needed.

## 5. Prioritized defect list (all entries verified against source)

### D1 — HIGH — I/O budget monitor omits DLQ malformed + processing files
- **Evidence:** `IoBudgetMonitor._paths` (crawler.py:4239–4252) tracks ledger+sidecars, state_file, dlq_file, dead_dlq_file, coverage json/csv. It does NOT track `dlq_malformed.jsonl` (created by ledger at crawl_ledger.py:3378 as `dlq_file.with_name("dlq_malformed.jsonl")`) nor the transient `dlq*.processing.*.jsonl` files (crawl_ledger.py:3569–3573).
- **Impact:** durable malformed-file growth is invisible to the 500 MiB hard cap; the mandate's hard limit could be silently exceeded. Processing files are transient but should be counted while present.
- **Fix:** extend `_paths` with the malformed path (derived from `dlq_file`) and add a `dlq*.processing.*.jsonl` glob to `usage_bytes()`.

### D3 — HIGH — `RenderLimitReached` classified as retryable + DLQ-eligible
- **Evidence:** `fetch_and_extract_once` (crawler.py:2619–2628) catches `Exception` from `renderer.render()` and returns `FetchFailure(..., retryable=True, dlq_eligible=True)`. `RenderLimitReached` (browser_renderer.py:135, raised at 1104–1108 when `max_pages` attempted) therefore lands in the DLQ and retries 10× (dlqMaxAttempts) — each retry re-fetches the page and re-renders — then dies as "failed". This is a capacity signal, not a transient failure.
- **Impact:** up to N workers × 10 wasted full-fetch+render cycles per capped page; DLQ churn; misleading final coverage (URLs marked failed that were simply past the render budget).
- **Fix:** catch `RenderLimitReached` specifically before the generic handler → `retryable=False, dlq_eligible=False` with a clear terminal error.

### D4 — MEDIUM — No total per-render deadline in `BrowserRenderer.render`
- **Evidence:** `page.goto` carries `timeout_seconds` (browser_renderer.py:1277–1281) and context default timeouts are set (L1187–1189), but the surrounding work (DOM snapshot via CDP, `_collect_links`, response-task draining at L1360–1375, context close) has no aggregate deadline. A pathological page can pin a worker well beyond `timeout_seconds`.
- **Impact:** crawl worker starvation; budget/time blowout on hostile pages; degraded graceful-stop latency.
- **Fix:** wrap the per-render body in `asyncio.wait_for(..., timeout=self.timeout_seconds * 2)`; on timeout raise `BrowserRendererError` (context cleanup already runs in `finally`).

### D6 — MEDIUM — Zero test coverage on `html_extractor` (largest module)
- **Evidence:** no `scripts/test_html_extractor.py` exists; html_extractor.py is 3,872 lines (title ranking L1045–1083, protected-token DOM preservation L373–384/L1012–1023, `_SafeMarkdownConverter.convert_a` L42–62, `_markdownify_dom` L3299–3311).
- **Impact:** regressions in extraction quality are undetectable by the suite; this module gates Stage D/E quality.
- **Fix:** add `scripts/test_html_extractor.py` — smoke tests: title ranking (h1 > og:title > <title>; generic-penalty list), hidden-but-relevant content preservation (modal/accordion/tab), angle-bracket link conversion, failure hygiene (no exceptions on malformed input).

### D7 — MEDIUM — Stale duplicate `scripts/url_policy.py` (171 lines) vs hardened `scripts/uet_crawler/url_policy.py` (883 lines)
- **Evidence:** crawler.py:66 and audit_extraction.py:27 import `uet_crawler.url_policy`; the flat file is untracked, unimported dead code containing the pre-hardening logic.
- **Impact:** maintenance hazard; a future import path could pick up the unhardened version.
- **Fix:** do not delete (pre-existing, per CLAUDE.md). Document in final report; optionally remove only if user approves.

### D8 — LOW — `mark_result` keeps stale `http_status` on late success paths
- **Evidence:** crawl_ledger.py:587–591 `http_status=COALESCE(?, http_status)` — a `skipped_short`/`skipped_duplicate` recorded after a prior 429 keeps status 429 in the ledger row. Cosmetic (reporting only; state field drives coverage counts).
- **Decision:** document, do not fix (surgical-change rule; no correctness impact).

### D9 — LOW — `crawl_events` grows unboundedly (one row per result + per event)
- **Evidence:** crawl_ledger `_initialize` creates `crawl_events` without retention; `mark_result` inserts an event per call (L592–609).
- **Impact:** bounded by URL count × ~2 rows; acceptable at expected scale (tens of thousands of URLs). No fix; noted for capacity review.

### D10 — NOTE — `uet_crawler/*.py` symlinks to flat files (html_extractor, gemini_response, image_normalization; robots_rules)
- **Evidence:** md5-identical content verified (html c2fe9491…, gemini 724e606e…, image 46b10b2f…); no drift possible.
- **Risk:** symlinks break on Windows without developer mode. WSL fine. Noted for packaging; no fix.

### D11 — HIGH — Gemini `v1/interactions` vision payload used unsupported `input` types
- **Evidence:** `describe_image` (crawler.py) posted `input: [{"type":"text"}, {"type":"image"}]`; the live endpoint rejects both (`"The value 'image' is not supported for 'type' at 'input[1]'"`; supported: `content`, `user_input`, …). Every image transcription returned HTTP 400 → all image descriptions (PDF figures, HTML images) silently missing. Discovered during Stage B live dry run; reproduced with curl; verified the correct shape (single `content` item wrapping `text` + `image` parts with base64 `data`/`mime_type`/`resolution`) returns 200 with a valid transcription.
- **Fix:** extracted `build_gemini_interaction_payload()` (crawler.py) using the verified shape; `describe_image` calls it. Live verification: 200 + `{"decorative": true, "markdown": "", "unreadable_items": []}` through the real client.

## 6. Fix execution plan (test-first)

| Defect | Test (write first, must fail) | Fix | Verify |
|---|---|---|---|
| D1 | extend `test_io_budget.py` `IoBudgetMonitorTests`: write only `dlq_malformed.jsonl` + `dlq.processing.*.jsonl` → `usage_bytes()` counts them; hard-limit raise triggered by those files alone | add paths to `IoBudgetMonitor` | `python3 -m pytest scripts/test_io_budget.py -v` |
| D3 | new `test_render_limit.py`: stub raw_http returns HTML that triggers `html_render_reason`, stub renderer raises `RenderLimitReached` → `FetchAttempt.retryable is False`, `dlq_eligible is False` | specific except in `fetch_and_extract_once` | `python3 -m pytest scripts/test_render_limit.py -v` |
| D4 | subclass `BrowserRenderer` overriding `_render_once` to sleep; `timeout_seconds=0.2` → `render()` raises `BrowserRendererError` in ~0.5 s (needs async_playwright import guard — skipped if playwright missing) | `asyncio.wait_for` wrapper in `render()` | `python3 -m pytest scripts/test_render_deadline.py -v` |
| D6 | new `test_html_extractor.py` smoke tests (title ranking, protected tokens, link conversion, malformed-input hygiene) | code changes only if tests expose bugs | `python3 -m pytest scripts/test_html_extractor.py -v` |

Then: full suite re-run (`test_io_budget`, `test_crawler_security`, `test_crawler_adversarial`, `test_url_policy_adversarial`, `test_robots_rules_adversarial`, `test_gemini_response`, `test_image_normalization`, `test_ingest_pdf`, `test_pdf_markdown_cleaner`, new files) → Stage B/C dry runs → Stage D limited ingestion → Stage E retrieval eval → full crawl.

## 7. Fix status (2026-08-02)

| Defect | Status | Evidence |
|---|---|---|
| D1 | FIXED | `crawler.py` `IoBudgetMonitor` now tracks `dlq_malformed.jsonl` + `dlq*.processing.*.jsonl`; `test_io_budget.py` 12/12 pass |
| D3 | FIXED | `fetch_and_extract_once` catches `RenderLimitReached` before generic handler → `retryable=False, dlq_eligible=False`; `test_render_limit.py` 4/4 pass |
| D4 | FIXED | `render()` wraps `_render_locked` in `asyncio.wait_for(timeout_seconds * 2)` → `BrowserRendererError`; `test_render_deadline.py` 2/2 pass |
| D6 | FIXED (coverage) | `test_html_extractor.py` added: 10/10 pass (title ranking, protected content, link conversion, failure hygiene) |
| D11 | FIXED | `build_gemini_interaction_payload()` (verified live: HTTP 200, valid transcription); `test_gemini_payload.py` 6/6 pass |
| D7 | DOCUMENTED | stale `scripts/url_policy.py` left in place (per CLAUDE.md surgical rule); flagged for user approval to delete |
| D8 | DOCUMENTED | no fix (cosmetic, reporting only) |
| D9 | DOCUMENTED | no fix; capacity note |
| D10 | DOCUMENTED | symlink layout confirmed md5-identical |

**Full suite: 196 passed in ~20s (13 test files, incl. smoke_test_ingest 19 passed/1 skipped).**
