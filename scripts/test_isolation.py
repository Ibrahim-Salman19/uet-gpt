"""Tests for the subprocess isolation layer (Deliverable 1b).

These exercise the worker contract: a valid fixture extracts correctly, a
corrupt PDF surfaces a structured error (no parent crash), a timed-out worker is
killed, and malformed worker output maps to invalid_worker_output. The timeout
test against the real corpus's largest PDF is guarded by PROSPECTUS_PRESENT so it
skips cleanly on a fresh clone.
"""

from __future__ import annotations

import json
import sys
import tempfile
import unittest
from pathlib import Path

SCRIPTS = Path(__file__).resolve().parent
if str(SCRIPTS) not in sys.path:
    sys.path.insert(0, str(SCRIPTS))

from eval.isolation import run_isolated, WorkerRequest, WORKER_PATH  # noqa: E402

CORPUS = SCRIPTS / "corpus" / "fixtures"
PROSPECTUS = CORPUS / "pdf-download" / "uet-prospectus-2024-d60577" / "body.bin"
SMALL_PDF = CORPUS / "pdf-download" / "sexualharassment-policy-4b52e1" / "body.bin"
PROSPECTUS_PRESENT = PROSPECTUS.exists() and PROSPECTUS.stat().st_size > 1_000_000


class TestIsolation(unittest.TestCase):
    def test_valid_pdf_extracts_in_worker(self):
        if not SMALL_PDF.exists():
            self.skipTest("small PDF fixture not present")
        out = run_isolated(WorkerRequest(
            fixture_id="test/pdf", extractor_kind="pdf",
            body_path=str(SMALL_PDF), content_type="application/pdf",
            final_url="https://uettaxila.edu.pk/x.pdf", timeout_ms=120000,
        ))
        self.assertEqual(out.status, "success")
        self.assertIsNotNone(out.result)
        self.assertTrue(len(out.result.get("markdown", "")) > 0)
        self.assertTrue(out.determinism_ok)

    def test_corrupt_pdf_does_not_crash_parent(self):
        with tempfile.NamedTemporaryFile(delete=False, suffix=".bin") as tf:
            tf.write(b"definitely not a pdf")
            bad = tf.name
        try:
            out = run_isolated(WorkerRequest(
                fixture_id="test/bad-pdf", extractor_kind="pdf",
                body_path=bad, content_type="application/pdf",
                final_url="https://uettaxila.edu.pk/broken.pdf", timeout_ms=60000,
            ))
            # The extractor handled the bad PDF gracefully → worker status success
            # with a structured pdf_error. The parent did not crash.
            self.assertEqual(out.status, "success")
            self.assertIsNotNone(out.result)
            self.assertEqual(out.result["pdf_error"]["error_code"], "invalid_pdf")
        finally:
            Path(bad).unlink()

    def test_timeout_kills_worker(self):
        # A 1ms budget cannot convert even a small PDF; the parent must kill the
        # worker and return a timeout outcome rather than hanging.
        if not SMALL_PDF.exists():
            self.skipTest("small PDF fixture not present")
        out = run_isolated(WorkerRequest(
            fixture_id="test/timeout", extractor_kind="pdf",
            body_path=str(SMALL_PDF), content_type="application/pdf",
            final_url="https://uettaxila.edu.pk/x.pdf", timeout_ms=1,
        ))
        self.assertEqual(out.status, "timeout")
        self.assertEqual(out.error_code, "wall_clock_exceeded")

    def test_invalid_worker_output(self):
        # Point WORKER_PATH at a stub that prints non-JSON stdout.
        import eval.isolation as iso
        with tempfile.NamedTemporaryFile("w", suffix=".py", delete=False) as f:
            f.write("import sys; print('not json {')")
            stub = f.name
        orig = iso.WORKER_PATH
        iso.WORKER_PATH = Path(stub)
        try:
            out = run_isolated(WorkerRequest(
                fixture_id="test/bad-worker", extractor_kind="html",
                body_path=str(SMALL_PDF) if SMALL_PDF.exists() else __file__,
                content_type="text/html", final_url="https://x/", timeout_ms=30000,
            ))
            self.assertEqual(out.status, "invalid_worker_output")
            self.assertEqual(out.error_code, "stdout_not_json")
        finally:
            iso.WORKER_PATH = orig
            Path(stub).unlink()

    @unittest.skipUnless(PROSPECTUS_PRESENT, "prospectus PDF not present (>1MB)")
    def test_prospectus_extracts_under_isolation(self):
        # The slowest fixture (4.6 MB / 166 pages). Confirms the isolation layer
        # handles the real worst case without timeout when given a realistic budget.
        # timeout_ms was 300000 (5 min) when this fixture crashed near-instantly
        # under the broken RapidOCR backend (see scripts/crawler.py's OCR fix). Real
        # Tesseract OCR of 64/166 pages measures ~1880.8s single-pass (see this
        # fixture's expected.json _note); run_isolated derives an RLIMIT_CPU budget
        # from timeout_ms, so a stale 300000 now kills the worker with SIGXCPU
        # before it can finish, not a real defect in the extraction itself.
        out = run_isolated(WorkerRequest(
            fixture_id="pdf-download/uet-prospectus-2024-d60577",
            extractor_kind="pdf", body_path=str(PROSPECTUS),
            content_type="application/pdf",
            final_url="https://uettaxila.edu.pk/prospectus.pdf",
            timeout_ms=5400000,
        ))
        self.assertEqual(out.status, "success")
        self.assertIsNotNone(out.result)
        self.assertTrue(len(out.result.get("markdown", "")) > 0)


