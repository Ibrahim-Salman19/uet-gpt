# PDF Extraction Path Unification (2026-08-20)

**Authoritative machine-readable sources:** [`dual-path-comparison.json`](./dual-path-comparison.json)
(direct crawler-vs-harness byte comparison on all 3 real local PDF fixtures) and
[`harness-43fixture-twopass-report.json`](./harness-43fixture-twopass-report.json)
(full unrestricted 43-fixture harness run, genuine two-pass determinism). This
document narrates them for a human reader; if it ever disagrees with the JSON,
the JSON wins.

## Verdict

```text
PDF EXTRACTION PATH UNIFICATION: COMPLETE (crawler.py <-> harness)
ACCEPTANCE GATE (mandate §7):     PASSED — byte-identical output, all 3 real
                                   PDF fixtures, single input = single output
DETERMINISM:                      genuine two-pass, 100% across all 43 fixtures
INGEST_PDF.PY:                    explicitly NOT unified this phase — disclosed,
                                   not silently left inconsistent (see §5)
CLOUD ACTIVITY:                   0 (Convex/Gemini/Pinecone/Neon/Zilliz)
COMMIT:                           NOT YET MADE — awaiting explicit authorization
```

## 0. Scope

This addresses Phase 1 of the local-corpus mandate: unify the PDF extraction
path so the validation harness (`scripts/eval/run_extraction_eval.py`) tests
what the production crawler (`scripts/crawler.py`) actually does, rather than
a separately-maintained approximation of it. No crawling, embedding, or cloud
operation of any kind occurred this session — this is local code and local
fixture work only.

## 1. What the mandate assumed, and what actually reproduced

The task brief cited a specific, already-observed defect as justification for
this phase: on the `peeda-2006-2` fixture, the validation harness's PDF path
allegedly measured 1 OCR page where the real crawler path measured 0, on
identical input bytes — cited as concrete proof the two paths had drifted.

That specific claim traces to `docs/audit/CORPUS_INTEGRITY_REMEDIATION_20260819.md`
§3c, which itself discloses the measurement came from "a script [that] lives
only in the scratchpad this session... not in the repo" — i.e. not literally
`run_extraction_eval.py`'s `_extract_pdf`, and not re-checked against it.

Before writing any code, this session reproduced the comparison directly
against the real, current, committed functions — `crawler.extract_pdf_sync`
and (pre-fix) `run_extraction_eval._extract_pdf` — with precise instrumentation
(monkeypatching `pymupdf4llm`'s own `make_ocr_decision` and the real Tesseract
`exec_ocr` entry point, not eyeballing logs). Result: **the specific OCR-page-
count divergence does not reproduce.** Both paths agreed exactly:

| Fixture | pymupdf4llm `needs_ocr=True` pages | real Tesseract OCR executed |
|---|---|---|
| `peeda-2006-2` | crawler: `[]` · harness: `[]` | crawler: `[]` · harness: `[]` |
| `sexualharassment-policy` | crawler: `[1]` · harness: `[1]` | crawler: `[1]` · harness: `[1]` |

The `sexualharassment-policy` result (page 1 needs and gets real OCR) also
matches that report's own earlier, more careful §3 measurement ("(1 page):
45.1s... 5,357 words" — the harness path here independently reproduces 5,357
words exactly), not its later §3c scratchpad-script re-measurement claiming
"0 pages needed OCR" for the same fixture. The most likely explanation is that
the uncommitted scratchpad script differed from the real harness in some
unrecorded way (kwargs, environment, or which of `pymupdf4llm`'s two internal
implementations it dispatched to — see §2) — not a real divergence between the
two functions actually shipped in this repo. This is reported plainly because
it changes the shape of the finding, not because it changes the verdict: a
real, independently-confirmed divergence existed regardless (§2).

**This does not mean nothing was wrong.** Direct reading of all three PDF call
sites (§2) found a real, current, verifiable divergence — just not the one
originally cited — and it is what this phase fixes.

## 2. The real divergence: post-processing, not OCR decisions

