"""Extraction-quality evaluation harness.

Replays each captured fixture (``body.bin`` + headers) through the **real**
``extract_html_document`` function and scores the output against the fixture's
``expected.json``. This is the measurement layer that makes extraction quality
falsifiable: every claim about precision/recall now has a number behind it.

It is deliberately distinct from the existing retrieval eval
(``scripts/eval/run_eval.py``), which measures whether the *right document
comes back for a query*. This one measures whether the *extractor pulled the
right title, blocks, and links out of a raw page*.

Usage (run from the repository root)::

    python scripts/eval/run_extraction_eval.py
    python scripts/eval/run_extraction_eval.py --family legacy-asp
    python scripts/eval/run_extraction_eval.py --baseline prev_report.json
    python scripts/eval/run_extraction_eval.py --output report.json
    python scripts/eval/run_extraction_eval.py --min-pass-rate 0.9   # WIP runs

Exit codes (strict release gate)::

    0  success — no regressions, pass_rate >= --min-pass-rate, no raises/nondeterminism
    1  harness error — no fixtures, import failure, malformed fixture (unless
       --allow-malformed-fixtures), invalid expected.json, or baseline parse error
    2  quality gate failure — any extraction_raises > 0, any determinism failure,
       pass_rate < --min-pass-rate, or baseline regression detected

Known limitation: this harness runs the extractor in-process. A pathological
fixture could hang or crash the whole process rather than being isolated to
its own bounded worker. Per-fixture subprocess isolation with timeouts is
deferred to a later phase (see docs/extraction_standard.md).
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import sys
import traceback
from collections import defaultdict
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any
from urllib.parse import urlsplit

SCRIPTS_DIR = Path(__file__).resolve().parents[1]
if str(SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPTS_DIR))

from eval.extraction_metrics import score_fixture  # noqa: E402
from eval.corpus_manifest import (  # noqa: E402
    EVALUATION_SCHEMA_VERSION,
    build_manifest,
    diff_manifests,
)
from eval.isolation import WorkerRequest, run_isolated  # noqa: E402
from eval.ledger_coverage import build_coverage_report, print_coverage_report  # noqa: E402

# Real extractor, treated as a black box. Importing it pulls in the full
# 6,200-line module; we only touch its public entry point.
from html_extractor import (  # noqa: E402
    HtmlExtractionResult,
    UrlPolicyLike,
    extract_html_document,
)

# PDFs are routed to crawler.py's real production extractor (extract_pdf_sync)
# rather than a second, separately-maintained call into PyMuPDF4LLM: two
# implementations with merely "mirrored" kwargs is exactly how this harness
# drifted from production before (it measured raw, uncleaned pymupdf4llm
# output, never exercising crawler.py's _clean_pdf_pages or its quality gate).
# The HTML extractor must never see a PDF body (it would emit raw
# ``%PDF``/``obj``/``endobj`` tokens as "markdown"). Routing by content-type
# is the whole point: the harness exercises the *correct* extractor per family.
import pymupdf as fitz  # noqa: E402

import crawler  # noqa: E402

# pymupdf4llm's OCR path prints "=== Document parser messages ===" progress
# notes via pymupdf.message(), which defaults to stdout. scripts/eval/_fixture_worker.py
# parses this process's stdout as one JSON object (see its module docstring's
# "never prints anything else to stdout" contract), so that leak corrupts the
# worker's output under subprocess isolation - route it to stderr instead.
fitz.set_messages(stream=sys.stderr)

DEFAULT_CORPUS = SCRIPTS_DIR / "corpus" / "fixtures"

# Media types routed to the PDF extractor. Matched *exactly* after stripping
# parameters — never via substring (``text/html; note=application/pdf`` must
# NOT route to PDF). Magic-byte sniffing is the secondary signal.
_PDF_MEDIA_TYPES = frozenset({"application/pdf", "application/x-pdf"})
_PDF_MAGIC = b"%PDF-"


# ─────────────────────────────────────────────────────────────────────────────
# MIME routing (defect 9: strict media-type parsing, header-first sourcing)
# ─────────────────────────────────────────────────────────────────────────────


def _normalized_media_type(content_type: object) -> str:
    """Lowercase the type/subtype, drop parameters. ``text/html; charset=utf-8`` → ``text/html``."""
    return str(content_type or "").split(";", 1)[0].strip().casefold()


def _looks_like_pdf(content_type: object, body: bytes) -> bool:
    """True iff the media type is exactly a PDF type, or the body opens with ``%PDF-``."""
    if _normalized_media_type(content_type) in _PDF_MEDIA_TYPES:
        return True
    return bytes(body or b"").startswith(_PDF_MAGIC)


# ─────────────────────────────────────────────────────────────────────────────
# PDF extraction (defect 8: surface failures instead of swallowing them)
# ─────────────────────────────────────────────────────────────────────────────


@dataclass(frozen=True)
class PdfExtractionOutcome:
    """Structured PDF result. ``error_code`` is None on success.

    The old contract returned ``(None, "", [])`` for every failure, leaving the
    caller unable to tell a corrupt PDF from an empty one. The error_code
    vocabulary: ``invalid_pdf`` (PyMuPDF won't open it), ``empty_pdf`` (no
    pages), ``pymupdf_error`` / ``pymupdf4llm_error`` (raise mid-conversion).

    NOTE: PDFs have no outbound *HTML* links in their extracted text — the
    crawler discovers PDF links at the HTML layer, not here. PDFs *may* contain
    link annotations reachable via ``page.get_links()``, but extracting those
    is an explicit policy decision deferred to a later phase.
    """

    title: str | None
    markdown: str
    links: tuple[str, ...] = ()
    error_code: str | None = None
    error_message: str | None = None


class _ProductionPdfSettings:
    """Mirrors crawler.py's real default PDF configuration (``load_settings``'s
    ``pdf.tableStrategy``/``pdf.useOcr``/``pdf.ocrLanguage`` defaults), so this
    harness exercises the same extraction configuration production uses rather
    than inventing its own. If those defaults ever change, this must change
    with them — that drift risk is why ``crawler.extract_pdf_sync`` itself,
    not just its config, is what this harness now calls (see ``_extract_pdf``).
    ``describe_pdf_images=False`` skips ``extract_pdf_sync``'s image-candidate
    extraction, which this markdown-extraction-quality harness does not use.
    """

    pdf_table_strategy = "lines_strict"
    pdf_use_ocr = True
    pdf_ocr_language = "eng"
    describe_pdf_images = False


_PRODUCTION_PDF_SETTINGS = _ProductionPdfSettings()


def _extract_pdf(body: bytes, url: str) -> PdfExtractionOutcome:
    """Run the real production PDF extractor. Never raises — failures become
    structured outcomes.

    Delegates to crawler.py's extract_pdf_sync — the actual crawler production
    code path (kwargs, OCR engine selection, and _clean_pdf_pages cleaning) —
    instead of a separately-maintained approximation of it, so this harness
    measures what the crawler really produces rather than a fantasy of it.
    """
    try:
        doc = fitz.open(stream=body, filetype="pdf")
    except fitz.FileDataError as exc:
        return PdfExtractionOutcome(None, "", error_code="invalid_pdf", error_message=str(exc))
    except Exception as exc:  # noqa: BLE001 — a corrupt stream is a measurement
        return PdfExtractionOutcome(None, "", error_code="invalid_pdf", error_message=f"{type(exc).__name__}: {exc}")

    if doc.page_count == 0:
        doc.close()
        return PdfExtractionOutcome(None, "", error_code="empty_pdf", error_message="zero pages")
    doc.close()

    try:
        title, page_texts, _candidates = crawler.extract_pdf_sync(body, url, _PRODUCTION_PDF_SETTINGS)
    except Exception as exc:  # noqa: BLE001
        return PdfExtractionOutcome(None, "", error_code="pymupdf4llm_error", error_message=f"{type(exc).__name__}: {exc}")

    markdown = "\n\n".join(p for p in page_texts if p.strip())
    return PdfExtractionOutcome(title or url, markdown)


# Metrics that are aggregated as means across fixtures (rates in [0,1]).
RATE_METRICS = (
    "title_accuracy",
    "canonical_accuracy",
    "block_recall",
    "block_precision",
    "link_recall",
    "link_precision",
)
# Metrics that are summed as counts.
COUNT_METRICS = ("extraction_raises", "passed")

# ─────────────────────────────────────────────────────────────────────────────
# Determinism fingerprint (defect 4: cover the FULL result, not just markdown)
# ─────────────────────────────────────────────────────────────────────────────


def result_fingerprint(result: HtmlExtractionResult | None) -> str:
    """Stable sha256 over the *entire* extraction result.

    ``HtmlExtractionResult.content_hash`` covers markdown only, so a title flip,
    a re-ordered crawl-link list, or a changed resource classification would
    pass undetected. This fingerprint covers canonical_url, title, markdown,
    crawl_links (sorted), resources, image_candidates, and diagnostics — the
    full observable output — so any non-determinism surfaces.
    """
    payload: dict[str, Any] = {
        "result_is_none": result is None,
    }
    if result is not None:
        payload.update({
            "canonical_url": result.canonical_url,
            "title": result.title,
            "markdown": result.markdown,
            "crawl_links": sorted(result.crawl_links or []),
            "resources": [
                {
                    "url": item.url,
                    "text": item.text,
                    "kind": item.kind,
                    "crawlable": item.crawlable,
                    "nofollow": item.nofollow,
                }
                for item in (result.resources or [])
            ],
            "image_candidates": [
                {
                    "url": item.url,
                    "alt_text": item.alt_text,
                    "context": item.context,
                    "score": item.score,
                    "source": item.source,
                }
                for item in (result.image_candidates or [])
            ],
            "diagnostics": dict(sorted((result.diagnostics or {}).items())),
        })
    encoded = json.dumps(payload, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode("utf-8")
    return hashlib.sha256(encoded).hexdigest()


@dataclass(frozen=True)
class _ResourceShim:
    """Reconstruction of HtmlResourceLink for the isolated path. See ``_result_dict_to_object``."""
    url: str
    text: str
    kind: str
    crawlable: bool
    nofollow: bool = False


@dataclass(frozen=True)
class _ImageShim:
    """Reconstruction of HtmlImageCandidate for the isolated path."""
    url: str
    alt_text: str
    context: str
    score: float
    source: str = "img"


def _result_dict_to_object(rd: dict[str, Any]) -> HtmlExtractionResult:
    """Rebuild an HtmlExtractionResult from the worker's JSON-serialized dict.

    The isolated worker serializes the result to plain JSON (resources/images
    become dicts); the in-process scoring block expects real dataclass objects.
    These shims expose the same attributes the scorer and fingerprint read, so
    the rest of ``evaluate_one`` is identical between the two paths.
    """
    return HtmlExtractionResult(
        canonical_url=rd.get("canonical_url", ""),
        title=rd.get("title", ""),
        markdown=rd.get("markdown", ""),
        crawl_links=list(rd.get("crawl_links") or []),
        resources=[_ResourceShim(**r) for r in (rd.get("resources") or [])],
        image_candidates=[_ImageShim(**ic) for ic in (rd.get("image_candidates") or [])],
        diagnostics=dict(rd.get("diagnostics") or {}),
    )


# ─────────────────────────────────────────────────────────────────────────────
# Replay policy (defect 1: strict hostname boundary)
# ─────────────────────────────────────────────────────────────────────────────


class ReplayPolicy:
    """Minimal ``UrlPolicyLike`` that lets the extractor classify links.

    During replay there is no live network and no crawl frontier; the harness
    only needs the extractor to *discover* links, not to authorize them. This
    policy canonicalizes URLs and accepts anything whose registered host is the
    configured suffix or a subdomain of it.

    The host check is *strict*: it parses ``hostname`` (not ``netloc``) so a
    port suffix does not defeat matching, requires an ``http``/``https`` scheme
    so relative URLs are not treated as network targets, and matches the suffix
    as a complete host label (``host == expected or host.endswith("." + expected)``)
    so ``eviluettaxila.edu.pk`` is NOT accepted as ``uettaxila.edu.pk``.
    """

    def __init__(self, host_suffix: str = "uettaxila.edu.pk") -> None:
        self._suffix = host_suffix.casefold().strip().rstrip(".")

    def canonicalize(self, url: str) -> str:
        return url  # the extractor only needs identity here

    def is_network_target(self, url: str) -> bool:
        try:
            parts = urlsplit(str(url or "").strip())
            if parts.scheme.casefold() not in {"http", "https"}:
                return False
            host = (parts.hostname or "").casefold().rstrip(".")
            expected = self._suffix
            _ = parts.port  # forces ValueError on a malformed port
        except (ValueError, UnicodeError):
            return False
        return host == expected or host.endswith("." + expected)

    def is_crawl_candidate(self, url: str) -> bool:
        return self.is_network_target(url)


# ─────────────────────────────────────────────────────────────────────────────
# Fixture loading + single-fixture evaluation
# ─────────────────────────────────────────────────────────────────────────────

# Marker stored on the fixture dict when expected.json failed to parse, so the
# harness can count invalid fixtures and fail the gate (defect 11).
_EXPECT_PARSE_ERROR = "_expected_parse_error"


def load_fixture(fixture_dir: Path) -> dict[str, Any] | None:
    """Read the immutable artifact files for one fixture.

    Returns ``None`` if the fixture is *malformed* (missing required files) —
    the caller counts this and, unless ``--allow-malformed-fixtures`` is set,
    fails the gate with exit 1 (defect 11). A fixture whose ``expected.json``
    fails to parse is NOT malformed — it is *invalid*: it is still loaded, but
    with a ``_expected_parse_error`` marker so ``main`` can count it and the
    scorer treats it as unlabelled (it must not contribute a vacuous perfect
    score to the quality denominators — defect 3).
    """
    meta_p = fixture_dir / "meta.json"
    body_p = fixture_dir / "body.bin"
    headers_p = fixture_dir / "response-headers.json"
    if not (meta_p.exists() and body_p.exists() and headers_p.exists()):
        return None
    meta = json.loads(meta_p.read_text(encoding="utf-8"))
    headers = json.loads(headers_p.read_text(encoding="utf-8"))

    expected: dict[str, Any] = {}
    invalid_expected: str | None = None
    exp_p = fixture_dir / "expected.json"
    if exp_p.exists():
        try:
            expected = json.loads(exp_p.read_text(encoding="utf-8"))
        except json.JSONDecodeError as exc:
            # Invalid expected.json is a gate failure (defect 11), not a silent
            # vacuous-pass. We keep loading so the fixture still exercises the
            # crash-safety / determinism properties, but flag it.
            invalid_expected = str(exc)
            expected = {_EXPECT_PARSE_ERROR: str(exc)}

    # Content-type: prefer the *response header* (the wire truth), fall back to
    # meta only when the header is absent (defect 9 — meta was primary before,
    # which let a stale meta value override the actual server response).
    resp_headers = headers.get("headers", {}) if isinstance(headers.get("headers"), dict) else {}
    content_type = (
        _header_first(resp_headers, "content-type")
        or meta.get("content_type", "")
    )

    return {
        "fixture_id": f"{fixture_dir.parent.name}/{fixture_dir.name}",
        "family": fixture_dir.parent.name,
        "dir": fixture_dir,
        "meta": meta,
        "body": body_p.read_bytes(),
        "status": headers.get("status"),
        "content_type": content_type,
        "final_url": meta.get("final_url") or meta.get("requested_url", ""),
        "expected": expected,
        "invalid_expected": invalid_expected,
    }


def _header_first(headers: dict[str, str], name: str) -> str:
    """Case-insensitive header lookup (HTTP headers are case-insensitive)."""
    name_l = name.lower()
    for k, v in headers.items():
        if k.lower() == name_l:
            return v
    return ""


def _parse_status(value: object) -> int | None:
    """Coerce a stored status into an int in [100,599], else None (defect 5).

    Handles int, numeric str, garbage, and None without raising. Out-of-range
    values (e.g. 99, 600) are rejected so they do not corrupt family logic.
    """
    try:
        parsed = int(value)  # type: ignore[arg-type]
    except (TypeError, ValueError, OverflowError):
        return None
    return parsed if 100 <= parsed <= 599 else None


def _expected_status_family(fixture: dict[str, Any]) -> str:
    """Classify the fixture's *capture* outcome for cross-tab reporting.

    Uses the *actual body bytes* (``len(fixture["body"])``), never the stale
    ``meta.body_size`` field (defect 5). Returns one of:

    - ``"success"``     — 2xx with a body
    - ``"no_content"``  — 204/205, or 2xx with an empty body (legitimate)
    - ``"http_error"``  — 4xx/5xx
    - ``"other"``       — anything else (3xx, weird codes, unparseable status)
    """
    status = _parse_status(fixture.get("status"))
    body_size = len(fixture.get("body") or b"")
    if status is None:
        return "other"
    if 200 <= status < 300:
        return "success" if body_size else "no_content"
    if 400 <= status < 600:
        return "http_error"
    return "other"


def _fixture_population(fixture: dict[str, Any]) -> str:
    """Which quality denominator this fixture belongs to (defects 3, 6).

    - ``"graceful"``   — explicitly expects no content (``expected.outcome == "no_content"``)
    - ``"labelled"``   — has at least one real assertion (required/forbidden
                         blocks, title, links, canonical, resource floor)
    - ``"unlabelled"`` — no assertions; contributes only to crash-safety,
                         determinism, and counts — never to rate denominators
    """
    exp = fixture.get("expected") or {}
    if not isinstance(exp, dict) or _EXPECT_PARSE_ERROR in exp:
        return "unlabelled"
    inner = exp.get("expected", exp)
    if not isinstance(inner, dict):
        return "unlabelled"
    if str(inner.get("outcome", "")).lower() == "no_content":
        return "graceful"
    has_assertion = any(
        inner.get(k)
        for k in (
            "title_contains", "title_not_contains", "required_text_blocks",
            "forbidden_text_blocks", "required_links_contain",
            "forbidden_links_contain", "canonical_host",
        )
    ) or int(inner.get("resource_min_count", 0) or 0) > 0
    return "labelled" if has_assertion else "unlabelled"


_VALID_CRITICALITY = {"critical", "standard", "diagnostic"}


def _fixture_criticality(fixture: dict[str, Any]) -> str:
    """Read ``expected.criticality`` (default ``standard``), validated to the enum.

    Critical fixtures (admissions deadlines, fees, merit lists) enforce stricter
    gate floors that standard/diagnostic improvements cannot compensate for.
    """
    exp = fixture.get("expected") or {}
    if not isinstance(exp, dict) or _EXPECT_PARSE_ERROR in exp:
        return "standard"
    inner = exp.get("expected", exp)
    if not isinstance(inner, dict):
        return "standard"
    crit = str(inner.get("criticality", "standard")).lower()
    return crit if crit in _VALID_CRITICALITY else "standard"


def _fixture_timeout_ms(fixture: dict[str, Any], default_ms: int) -> int:
    """Read a fixture-declared wall-clock ceiling (``expected.max_duration_ms``).

    Falls back to ``default_ms`` (sized by family). A 4.8 MB / 166-page
    prospectus legitimately needs ~90s; a small ASP page does not. Fixture-level
    ceilings prevent a slow fixture from being judged against a tiny default
    *and* prevent a hung fixture from stalling the run indefinitely.
    """
    exp = fixture.get("expected") or {}
    if isinstance(exp, dict):
        inner = exp.get("expected", exp) if isinstance(exp.get("expected"), dict) else exp
        v = inner.get("max_duration_ms") if isinstance(inner, dict) else None
        if isinstance(v, (int, float)) and v > 0:
            return int(v)
    return default_ms


def evaluate_one(fixture: dict[str, Any], policy: UrlPolicyLike,
                 deterministic: bool = False, *,
                 isolation: str = "pdf",
                 default_timeout_ms: int = 90_000) -> dict[str, Any]:
    """Run the real extractor on one fixture and score it. Never raises.

    Failures (4xx/5xx, empty body, parser crash) are scored, not raised — the
    harness measures how the extractor *actually behaves* on adversarial input.

    ``isolation`` selects the execution path:
      - ``"off"`` — in-process (the legacy path; used by the unit tests).
      - ``"pdf"`` — PDF fixtures run in an isolated subprocess with wall-clock +
        (POSIX) memory limits; HTML stays in-process. The default.
      - ``"on"`` — every fixture runs isolated.

    When isolated, the worker runs BOTH extraction passes (for the determinism
    fingerprint) in the child, so the parent does not spawn twice per fixture.
    """
    body = fixture["body"]
    content_type = fixture["content_type"]
    final_url = fixture["final_url"]
    raised = False
    error: str | None = None
    tb: str | None = None
    result: HtmlExtractionResult | None = None
    extractor_used = "html"
    pdf_error: dict[str, str] | None = None
    # Isolation bookkeeping (populated on the isolated path; left None in-process).
    worker_outcome = None
    isolated = False
    duration_ms: int | None = None
    peak_memory_bytes: int | None = None
    invalid_worker_output = False

    # ── Isolation dispatch ──
    # A native-code hang (PyMuPDF, lxml) or runaway extractor must not stall the
    # parent. Route the applicable fixtures through a subprocess with a wall-clock
    # timeout + (POSIX) memory limit. The worker returns BOTH extraction passes'
    # fingerprints so determinism is computed in-child.
    is_pdf_route = _looks_like_pdf(content_type, body)
    use_isolation = isolation == "on" or (isolation == "pdf" and is_pdf_route)
    # Isolation (crash/hang protection) applies INDEPENDENTLY of the determinism
    # check — a malformed fixture can stall the parent whether or not we re-run
    # for a fingerprint. The determinism flag is passed to the worker so it
    # decides whether to do the second pass.
    if use_isolation:
        req = WorkerRequest(
            fixture_id=fixture["fixture_id"],
            extractor_kind="pdf" if is_pdf_route else "html",
            body_path=str(fixture["dir"] / "body.bin"),
            content_type=content_type,
            final_url=final_url,
            host_suffix=getattr(policy, "_suffix", "uettaxila.edu.pk"),
            timeout_ms=_fixture_timeout_ms(fixture, default_timeout_ms),
            deterministic=deterministic,
        )
        worker_outcome = run_isolated(req)
        isolated = True
        duration_ms = worker_outcome.duration_ms
        peak_memory_bytes = worker_outcome.peak_memory_bytes
        # Default: a worker failure leaves determinism unmeasurable. We cannot
        # claim a determinism violation when no result was produced, so treat it
        # as vacuously OK — the raise itself already fails the quality gate. The
        # success branch below overrides this with the worker's real reading.
        determinism_ok = True
        if worker_outcome.status == "invalid_worker_output":
            # A malformed worker result is a harness error (exit 1), surfaced via
            # the invalid_expected path's sibling flag. We still record it so the
            # report shows which fixture broke the worker contract.
            invalid_worker_output = True
            result = None
            raised = True
            error = worker_outcome.error_message or "invalid worker output"
        elif worker_outcome.status == "success":
            rd = worker_outcome.result
            if rd is None or (rd.get("pdf_error") and not rd.get("markdown")):
                # Worker succeeded structurally but the extractor found no content
                # (e.g. invalid PDF). pdf_error is preserved for the report.
                pdf_error = rd.get("pdf_error") if rd else None
            if rd and (rd.get("markdown") or rd.get("canonical_url")):
                # Rebuild the result object the scoring block expects, so the rest
                # of evaluate_one is identical between isolated and in-process paths.
                result = _result_dict_to_object(rd)
                extractor_used = rd.get("extractor_used", "html")
            determinism_ok = worker_outcome.determinism_ok
        else:
            # timeout / worker_crash / memory_limit / extractor_error: a failed
            # isolated extraction counts as a raise — the extractor did not
            # produce a usable result.
            raised = True
            error = f"{worker_outcome.status}: {worker_outcome.error_code} ({worker_outcome.error_message})"
            result = None

    # Route by content-type/magic bytes: PDFs must never reach the HTML extractor.
    # Skipped on the isolated path — the worker already ran the correct route and
    # populated ``result``/``pdf_error``/``raised``.
    if not isolated:
        if _looks_like_pdf(content_type, body):
            extractor_used = "pdf"
            outcome = _extract_pdf(body, final_url)
            if outcome.error_code is None:
                result = HtmlExtractionResult(
                    canonical_url=final_url,
                    title=outcome.title or "",
                    markdown=outcome.markdown,
                    crawl_links=list(outcome.links),
                )
            else:
                # PDF failure is a *visible* result (defect 8): record the structured
                # error so the report can distinguish corrupt/empty/encrypted PDFs.
                pdf_error = {"error_code": outcome.error_code, "error_message": outcome.error_message or ""}
        else:
            try:
                result = extract_html_document(body, content_type, final_url, policy)
            except Exception as exc:  # noqa: BLE001 — a crash is a measurement, not a fatal error
                raised = True
                error = f"{type(exc).__name__}: {exc}"
                tb = traceback.format_exc(limit=3)

        # Determinism: re-run and confirm the FULL-result fingerprint is stable
        # (defect 4). A divergence here means the extractor has hidden
        # non-determinism that would break reproducibility. We re-run EVEN WHEN the
        # first result is None, so a None↔content flip between runs is caught. Both
        # the PDF and HTML branches reconstruct the second result with the SAME
        # canonical_url (final_url) as ``result`` so the comparison is symmetric —
        # an earlier version hashed an empty canonical on one side and final_url on
        # the other, which falsely flagged every PDF as nondeterministic.
        determinism_ok = True
        if deterministic:
            try:
                if extractor_used == "pdf":
                    second_outcome = _extract_pdf(body, final_url)
                    second_result: HtmlExtractionResult | None = None
                    if second_outcome.error_code is None:
                        second_result = HtmlExtractionResult(
                            canonical_url=final_url,
                            title=second_outcome.title or "",
                            markdown=second_outcome.markdown,
                            crawl_links=list(second_outcome.links),
                        )
                    determinism_ok = result_fingerprint(result) == result_fingerprint(second_result)
                else:
                    second = extract_html_document(body, content_type, final_url, policy)
                    determinism_ok = result_fingerprint(result) == result_fingerprint(second)
            except Exception:  # noqa: BLE001
                determinism_ok = False

    population = _fixture_population(fixture)

    # ── Score ──
    if population == "graceful":
        # Explicit no-content expectation: the only requirement is "did not raise
        # and produced nothing." If the extractor *did* emit content from an
        # error page, that is a visible, scoreable signal (defect 6). Rate
        # metrics are None (not in the denominators) and the report distinguishes
        # these from real extractions.
        metrics = _graceful_metrics(raised, determinism_ok, leaked_content=(result is not None and bool(result.markdown.strip())))
    elif raised or result is None or pdf_error is not None:
        # Expected real content but got none (dead link not marked no_content, a
        # crash, or a PDF that would not parse). This is a real miss, not a pass.
        metrics = _empty_metrics(raised or pdf_error is not None)
        if pdf_error is not None:
            metrics["pdf_error"] = pdf_error
    else:
        metrics = score_fixture(
            fixture["expected"],
            title=result.title,
            markdown=result.markdown,
            crawl_links=result.crawl_links,
            resources=result.resources,
            canonical_url=result.canonical_url,
            raised=raised,
            image_candidates=result.image_candidates,
        )
    metrics["determinism_ok"] = determinism_ok
    # Fold determinism into passed (defect 4): a nondeterministic fixture must
    # not report success.
    metrics["passed"] = bool(metrics["passed"]) and determinism_ok
    metrics["population"] = population
    metrics["criticality"] = _fixture_criticality(fixture)
    metrics["word_count"] = result.word_count if result else 0
    metrics["fingerprint"] = result_fingerprint(result)
    metrics["extractor_used"] = extractor_used
    metrics["has_expected"] = bool(fixture["expected"]) and _EXPECT_PARSE_ERROR not in fixture["expected"]
    # Isolation telemetry (Deliverable 1b): present only when the fixture ran in
    # a subprocess. ``worker_status`` lets the report distinguish a real extractor
    # failure from a timeout/crash/memory-limit at the process boundary.
    metrics["isolated"] = isolated
    if isolated and worker_outcome is not None:
        metrics["worker_status"] = worker_outcome.status
        metrics["duration_ms"] = duration_ms
        metrics["peak_memory_bytes"] = peak_memory_bytes
    if fixture.get("invalid_expected") or invalid_worker_output:
        metrics["invalid_expected"] = fixture.get("invalid_expected") or error or "invalid worker output"
    if pdf_error is not None:
        metrics.setdefault("pdf_error", pdf_error)
    if error:
        metrics["error"] = error
        metrics["traceback"] = tb
    return {
        "fixture_id": fixture["fixture_id"],
        "family": fixture["family"],
        "status": fixture["status"],
        "expected_status": _expected_status_family(fixture),
        "criticality": metrics["criticality"],
        "metrics": metrics,
    }


def _empty_metrics(raised: bool) -> dict[str, Any]:
    m = {k: 0.0 for k in RATE_METRICS}
    m.update({k: 0 for k in COUNT_METRICS})
    m["resource_floor_ok"] = True
    m["extraction_raises"] = 1 if raised else 0
    m["passed"] = False
    m["graceful_failure"] = False
    m["leaked_content"] = False
    # Raw counts stay zero for a miss (defect 10).
    for k in (
        "required_blocks_total", "required_blocks_matched",
        "forbidden_blocks_total", "forbidden_blocks_leaked",
        "required_links_total", "required_links_matched",
        "forbidden_links_total", "forbidden_links_leaked",
    ):
        m[k] = 0
    m["missing_blocks"] = []
    m["leaked_blocks"] = []
    m["missing_links"] = []
    m["leaked_links"] = []
    return m


def _graceful_metrics(raised: bool, determinism_ok: bool, *, leaked_content: bool) -> dict[str, Any]:
    """Metrics for an *explicit* no-content expectation (defect 6).

    Rate metrics are ``None`` (JSON null) so they are excluded from the quality
    means — a family of dead links can no longer masquerade as 100% recall. The
    fixture passes iff the extractor did not raise, did not leak content from an
    error page, and was deterministic. ``leaked_content`` flags the failure mode
    the review wants made visible: an extractor that invents facts from a 5xx
    Cloudflare page.
    """
    m: dict[str, Any] = {k: None for k in RATE_METRICS}
    m.update({k: 0 for k in COUNT_METRICS})
    m["resource_floor_ok"] = True
    m["extraction_raises"] = 1 if raised else 0
    m["passed"] = (not raised) and (not leaked_content)
    m["graceful_failure"] = True
    m["leaked_content"] = leaked_content
    for k in (
        "required_blocks_total", "required_blocks_matched",
        "forbidden_blocks_total", "forbidden_blocks_leaked",
        "required_links_total", "required_links_matched",
        "forbidden_links_total", "forbidden_links_leaked",
    ):
        m[k] = 0
    m["missing_blocks"] = []
    m["leaked_blocks"] = []
    m["missing_links"] = []
    m["leaked_links"] = []
    return m


# ─────────────────────────────────────────────────────────────────────────────
# Aggregation + reporting (defects 3, 6, 10: populations + micro/macro)
# ─────────────────────────────────────────────────────────────────────────────


def aggregate(results: list[dict[str, Any]]) -> dict[str, Any]:
    by_family: dict[str, list[dict[str, Any]]] = defaultdict(list)
    by_crit: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for r in results:
        by_family[r["family"]].append(r)
        by_crit[r.get("criticality") or r["metrics"].get("criticality", "standard")].append(r)

    def _roll(group: list[dict[str, Any]]) -> dict[str, Any]:
        n = len(group)
        out: dict[str, Any] = {"fixtures": n}

        # Population split (defects 3, 6).
        pops = [g["metrics"].get("population", "unlabelled") for g in group]
        out["labelled"] = sum(1 for p in pops if p == "labelled")
        out["unlabelled"] = sum(1 for p in pops if p == "unlabelled")
        out["graceful"] = sum(1 for p in pops if p == "graceful")

        # Macro rate means over LABELLED fixtures only. Unlabelled and graceful
        # fixtures contribute to crash-safety / determinism / counts, never to
        # the quality denominators (defect 3).
        labelled = [g for g in group if g["metrics"].get("population") == "labelled"]
        for m in RATE_METRICS:
            vals = [g["metrics"][m] for g in labelled if g["metrics"].get(m) is not None]
            out[m] = round(sum(vals) / len(vals), 4) if vals else None

        for m in COUNT_METRICS:
            out[m + "_total"] = sum(g["metrics"][m] for g in group)
        det = [g["metrics"]["determinism_ok"] for g in group]
        out["determinism_rate"] = round(sum(det) / n, 4) if n else 0.0
        denom_pass = out["labelled"] + out["graceful"]
        out["pass_rate"] = round(out["passed_total"] / denom_pass, 4) if denom_pass else 0.0

        # Micro averages (defect 10): total matched / total assertions across the
        # labelled population. Complements the macro (per-fixture) mean above.
        def _micro(matched_key: str, total_key: str) -> float | None:
            tot = sum(int(g["metrics"].get(total_key, 0)) for g in labelled)
            mat = sum(int(g["metrics"].get(matched_key, 0)) for g in labelled)
            return round(mat / tot, 4) if tot else None
        out["block_recall_micro"] = _micro("required_blocks_matched", "required_blocks_total")
        # precision micro = 1 − (leaked / total); the inverted direction needs its own helper.
        out["block_precision_micro"] = _micro_precision(labelled, "forbidden_blocks_leaked", "forbidden_blocks_total")
        out["link_recall_micro"] = _micro("required_links_matched", "required_links_total")
        out["link_precision_micro"] = _micro_precision(labelled, "forbidden_links_leaked", "forbidden_links_total")

        # Typed resource + image metrics (Deliverable 2): macro means over the
        # fixtures that assert them (None when no fixture in the group asserts).
        out["resource_recall"] = _mean_present(labelled, "resource_recall")
        out["resource_precision"] = _mean_present(labelled, "resource_precision")
        out["resource_recall_micro"] = _micro("required_resources_matched", "required_resources_total")
        out["image_recall"] = _mean_present(labelled, "image_recall")

        # Assertion density (Deliverable 2): total assertions per family, so an
        # under-covered family (e.g. only 1 required block across 6 fixtures) is
        # visible and can be targeted for corpus expansion.
        out["assertion_count"] = sum(
            int(g["metrics"].get(k, 0) or 0)
            for g in labelled
            for k in ("required_blocks_total", "required_links_total",
                      "required_resources_total", "required_images_total")
        )
        out["avg_assertions_per_labelled_fixture"] = round(
            out["assertion_count"] / len(labelled), 2
        ) if labelled else 0.0
        return out

    overall = _roll(results)
    per_family = {fam: _roll(grp) for fam, grp in sorted(by_family.items())}
    # by_criticality (Deliverable 1c): critical fixtures get their own roll-up so
    # the gate can enforce a separate, uncompensable 100% floor on them. A
    # standard-page improvement must never mask a failed critical fixture.
    by_criticality = {crit: _roll(grp) for crit, grp in sorted(by_crit.items())}
    return {
        "overall": overall,
        "per_family": per_family,
        "by_criticality": by_criticality,
    }


def _micro_precision(labelled: list[dict[str, Any]], leaked_key: str, total_key: str) -> float | None:
    tot = sum(int(g["metrics"].get(total_key, 0)) for g in labelled)
    leaked = sum(int(g["metrics"].get(leaked_key, 0)) for g in labelled)
    return round(1.0 - (leaked / tot), 4) if tot else None


def _mean_present(labelled: list[dict[str, Any]], key: str) -> float | None:
    """Mean over fixtures that actually assert ``key`` (skip None/unset)."""
    vals = [g["metrics"][key] for g in labelled
            if g["metrics"].get(key) is not None]
    return round(sum(vals) / len(vals), 4) if vals else None


def print_report(summary: dict[str, Any], results: list[dict[str, Any]],
                 coverage: dict[str, Any] | None = None) -> None:
    ov = summary["overall"]
    n_lab = ov.get("labelled", 0)
    n_unlab = ov.get("unlabelled", 0)
    n_grace = ov.get("graceful", 0)
    print(f"\n=== Extraction eval — {ov['fixtures']} fixtures "
          f"({n_lab} labelled, {n_grace} graceful, {n_unlab} unlabelled) ===")

    def _rate(v: Any) -> str:
        return f"{v:.1%}" if isinstance(v, (int, float)) else "  n/a"

    print(f"  title_accuracy   : {_rate(ov['title_accuracy'])}")
    print(f"  block_recall     : {_rate(ov['block_recall'])}    macro   "
          f"(micro: {_rate(ov.get('block_recall_micro'))})    (critical-fact recovery)")
    print(f"  block_precision  : {_rate(ov['block_precision'])}    "
          f"(micro: {_rate(ov.get('block_precision_micro'))})    (boilerplate leakage, higher=better)")
    print(f"  link_recall      : {_rate(ov['link_recall'])}    "
          f"(micro: {_rate(ov.get('link_recall_micro'))})")
    print(f"  link_precision   : {_rate(ov['link_precision'])}    "
          f"(micro: {_rate(ov.get('link_precision_micro'))})")
    print(f"  canonical_acc    : {_rate(ov['canonical_accuracy'])}")
    print(f"  extraction_raises: {ov['extraction_raises_total']}    (must be 0)")
    print(f"  determinism_rate : {ov['determinism_rate']:.1%}    (full-result fingerprint stable across runs)")
    print(f"  pass_rate        : {_rate(ov['pass_rate'])}    (over labelled + graceful)")
    rrec = ov.get("resource_recall")
    print(f"  resource_recall  : {_rate(rrec)}    (micro: {_rate(ov.get('resource_recall_micro'))})    (typed resources: kind/crawlable/nofollow)")
    print(f"  image_recall     : {_rate(ov.get('image_recall'))}    (alt-text/source typed image assertions)")
    print("\n  per family (labelled/graceful/unlabelled  ·  assertions/labelled fixture):")
    for fam, stats in summary["per_family"].items():
        print(f"    {fam:18s} n={stats['fixtures']:2d} "
              f"({stats.get('labelled', 0)}/{stats.get('graceful', 0)}/{stats.get('unlabelled', 0)})  "
              f"asrt={stats.get('avg_assertions_per_labelled_fixture', 0):.1f}  "
              f"recall={_rate(stats['block_recall'])}  "
              f"rrec={_rate(stats.get('resource_recall'))}  "
              f"title={_rate(stats['title_accuracy'])}  "
              f"raises={stats['extraction_raises_total']}  "
              f"det={stats['determinism_rate']:.1%}")
    # by_criticality (Deliverable 1c): critical fixtures get an enforced 100%
    # floor, so surface their roll-up prominently — a standard-page improvement
    # must never mask a failed critical fixture.
    by_crit = summary.get("by_criticality", {})
    if by_crit:
        print("\n  by criticality (critical enforces a 100% floor):")
        for crit, stats in sorted(by_crit.items()):
            print(f"    {crit:11s} n={stats['fixtures']:2d}  "
                  f"pass_rate={_rate(stats.get('pass_rate'))}  "
                  f"recall={_rate(stats['block_recall'])}  "
                  f"raises={stats['extraction_raises_total']}  "
                  f"det={stats['determinism_rate']:.1%}")
    failures = [r for r in results if not r["metrics"]["passed"]]
    if failures:
        print(f"\n  {len(failures)} fixture(s) not fully passing — see report JSON for detail.")
    # Per-family ledger coverage (Deliverable 2). Omitted (not degraded) when
    # the crawl ledger is absent — e.g. in CI, where only the corpus ships.
    if coverage is not None:
        print_coverage_report(coverage)


# ─────────────────────────────────────────────────────────────────────────────
# Baseline / regression (defect 7: status logic + per-fixture comparison)
# ─────────────────────────────────────────────────────────────────────────────


_REGRESSION_METRICS = (
    "block_recall", "block_precision", "title_accuracy",
    "link_recall", "link_precision", "canonical_accuracy",
)


def detect_regression(current: dict[str, Any], baseline_path: Path) -> dict[str, Any]:
    """Compare current metrics to a stored baseline.

    A regression is a DROP in any primary rate metric or a RISE in
    extraction_raises_total, at EITHER the overall roll-up OR the per-fixture
    level. Improvements are reported but never fail the gate. The previous
    ternary labeled every non-regression "improved", making "stable"
    unreachable — fixed by computing the two directions independently.
    """
    if not baseline_path.exists():
        return {"status": "no_baseline"}
    try:
        baseline = json.loads(baseline_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        # A malformed baseline is a gate failure (defect 7): exit 1, not 0.
        return {"status": "baseline_parse_error", "error": str(exc)}

    cur = current["overall"]
    base = baseline.get("overall", {})

    regressed: list[dict[str, Any]] = []
    improved: list[dict[str, Any]] = []
    for m in _REGRESSION_METRICS:
        c, b = cur.get(m), base.get(m)
        if c is None or b is None:
            continue
        delta = round(c - b, 4)
        if delta < -1e-9:
            regressed.append({"metric": m, "baseline": b, "current": c, "delta": delta, "scope": "overall"})
        elif delta > 1e-9:
            improved.append({"metric": m, "baseline": b, "current": c, "delta": delta, "scope": "overall"})

    base_raises = base.get("extraction_raises_total", 0)
    cur_raises = cur.get("extraction_raises_total", 0)
    if cur_raises > base_raises:
        regressed.append({"metric": "extraction_raises_total",
                          "baseline": base_raises, "current": cur_raises,
                          "delta": cur_raises - base_raises, "scope": "overall"})
    elif cur_raises < base_raises:
        improved.append({"metric": "extraction_raises_total",
                         "baseline": base_raises, "current": cur_raises,
                         "delta": cur_raises - base_raises, "scope": "overall"})

    # Per-fixture comparison (defect 7): the baseline already carries fixtures[]
    # with per-fixture metrics + fingerprint. Detect dropped fixtures, changed
    # fingerprints, and per-fixture rate drops hidden by an overall average.
    fixture_regressed = _compare_fixtures(current.get("fixtures", []), baseline.get("fixtures", []))
    regressed.extend(fixture_regressed)

    status = "regressed" if regressed else ("improved" if improved else "stable")
    return {"status": status, "regressed": regressed, "improved": improved}


def _compare_fixtures(current: list[dict[str, Any]], baseline: list[dict[str, Any]]) -> list[dict[str, Any]]:
    base_by_id = {f["fixture_id"]: f for f in baseline if "fixture_id" in f}
    cur_ids = {f.get("fixture_id") for f in current}
    out: list[dict[str, Any]] = []
    # Removed baseline fixtures = a regression (coverage lost).
    for fid, bf in base_by_id.items():
        if fid not in cur_ids:
            out.append({"metric": "fixture_removed", "fixture_id": fid, "scope": "fixture"})
    for cf in current:
        fid = cf.get("fixture_id")
        bf = base_by_id.get(fid)
        if not bf:
            continue
        bm = bf.get("metrics", {})
        cm = cf.get("metrics", {})
        # Fingerprint change (defect 4 surfacing in regression): a stable
        # extractor should reproduce the same fingerprint on the same bytes.
        if bm.get("fingerprint") and cm.get("fingerprint") and bm["fingerprint"] != cm["fingerprint"]:
            out.append({"metric": "fingerprint_changed", "fixture_id": fid, "scope": "fixture"})
        for m in _REGRESSION_METRICS:
            b, c = bm.get(m), cm.get(m)
            if b is None or c is None:
                continue
            if round(c - b, 4) < -1e-9:
                out.append({"metric": m, "fixture_id": fid, "baseline": b,
                            "current": c, "delta": round(c - b, 4), "scope": "fixture"})
    return out


# ─────────────────────────────────────────────────────────────────────────────
# CLI
# ─────────────────────────────────────────────────────────────────────────────


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description="UET extraction-quality eval harness.")
    p.add_argument("--corpus", default=str(DEFAULT_CORPUS),
                   help="Path to the fixtures root (default: scripts/corpus/fixtures).")
    p.add_argument("--family", default=None,
                   help="Restrict to one fixture family.")
    p.add_argument("--baseline", default=None,
                   help="Previous report JSON for regression detection.")
    p.add_argument("--output", default=None,
                   help="Write the JSON report to this path.")
    p.add_argument("--no-determinism", action="store_true",
                   help="Skip the second extraction pass (faster, no determinism check).")
    p.add_argument("--min-pass-rate", type=float, default=1.0,
                   help="Minimum pass rate for the standard-fixture gate (default 1.0 = strict).")
    p.add_argument("--isolation", choices=("off", "pdf", "on"), default="on",
                   help="Subprocess isolation scope (default on = every fixture isolated). "
                        "'pdf' isolates only PDF fixtures; 'off' is in-process (debugging only, "
                        "forbidden in CI).")
    p.add_argument("--wip", action="store_true",
                   help="Allow relaxed thresholds (min-pass-rate < 1.0, --allow-malformed). "
                        "Forbidden in CI unless ALLOW_WEAK_EXTRACTION_GATE=1.")
    p.add_argument("--allow-malformed-fixtures", action="store_true",
                   help="Skip malformed fixtures instead of failing the gate (requires --wip).")
    p.add_argument("--accept-corpus-change", action="store_true",
                   help="Acknowledge a changed corpus universe vs the baseline instead of "
                        "failing closed. Use when the corpus was intentionally edited; you "
                        "must then regenerate the approved baseline.")
    args = p.parse_args(argv)

    # ── Deliverable 1d: gate-weakening safeguards ──
    # Relaxed thresholds require an explicit --wip opt-in, and --wip is forbidden
    # in CI without an explicit override env var — so a lower threshold cannot
    # silently slip into the production gate.
    wants_relaxation = args.min_pass_rate < 1.0 or args.allow_malformed_fixtures
    if wants_relaxation and not args.wip:
        print("✗ Relaxed thresholds require --wip (you passed --min-pass-rate < 1.0 "
              "or --allow-malformed-fixtures without --wip).", file=sys.stderr)
        return 1
    if args.wip:
        if os.getenv("CI") == "true" and os.getenv("ALLOW_WEAK_EXTRACTION_GATE") != "1":
            print("✗ --wip is forbidden in CI. Set ALLOW_WEAK_EXTRACTION_GATE=1 to override.",
                  file=sys.stderr)
            return 1
        print("⚠️  WIP MODE: quality gates are relaxed — do not merge on this run.",
              file=sys.stderr)
    # Isolation cannot be disabled in CI: the HTML path runs lxml (native code) and
    # a malformed page can stall or crash an in-process evaluator. Only 'off' is
    # blocked — 'pdf'/'on' are both acceptable.
    if args.isolation == "off" and os.getenv("CI") == "true":
        print("✗ --isolation off is forbidden in CI (native-code crash/hang risk).",
              file=sys.stderr)
        return 1

    corpus = Path(args.corpus)
    if not corpus.is_dir():
        print(f"ERROR: corpus dir not found: {corpus}", file=sys.stderr)
        return 1

    # ── Deliverable 1a: corpus identity manifest ──
    # Built once before evaluation so the report can carry the universe hash and
    # detect_regression can compare it against the baseline.
    manifest = build_manifest(corpus)

    fixture_dirs = sorted(d for d in corpus.iterdir() if d.is_dir())
    policy = ReplayPolicy()
    results: list[dict[str, Any]] = []
    malformed: list[str] = []
    invalid_expected: list[str] = []
    for fam_dir in fixture_dirs:
        if args.family and fam_dir.name != args.family:
            continue
        for fixture_dir in sorted(d for d in fam_dir.iterdir() if d.is_dir()):
            fixture = load_fixture(fixture_dir)
            if fixture is None:
                fid = f"{fam_dir.name}/{fixture_dir.name}"
                malformed.append(fid)
                print(f"  SKIP malformed fixture: {fid}", file=sys.stderr)
                continue
            if fixture.get("invalid_expected"):
                invalid_expected.append(fixture["fixture_id"])
            results.append(evaluate_one(
                fixture, policy,
                deterministic=not args.no_determinism,
                isolation=args.isolation,
            ))

    # Gate: malformed fixtures (defect 11) and invalid expected.json are harness
    # errors (exit 1) unless explicitly allowed via --wip.
    if malformed and not (args.allow_malformed_fixtures and args.wip):
        print(f"\n✗ {len(malformed)} malformed fixture(s): {', '.join(malformed)}", file=sys.stderr)
        print("  (pass --wip --allow-malformed-fixtures to skip instead of failing)",
              file=sys.stderr)
        return 1
    if invalid_expected:
        print(f"\n✗ {len(invalid_expected)} fixture(s) with invalid expected.json: "
              f"{', '.join(invalid_expected)}", file=sys.stderr)
        return 1

    if not results:
        print("No fixtures evaluated.", file=sys.stderr)
        return 1

    summary = aggregate(results)
    # Per-family ledger coverage (Deliverable 2): cross-reference the corpus
    # against the real crawl ledger so coverage gaps — confirmed families with
    # no labelled fixture — are visible. None when the ledger is absent (CI).
    ledger_path = SCRIPTS_DIR.parent / "crawl_ledger.sqlite3"
    coverage = build_coverage_report(
        corpus_root=Path(args.corpus),
        ledger_path=ledger_path,
        per_family_stats=summary["per_family"],
    )
    report = {
        "evaluation_schema_version": EVALUATION_SCHEMA_VERSION,
        "corpus_manifest": manifest,
        "corpus_manifest_hash": manifest["corpus_manifest_hash"],
        "overall": summary["overall"],
        "per_family": summary["per_family"],
        "by_criticality": summary["by_criticality"],
        "ledger_coverage": coverage,
        "fixtures": results,
    }
    print_report(summary, results, coverage=coverage)

    # Quality gate (defect 2 + Deliverable 1c criticality floor).
    any_raise = any(r["metrics"]["extraction_raises"] > 0 for r in results)
    any_nondeterminism = any(not r["metrics"]["determinism_ok"] for r in results)
    pass_rate = summary["overall"]["pass_rate"] or 0.0

    # Critical fixtures enforce a separate, uncompensable floor: 100% pass, 100%
    # recall, 0 raises, 100% determinism. A failed critical fixture → exit 2
    # regardless of the overall pass rate. Not subject to --min-pass-rate.
    crit = summary["by_criticality"].get("critical")
    critical_failed: list[str] = []
    if crit and crit["fixtures"] > 0:
        for r in results:
            if r.get("criticality") == "critical" and not r["metrics"]["passed"]:
                critical_failed.append(r["fixture_id"])
        crit_block_recall = crit.get("block_recall")
        critical_block_recall_failed = crit_block_recall is not None and crit_block_recall < 1.0
    else:
        critical_block_recall_failed = False

    # Critical-resource recall (Deliverable 2): a ``required_resources`` spec
    # flagged ``critical: true`` (e.g. the prospectus PDF link, a merit-list
    # download) enforces an uncompensable 100% floor. A missing critical
    # resource → exit 2 regardless of overall pass rate — losing the one link a
    # student needs is never compensated by other improvements.
    critical_resource_missing: list[str] = []
    for r in results:
        for spec_id in r["metrics"].get("critical_resources_missing", []):
            critical_resource_missing.append(f"{r['fixture_id']}:{spec_id}")

    quality_failed = (
        any_raise or any_nondeterminism
        or pass_rate < args.min_pass_rate
        or bool(critical_failed)
        or critical_block_recall_failed
        or bool(critical_resource_missing)
    )

    comparison: dict[str, Any] = {}
    universe: dict[str, Any] = {}
    baseline_status = "no_baseline"
    if args.baseline:
        # Corpus-universe comparison (Deliverable 1a/1.1). A changed universe
        # (added/removed/relabeled/edited fixture) FAILS CLOSED (exit 1) unless
        # explicitly acknowledged via --accept-corpus-change. This is distinct
        # from a metric regression (exit 2): a universe change means the two runs
        # are not comparable at all, so the metric comparison is meaningless until
        # the baseline is promoted.
        #
        # Baseline-promotion workflow:
        #   1. Edit the corpus (add/remove/curate fixtures).
        #   2. Run once with --accept-corpus-change to acknowledge the new universe.
        #   3. Regenerate the approved baseline:
        #        python scripts/eval/run_extraction_eval.py --output <baseline_path>
        #   4. Commit the new baseline. Subsequent runs compare against it.
        # --accept-corpus-change does NOT bypass quality gates; it only acknowledges
        # that the universe changed so the (still-run) regression check is interpreted
        # against the new universe rather than blocking as incompatible.
        baseline_report = _safe_load_baseline(Path(args.baseline))
        if isinstance(baseline_report, str):
            print(f"\n✗ baseline parse error: {baseline_report}", file=sys.stderr)
            return 1
        if baseline_report is not None:
            universe = diff_manifests(manifest, baseline_report.get("corpus_manifest", {}))
            report["corpus_universe"] = universe
            if universe.get("universe") == "changed":
                # Fail closed (Deliverable 1.1): a changed evaluation universe must
                # NOT merge green. Removing a difficult fixture would otherwise be
                # visible in the report but not block CI. The change must be either
                # explicitly acknowledged (--accept-corpus-change, then regenerate
                # the approved baseline) or the gate blocks with exit 1.
                print(f"\n✗ Corpus universe changed vs baseline: {universe['summary']}", file=sys.stderr)
                if universe.get("removed"):
                    print(f"     removed: {', '.join(universe['removed'])}", file=sys.stderr)
                if universe.get("added"):
                    print(f"     added:   {', '.join(universe['added'])}", file=sys.stderr)
                if universe.get("changed"):
                    fields = {f"  {c['fixture_id']}: {c['field']}" for c in universe["changed"][:8]}
                    print("     changed: " + "; ".join(c["fixture_id"] + "." + c["field"]
                                                       for c in universe["changed"][:8]), file=sys.stderr)
                if args.accept_corpus_change:
                    print("     (--accept-corpus-change: acknowledged — regenerate the baseline "
                          "before the next run)", file=sys.stderr)
                else:
                    print("     Baseline compatibility: INCOMPATIBLE. Re-run with "
                          "--accept-corpus-change once the change is approved,\n"
                          "     then regenerate scripts/corpus/baseline_report.json.",
                          file=sys.stderr)
                    return 1
        comparison = detect_regression(report, Path(args.baseline))
        report["comparison"] = comparison
        report["corpus_universe"] = universe
        baseline_status = comparison.get("status", "no_baseline")
        if baseline_status == "regressed":
            print("\n⚠️  REGRESSION detected:")
            for r in comparison["regressed"]:
                fid = f" [{r['fixture_id']}]" if "fixture_id" in r else ""
                delta = r.get("delta")
                # Metric-drop regressions carry a numeric delta; structural ones
                # (fixture_removed / fingerprint_changed) don't — format defensively.
                delta_str = f" ({delta:+.4f})" if isinstance(delta, (int, float)) else ""
                base_cur = ""
                if "baseline" in r and "current" in r:
                    base_cur = f": {r['baseline']} → {r['current']}"
                print(f"     {r['metric']}{fid}{base_cur}{delta_str}")
        elif baseline_status == "improved":
            print("\n✓ Improved vs baseline (no regressions).")
        elif baseline_status == "stable":
            print("\n✓ Stable vs baseline (no regressions, no improvements).")
        elif baseline_status == "no_baseline":
            if args.output and Path(args.output).resolve() == Path(args.baseline).resolve():
                print(f"\n(no baseline file — wrote this run as the new baseline: {args.baseline})")
            else:
                print(f"\n(no baseline file at {args.baseline} — pass --output to create one)")

    # Record the gate configuration (Deliverable 1d) so a report is self-describing
    # about whether the strict gate was in force.
    report["gate"] = {
        "mode": "wip" if args.wip else "strict",
        "min_pass_rate": args.min_pass_rate,
        "critical_pass_rate": 1.0,           # always 1.0 — critical floor is not configurable
        "require_determinism": not args.no_determinism,
        "allow_malformed_fixtures": bool(args.allow_malformed_fixtures and args.wip),
        "isolation_scope": args.isolation,
    }

    if args.output:
        out_p = Path(args.output)
        out_p.parent.mkdir(parents=True, exist_ok=True)
        out_p.write_text(json.dumps(report, indent=2, sort_keys=True) + "\n", encoding="utf-8")
        print(f"\nReport written to: {out_p}")

    # Exit-code precedence: harness error (1) already returned above.
    if quality_failed:
        reasons = []
        if any_raise:
            reasons.append("extraction crash(es)")
        if any_nondeterminism:
            reasons.append("nondeterministic output")
        if pass_rate < args.min_pass_rate:
            reasons.append(f"pass_rate {pass_rate:.1%} < min {args.min_pass_rate:.1%}")
        if critical_failed:
            reasons.append(f"{len(critical_failed)} critical fixture(s) failed: "
                           f"{', '.join(critical_failed)}")
        if critical_block_recall_failed:
            reasons.append("critical block_recall < 100%")
        if critical_resource_missing:
            reasons.append(f"{len(critical_resource_missing)} critical resource(s) missing: "
                           f"{', '.join(critical_resource_missing)}")
        print(f"\n✗ Quality gate failed: {'; '.join(reasons)}", file=sys.stderr)
        return 2
    if baseline_status == "regressed":
        return 2
    return 0


def _safe_load_baseline(path: Path) -> dict[str, Any] | str | None:
    """Load a baseline report, returning None if absent, or an error string."""
    if not path.exists():
        return None
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        return str(exc)


if __name__ == "__main__":
    raise SystemExit(main())