class TestHtmlWorkerIsolation(unittest.TestCase):
    """HTML fixtures run through lxml (native code). These tests confirm the
    worker handles both valid and pathological HTML bodies without crashing the
    parent — the isolation contract that PDF-only testing alone doesn't cover.
    """

    def _write_body(self, body: bytes) -> str:
        import tempfile
        from pathlib import Path
        tf = tempfile.NamedTemporaryFile(delete=False, suffix=".bin")
        tf.write(body)
        tf.close()
        self.addCleanup(Path(tf.name).unlink)
        return tf.name

    def test_valid_html_extracts_through_worker(self):
        from eval.isolation import run_isolated, WorkerRequest
        body = (b"<html><head><title>Admissions 2026</title></head>"
                b"<body><p>Fee Rs 4000</p>"
                b"<a href='https://admissions.uettaxila.edu.pk/'>Apply</a></body></html>")
        out = run_isolated(WorkerRequest(
            fixture_id="t/html", extractor_kind="html",
            body_path=self._write_body(body), content_type="text/html",
            final_url="https://admissions.uettaxila.edu.pk/", timeout_ms=60000,
        ))
        self.assertEqual(out.status, "success")
        self.assertIsNotNone(out.result)
        self.assertIn("admissions", out.result.get("markdown", "").lower())
        # The extractor classifies discovered links into ``resources`` (with a
        # kind/crawlable/nofollow tuple), not bare ``crawl_links``. This is exactly
        # the resource/crawl separation Deliverable 2 makes scoreable.
        all_urls = [r["url"] for r in out.result.get("resources", [])] + out.result.get("crawl_links", [])
        self.assertTrue(any("admissions.uettaxila.edu.pk" in u for u in all_urls))

    def test_pathological_html_does_not_crash_parent(self):
        """Deeply nested / degenerate HTML exercises the lxml isolation contract.

        The parent must survive. Any structured outcome is acceptable — ``success``
        (lxml recovered something), ``extractor_error`` (lxml raised, caught), or
        ``timeout`` (the pathological input exceeded the wall-clock budget and the
        worker was killed). The contract under test is *parent survival*, not
        extraction quality on adversarial input.
        """
        from eval.isolation import run_isolated, WorkerRequest
        # 5k unclosed nested divs — a classic pathological parser input that lxml
        # struggles with (full 50k reliably exceeds a 30s budget; 5k is enough to
        # exercise the path while keeping the test bounded).
        body = b"<html><body>" + b"<div>" * 5000 + b"x" + b"</body></html>"
        out = run_isolated(WorkerRequest(
            fixture_id="t/pathological", extractor_kind="html",
            body_path=self._write_body(body), content_type="text/html",
            final_url="https://uettaxila.edu.pk/", timeout_ms=30000,
        ))
        # The parent survived (we got a structured outcome, not a crash).
        self.assertIn(out.status, ("success", "extractor_error", "timeout"))

    def test_empty_html_body_handled_gracefully(self):
        from eval.isolation import run_isolated, WorkerRequest
        out = run_isolated(WorkerRequest(
            fixture_id="t/empty", extractor_kind="html",
            body_path=self._write_body(b""), content_type="text/html",
            final_url="https://uettaxila.edu.pk/", timeout_ms=30000,
        ))
        # Empty body → extractor returns nothing; worker transport still succeeds.
        self.assertEqual(out.status, "success")


