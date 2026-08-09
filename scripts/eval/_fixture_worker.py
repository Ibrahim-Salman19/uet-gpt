"""Subprocess worker for isolated fixture extraction (Deliverable 1b).

Invoked by ``scripts/eval/isolation.py`` as::

    python scripts/eval/_fixture_worker.py < body.bin   # stdin = JSON request

The worker reads a JSON request from stdin, runs the extractor (HTML or PDF
route, chosen by the parent), runs a SECOND extraction for the determinism
fingerprint, and writes one JSON outcome object to stdout. It never prints
anything else to stdout (diagnostics go to stderr). A non-zero exit means a
worker crash; the parent maps that to ``status="worker_crash"``.

Why a separate file rather than ``multiprocessing``? On Windows the dev
environment uses spawn-mode subprocesses where pickling the 6,200-line
``html_extractor`` target callable is fragile; a single-file stdin/stdout worker
avoids the pickle machinery entirely and behaves identically on Windows (dev)
and Linux (CI).

The body is read from ``body_path`` on disk (passed in the request) rather than
piped through stdin — the prospectus is 4.6 MB and the parent already holds it
on disk as ``body.bin``. This keeps the request small and lets the child mmap or
stream the bytes.

Outcome status vocabulary (the parent maps these to metrics + exit codes)::

    success                — extraction completed (result.pdf_error may still be set)
    extractor_error        — extractor raised; captured, not fatal to the parent
    timeout                — NOT produced here (the parent's wall-clock timeout kills us);
                             included in the vocabulary for symmetry
    worker_crash           — NOT produced here (non-zero exit / no stdout); parent infers
    memory_limit           — NOT produced here (POSIX RLIMIT_AS kills us); parent infers
    invalid_worker_output  — NOT produced here (parent infers on bad stdout)
"""

from __future__ import annotations

import json
import sys
import time
import traceback
from dataclasses import dataclass
from pathlib import Path
from typing import Any

# Bootstrap sys.path so the worker can import the extractor + eval package
# regardless of the child's CWD (subprocess may inherit a different CWD).
SCRIPTS_DIR = Path(__file__).resolve().parents[1]
if str(SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPTS_DIR))

from html_extractor import HtmlExtractionResult, extract_html_document  # noqa: E402

# Import the harness helpers we share (PDF extraction + fingerprint + ReplayPolicy).
# These are lightweight: importing run_extraction_eval pulls html_extractor, which
# is the heavy module the child needs anyway.
from eval.run_extraction_eval import (  # noqa: E402
    ReplayPolicy,
    _extract_pdf,
    _looks_like_pdf,
    result_fingerprint,
)


# Lightweight stand-ins with the same attributes ``result_fingerprint`` reads.
# Defined here (rather than importing the frozen dataclasses from html_extractor)
# so the worker is self-contained for fingerprinting and can't accidentally
# diverge from the field set the fingerprint hashes.
@dataclass
class _ResourceShim:
    url: str
    text: str
    kind: str
    crawlable: bool
    nofollow: bool = False


@dataclass
class _ImageShim:
    url: str
    alt_text: str
    context: str
    score: float
    source: str = "img"


def _result_to_dict(result: HtmlExtractionResult | None, extractor_used: str,
                    pdf_error: dict[str, str] | None) -> dict[str, Any]:
    """Serialize an HtmlExtractionResult (or None) to a JSON-safe dict."""
    if result is None:
        return {
            "canonical_url": "", "title": "", "markdown": "",
            "crawl_links": [], "resources": [], "image_candidates": [],
            "diagnostics": {}, "extractor_used": extractor_used,
            "pdf_error": pdf_error, "word_count": 0,
        }
    return {
        "canonical_url": result.canonical_url,
        "title": result.title,
        "markdown": result.markdown,
        "crawl_links": list(result.crawl_links or []),
        "resources": [
            {"url": r.url, "text": r.text, "kind": r.kind,
             "crawlable": r.crawlable, "nofollow": r.nofollow}
            for r in (result.resources or [])
        ],
        "image_candidates": [
            {"url": ic.url, "alt_text": ic.alt_text, "context": ic.context,
             "score": ic.score, "source": ic.source}
            for ic in (result.image_candidates or [])
        ],
        "diagnostics": dict(result.diagnostics or {}),
        "extractor_used": extractor_used,
        "pdf_error": pdf_error,
        "word_count": result.word_count,
    }


