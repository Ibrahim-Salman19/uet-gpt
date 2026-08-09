# UET Extraction Corpus

A **versioned, immutable** corpus of real UET Taxila web responses + golden
semantic expectations, paired with an evaluation harness that measures
extraction **precision and recall**. This is the measurement foundation that
makes every claim about extractor quality falsifiable.

> Why this exists: the production extractor is a 6,200-line module. "Tests pass"
> does not prove it pulls the right title, critical facts, or links out of a real
> page. This corpus captures *real* raw responses and asserts, per fixture, the
> facts that must survive extraction. A regression that drops an admissions
> deadline or leaks `__VIEWSTATE` is now caught automatically.

---

## Layout

```
scripts/corpus/
  starter_set.py             # the curated (family, url) registry, grounded in the crawl ledger
  capture.py                 # captures real raw responses into fixtures (wraps RawHttpClient)
  bootstrap_expectations.py  # generates a skeleton expected.json per fixture (human curates after)
  _author_expectations.py    # one-shot authoring script for the curated starter corpus
  MANIFEST.json              # regenerated index of every fixture on disk
  README.md                  # this file
  fixtures/
    <family>/<slug>/
      request.json           # requested URL + provenance
      response-headers.json  # status + lowercased response headers
      body.bin               # raw response bytes (exact, sha256-pinned in meta)
      meta.json              # sha256/size/content-type/final-url/redirects/IP/timing
      expected.json          # golden semantic expectations (the "answer key")
```

## Fixture families

Grounded in the actual `crawl_ledger.sqlite3` distribution — **not** a
speculative taxonomy:

| Family | What it exercises | Source |
|---|---|---|
| `legacy-asp` | `web.uettaxila.edu.pk/*.asp` pages (the dominant idiom) | ledger |
| `legacy-aspx` | `web.uettaxila.edu.pk/*.aspx` pages (incl. ASP.NET state) | ledger |
| `admissions-php` | `admissions.uettaxila.edu.pk/*.php` (the critical student path) | ledger |
| `pdf-download` | real `.pdf` documents served as bytes | ledger |
| `fms-profile` | `fms.uettaxila.edu.pk/Profile/*` (faculty pages, often 522) | ledger |
| `main-root` | top-level host pages | ledger |
| `web-other` | `web.uettaxila.edu.pk` non-`.asp`/`.aspx` pages — the single largest confirmed ledger family (207 ingested URLs); 14-fixture batch selected for structural diversity (see `web_other_shortlist.md`) | ledger |
| `fetch-failure` | real 4xx/5xx that the extractor must handle gracefully | ledger |

Failure-mode fixtures (4xx/5xx, empty bodies, Cloudflare 522s) are **first-class**:
they are the corpus's regression guards for graceful handling.

The `web-other` batch was selected by stratifying the 207 ingested ledger URLs
across route prefix, word-count bucket, query-string presence, file extension,
and page shape — *not* by word count alone (which would over-sample repeated
department/society templates). See `web_other_shortlist.md` for the full
selection rationale, exclusion rules, and re-expansion criteria.

## The `expected.json` schema (semantic, not exact-string)

