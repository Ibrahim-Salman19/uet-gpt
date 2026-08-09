# UET RAG Crawler — Written Threat Model

Date: 2026-08-01
Scope: `scripts/crawler.py`, `scripts/uet_crawler/*` (url_policy, robots_rules, browser_renderer, crawl_ledger, html_extractor, image_normalization, gemini_response), Convex `/ingest` backend.
Author: pipeline hardening run. This document precedes all security changes in this run.

Severity: CRIT / HIGH / MED / LOW. For each threat: existing control, gap, severity, exploit/failure scenario, required correction, test proving the correction.

---

## 1. URL and network threats

| Threat | Existing control | Gap | Severity | Scenario | Correction | Test |
|---|---|---|---|---|---|---|
| SSRF via internal IP | `HostSafetyCache.resolve` rejects non-global IPs (crawler.py `_is_public_ip`); `UrlPolicy.is_network_target` restricts to official suffix; IP literals short-circuit through `_is_public_ip` | None found | CRIT | Malicious link `http://169.254.169.254/` | Already closed | test_crawler_security + url_policy adversarial |
| DNS rebinding (TOCTOU) | All addresses pinned via `CURLOPT_RESOLVE`; `FRESH_CONNECT=1`/`FORBID_REUSE=1`; per-request resolve+recheck on every redirect hop | None found | CRIT | Host resolves public first check, private on connect | Already closed | test_crawler_security `test_resolved_ips_pinned` |
| Public DNS resolving to private address | `resolve()` requires ALL answers public; >16 answers blocked | None | HIGH | `uettaxila.edu.pk` poisoned to 127.0.0.1 | Closed | test_crawler_adversarial |
| IPv4-mapped IPv6 / 6to4 / Teredo | Unwrapped; Teredo fail-closed | None | MED | `::ffff:127.0.0.1` bypass | Closed | `_is_public_ip` tests |
| Alternative numeric IP forms (127.1, octal, hex, integer) | `_is_numeric_host` rejects in `_process_host` | None | HIGH | `http://2130706433/` | Closed | test_url_policy_adversarial |
| Unicode lookalike / IDNA confusion | UTS #46 + std3 with `idna>=3.14` (CVE-2026-45409 gate); non-ASCII hosts fail closed when idna unavailable | None | HIGH | `https://uettaxila.edu.pк/` (Cyrillic к) | Closed | test_url_policy_adversarial |
| Trailing-dot hosts | Single trailing dot normalized away | Acceptable | LOW | `uettaxila.edu.pk.` | Documented behavior | url_policy tests |
| User-info URLs | Rejected in canonicalize/origin | None | HIGH | `https://user:pass@host/` | Closed | url_policy tests |
| Backslash authority confusion | `_text_cleanup` rejects `\` | None | HIGH | `https://host\@evil/` | Closed | url_policy tests |
| Malformed/zero ports | `parsed.port` validation; port 0 rejected; non-default ports not allowed for suffix match | None | HIGH | `https://host:0/` | Closed | url_policy tests |
| Redirect chains / open redirects | Manual redirect loop; every hop re-validated (policy + DNS); max 5; loop detection; `allow_redirects=False` | None | CRIT | 301 to attacker host | Closed | test_crawler_adversarial |
| Scheme changes | HTTP→HTTPS only for exact seed hosts / configured hosts; never https→http downgrade | None | HIGH | https→http downgrade | Closed | url_policy tests |
| Proxy environment leakage | `trust_env=False` on all sessions; `trustEnvironmentProxies=true` hard-rejected | None | HIGH | `HTTP_PROXY` env smuggling traffic | Closed | load_settings test |
| Service-worker request bypass | Playwright `service_workers="block"`; websocket/eventsource routed and blocked | None | MED | SW hijacks fetch | Closed | browser renderer |
| Browser subresource escape | Route handler re-checks policy+DNS per request; third-party only for https script/stylesheet deps | None | HIGH | `<img src=https://evil/…>` | Closed | browser renderer routing |
| WebSockets / EventSource | Resource-type blocking + `route_web_socket` closure | None | MED | ws exfil | Closed | browser renderer |

## 2. Parser threats

