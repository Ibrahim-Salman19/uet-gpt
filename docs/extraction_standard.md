# UET GPT Extraction Standard

This document defines the **quality bar every chunk must meet** before it enters
the vector index, and the **four-layer defense** that enforces it. The biggest
historical accuracy problem was not retrieval — it was that most chunks
contained useless data (nav menus, mangled tables, repeated headers, orphan
table rows). This standard exists to make that class of failure impossible.

> **Bandwidth note.** Convex bills reads + writes by document size. Every chunk
> rejected by these layers saves ~80 KB of writes (chunk row + 768-dim vector +
> HNSW index update). With ~2,000 pages and a ~30% rejection rate, that is
> ~48 MB saved per full re-crawl — meaningful headroom under the 1 GB budget.

---

## The four defense layers

Chunk quality is enforced at **four sequential checkpoints**. A page must clear
all four to land in the index. Each layer is independent and has its own test
suite so a regression in one cannot be masked by another.

```
Website → [1] Crawler → [2] Webhook validator → [3] Normalizer → [4] Chunker
            python       convex HTTP action        chunking.ts      chunking.ts
```

### Layer 1 — Crawler (`scripts/crawler.py`)

The first line of defense, runs at fetch time on the Python side.

| Check | Implementation | Effect |
|---|---|---|
| Boilerplate DOM strip | `BOILERPLATE_SELECTORS` + `strip_boilerplate_html` | Removes popup/modal/news-ticker/cookie chrome before trafilatura sees the page |
| Trafilatura recall mode | `favor_recall=True, fast=False` | Enables trafilatura's full fallback chain (F1=0.958) — never falls back to raw markdownify unless trafilatura returns nothing |
| Min word count | `MIN_WORD_COUNT = 150` | Pages with <150 words are skipped before push |
| Low-quality reject | `is_low_quality_content()` | Rejects pages that are >50% nav tokens, >40% pipe-density, or have abnormal stopword ratios |
| PDF image describer | `extract_and_describe_pdf_images` + Gemini Vision | Inlines `[Figure: ...]` blocks for significant PDF images so their content becomes searchable |
| PDF cleanup | `clean_pdf_markdown` (shared via `pdf_utils.py`) | Strips pymupdf4llm image placeholders, repeating headers/footers, bare page numbers |

### Layer 2 — Webhook validator (`convex/crawl/webhook.ts` `validatePageContent`)

Second line of defense, runs in the Convex HTTP action. Catches Crawl4AI pages
(which bypass the Python crawler) and anything trafilatura let through.

| Check | Floor | Rationale |
|---|---|---|
| Empty content | reject | Catches total extraction failures |
| Min length | <10 words OR <50 chars → reject | Catches ASP.NET error pages, redirect stubs, "loading…" placeholders |
| Nav-menu density | >60% nav tokens AND no prose punctuation → reject | Catches pages where only nav chrome was extracted |
| PDF leniency | PDFs skip the above floors | PyMuPDF4LLM can legitimately produce sparse per-page text on image-heavy pages |

### Layer 3 — Normalizer (`convex/crawl/chunking.ts` `normalizeContent`)

Runs after the validator accepts a page, before chunking. Strips site-chrome
lines that survived extraction. Order matters — byte normalization first, then
site-chrome lines, then structural cleanup.

Strips: `\r\n`, `&nbsp;`, trailing whitespace, anchor links `[]( #...)`, empty
table rows `| |`, "Last Updated:", "©", "(c) YYYY", "All rights reserved",
"Skip to main content", "You are here:", "Home >" breadcrumbs, "Back to top",
ASP.NET `__VIEWSTATE` / `__EVENTVALIDATION` residue.

### Layer 4 — Chunker (`convex/crawl/chunking.ts`)

Runs last. Splits the normalized text into parent (3000 char) and child
(800 char) chunks with overlap. Three quality gates inside the chunker:

1. **`isQualityChunk`** — rejects chunks with <5 meaningful words OR chunks
   that look like nav menus (>60% nav tokens, no prose punctuation). The
   nav-token set (`NAV_TOKENS`) is sourced from observed UET page chrome.