`crawler.py`'s `extract_pdf_sync` and `run_extraction_eval.py`'s (pre-fix)
`_extract_pdf` called `pymupdf4llm.to_markdown` with effectively identical
resolved kwargs (verified against the installed `pymupdf4llm` 1.28.2's actual
dispatch: `to_markdown` is a `(*args, **kwargs)` shim forwarding to
`_layout_to_markdown`, whose own parameter defaults — `use_ocr=True`,
`ocr_language="eng"` — exactly matched what the crawler passed explicitly and
the harness omitted). Where they genuinely diverged:

- **Cleaning**: `crawler.py` ran `_clean_pdf_pages()` (strips pymupdf4llm's
  `<!-- Start of picture text -->` OCR-noise markers, image-omission
  placeholders, and repeated page furniture) before returning. The harness ran
  **no cleaning at all** — it joined raw `pymupdf4llm` page output directly.
- **Quality gate**: `crawler.py`'s real ingestion path (`build_pdf_document`)
  additionally runs `assess_pdf_markdown_quality()` as a hard gate. The
  harness had no equivalent — a document that would be rejected by the real
  crawler could still register as a harness pass.
- A third, independent implementation also exists in `scripts/ingest_pdf.py`
  (different kwargs — `header=True/footer=True` vs. the other two's
  `False/False`, hardcoded `use_ocr=True` rather than settings-driven, opens
  the PDF by path string rather than a shared `fitz.Document`) plus its own,
  richer cleaner (`pdf_markdown_cleaner.clean_pdf_markdown`) and a VLM
  (Gemini vision) fallback neither other path has. See §5 for why this one is
  explicitly out of scope this phase.

This is a real instance of exactly the risk the mandate names: the harness was
measuring a fantasy of production, not production itself — just located one
layer downstream of where the brief's specific example pointed.

## 3. The fix

`scripts/eval/run_extraction_eval.py`'s `_extract_pdf` now delegates directly
to `crawler.extract_pdf_sync` instead of maintaining a second, hand-mirrored
call into `pymupdf4llm`. `crawler.py` itself is **unchanged** — it was already
the correct, already-tested production implementation; the fix is entirely in
the harness catching up to it, consistent with the mandate's own framing ("The
harness should test production extraction, not imitate it") and with
mandate §8's instruction not to re-tune the already-resolved parser out of
proximity.

A small `_ProductionPdfSettings` shim (table_strategy="lines_strict",
use_ocr=True, ocr_language="eng", describe_pdf_images=False) supplies the
minimal `Settings` surface `extract_pdf_sync` reads, mirroring `crawler.py`'s
real config defaults — the same pattern already used by
`scripts/test_crawler_pdf_extraction.py`'s `_FakeSettings`, not a new one
invented for this change. The harness's existing pre-check contract (open with
`fitz`, classify unopenable bytes as `invalid_pdf`, zero pages as `empty_pdf`,
never raise out of `_extract_pdf`) is preserved unchanged — only the actual
extraction+cleaning step now calls the real function. The isolated-subprocess
worker (`scripts/eval/_fixture_worker.py`) already imports `_extract_pdf` from
`run_extraction_eval`, so it inherits the fix with no separate change.

**Diff scope:** one file, `scripts/eval/run_extraction_eval.py`
(45 insertions, 27 deletions). `scripts/crawler.py` — including the frozen
`761d1bc` HTML parser fix — is untouched.
`scripts/eval/run_extraction_eval.py` sha256 (working tree, post-fix):
`040d0a567b4e72ee64e3ea917db044e85e6bfed70327b26ca5110290696499d6`.

## 4. Acceptance gate evidence (mandate §7)

**Direct byte comparison, all 3 real local PDF fixtures** (the complete local
PDF corpus — not a sample), `crawler.extract_pdf_sync` vs. the fixed
`run_extraction_eval._extract_pdf`, same input bytes, same production config:

| Fixture | Fixture SHA-256 | Pages | Words | Output SHA-256 (both paths) | Identical |
|---|---|---:|---:|---|---|
| `peeda-2006-2` (native text) | `1efcbc50c3...c0c4ded` | 16 | 8,121 | `b082835d82...281a9bc3d` | **True** |
| `sexualharassment-policy` (native text, page 1 real-OCR) | `1968efa364...5062ee2a4` | 15 | 5,341 | `2b51c307fa...8a147a275` | **True** |
| `uet-prospectus-2024` (mixed: 166 pages, real OCR across dozens) | `eac214d8b8...a24661cec` | 166 | 44,776 | `c2f9639b37...4526d229d8` | **True** |

Full hashes in `dual-path-comparison.json`. This covers every fixture type the
mandate named except a *purely*-scanned (100% OCR, 0% native text) PDF, which
does not exist anywhere in the local corpus (disclosed, not worked around —
capturing one would require a new live fetch, out of scope for a local-only
phase per the mandate's own sequencing).

**Full unrestricted 43-fixture harness, genuine two-pass determinism**
(`python3 scripts/eval/run_extraction_eval.py --isolation off`, no family
restriction, all 7 corpus families):

```text
gate.mode:               strict
gate.require_determinism: true
gate.min_pass_rate:      1.0
overall.pass_rate:       100.0%
overall.determinism_rate: 100.0%
overall.extraction_raises_total: 0
overall.fixtures:        43 (34 labelled, 9 graceful, 0 unlabelled)
pdf-download family:     3/3 fixtures, passed=True, determinism_ok=True, 0 raises (all three)
corpus_manifest_hash:    2a72df9bf0149e1ad1b116eb47b2dceee21ba3cf5e1ba8f728b4dea580621252
```

Zero regressions in any of the other 40 (non-PDF) fixtures — expected, since
this change touches only the PDF branch, but verified rather than assumed.

**Regression suites** (from repo root, `PYTHONPATH=.`):

| Suite | Result |
|---|---|
| `test_extraction_eval.py`, `test_isolation.py`, `test_crawler_pdf_extraction.py`, `test_crawler_pdf_cleaning.py`, `test_pdf_markdown_cleaner.py` | 109 passed |
| Full repo pytest suite (`pytest scripts/`) | 417 passed, 90 subtests passed — matches the pre-existing baseline in `CORPUS_INTEGRITY_REMEDIATION_20260819.md` §7 exactly, confirming zero regressions elsewhere |

## 5. Explicitly out of scope: `scripts/ingest_pdf.py`

The mandate's own target architecture (§5) and acceptance gate (§7) name only
crawler and validation-harness parity. `ingest_pdf.py` is a different tool
serving a different purpose — manual, interactive high-fidelity ingestion of
individually curated documents, with a VLM (Gemini vision) escalation path
neither other implementation has, and deliberate configuration differences
(e.g. `header=True`/`footer=True`, unlike the bulk crawler's `False`/`False` —
plausibly intentional, since bulk crawling already strips repeated page
furniture downstream via cleaning, while a manually-curated single document
may want header/footer content retained). Unifying it would mean either
weakening it to the crawler's simpler cleaner or restructuring its VLM
fallback architecture around a shared function — both larger, riskier changes
than this phase's mandate or acceptance gate called for.

This is a disclosed, deliberate scope boundary, not an oversight: three
independent PDF implementations is worse than two, and this is recorded as a
residual risk rather than silently left unmentioned.

## 6. Cloud activity

Convex Cloud reads/writes/deploys: **0**. Gemini: **0**. Pinecone: **0**.
Neon: **0**. Zilliz: **0**. No network request of any kind was made to
`uettaxila.edu.pk` or any other external host. All work was local: fixture
reads, local Python execution, local pytest.

## 7. Commit

Not yet committed. Per the mandate's own commit strategy (§72, "1. PDF path
unification + regression") this is scoped to land as one focused commit
containing only `scripts/eval/run_extraction_eval.py` plus this evidence
directory — but committing is a separate, explicit decision from doing the
work, and hasn't been authorized in this conversation yet.