| Threat | Existing control | Gap | Severity | Scenario | Correction | Test |
|---|---|---|---|---|---|---|
| Oversized HTML | `max_response_bytes` stream cap (25 MiB default); html_extractor `max_input_bytes` | None | MED | 5 GB HTML | Closed | crawler adversarial |
| Oversized PDFs | `max_pdf_response_bytes` (50 MiB default); pymupdf page/object limits via ingest path | None | MED | 2 GB PDF | Closed | test_ingest_pdf |
| Malformed HTML | lxml + html.parser fallback; replace-char diagnostics | None | LOW | garbage HTML | Closed | adversarial |
| Malformed XML / DTD / entities | Expat with DTD/entity rejection, `validate_xml_runtime` gate (Expat ≥ 2.7.2), depth/element/attr caps | None | HIGH | billion-laughs sitemap | Closed | test_crawler_adversarial |
| Quadratic XML expansion / huge tokens | `MAX_XML_TOKEN_BYTES` 64 KiB, element/attr caps | None | MED | quadratic nesting | Closed | sitemap fuzz |
| Gzip bombs | Ratio cap 250 + size caps; bounded streaming decompress | None | HIGH | 1 GB → 250 GB | Closed | test_crawler_adversarial |
| Recursive sitemap indexes | Depth-limited BFS; file cap; cycle-safe via seen set | None | MED | sitemap index → index | Closed | sitemap tests |
| Excessive sitemap URLs | `sitemap_max_urls` (default 1M), 50k locations/file | None | MED | 10M URLs | Closed | sitemap tests |
| Malformed UTF-8 / control chars | `_text_cleanup`, `_prepare_robots_text` line filtering, decode diagnostics | None | LOW | NUL-injected robots | Closed | robots adversarial |
| Malicious PDFs | pymupdf sandboxed parsing; page limits; OCR bounded | PDFs are complex; pymupdf CVEs exist in the wild | MED | crafted PDF exploiting parser | Version-pinned pymupdf; treat extraction failures as explicit | test_ingest_pdf adversarial |
| Image decompression bombs | Pillow `Image.MAX_IMAGE_PIXELS`? | **Pillow decompression-bomb guard not verified** | MED | 100k×100k PNG | Verify/ensure `Image.MAX_IMAGE_PIXELS` or dimension limits in `prepare_image_for_gemini` | test_image_normalization |
| Model hallucinations | Gemini temperature 0.0; JSON schema response_format; "unreadable_items" handling; model text marked separately | Model can still invent | MED | Image transcription invents a fee amount | Prompt containment + marked model text + not authoritative | test_gemini_response |

## 3. Crawler threats

