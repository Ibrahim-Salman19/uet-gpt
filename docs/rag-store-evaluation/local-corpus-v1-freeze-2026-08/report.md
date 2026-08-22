# Phase 4 — Corpus V1 Freeze (2026-08-22)

**Base commit:** `e48421d` (three crawler completion-detection fixes, this
session). Freezes the output of the mandate's Phase 3 bounded/resumable full
local crawl, run entirely with `--dry-run` against `uettaxila.edu.pk`.

## Verdict

```text
CRAWL COMPLETION:            FRONTIER_EXHAUSTED (genuine, not budget/cap-limited)
COVERAGE COMPLETE (ledger):  TRUE (0 non-terminal URL rows)
CORPUS SIZE:                 1,891 documents (1,506 HTML, 385 PDF)
DOCUMENT ID INTEGRITY:       1 duplicate documentId (disclosed, benign - see §3)
RAW CACHE:                   2,456 files, 547MB, content-addressed
CONVEX CLOUD CALLS:          0 (--dry-run; verified via grep across every
                              console log this session)
GEMINI CALLS:                0 (config-level describeImages=false for both
                              pdf/html, independent of any GEMINI_API_KEY*
                              present in .env.local)
PINECONE / NEON CALLS:       0 (no integration exists in crawler.py)
CORPUS DIRECTORY:            all 2,458 existing files made read-only at
                              freeze time (verified 0 writable); directory
                              entries themselves remain writable, a DrvFs/WSL
                              mount limitation, not a chmod scope gap - see §5
```

## 0. What this phase is