2. **`chunkTableBlock`** — detects the `|---|` separator row explicitly and
   repeats the header (plus separator) in EVERY emitted chunk. Without this,
   a fee table split across chunks produces orphan rows like `| 45000 | 5000 |`
   with no column context.
3. **`healBrokenTables`** — joins table rows split by stray blank lines BEFORE
   the `/\n{2,}/` block split. Trafilatura and pymupdf4llm frequently emit the
   separator on its own line with a blank line before the data rows; without
   healing, the chunker sees header and data as separate blocks and loses every row.

---

## What a good chunk looks like

A chunk that clears all four layers is **self-contained evidence**: a reader
(or LLM) can understand it without any surrounding context.

✅ **Good** — header preserved, self-contained:
```
| Description | Amount (Rs.) |
| --- | --- |
| Tuition Fee (Per Semester) | 45000 |
| Lab Fee | 5000 |
| Examination Fee | 3000 |
```

❌ **Bad** — orphan rows, no header (chunker rejects via `chunkTableBlock` fix):
```
| 45000 | 5000 |
| 3000 | 1500 |
```

❌ **Bad** — nav menu fragment (chunker rejects via `isQualityChunk`):
```
Home
Admissions
Academics
Faculty
Contact
```

❌ **Bad** — site-chrome bleed (normalizer strips before chunking):
```
Last Updated: March 2025
© UET Taxila
Skip to main content
The tuition fee for BSc programs is Rs. 45000 per semester.
```

---

## Adding a new extraction rule

When you find a new class of "useless chunk" in production:

1. **Identify the layer.** Is it site chrome on every page? → Layer 3
   (normalizer). Is it a chunk-level pattern? → Layer 4 (chunker). Is it a
   whole-page failure mode? → Layer 2 (webhook validator) or Layer 1 (crawler).
2. **Add the rule with a comment** explaining what real-world UET page
   triggered it. Future maintainers need to know *why* a regex exists, not
   just *what* it matches.
3. **Add a regression test** in `tests/convex/crawl/webhook.test.ts` that
   fails without your rule and passes with it. The existing tests
   (`repeats the header in every chunk even when a section-divider row
   interleaves data`, `rejects navigation-menu fragments via isQualityChunk`,
   `strips UET site-chrome boilerplate lines via normalizeContent`) are the
   template.
4. **Run the quality gate**: `pnpm vitest run tests/convex/crawl/` (must be
   100% green) + `python -m py_compile scripts/*.py` (if you touched Python).

---

## Forbidden changes (do NOT break these)

These are load-bearing invariants from `AGENTS.md`. Breaking them corrupts the
live index or the security perimeter:

- `convex/schema.ts` vector index filter field names → corrupts the HNSW index,
  requires a full ($$$) re-embed
- `embeddingDimension` in any RAG config → silent similarity-score breakage
  pipeline-wide
- HMAC auth guard in `webhook.ts` (timestamp + signature block) → security hole
- Synchronous embedding inside the HTTP webhook handler → Convex 1 MB action
  limit violation

## Measurement layer — the capture corpus + extraction eval

The four layers above enforce quality at *runtime*. They answer "is this chunk
acceptable?" but not "how often does the extractor get it right?". The
**extraction corpus** (`scripts/corpus/`) and **extraction eval**
(`scripts/eval/run_extraction_eval.py`) close that gap by measuring precision
and recall against captured real responses.

```
Captured raw UET response (body.bin) → extract_html_document / PyMuPDF4LLM
                                      → score vs expected.json
                                      → title/block/link precision & recall
```

What it measures, that the runtime layers cannot:

- **`extraction_raises`** — does the extractor ever *crash* on a real page (a
  4.8 MB PDF, a Cloudflare 522, a dead link)? Must be 0.