| Threat | Existing control | Gap | Severity | Scenario | Correction | Test |
|---|---|---|---|---|---|---|
| Infinite pagination | `max_depth` default 4; priority BFS; no auto-pagination | Acceptable | LOW | `?page=1..N` | Bounded by query param budget + depth | adversarial |
| Query permutation explosion | `max_query_params` 20, `max_query_values_per_key` 8, strip params | None | MED | facet explosion | Closed | url_policy tests |
| Duplicate content | ContentDeduplicator exact+SimHash, reservation-based | None | MED | mirrored pages | Closed | dedup tests |
| Infinite scrolling | `_bounded_scroll` 18 steps / 120k px | None | MED | infinite feed | Closed | browser renderer |
| Recursive iframes | frame count 24, 8 MiB/frame, 16 MiB aggregate, policy+DNS re-check | None | HIGH | nested frames | Closed | browser renderer |
| Shadow DOM explosion | open-root materialization with node/char caps; CDP snapshot ≤250k nodes, 16 MiB | None | MED | shadow recursion | Closed | browser renderer |
| Unbounded browser rendering | per-render hard timeout; `render_max_pages` 500; attempt budget; context-per-page | None | MED | slow JS page | Closed | browser renderer |
| Queue starvation | Priority queue; BFS depth ordering; retries via DLQ re-enqueue | None | LOW | low-priority starvation | Documented | — |
| Priority inversion | N/A (no locks in frontier beyond in-memory sets) | None | LOW | — | — | — |
| Retry storms | AIMD + token bucket + host pacer + full-jitter backoff + Retry-After bound | AIMD backs off only on 0/429/503 (500/502/504 don't slow it) | LOW | 500-storm | Acceptable; documented | — |
| Host overload | `min_host_delay` per origin; crawl-delay honored (cap 300 s) | None | MED | hammering | Closed | — |
| Duplicate scheduling | Frontier `seen` set + atomic enqueue; ledger PK (run_id, url) | None | HIGH | two workers same URL | Closed | concurrency tests |
| Shutdown data loss | stop_event → workers cancelled → requeue in-flight; checkpoint on interrupt | None | CRIT | SIGKILL | State save + DLQ replay | recovery tests |
| DLQ loss | durable append (fsync), snapshot compaction with crash-safe ordering | None | HIGH | crash mid-compaction | Closed | recovery tests |
| State corruption | atomic rename; corrupt quarantine; version check | None | MED | partial write | Closed | recovery tests |
| Concurrent dedup races | pending reservation futures; commit after durable success; release on failure | None | HIGH | two workers same doc | Closed | dedup concurrency tests |

## 4. Ingestion threats

| Threat | Existing control | Gap | Severity | Scenario | Correction | Test |
|---|---|---|---|---|---|---|
| Oversized payloads | crawler `max_ingest_bytes` (default 5 MiB) byte check | **Backend `/ingest` caps at 4,194,304 characters; crawler byte check alone can pass a 4–5 MiB ASCII payload the backend 413s** | HIGH | 4.5 MiB ASCII page | Align: default 4 MiB + character check on serialized payload | new push-limit test |
| Partial writes | Single Convex mutation; `upsertDocument` atomic | None | MED | crash mid-push | Retry idempotent | — |
| Duplicate ingestion | contentHash compare → `skipped`; crawler sends Idempotency-Key | Backend ignores the header (dedup is by URL+contentHash; consistent semantics) | LOW | retry double-write | Documented; semantics equivalent | backend smoke |
| Push accepted but local state not committed | `_finish_after_irreversible_side_effect` defers cancellation; `_finalize_successful_push` writes ledger+DLQ ack+commit reservation | None | HIGH | cancel during push | Closed | cancellation tests |
| Local commit but remote push failed | Retries; failure → DLQ; reservation released | None | MED | 500 after commit | DLQ replay is idempotent | recovery tests |
| Stale content replacing fresher | backend keeps existing when same hash; different hash → full replace (documented behavior) | Backend has no last-write-wins freshness logic on `/ingest`; freshnessTier passed but unused | MED | older crawl overwrites newer | Documented limitation | — |
| Missing provenance | backend stores url/source/crawlSessionId; chunk parents carry headingPath | None | LOW | provenance loss | Closed | backend smoke |
| Chunk-order loss | backend preserves parent/child order via chunking | None | LOW | reorder | Closed | — |
| Failed embeddings | workpool retries; DLQ on embed failure | Hard workpool failure with null return is silently dropped (backend bug, mutations.ts routeChunkResult) | MED | embed crash | Backend limitation documented; retry via cron backstop | — |
| Orphaned records | backend cascades deletes | None | LOW | chunk orphan | Closed | — |
| **Persistent DB I/O exhaustion (this run's 500 MiB cap)** | **No monitor exists** | **No application-level accounting, no file-size tracking, no 450/480/500 thresholds** | CRIT (run budget) | crawl writes > 500 MiB of ledger/state | Implement `IoBudgetMonitor` | new test_io_budget.py |
| `--clean` then resume | `--clean` resets backend; resume restores deduper exact-hashes → refetched pages skipped as duplicates | **`--clean`+resume leaves backend empty** | HIGH | `--clean --resume` run | Treat `--clean` as fresh start (no restore) | new test |
| Config coercion | strict `config_int/float/bool`; `_require_range`; rejects NaN/Inf/negatives | None | MED | `"concurrency": "many"` | Closed | load_settings tests |

---

## Controls summary

- SSRF: policy + per-request DNS + pinned connections + re-check per redirect hop + public-IP-only.
- Parser: bounded streaming, Expat hardened, gzip ratio caps, robots 500 KiB per RFC 9309.
- Browser: fresh context per page, service workers/WS/SSE blocked, third-party gated, read-only (GET only, downloads disabled), bounded DOM/scroll/snapshot.
- Ingestion: idempotent by URL+contentHash, bounded payloads, cancellation-safe commit ordering.
- Persistence: WAL + synchronous=FULL + atomic renames + crash-safe DLQ ordering + quarantine of corrupt state.

Gaps being corrected in this run (marked **bold**): the 500 MiB I/O budget monitor (CRIT), `--clean`+resume deduper restore (HIGH), `/ingest` 4 MiB character-limit alignment (HIGH). Everything else is either already controlled or a documented, non-blocking limitation.
