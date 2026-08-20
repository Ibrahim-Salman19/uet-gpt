# Phase 2 — Local-Only Crawler Pilot (2026-08-20)

**Base commit:** `a6ee46b` (Phase 1, PDF path unification). This phase adds
local corpus construction and one ledger correctness fix, verified against 5
bounded, real pilot crawls of `uettaxila.edu.pk`.

## Verdict

```text
FILESYSTEM CORPUS SINK:      BUILT (scripts/uet_crawler/corpus_sink.py)
LOCAL PILOT (5 runs):        PASSED after 1 real bug found and fixed
RAW ARTIFACT PERSISTENCE:    VERIFIED (content-addressed, idempotent)
LEDGER PERSISTENCE:          VERIFIED (with a real correctness bug fixed - see §2)
HTML EXTRACTION:             VERIFIED (26 real pages across 5 runs)
PDF EXTRACTION:               NOT EXERCISED this pilot (no PDF in the small
                              URL sample) - independently, exhaustively
                              verified in Phase 1 instead (all 3 real local
                              PDF fixtures, byte-identical, 2-pass deterministic)
RESUME/RESTART:              VERIFIED (same run_id continues; append-only
                              local log requires freeze-time dedup - see §3)
CONVEX CLOUD CALLS:          0 (--dry-run; verified no HTTP request constructed)
GEMINI CALLS:                0 (config-level describeImages=false; verified
                              via grep across all 5 pilot console logs)
PINECONE / NEON CALLS:       0 (no integration exists in crawler.py)
HISTORICAL LEDGER/STATE:     UNCHANGED (backed up before pilot 1, restored
                              and sha256-verified identical after pilot 5)
```

## 0. What this phase built

Per the mandate's Phase 2 architecture ("fetch → local raw file → local
ledger → extract → local normalized document..., independent of
Convex/Workpool/Gemini"), `crawler.py` had **no local raw-byte cache and no
local normalized-document output at all** before this session — confirmed by
grep (no `--output`/`--save-raw`/local-cache flag existed) and independently
by `docs/audit/CORPUS_INTEGRITY_REMEDIATION_20260819.md` §10's own disclosed
gap ("the production crawler does not cache raw PDF bytes locally"). `--dry-run`
already existed and correctly skips the Convex `/ingest` HTTP call entirely,
but wrote nothing else to disk.

**New:** `scripts/uet_crawler/corpus_sink.py` — `FilesystemCorpusSink`, a
small, dependency-free, synchronous module (called via `asyncio.to_thread`
from the crawl loop, matching this codebase's existing convention for other
blocking work). Layout:

```text
<root>/raw/<sha256[:2]>/<sha256>   - raw fetched bytes, content-addressed,
                                      written once per unique byte content
<root>/raw-manifest.jsonl          - one record per successful fetch (canonical
                                      URL, final URL, HTTP status, content
                                      type, fetch timestamp, byte count,
                                      SHA-256, ETag, Last-Modified)
<root>/documents.jsonl             - one record per extracted, quality-passed,
                                      non-duplicate document (documentId,
                                      canonicalUrl, sourceUrl, title,
                                      contentHash, rawHash, contentType,
                                      extractionMethod, extractionVersion,
                                      crawlTimestamp, status, wordCount, markdown)
```

Wired into `crawler.py` behind a new `--local-corpus-dir PATH` flag:
- The raw-artifact write happens inside `fetch_and_extract_once`, immediately
  after a successful HTTP fetch and *before* extraction is attempted - so a
  failed extraction still leaves bytes available for a future re-parse
  without a second network request ("fetch once, parse many times"), closing
  the exact gap the corpus-integrity report disclosed.
- The normalized-document write happens inside `_finalize_successful_push`,
  in the same cancellation-shielded section as the existing Convex-push
  ledger update (`_finish_after_irreversible_side_effect`) - both happen
  atomically together, or neither does (see §2 for why this placement
  matters).
- Entirely independent of Convex: with `--dry-run`, `push()` returns
  immediately and no local write is skipped or altered because of it.
- `documentId` is a new, local-only identity: `sha256(canonical_url)`. The
  Convex `/ingest` payload has no analogous explicit ID to reuse (Convex
  derives its own server-side identity), so this only needs to be stable and
  collision-resistant for the local filesystem corpus, not to match any
  existing scheme.