def _run_once(req: dict[str, Any], body: bytes) -> tuple[dict[str, Any], str, dict[str, str] | None, bool]:
    """Run one extraction pass.

    Returns (result_dict, extractor_used, pdf_error, result_is_none). The
    ``result_is_none`` flag is explicit so the determinism fingerprint can
    distinguish "extractor returned None" from "extractor returned an empty
    result" without guessing from the dict shape.
    """
    content_type = req.get("content_type", "")
    final_url = req.get("final_url", "")
    host_suffix = req.get("host_suffix", "uettaxila.edu.pk")
    policy = ReplayPolicy(host_suffix)

    pdf_error: dict[str, str] | None = None
    result: HtmlExtractionResult | None
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
            result = None
            pdf_error = {"error_code": outcome.error_code,
                         "error_message": outcome.error_message or ""}
    else:
        extractor_used = "html"
        result = extract_html_document(body, content_type, final_url, policy)
    return _result_to_dict(result, extractor_used, pdf_error), extractor_used, pdf_error, (result is None)


def _reconstruct_result(rd: dict[str, Any], result_is_none: bool) -> HtmlExtractionResult | None:
    """Rebuild an HtmlExtractionResult from its serialized form, for fingerprinting.

    The fingerprint must cover the real fields; we reconstruct the dataclass from
    the JSON dict so ``result_fingerprint`` sees the same shape the scorer does.
    ``result_is_none`` is carried explicitly (not inferred) so None and empty
    results fingerprint differently.
    """
    if result_is_none:
        return None
    return HtmlExtractionResult(
        canonical_url=rd.get("canonical_url", ""),
        title=rd.get("title", ""),
        markdown=rd.get("markdown", ""),
        crawl_links=list(rd.get("crawl_links") or []),
        # Reconstruct resource/image objects so the fingerprint covers them.
        resources=[
            _ResourceShim(**r) for r in (rd.get("resources") or [])
        ],
        image_candidates=[
            _ImageShim(**ic) for ic in (rd.get("image_candidates") or [])
        ],
        diagnostics=dict(rd.get("diagnostics") or {}),
    )


def main() -> int:
    raw_stdin = sys.stdin.buffer.read()
    try:
        req = json.loads(raw_stdin.decode("utf-8"))
    except (json.JSONDecodeError, UnicodeDecodeError) as exc:
        # The parent treats this as invalid_worker_output, but emit a structured
        # error so it's diagnosable rather than a bare crash.
        json.dump({"status": "extractor_error",
                   "result": None, "duration_ms": 0, "peak_memory_bytes": None,
                   "error_code": "bad_request_json",
                   "error_message": f"could not parse request: {exc}"}, sys.stdout)
        return 0

    body_path = Path(req.get("body_path", ""))
    try:
        body = body_path.read_bytes()
    except OSError as exc:
        json.dump({"status": "extractor_error",
                   "result": None, "duration_ms": 0, "peak_memory_bytes": None,
                   "error_code": "body_unreadable",
                   "error_message": f"could not read {body_path}: {exc}"}, sys.stdout)
        return 0

    start = time.monotonic()
    # Pass 1
    try:
        rd1, extractor_used, pdf_error, is_none_1 = _run_once(req, body)
    except Exception as exc:  # noqa: BLE001 — a crash is a measurement
        json.dump({"status": "extractor_error",
                   "result": None,
                   "duration_ms": int((time.monotonic() - start) * 1000),
                   "peak_memory_bytes": _peak_rss(),
                   "error_code": type(exc).__name__,
                   "error_message": f"{type(exc).__name__}: {exc}",
                   "traceback": traceback.format_exc(limit=4)}, sys.stdout)
        return 0

    # Pass 2: determinism fingerprint, compared against pass 1. Both passes use
    # the same canonical_url (final_url) so the comparison is symmetric. Skipped
    # when the parent did not request determinism (deterministic=False) — the
    # worker then does a single pass and reports det_ok=True (vacuous, since no
    # second pass was run).
    det_ok = True
    if req.get("deterministic", True):
        try:
            rd2, _, _, is_none_2 = _run_once(req, body)
            fp1 = result_fingerprint(_reconstruct_result(rd1, is_none_1))
            fp2 = result_fingerprint(_reconstruct_result(rd2, is_none_2))
            det_ok = (fp1 == fp2)
        except Exception:  # noqa: BLE001
            det_ok = False

    outcome = {
        "status": "success",
        "result": rd1,
        "determinism_ok": det_ok,
        "duration_ms": int((time.monotonic() - start) * 1000),
        "peak_memory_bytes": _peak_rss(),
        "error_code": None,
        "error_message": None,
    }
    json.dump(outcome, sys.stdout)
    return 0


def _peak_rss() -> int | None:
    """Best-effort peak RSS of this worker process, in bytes.

    On Linux (CI) the parent's RLIMIT_AS enforces the hard ceiling; this value
    is informational for the report. Returns None if unavailable.
    """
    try:
        import resource
        # ru_maxrss is in KB on Linux, bytes on macOS; we target Linux CI.
        return resource.getrusage(resource.RUSAGE_SELF).ru_maxrss * 1024
    except Exception:  # noqa: BLE001 — Windows has no resource module
        return None


if __name__ == "__main__":
    # Ensure stdout is line-buffered JSON, nothing else leaks to stdout.
    sys.exit(main())