Per the mandate's Phase 4, this freezes Corpus V1: the full local crawl is
finished (`FRONTIER_EXHAUSTED`), its output directory is made immutable, and
this report + `manifest.json` record what was crawled, how, and what gaps are
known - so later phases (Phase 5's local Convex lexical capacity proof, Phase
6's Gemini embedding cost report) have a fixed, reproducible input rather than
a moving target.

## 1. The crawl

Run `1787260445615-11524`, started 2026-08-20T21:14:06Z, finished
2026-08-22T18:19:06Z. `scripts/crawler.py --config
scripts/crawl_config_local_corpus.json --exhaustive --dry-run
--local-corpus-dir /mnt/d/uetgpt_corpus_v1 --allow-incomplete` (initially run
in 1500s batches for resumability, later switched to a single unbounded
process once the batching pattern's only purpose - periodic checkpointing -
was no longer needed).

The wall-clock span includes an extended `web.uettaxila.edu.pk` outage
(confirmed independently via direct `curl` checks returning HTTP 522/timeout,
not a crawler-side issue) from roughly 2026-08-21 06:20 UTC to 2026-08-22
12:35 UTC. The crawl was deliberately backed off during this window (30-60
minute health-check intervals) rather than repeatedly hammering a downed
origin; active crawl time was substantially less than the ~45-hour wall-clock
span.

31 explicit seed URLs plus an auto-generated `departmentfaculty?departmentId=
1..25` range, `maxDepth=4`, `concurrency=5`. `pdf.describeImages` and
`html.describeImages` both `false` at the config level - a guarantee that
holds regardless of which `GEMINI_API_KEY*` environment variables happen to
be loaded.

## 2. Three real bugs found and fixed

All three were found because this crawl kept reporting `QUEUE_DRAINED_
INCOMPLETE` instead of `FRONTIER_EXHAUSTED` even after the frontier and
dead-letter queue were both genuinely empty - investigated rather than
accepted, since the mandate's own coverage gates depend on this signal being
trustworthy.

1. **`DeadLetterQueue.add()` didn't report dead-lettering.** It decides
   internally when a URL's retry budget (`dlqMaxAttempts=10`) is exhausted
   and moves it to `dlq_dead.jsonl`, but returned nothing - so every caller
   always wrote the non-terminal `failed_fetch_retryable` ledger state,
   regardless of whether the DLQ had actually given up. A URL's ledger row
   could stay incomplete forever even though nothing would ever retry it
   again.
2. **`failed_extract` was missing from `TERMINAL_STATES`.** Extraction
   failures (e.g. a `PdfExtractionQualityError`, or a page with no
   extractable content) are always recorded with `retryable=False,
   dlq_eligible=False` in `crawler.py` - retrying the fetch cannot change the
   outcome - but the ledger didn't classify the state as terminal.
3. **`begin_run()`'s `exhaustive` computation was wrong.** It computed
   `exhaustive=(max_depth < 0 and max_pages == 0)`, but `max_depth` is a
   separate, normally-finite setting unrelated to what `--exhaustive` means
   (no URL-count cap). Since a real crawl is almost always depth-bounded,
   this made `exhaustive` false - and therefore `FRONTIER_EXHAUSTED`
   unreachable - for essentially any real invocation of `--exhaustive`, not
   just this one.

Fixed in `scripts/crawler.py` and `scripts/uet_crawler/crawl_ledger.py`;
3 new regression tests added (`test_crawler_adversarial.py`,
`test_crawl_ledger.py`); full suite passes (70 passed, 9 subtests, 0
failures). Committed as `e48421d`.

The already-stuck rows from *before* the fix (129 total: 97 confirmed-dead
DLQ entries cross-checked 1:1 against `dlq_dead.jsonl`, plus 32
`failed_extract` rows) were backfilled via the ledger's own
`mark_result_if_not_terminal` API - the legitimate, already-tested
application code path, not a raw SQL write - after which the crawler itself
confirmed `FRONTIER_EXHAUSTED` on its next run.

## 3. Disclosed gap: one duplicate `documentId`

```text
documentId f373f18e2166e26cf1aa9d90420414e94ff2e7628af06f89ec26ae9748dbc960
  sourceUrl https://web.uettaxila.edu.pk/                                          crawlTimestamp 2026-08-20T21:15:37Z  wordCount 1443
  sourceUrl https://web.uettaxila.edu.pk/UETsub/examination/examViewDtSregS.asp?frm_cate=Date%20Sheet%20BSc  crawlTimestamp 2026-08-21T01:11:19Z  wordCount 1443
```

Both source URLs canonicalize to the site root (the exam-datesheet path
redirects there). Same word count, differing `contentHash` - likely dynamic
page content (a timestamp or session-scoped element) rather than a real
content change. Not a code defect: `documentId = sha256(canonicalUrl)` by
design, so two different source paths reaching the same canonical URL is
expected. Two entries sharing a `documentId` with matching content are
trivially collapsible if a downstream consumer needs strict dedup; this one
pair differs slightly in `contentHash`, so a real dedup step would keep the
later `crawlTimestamp`.

## 4. Real, permanent gaps

362 `failed_fetch_terminal` + 32 `failed_extract` URLs (of 2,880 discovered)
are genuine content gaps, not crawler defects:
- Most `failed_fetch_terminal` rows are aftermath of the extended outage -
  persistently-500ing backend endpoints (e.g. `departmentfaculty?
  departmentId=N`, several `meetingMinutes/*.pdf` paths) that returned the
  same error across every retry cycle, independent of the outage window.
- `failed_extract` rows are PDFs that failed quality checks (too few
  extractable words) or genuinely had no extractable content.

Neither category will resolve by re-running against the same ledger; a
future crawl against a healthier origin, or with OCR/extraction
improvements, may recover some of them.

## 5. Evidence

Full manifest with checksums: `manifest.json` (this directory). Small
samples: `documents-sample.jsonl`, `raw-manifest-sample.jsonl` (3 entries
each - the full corpus, 16MB `documents.jsonl` + 547MB raw cache, is not
committed to git, matching this repo's existing manifest-not-payload
convention; it lives at `/mnt/d/uetgpt_corpus_v1`).

All 2,458 existing files (`documents.jsonl`, `raw-manifest.jsonl`, every file
in `raw/`) were made read-only via `chmod -R a-w`, verified afterward with
`find ... ! -writable` returning all 2,458 - 0 remain writable. Directory
entries themselves (permitting new file creation) could not be locked down
the same way: `/mnt/d` is a DrvFs mount (a Windows drive surfaced into WSL),
and a live write test confirmed a new file can still be created in the
directory despite the recursive chmod - Windows NTFS ACLs govern actual
enforcement there, not POSIX directory permission bits. Existing content is
protected from in-place overwrite; new files could theoretically still be
added to the tree.

```text
documents.jsonl:      1891 lines, sha256 97b9b2b9c8717826...f3177ad
raw-manifest.jsonl:   2527 lines, sha256 4493d8e754819032...580481a9
raw/:                 2456 files, 547MB, content-addressed
ledger state counts:  dry_run_ready=1891 skipped_duplicate=441
                       failed_fetch_terminal=362 skipped_short=136
                       failed_extract=32 skipped_unsupported=14
                       skipped_robots=4  (incompleteUrls=0)
```

**Regression suite:** `pytest scripts/test_crawler_adversarial.py
scripts/test_crawler_safety_limits.py scripts/test_crawler_security.py
scripts/test_crawl_ledger.py` - 70 passed, 9 subtests passed, 0 failures.

## 6. Cloud activity

Convex Cloud: **0**. Gemini: **0**. Pinecone: **0**. Neon: **0**. Verified by
grepping every crawl console log produced this session
(`convex.cloud|pinecone|generativelanguage.googleapis|gemini`) - zero
matches - independently guaranteed by `--dry-run` and the config-level
`describeImages: false` settings.

## 7. What Phase 4 does not yet claim

This freeze covers corpus *construction* only. No chunking, embedding,
indexing, or retrieval evaluation of any kind has happened. Phase 5 (local
Convex minimal lexical capacity proof) and Phase 6 (Gemini embedding
workload/cost report, then an explicit separate authorization checkpoint
before any real embedding) remain unstarted.