Every fixture falls into one of three **populations** (the harness reports each
separately so a family of dead links can't masquerade as 100% recall):

- **labelled** — a real page with at least one assertion (the default).
- **graceful** — a dead link (4xx/5xx/empty) that must declare
  `expected.outcome: "no_content"` explicitly. Its rate metrics are `null`
  (excluded from the quality means); it passes iff the extractor neither raises
  nor invents content from the error page.
- **unlabelled** — captured but not yet curated. Contributes only to
  crash-safety and determinism, **never** to the precision/recall denominators.

```json
{
  "fixture_id": "admissions-php/faqs-07df8a",
  "family": "admissions-php",
  "expected": {
    "title_contains": ["Frequently Asked Questions"],
    "title_not_contains": ["Untitled", "404"],
    "canonical_host": "admissions.uettaxila.edu.pk",
    "required_text_blocks": [
      {"text": "Rs. 4,000", "why": "application processing fee — a critical fact"},
      {"text": "60% marks", "why": "eligibility threshold for Engineering programs"}
    ],
    "forbidden_text_blocks": ["__VIEWSTATE", "Untitled Document"],
    "required_links_contain": ["admissions"],
    "forbidden_links_contain": ["logout", "login"],
    "resource_min_count": 0
  }
}
```

A graceful (dead-link) fixture is minimal and **explicit**:

```json
{
  "fixture_id": "fetch-failure/admissions-78b6de",
  "family": "fetch-failure",
  "_note": "404 capture: extractor must not raise and must not invent content.",
  "expected": { "outcome": "no_content" }
}
```

Matching is **semantic**: lowercase, whitespace-collapsed, `&nbsp;`-stripped.
`required_text_blocks` matching additionally strips ASP.NET residue so a
required fact survives a noisy page; `forbidden_text_blocks` matching preserves
boilerplate tokens (so `__VIEWSTATE` leakage is actually detected).

The `why` field is mandatory for human review — every required block must
explain *why* it matters, so a future maintainer knows what a regression costs.

### Typed resource expectations (Deliverable 2)

`required_resources` asserts on the extractor's **typed** `resources` output —
each entry has a `url`, a closed-enum `kind` (`page`, `pdf`, `document`,
`spreadsheet`, `calendar`, `data`, `presentation`, `ebook`, `archive`, `video`,
`audio`, `image`), a `crawlable` flag (the policy decision), and a `nofollow`
flag. This is scored **separately** from the legacy `required_links_contain`
substring check, and a bare `crawl_links` string can never satisfy a typed
resource spec — so a PDF that only appears in `crawl_links` (not in `resources`
with `kind: pdf`) is correctly scored as a miss:

```json
"required_resources": [
  {"url_contains": "Prospectus-2024", "kind": "pdf", "crawlable": true, "critical": true},
  {"url_contains": "ProgramsOffered", "kind": "page", "crawlable": true}
]
```

- `url_contains` — case-insensitive substring matched against the normalized resource URL.
- `kind` / `crawlable` / `nofollow` — optional typed assertions; omitted fields are not checked.
- `critical: true` — marks an **uncompensable** resource: a single missing
  critical resource fails the fixture and the gate (exit 2) regardless of every
  other metric. Critical-resource recall is enforced at 100%, not averaged.

`required_images` asserts on `image_candidates` (alt-text and source
namespace, e.g. `img:src`, `meta:og:image`):

```json
"required_images": [
  {"alt_contains": "campus map", "source": "img:src"}
]
```

`max_duration_ms` declares a fixture-specific wall-clock ceiling for the
isolated worker. The default is 90s; large PDFs need more — the 4.8 MB
prospectus uses 300000ms because the worker extracts it **twice** (once for the
result, once for the determinism fingerprint), and a single pass measures ~124s.

---

## Usage

### Capture the corpus

```bash
# From the repository root. Sequential, 2s politeness delay, ~3 min total.
python scripts/corpus/capture.py
python scripts/corpus/capture.py --family legacy-asp   # one family
python scripts/corpus/capture.py --limit 4             # first N
python scripts/corpus/capture.py --force               # re-capture existing
```

Capture wraps the production `RawHttpClient` + `UrlPolicy` + `HostSafetyCache`,
so every fixture inherits the same SSRF / redirect / size-bounded guarantees as
a live crawl. It never pushes to Convex and never touches the extractor.

### Author expectations

For a new fixture, generate a skeleton and then curate the critical facts:

```bash
python scripts/corpus/bootstrap_expectations.py        # writes skeletons where none exist
```

The skeleton auto-fills title/canonical/links from the *current* extractor
output and flags itself `_auto_generated: true`. You then replace the
`required_text_blocks` `TODO` with 1-3 **critical facts** read from the
captured `body.bin` / extracted markdown (deadlines, fees, names, program
lists). Delete `_auto_generated` once reviewed.

### Run the extraction eval

```bash
python scripts/eval/run_extraction_eval.py
python scripts/eval/run_extraction_eval.py --family admissions-php
python scripts/eval/run_extraction_eval.py --baseline scripts/corpus/baseline_report.json
python scripts/eval/run_extraction_eval.py --output report.json
```

The harness replays each `body.bin` through the **real** extractor (HTML via
`extract_html_document`, PDF via PyMuPDF4LLM — routed by exact media-type match
or `%PDF-` magic bytes, never by substring), scores against `expected.json`,
and prints a per-family table split by population.

**Strict exit gate** (release-safe by default):

- `0` — success: no raise, no nondeterminism, `pass_rate >= --min-pass-rate`, no critical-fixture failure, no baseline regression
- `1` — harness error: no fixtures, malformed fixture (unless `--wip --allow-malformed-fixtures`), invalid `expected.json`, unparseable baseline, or `--wip` in CI without `ALLOW_WEAK_EXTRACTION_GATE=1`
- `2` — quality-gate failure: any `extraction_raises > 0`, any determinism failure, `pass_rate < --min-pass-rate` (default `1.0`), **any critical fixture failing** (enforced 100% floor — not subject to `--min-pass-rate`), critical `block_recall < 100%`, or a baseline regression

**Criticality tiers** (Deliverable 1c) are recorded in `expected.json`:
`critical` (admissions deadlines/fees/eligibility/merit lists/results),
`standard` (ordinary info), `diagnostic` (malformed/no-content). A single failed
*critical* fixture exits 2 regardless of the overall pass rate — a
standard-page improvement can never compensate for losing one merit-list link.

**Gate-weakening safeguards** (Deliverable 1d): lowering `--min-pass-rate` below
1.0 or `--allow-malformed-fixtures` requires explicit `--wip`, which prints a
prominent warning and is **forbidden in CI** (`CI=true`) unless
`ALLOW_WEAK_EXTRACTION_GATE=1` is set. The full gate configuration is recorded in
the report's `gate` block so every run is self-describing about whether the
strict gate was in force.

**Subprocess isolation** (Deliverable 1b/1.1): **every** fixture runs in a
bounded subprocess (`--isolation on`, the default) with a wall-clock timeout and
(on POSIX) an address-space / CPU limit, so a native-code hang in PyMuPDF or lxml
cannot stall or crash the parent evaluator. `--isolation pdf` isolates only PDF
fixtures; `--isolation off` is the in-process path (debugging only — **forbidden
in CI**). Each fixture may declare `max_duration_ms` so a 90s prospectus is not
judged against a 30s ceiling. On Windows (dev) only the wall-clock timeout is
enforced; on Linux (CI) full `RLIMIT_AS` + `RLIMIT_CPU` apply.

**Corpus-universe compatibility** (Deliverable 1.1): a changed corpus universe
vs the baseline (added/removed/relabeled/edited fixtures) **fails closed**
(exit 1) unless explicitly acknowledged with `--accept-corpus-change`. Removing
a difficult fixture to improve the metrics cannot slip through — the change is
visible in the report *and* blocks the gate. After accepting an approved change,
regenerate `scripts/corpus/baseline_report.json`.

> **Performance:** the determinism check runs a second extraction (inside the
> worker, when isolated) and compares a **full-result fingerprint** (title,
> canonical_url, markdown, sorted crawl_links, resources, image_candidates,
> diagnostics) — not just the markdown `content_hash`, which missed title/link
> nondeterminism. For large PDFs (the prospectus is 4.8 MB / 166 pages) this
> dominates runtime — a full corpus run is ~2-3 min. Use `--no-determinism` for
> fast iteration during authoring; run the full check (no flag) before any
> extractor change or merge.

**Corpus identity** (Deliverable 1a/1.1): every report carries a
`corpus_manifest_hash` — a content-addressed fingerprint over every fixture's
body, headers, metadata, expectations, family, and criticality. A changed corpus
universe vs the baseline **fails closed** (exit 1, INCOMPATIBLE) — removing a
difficult fixture to improve the metrics cannot slip through.

**Corpus-change vs baseline-promotion** — two distinct concepts:

- A **corpus change** (exit 1) means the current corpus and the baseline are not
  comparable *at all* — fixtures were added/removed/relabeled/edited. The metric
  comparison is meaningless until you promote a new baseline.
- A **metric regression** (exit 2) means the same corpus produced worse numbers.
  The two runs ARE comparable; quality dropped.

Promotion workflow when you intentionally edit the corpus:
1. Edit the fixtures (add/remove/curate).
2. Acknowledge the new universe: `--accept-corpus-change` (still runs the full
   quality gate — it does NOT bypass quality floors, only the universe check).
3. Regenerate the approved baseline:
   `python scripts/eval/run_extraction_eval.py --output scripts/corpus/baseline_report.json`
4. Commit the new baseline. Subsequent runs compare against it.

---

## Metrics

| Metric | Meaning |
|---|---|
| `title_accuracy` | required title substrings present ∧ forbidden absent |
| `canonical_accuracy` | canonical host matches the expected family host |
| `block_recall` | fraction of required critical-fact blocks found (the headline number) |
| `block_precision` | 1 − fraction of forbidden boilerplate blocks leaked |
| `link_recall` / `link_precision` | same, for crawl/resource links |
| `resource_recall` | fraction of typed `required_resources` specs satisfied (kind/crawlable/nofollow) |
| `image_recall` | fraction of typed `required_images` specs satisfied (alt-text/source) |
| `extraction_raises` | count of fixtures where the extractor **crashed** (must be 0) |
| `determinism_rate` | fraction of fixtures whose full-result fingerprint is stable across two runs |
| `pass_rate` | fraction of fixtures meeting every expectation at once |

The two hard properties — `extraction_raises == 0` and `determinism_rate == 1.0`
— are non-negotiable regressions on their own. Critical-resource recall
(`required_resources` with `critical: true`) is a third: a single missing
critical resource is an uncompensable gate failure.

### Per-family ledger coverage

When `crawl_ledger.sqlite3` is present, the report's `ledger_coverage` block
cross-references the corpus against the real 4,111-URL crawl ledger so a
family confirmed in production but absent from the labelled corpus is surfaced
as a **gap**. For example, `web.uettaxila.edu.pk` non-`.asp` pages dominate the
ingested ledger (~207 URLs) but had zero corpus representation at the start of
Deliverable 2 — the coverage report makes that visible rather than silent.
(Omitted in CI, where only the corpus ships.)

## Adding fixtures

1. Add the `(family, url)` to `starter_set.py`.
2. `python scripts/corpus/capture.py --family <new>` to capture it.
3. `python scripts/corpus/bootstrap_expectations.py` to scaffold its expectation.
4. Curate `required_text_blocks` against the real extracted content.
5. `python scripts/eval/run_extraction_eval.py --family <new>` to confirm.
6. Commit the whole fixture directory — it's the regression's source of truth.

## Relationship to the retrieval eval

This is **distinct** from `scripts/eval/run_eval.py` (the retrieval eval):

- `run_eval.py` asks: *"for a student query, does the right document come back?"* (recall@5/MRR/nDCG vs a live Convex index).
- `run_extraction_eval.py` asks: *"for a raw page, does the extractor pull the right title/facts/links out?"* (precision/recall vs captured fixtures).

Both matter; they measure different stages of the pipeline.