class TestCorruptPdfDoesNotFalseGreen(unittest.TestCase):
    """Deliverable 1.1 regression: a corrupt PDF that a LABELED fixture expects
    content from must FAIL the fixture and the gate — the worker's ``status:
    success`` (transport ok) must not be confused with a successful extraction.

    Only a fixture that explicitly declares the failure mode (outcome: no_content)
    may pass a corrupt-PDF body.
    """

    def _make_fixture(self, tmpdir, slug, expected):
        import hashlib, json
        from pathlib import Path
        d = Path(tmpdir) / "pdf-download" / slug
        d.mkdir(parents=True)
        body = b"definitely not a pdf, just garbage bytes"
        (d / "body.bin").write_bytes(body)
        (d / "response-headers.json").write_text(json.dumps({"status": 200, "headers": {"content-type": "application/pdf"}}))
        (d / "meta.json").write_text(json.dumps({"content_type": "application/pdf", "final_url": "https://uettaxila.edu.pk/x.pdf", "body_sha256": hashlib.sha256(body).hexdigest(), "body_size": len(body)}))
        (d / "expected.json").write_text(json.dumps({"expected": expected}))
        return d

    def test_labeled_fixture_corrupt_pdf_fails_gate(self):
        """A critical fixture expecting content + corrupt PDF → exit 2 (no false green)."""
        import os
        from eval.run_extraction_eval import main
        os.environ.pop("CI", None)
        with tempfile.TemporaryDirectory() as td:
            self._make_fixture(td, "crit", {
                "criticality": "critical",
                "required_text_blocks": [{"text": "important fact"}],
            })
            rc = main(["--corpus", td, "--no-determinism", "--isolation", "pdf"])
            self.assertEqual(rc, 2)

    def test_worker_survives_corrupt_pdf_and_records_error(self):
        """The parent/worker must NOT crash on a corrupt PDF; the error is recorded."""
        from eval.run_extraction_eval import load_fixture, evaluate_one, ReplayPolicy
        with tempfile.TemporaryDirectory() as td:
            d = self._make_fixture(td, "crit", {"required_text_blocks": [{"text": "x"}]})
            fx = load_fixture(d)
            r = evaluate_one(fx, ReplayPolicy(), deterministic=False, isolation="pdf")
            self.assertTrue(r["metrics"]["isolated"])
            self.assertEqual(r["metrics"]["worker_status"], "success")  # transport ok
            self.assertIsNotNone(r["metrics"].get("pdf_error"))         # but extraction failed
            self.assertFalse(r["metrics"]["passed"])                    # so the fixture fails

    def test_diagnostic_fixture_corrupt_pdf_passes(self):
        """A diagnostic fixture declaring outcome: no_content may pass a corrupt PDF."""
        import os
        from eval.run_extraction_eval import main
        os.environ.pop("CI", None)
        with tempfile.TemporaryDirectory() as td:
            self._make_fixture(td, "diag", {
                "criticality": "diagnostic",
                "outcome": "no_content",
            })
            rc = main(["--corpus", td, "--no-determinism", "--isolation", "pdf"])
            self.assertEqual(rc, 0)