- **`determinism_rate`** — is the output stable for a fixed input? The check
  compares a **full-result fingerprint** (title, canonical_url, markdown, sorted
  crawl_links, resources, image_candidates, diagnostics) across two runs — not
  just the markdown hash, which silently missed title/link nondeterminism. A
  divergence here means hidden non-determinism that would break reproducibility.
- **`block_recall`** — did the critical fact (the fee amount, the deadline,
  the eligibility threshold) actually survive extraction? This is the headline
  number: a chunk that clears all four runtime layers can still have lost the
  one fact the student needed. Reported as both **macro** (per-fixture mean)
  and **micro** (total matched / total assertions).
- **`block_precision`** — did `__VIEWSTATE` / `Untitled Document` / boilerplate
  leak *into* the extracted markdown?

Fixtures are split into three **populations** so dead links can't masquerade as
high recall: **labelled** (real assertions, the only fixtures in the quality
means), **graceful** (dead links declaring `outcome: "no_content"` explicitly —
rate metrics `null`, excluded from means), and **unlabelled** (captured but not
yet curated — crash-safety and determinism only, never in rate denominators).

Run it before any extractor change:

```bash
python scripts/eval/run_extraction_eval.py --baseline scripts/corpus/baseline_report.json
# exit 0 = clean · exit 1 = harness error (malformed fixture / bad expected.json /
#                   --wip in CI without override)
# exit 2 = quality-gate failure (any raise, any nondeterminism, pass_rate <
#          --min-pass-rate, ANY critical fixture failing, or a baseline regression
#          at overall OR per-fixture level)
```

The gate is **strict by default** (`--min-pass-rate` defaults to `1.0`): it
fails on *current* quality violations, not only on a regression, so a
freshly-broken extractor can't ship green just because no baseline was supplied.
Three additional integrity layers protect against silent weakening:

- **Criticality tiers** (`critical`/`standard`/`diagnostic`): critical fixtures
  (admissions deadlines, fees, merit lists) enforce an uncompensable 100% floor
  — a standard-page improvement never masks a failed critical fixture.
- **Corpus identity**: every report carries a `corpus_manifest_hash` over all
  fixture bodies/headers/expectations/families/criticality. A baseline comparison
  detects a changed evaluation universe and surfaces it rather than silently
  comparing two different corpora. Removing a difficult fixture to improve the
  metrics is detectable.
- **Gate-weakening safeguards**: lowering thresholds requires explicit `--wip`,
  which is forbidden in CI without `ALLOW_WEAK_EXTRACTION_GATE=1`.
- **Subprocess isolation**: PDF fixtures (and, with `--isolation on`, all
  fixtures) run in a bounded worker with a wall-clock timeout + POSIX memory/CPU
  limits, so a native-code hang in PyMuPDF or lxml cannot stall the evaluator.

See `scripts/corpus/README.md` for the fixture schema, family taxonomy (grounded
in the crawl ledger), and how to add fixtures. **Note:** this is distinct from
the retrieval eval (`scripts/eval/run_eval.py`), which measures whether the
*right document comes back for a query* — a different pipeline stage.

## Operational checklist (before re-crawl)

- [ ] `pnpm vitest run tests/convex/crawl/` → 132/132 pass
- [ ] `python -m pytest scripts/test_extraction_eval.py scripts/test_corpus_integrity.py scripts/test_corpus_manifest.py scripts/test_isolation.py` → all green
- [ ] `python scripts/eval/run_extraction_eval.py --baseline scripts/corpus/baseline_report.json` → exit 0 (no regression; `extraction_raises` must be 0, `determinism_rate` 100%, no critical-fixture failures)
- [ ] `python -m py_compile scripts/*.py` → 0 errors
- [ ] `pnpm typecheck` → 0 errors (excluding pre-existing WIP)
- [ ] Spot-check 5 random chunks in the Convex dashboard after the first 50
      pages ingest — confirm no nav-menu fragments, no orphan table rows, no
      "Last Updated:" lines
- [ ] Bandwidth check after first 200 pages: if writes exceed ~190 KB/page
      average, something is bypassing the validator (investigate before
      continuing the crawl)