`.gitignore` gained one entry, `/local_corpus_pilot/` - raw bytes and
extracted markdown are never committed, matching the mandate's own
`docs/rag-store-evaluation/...` manifest-not-payload convention.

## 1. Pilots run (5 total, real requests to uettaxila.edu.pk)

All 5 used `scripts/crawl_config_pilot.json` (identical seeds/limits to the
production `crawl_config.json`, with `pdf.describeImages`/`html.describeImages`
explicitly set `false` - a config-level, auditable zero-Gemini-calls guarantee
verified by direct settings construction before any pilot ran, independent of
whether `.env.local` happens to hold real Gemini keys, which it does).
`--limit 20` (the safe default), `--dry-run` throughout.

| # | Purpose | Result |
|---|---|---|
| 1 | First attempt, `--no-resume` | Accidentally processed 20 **stale DLQ URLs** from the 2026-08-18 historical crawl instead of fresh seeds (the crawler prioritizes DLQ retry over frontier expansion - documented, intentional behavior per `CRAWL_RUNBOOK.md`'s own DLQ Recovery Protocol). All 20 failed (legitimately dead legacy URLs). Nothing to verify - state restored from backup, DLQ set aside for pilot 2. |
| 2 | Fresh seeds, `--no-resume` | 14 documents extracted successfully (all HTML). **Found the ledger bug in §2**: 6 of 14 local documents had no matching `dry_run_ready` ledger row. |
| 3 | Re-run after an initial (insufficient) fix attempt | Bug persisted differently-shaped (6/11 mismatched) - the first fix (moving the local write inside the cancellation-shielded section) did not address the actual cause; investigated further rather than declaring success. |
| 4 | Re-run after the real fix (§2) | 12/12 documents match ledger `dry_run_ready` rows exactly. 0 mismatches, 0 duplicate `documentId`s. |
| 5 | Same session, **without** `--no-resume` (resume test) | Correctly continued the same `run_id`, processed 20 more URLs (12 more successes, 0 ledger mismatches). Confirms resume works; also revealed an expected, disclosed characteristic - see §3. |

## 2. Real bug found and fixed: ledger state corruption on budget-limited runs

**Root cause** (`scripts/crawler.py`'s `enqueue_discovered`): once the
frontier's URL cap is reached, every further discovery of an already-capped
link calls `ledger.mark_result(link, "discovered", error="not scheduled...")`
unconditionally - including for links that were **already themselves
successfully processed earlier in the same run** (e.g. every admissions seed
page's nav menu links back to the other admissions seeds). Since `mark_result`
unconditionally overwrites the `state` column, an already-`dry_run_ready`
(or `ingested`) URL's terminal state was silently demoted back to
`"discovered"` if any other page discovered it again after the cap. A second,
structurally identical call site (`skipped_depth`, for links beyond
`maxDepth`) had the same defect.

This is **pre-existing and unrelated to this session's other changes** -
confirmed by reading `discover_many`'s own UPSERT (`ON CONFLICT ... DO UPDATE
SET` deliberately excludes `state`, so link (re)discovery alone is already
correctly safe) and by direct SQL event-history inspection
(`crawl_events`) showing the exact sequence: `dry_run_ready` written at
06:33:19, then silently overwritten back to `discovered` at 06:33:36 by a
later `enqueue_discovered` call for the same URL.

**Impact:** any run that ends via `BUDGET_PAGE_LIMIT` rather than
`FRONTIER_EXHAUSTED` - which mandate §12/§13's own architecture treats as the
*normal*, expected case ("the crawl may require several runs") - could
undercount its own real successes in `crawl_ledger.sqlite3`'s `state`
column. This is the exact mechanism `docs/audit/CORPUS_INTEGRITY_REMEDIATION_20260819.md`
used for its headline "1,226 ledger-confirmed documents" figure, so this bug
directly affects the reliability of that kind of count for any
budget-limited run - not just this pilot.

**Fix:** `CrawlLedger.mark_result_if_not_terminal(url, state, *, error)`
(`scripts/uet_crawler/crawl_ledger.py`) - a conditional `UPDATE ... WHERE
state NOT IN (<TERMINAL_STATES>)`. Both call sites in `enqueue_discovered`
now use it instead of the unconditional `mark_result`. 3 new regression
tests in `scripts/test_crawl_ledger.py`, against a real (temp-file) SQLite
`CrawlLedger` instance, covering both call sites plus the "still updates a
genuinely non-terminal URL" case (guarding against the fix being too broad).

**Verified:** pilot 4/5 (post-fix) show exact 1:1 correspondence between
`documents.jsonl` and ledger `dry_run_ready` rows for their own run - see
the query and output in §4.

## 3. Disclosed, accepted characteristic: `documents.jsonl` is append-only, not pre-deduplicated

Pilot 5 (resume) found `https://admissions.uettaxila.edu.pk/` written to
`documents.jsonl` twice (06:46:55Z and 06:49:54Z, identical word count,
presumably identical content) - because seed URLs are re-scheduled on every
crawler invocation regardless of `--resume`, independent of whether the
ledger already shows them `dry_run_ready`. This is existing, unrelated
crawler behavior (not introduced or changed this session), and not something
this phase's scope extends to altering.

This is exactly the situation the mandate's own corpus-freeze integrity
gates already anticipate (§25: "0 unexplained duplicate document IDs" as a
gate to satisfy, not an invariant the crawler itself must never violate). No
code change was made for this - it's recorded here so the freeze step (Phase
3) does not assume `documents.jsonl` is pre-deduplicated. Deduplication by
`documentId` is straightforward: two entries sharing a `documentId` with
matching `contentHash` are trivially safe to collapse (byte-identical);
differing `contentHash` values would represent a genuine content update
between attempts and should keep the later `crawlTimestamp`.

## 4. Evidence

Cross-reference query and result (pilot 4, post-fix):

```text
documents.jsonl entries: 12
ledger dry_run_ready (same run_id): 12
mismatches: []
duplicate documentIds: 0
```

Pilot 5 (resume) ledger state breakdown for the continued run:
`discovered=284, dry_run_ready=15, failed_fetch_retryable=2,
failed_fetch_terminal=4, skipped_duplicate=2` (15, not 12+12=24, because 9 of
pilot 4's 12 successes were seeds re-attempted and correctly *not*
re-discovered as new since they were already terminal - the §2 fix working
as intended on the ledger side; the local-corpus-side duplicate in §3 is the
separate, disclosed characteristic).

Raw cache after pilot 4+5: 26 files, 1.3MB, `local_corpus_pilot/raw/`
(content-addressed - re-fetching a byte-identical page across pilot 4/5 does
not write a second copy). Sample artifacts committed as evidence:
`pilot-documents-sample.jsonl`, `pilot-raw-manifest-sample.jsonl` (pilot 4's
12 documents/raw records), `pilot-4-and-5-console.log` (full console output).

**Historical crawl state integrity:** `crawler_state.json`,
`crawl_ledger.sqlite3`, and `dlq.jsonl` were sha256-hashed before pilot 1 and
restored + re-verified byte-identical after pilot 5 (`crawl_coverage.json`/
`.csv` restored and `diff`-verified identical too) - the 2026-08-18 historical
crawl record (1,226 ingested documents, 3,875 URL rows) is untouched by this
session's pilot experimentation. The pilots' own effects live only in
`local_corpus_pilot/` (git-ignored) and this evidence directory.

**Regression suites:** full repo pytest (`PYTHONPATH=. pytest scripts/`) -
420 passed, 90 subtests passed (417+90 baseline from Phase 1, +3 new
`test_crawl_ledger.py` tests), 0 failures.

## 5. Cloud activity

Convex Cloud: **0** (verified: `--dry-run` returns before any HTTP request is
constructed; independently, `.env.local`'s `CONVEX_SITE_URL` already resolves
to loopback). Gemini: **0** (verified: `grep -i gemini` across all 5 pilot
console logs returns nothing; independently guaranteed by
`crawl_config_pilot.json`'s `describeImages: false`). Pinecone: **0**. Neon:
**0**. No embedding, chunking, or database operation of any kind occurred.

## 6. What Phase 2 does not yet claim

This is 5 small pilots (20-URL budget each), not the full local crawl
(mandate Phase 3). No PDF was in the small URL sample this pilot happened to
draw, so PDF extraction specifically wasn't re-exercised here - it remains
independently, thoroughly verified by Phase 1's direct dual-path testing.
Coverage is explicitly `False`/`BUDGET_PAGE_LIMIT` for every run; nothing
here claims `FRONTIER_EXHAUSTED`. The full bounded/resumable crawl to
frontier exhaustion (mandate §18) has not been run.