class TestIsolationCiGuard(unittest.TestCase):
    """Deliverable 1.1: --isolation off is forbidden in CI."""

    def test_isolation_off_forbidden_in_ci(self):
        import os
        from eval.run_extraction_eval import main
        old = os.environ.get("CI")
        try:
            os.environ["CI"] = "true"
            with tempfile.TemporaryDirectory() as td:
                # even an empty corpus is enough — the guard fires before evaluation
                rc = main(["--corpus", td, "--isolation", "off"])
                self.assertEqual(rc, 1)
        finally:
            if old is None:
                os.environ.pop("CI", None)
            else:
                os.environ["CI"] = old


class TestDeterminismOnWorkerFailure(unittest.TestCase):
    """Deliverable 2 regression: when an isolated worker times out (or crashes)
    while determinism is ON, ``evaluate_one`` must not raise
    ``UnboundLocalError: determinism_ok``.

    The bug: the isolated success branch assigned ``determinism_ok`` from the
    worker, but the timeout/crash branch (status not in success/invalid) set
    ``raised=True`` and never assigned ``determinism_ok`` — so the later
    ``metrics["determinism_ok"] = determinism_ok`` reference crashed the parent.
    This test forces a timeout (timeout_ms=1 against a real PDF) with
    determinism enabled, through the full ``evaluate_one`` path.
    """

    def _make_timeout_fixture(self, tmpdir):
        import hashlib, json
        from pathlib import Path
        d = Path(tmpdir) / "pdf-download" / "timeout-fixture"
        d.mkdir(parents=True)
        # A small but real PDF body — the worker cannot finish extraction in 1ms,
        # guaranteeing a wall-clock timeout regardless of machine speed.
        body = b"%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF"
        (d / "body.bin").write_bytes(body)
        (d / "response-headers.json").write_text(json.dumps({
            "status": 200, "headers": {"content-type": "application/pdf"}
        }))
        (d / "meta.json").write_text(json.dumps({
            "content_type": "application/pdf",
            "final_url": "https://uettaxila.edu.pk/x.pdf",
            "body_sha256": hashlib.sha256(body).hexdigest(),
            "body_size": len(body),
        }))
        (d / "expected.json").write_text(json.dumps({"expected": {
            "required_text_blocks": [{"text": "anything"}],
        }}))
        return d

    def test_worker_timeout_with_determinism_does_not_crash_parent(self):
        """A worker timeout (status != success) under determinism=True must be
        scored as a failure, not crash the parent with UnboundLocalError."""
        from eval.run_extraction_eval import load_fixture, evaluate_one, ReplayPolicy
        with tempfile.TemporaryDirectory() as td:
            d = self._make_timeout_fixture(td)
            fx = load_fixture(d)
            # Override the fixture's timeout to 1ms to force a wall-clock timeout.
            # load_fixture reads expected.json; evaluate_one uses _fixture_timeout_ms
            # which reads expected.max_duration_ms, defaulting to default_timeout_ms.
            # Pass an absurdly small default to force the timeout.
            r = evaluate_one(
                fx, ReplayPolicy(),
                deterministic=True, isolation="pdf",
                default_timeout_ms=1,
            )
            self.assertTrue(r["metrics"]["isolated"])
            # A timeout is a worker failure: raised, not passed, determinism vacuously OK.
            self.assertIn(r["metrics"]["worker_status"], ("timeout", "worker_crash"))
            self.assertEqual(r["metrics"]["extraction_raises"], 1)
            self.assertFalse(r["metrics"]["passed"])
            # The crux: determinism_ok must be a real bool, not an UnboundLocalError.
            self.assertIn(r["metrics"]["determinism_ok"], (True, False))


if __name__ == "__main__":
    unittest.main()
