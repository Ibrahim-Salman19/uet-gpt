"""Unit tests for the extraction eval matchers and a passing/failing fixture E2E.

Run from the repository root::

    python -m pytest scripts/test_extraction_eval.py -v
    # or, without pytest:
    python scripts/test_extraction_eval.py
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

from eval.extraction_metrics import (  # noqa: E402
    contains_phrase,
    normalize_text,
    normalize_url,
    score_fixture,
    url_host,
)


class TestNormalization(unittest.TestCase):
    def test_normalize_collapses_whitespace_and_case(self):
        self.assertEqual(normalize_text("  Hello   WORLD\n"), "hello world")

    def test_normalize_strips_nbsp_and_viewstate(self):
        self.assertNotIn("nbsp", normalize_text("Fee&nbsp;4,000"))
        self.assertNotIn("viewstate", normalize_text("__VIEWSTATE blob"))

    def test_normalize_empty(self):
        self.assertEqual(normalize_text(""), "")

    def test_normalize_url_drops_fragment_and_trailing_slash(self):
        a = normalize_url("https://Example.com/Path/")
        b = normalize_url("https://example.com/Path#frag")
        self.assertEqual(a, b)

    def test_url_host(self):
        self.assertEqual(url_host("https://WWW.Example.com/x"), "www.example.com")


class TestMatchers(unittest.TestCase):
    def test_contains_phrase_is_semantic(self):
        self.assertTrue(contains_phrase("The Fee is RS. 4,000/- today", "rs. 4,000"))

    def test_contains_phrase_resists_whitespace(self):
        self.assertTrue(contains_phrase("last    date to   apply", "last date to apply"))

    def test_missing_phrase(self):
        self.assertFalse(contains_phrase("nothing relevant here", "deadline"))


class TestScoreFixture(unittest.TestCase):
    def _actual(self, **kw):
        base = dict(title="", markdown="", crawl_links=[], resources=[],
                    canonical_url="", raised=False)
        base.update(kw)
        return base

    def test_all_pass_when_expectations_met(self):
        expected = {"expected": {
            "title_contains": ["Admissions"],
            "title_not_contains": ["Error"],
            "canonical_host": "uettaxila.edu.pk",
            "required_text_blocks": [{"text": "last date to apply"}],
            "forbidden_text_blocks": ["__VIEWSTATE"],
            "required_links_contain": ["admissions"],
            "forbidden_links_contain": ["logout"],
            "resource_min_count": 0,
        }}
        actual = self._actual(
            title="Admissions 2026",
            markdown="The last date to apply is soon.",
            crawl_links=["https://admissions.uettaxila.edu.pk/"],
            resources=[],
            canonical_url="https://uettaxila.edu.pk/",
        )
        m = score_fixture(expected, **actual)
        self.assertTrue(m["passed"], msg=json.dumps(m, indent=2))
        self.assertEqual(m["block_recall"], 1.0)
        self.assertEqual(m["block_precision"], 1.0)

    def test_fails_when_required_block_missing(self):
        expected = {"expected": {"required_text_blocks": ["merit list"]}}
        actual = self._actual(markdown="Nothing about merit here.")
        m = score_fixture(expected, **actual)
        self.assertFalse(m["passed"])
        self.assertLess(m["block_recall"], 1.0)
        self.assertEqual(m["missing_blocks"], ["merit list"])

    def test_fails_when_forbidden_block_leaked(self):
        expected = {"expected": {"forbidden_text_blocks": ["__VIEWSTATE"]}}
        actual = self._actual(markdown="Some real text\n__VIEWSTATE blob\nmore text")
        m = score_fixture(expected, **actual)
        self.assertFalse(m["passed"])
        self.assertLess(m["block_precision"], 1.0)

    def test_fails_when_forbidden_link_present(self):
        expected = {"expected": {"forbidden_links_contain": ["logout"]}}
        actual = self._actual(crawl_links=["https://x/logout"])
        m = score_fixture(expected, **actual)
        self.assertLess(m["link_precision"], 1.0)

    def test_extraction_raise_marks_not_passed(self):
        m = score_fixture({"expected": {}}, **self._actual(raised=True))
        self.assertFalse(m["passed"])
        self.assertEqual(m["extraction_raises"], 1)

    def test_empty_expectation_set_passes(self):
        # A failure-mode fixture (no required content) should pass if extraction
        # didn't raise and there's nothing to violate.
        m = score_fixture({"expected": {}}, **self._actual())
        self.assertTrue(m["passed"])


class TestEndToEndWithSyntheticFixture(unittest.TestCase):
    """Drive the full harness scoring path against two synthetic fixtures."""

    def _make_fixture(self, root: Path, family: str, slug: str, *,
                      body: bytes, content_type: str, final_url: str,
                      status: int, expected: dict) -> Path:
        d = root / family / slug
        d.mkdir(parents=True, exist_ok=True)
        (d / "body.bin").write_bytes(body)
        import hashlib
        meta = {
            "body_sha256": hashlib.sha256(body).hexdigest(),
            "body_size": len(body),
            "content_type": content_type,
            "status": status,
            "final_url": final_url,
            "requested_url": final_url,
            "redirect_chain": [],
            "remote_ip": None,
            "fetched_at": "2026-01-01T00:00:00+00:00",
            "elapsed_ms": 1,
        }
        (d / "meta.json").write_text(json.dumps(meta), encoding="utf-8")
        (d / "response-headers.json").write_text(
            json.dumps({"status": status, "headers": {"content-type": content_type}}),
            encoding="utf-8",
        )
        exp = {"fixture_id": f"{family}/{slug}", "family": family, "expected": expected}
        (d / "expected.json").write_text(json.dumps(exp), encoding="utf-8")
        return d

    def test_passing_and_failing_fixtures_score_correctly(self):
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            good_body = b"""<!DOCTYPE html><html><head><title>Admissions 2026</title></head>
            <body><p>The last date to apply is 30 July 2026.</p>
            <a href="https://admissions.uettaxila.edu.pk/">Apply</a></body></html>"""
            self._make_fixture(
                root, "t", "good", body=good_body, content_type="text/html",
                final_url="https://admissions.uettaxila.edu.pk/",
                status=200,
                expected={
                    "title_contains": ["Admissions 2026"],
                    "required_text_blocks": [{"text": "last date to apply"}],
                    "required_links_contain": ["admissions.uettaxila.edu.pk"],
                    "forbidden_links_contain": ["logout"],
                },
            )
            # Failing fixture: body present but a critical fact is absent.
            bad_body = b"""<!DOCTYPE html><html><head><title>Admissions 2026</title></head>
            <body><p>No dates mentioned here.</p></body></html>"""
            self._make_fixture(
                root, "t", "bad", body=bad_body, content_type="text/html",
                final_url="https://admissions.uettaxila.edu.pk/",
                status=200,
                expected={
                    "title_contains": ["Admissions 2026"],
                    "required_text_blocks": [{"text": "last date to apply"}],
                },
            )

            # Import the harness lazily so sys.path bootstrap in run_extraction_eval
            # has already run (it has, via the SCRIPTS insert above).
            from eval.run_extraction_eval import load_fixture, evaluate_one, aggregate

            class _Pol:
                def canonicalize(self, u): return u
                def is_network_target(self, u): return True
                def is_crawl_candidate(self, u): return True

            results = []
            for slug in ("good", "bad"):
                fx = load_fixture(root / "t" / slug)
                self.assertIsNotNone(fx)
                results.append(evaluate_one(fx, _Pol(), deterministic=False))

            summary = aggregate(results)
            # One passing, one failing fixture.
            self.assertEqual(summary["overall"]["fixtures"], 2)
            self.assertLess(summary["overall"]["block_recall"], 1.0)
            self.assertGreater(summary["overall"]["block_recall"], 0.0)
            good = next(r for r in results if r["fixture_id"].endswith("good"))
            bad = next(r for r in results if r["fixture_id"].endswith("bad"))
            self.assertTrue(good["metrics"]["passed"])
            self.assertFalse(bad["metrics"]["passed"])


class TestReplayPolicyHostnameBoundary(unittest.TestCase):
    """Defect 1: ``ReplayPolicy.is_network_target`` must enforce the host boundary.

    The old ``netloc.endswith(suffix)`` accepted ``eviluettaxila.edu.pk``,
    rejected ``www.uettaxila.edu.pk:443`` (port suffix on netloc), and treated
    relative URLs as authorized network targets. The fix parses ``hostname``
    (not ``netloc``), requires an http(s) scheme, and matches the suffix as a
    complete host label.
    """

    def setUp(self):
        from eval.run_extraction_eval import ReplayPolicy
        self.pol = ReplayPolicy()

    def test_rejects_lookalike_suffix(self):
        # The whole point: eviluettaxila.edu.pk is NOT uettaxila.edu.pk.
        self.assertFalse(self.pol.is_network_target("https://eviluettaxila.edu.pk/"))

    def test_accepts_port_suffix(self):
        # netloc is "www.uettaxila.edu.pk:443" but hostname is the bare host.
        self.assertTrue(self.pol.is_network_target("https://www.uettaxila.edu.pk:443/"))

    def test_rejects_relative_path(self):
        self.assertFalse(self.pol.is_network_target("/path"))
        self.assertFalse(self.pol.is_network_target("relative.html"))

    def test_rejects_non_http_scheme(self):
        self.assertFalse(self.pol.is_network_target("file:///etc/passwd"))
        self.assertFalse(self.pol.is_network_target("javascript:alert(1)"))

    def test_rejects_malformed_port(self):
        self.assertFalse(self.pol.is_network_target("https://uettaxila.edu.pk:abc/"))

    def test_accepts_apex_and_subdomain(self):
        self.assertTrue(self.pol.is_network_target("https://uettaxila.edu.pk/"))
        self.assertTrue(self.pol.is_network_target("https://admissions.uettaxila.edu.pk/x"))

    def test_rejects_suffix_in_path(self):
        # A path that happens to contain the suffix is not a host match.
        self.assertFalse(self.pol.is_network_target("https://evil.com/uettaxila.edu.pk"))


class TestStrictMimeRouting(unittest.TestCase):
    """Defect 9: MIME routing must parse the media type, not substring-match."""

    def test_rejects_pdf_in_parameter(self):
        from eval.run_extraction_eval import _looks_like_pdf
        # The old ``any(hint in content_type)`` matched this → True (wrong).
        self.assertFalse(_looks_like_pdf("text/html; note=application/pdf", b""))

    def test_accepts_exact_pdf_types(self):
        from eval.run_extraction_eval import _looks_like_pdf
        self.assertTrue(_looks_like_pdf("application/pdf", b""))
        self.assertTrue(_looks_like_pdf("application/x-pdf", b""))
        self.assertTrue(_looks_like_pdf("application/pdf; charset=binary", b""))

    def test_magic_byte_sniff(self):
        from eval.run_extraction_eval import _looks_like_pdf
        self.assertTrue(_looks_like_pdf("text/html", b"%PDF-1.4 junk"))
        self.assertFalse(_looks_like_pdf("text/html", b"<html>"))

    def test_case_insensitive(self):
        from eval.run_extraction_eval import _looks_like_pdf, _normalized_media_type
        self.assertEqual(_normalized_media_type("Application/PDF"), "application/pdf")
        self.assertTrue(_looks_like_pdf("Application/PDF", b""))


class TestStatusParsing(unittest.TestCase):
    """Defect 5: status coercion must not crash on str/garbage/None, and the
    family classifier must use real body bytes, not stale meta.body_size."""

    def test_parse_status_handles_types(self):
        from eval.run_extraction_eval import _parse_status
        self.assertEqual(_parse_status(200), 200)
        self.assertEqual(_parse_status("200"), 200)
        self.assertEqual(_parse_status(" 404 "), 404)
        self.assertIsNone(_parse_status(None))
        self.assertIsNone(_parse_status("garbage"))
        self.assertIsNone(_parse_status(99))     # below 100
        self.assertIsNone(_parse_status(600))    # above 599
        self.assertIsNone(_parse_status([200]))  # wrong type

    def test_family_uses_real_body_bytes(self):
        from eval.run_extraction_eval import _expected_status_family
        # meta.body_size=0 but body.bin has 100 bytes → must be "success",
        # not "failure" (the old code read the stale meta value).
        fx = {"status": 200, "meta": {"body_size": 0}, "body": b"x" * 100}
        self.assertEqual(_expected_status_family(fx), "success")

    def test_family_204_is_no_content(self):
        from eval.run_extraction_eval import _expected_status_family
        self.assertEqual(_expected_status_family({"status": 204, "body": b""}), "no_content")
        self.assertEqual(_expected_status_family({"status": 205, "body": b""}), "no_content")

    def test_family_no_crash_on_string_status(self):
        from eval.run_extraction_eval import _expected_status_family
        # Defect 5: the old code did ``200 <= status`` on a str → TypeError.
        # The fix coerces numeric strings to int, so "200" → success, "404" →
        # http_error. Only genuinely unparseable statuses (None, "garbage")
        # fall through to "other" without raising.
        self.assertEqual(_expected_status_family({"status": "200", "body": b"x"}), "success")
        self.assertEqual(_expected_status_family({"status": "404", "body": b"x"}), "http_error")
        self.assertEqual(_expected_status_family({"status": None, "body": b"x"}), "other")
        self.assertEqual(_expected_status_family({"status": "garbage", "body": b"x"}), "other")

    def test_family_http_error(self):
        from eval.run_extraction_eval import _expected_status_family
        self.assertEqual(_expected_status_family({"status": 404, "body": b"not found"}), "http_error")
        self.assertEqual(_expected_status_family({"status": 522, "body": b""}), "http_error")


class TestPdfExtractionSurfacesErrors(unittest.TestCase):
    """Defect 8: PDF failures must be visible (structured error_code), not (None,'',[])."""

    def test_invalid_pdf_returns_error_code(self):
        from eval.run_extraction_eval import _extract_pdf
        out = _extract_pdf(b"definitely not a pdf", "https://uettaxila.edu.pk/x.pdf")
        self.assertIsNotNone(out.error_code)
        self.assertEqual(out.markdown, "")
        self.assertIn(out.error_code, {"invalid_pdf", "pymupdf_error"})

    def test_empty_bytes_invalid(self):
        from eval.run_extraction_eval import _extract_pdf
        out = _extract_pdf(b"", "https://uettaxila.edu.pk/x.pdf")
        self.assertIsNotNone(out.error_code)


class TestResultFingerprint(unittest.TestCase):
    """Defect 4: the fingerprint must cover the full result, not just markdown."""

    def test_identical_results_match(self):
        from eval.run_extraction_eval import result_fingerprint
        from html_extractor import HtmlExtractionResult
        r = HtmlExtractionResult(
            canonical_url="https://uettaxila.edu.pk/",
            title="T", markdown="body", crawl_links=["https://a/", "https://b/"],
        )
        self.assertEqual(result_fingerprint(r), result_fingerprint(r))

    def test_none_is_stable(self):
        from eval.run_extraction_eval import result_fingerprint
        from html_extractor import HtmlExtractionResult
        self.assertEqual(result_fingerprint(None), result_fingerprint(None))
        self.assertNotEqual(
            result_fingerprint(None),
            result_fingerprint(HtmlExtractionResult("u", "t", "m", [])),
        )

    def test_title_change_detected(self):
        # content_hash (markdown-only) would MISS this; the fingerprint must catch it.
        from eval.run_extraction_eval import result_fingerprint
        from html_extractor import HtmlExtractionResult
        r1 = HtmlExtractionResult("u", "Title A", "m", [])
        r2 = HtmlExtractionResult("u", "Title B", "m", [])
        self.assertNotEqual(result_fingerprint(r1), result_fingerprint(r2))

    def test_crawl_link_order_does_not_matter(self):
        # Sorted in the payload, so reordering is not a determinism failure.
        from eval.run_extraction_eval import result_fingerprint
        from html_extractor import HtmlExtractionResult
        r1 = HtmlExtractionResult("u", "t", "m", ["https://a/", "https://b/"])
        r2 = HtmlExtractionResult("u", "t", "m", ["https://b/", "https://a/"])
        self.assertEqual(result_fingerprint(r1), result_fingerprint(r2))


class TestRegressionDetection(unittest.TestCase):
    """Defect 7: 'stable' must be reachable; per-fixture comparison must catch
    regressions hidden by the overall average."""

    def _report(self, **kw):
        base = dict(block_recall=0.9, block_precision=0.9, title_accuracy=0.9,
                    link_recall=0.9, link_precision=0.9, canonical_accuracy=0.9,
                    extraction_raises_total=0)
        base.update(kw)
        return {"overall": base, "fixtures": []}

    def test_identical_is_stable(self):
        import json, tempfile, os
        from pathlib import Path
        from eval.run_extraction_eval import detect_regression
        rep = self._report()
        with tempfile.NamedTemporaryFile("w", suffix=".json", delete=False) as f:
            json.dump(rep, f); bp = f.name
        try:
            self.assertEqual(detect_regression(rep, Path(bp))["status"], "stable")
        finally:
            os.unlink(bp)

    def test_regression_detected(self):
        import json, tempfile, os
        from pathlib import Path
        from eval.run_extraction_eval import detect_regression
        cur = self._report(block_recall=0.8)
        with tempfile.NamedTemporaryFile("w", suffix=".json", delete=False) as f:
            json.dump(self._report(block_recall=0.9), f); bp = f.name
        try:
            r = detect_regression(cur, Path(bp))
            self.assertEqual(r["status"], "regressed")
            self.assertTrue(any(x["metric"] == "block_recall" for x in r["regressed"]))
        finally:
            os.unlink(bp)

    def test_improvement_is_improved(self):
        import json, tempfile, os
        from pathlib import Path
        from eval.run_extraction_eval import detect_regression
        cur = self._report(block_recall=0.95)
        with tempfile.NamedTemporaryFile("w", suffix=".json", delete=False) as f:
            json.dump(self._report(block_recall=0.9), f); bp = f.name
        try:
            self.assertEqual(detect_regression(cur, Path(bp))["status"], "improved")
        finally:
            os.unlink(bp)

    def test_raises_increase_is_regression(self):
        import json, tempfile, os
        from pathlib import Path
        from eval.run_extraction_eval import detect_regression
        cur = self._report(extraction_raises_total=2)
        with tempfile.NamedTemporaryFile("w", suffix=".json", delete=False) as f:
            json.dump(self._report(extraction_raises_total=0), f); bp = f.name
        try:
            self.assertEqual(detect_regression(cur, Path(bp))["status"], "regressed")
        finally:
            os.unlink(bp)


class TestPopulationSeparation(unittest.TestCase):
    """Defects 3 & 6: unlabelled and graceful fixtures must not inflate the
    quality rate means. The scorer's vacuous-truth contract (empty expected →
    passed=True) is preserved at the fixture level; the *aggregate* excludes
    them from the denominators."""

    def test_unlabelled_excluded_from_quality_means(self):
        from eval.run_extraction_eval import aggregate
        labelled = {"family": "f", "metrics": {
            **{k: 0.5 for k in
               ("title_accuracy", "canonical_accuracy", "block_recall",
                "block_precision", "link_recall", "link_precision")},
            "extraction_raises": 0, "passed": 1, "determinism_ok": True,
            "population": "labelled",
            "required_blocks_total": 2, "required_blocks_matched": 1,
            "forbidden_blocks_total": 0, "forbidden_blocks_leaked": 0,
            "required_links_total": 0, "required_links_matched": 0,
            "forbidden_links_total": 0, "forbidden_links_leaked": 0,
        }}
        unlabelled = {"family": "f", "metrics": {
            **{k: 1.0 for k in
               ("title_accuracy", "canonical_accuracy", "block_recall",
                "block_precision", "link_recall", "link_precision")},
            "extraction_raises": 0, "passed": 1, "determinism_ok": True,
            "population": "unlabelled",
            "required_blocks_total": 0, "required_blocks_matched": 0,
            "forbidden_blocks_total": 0, "forbidden_blocks_leaked": 0,
            "required_links_total": 0, "required_links_matched": 0,
            "forbidden_links_total": 0, "forbidden_links_leaked": 0,
        }}
        agg = aggregate([labelled, unlabelled])
        # Mean over labelled only → 0.5. The unlabelled 1.0s did not pull it up.
        self.assertEqual(agg["overall"]["block_recall"], 0.5)
        self.assertEqual(agg["overall"]["labelled"], 1)
        self.assertEqual(agg["overall"]["unlabelled"], 1)

    def test_graceful_rates_are_null(self):
        from eval.run_extraction_eval import _graceful_metrics
        m = _graceful_metrics(raised=False, determinism_ok=True, leaked_content=False)
        for k in ("title_accuracy", "block_recall", "block_precision",
                  "link_recall", "link_precision"):
            self.assertIsNone(m[k], f"{k} must be None for graceful fixtures")
        self.assertTrue(m["passed"])
        self.assertTrue(m["graceful_failure"])


class TestScoreFixtureRawCounts(unittest.TestCase):
    """Defect 10: the scorer returns raw counts enabling micro-aggregation."""

    def test_raw_counts_populated(self):
        from eval.extraction_metrics import score_fixture
        m = score_fixture(
            {"expected": {
                "required_text_blocks": [{"text": "a"}, {"text": "b"}, {"text": "c"}],
                "forbidden_text_blocks": ["x", "y"],
                "required_links_contain": ["uettaxila"],
                "forbidden_links_contain": ["logout"],
            }},
            title="t", markdown="a b c",  # 3 of 3 required present
            crawl_links=["https://uettaxila.edu.pk/"],
            resources=[], canonical_url="u", raised=False,
        )
        self.assertEqual(m["required_blocks_total"], 3)
        self.assertEqual(m["required_blocks_matched"], 3)
        self.assertEqual(m["forbidden_blocks_total"], 2)
        self.assertEqual(m["forbidden_blocks_leaked"], 0)
        self.assertEqual(m["required_links_total"], 1)
        self.assertEqual(m["required_links_matched"], 1)
        self.assertEqual(m["forbidden_links_total"], 1)
        self.assertEqual(m["forbidden_links_leaked"], 0)


class TestTypedResourceScoring(unittest.TestCase):
    """Deliverable 2: typed resource expectations (kind/crawlable/nofollow) scored
    separately from the legacy substring link checks. The key contract: a PDF in
    ``crawl_links`` (a bare string) must NOT satisfy a typed ``kind: pdf``
    resource expectation."""

    def _actual(self, **kw):
        base = dict(title="", markdown="", crawl_links=[], resources=[],
                    canonical_url="", raised=False)
        base.update(kw)
        return base

    def test_pdf_in_crawl_links_does_not_satisfy_typed_resource(self):
        # The reviewer's exact concern: a bare crawl_link string cannot satisfy a
        # kind/crawlable spec. Only a typed ``resources`` entry counts.
        m = score_fixture(
            {"expected": {"required_resources": [{"url_contains": "prospectus", "kind": "pdf"}]}},
            **self._actual(crawl_links=["https://uettaxila.edu.pk/prospectus.pdf"], resources=[]),
        )
        self.assertEqual(m["resource_recall"], 0.0)
        self.assertFalse(m["passed"])

    def test_typed_pdf_resource_satisfies_spec(self):
        m = score_fixture(
            {"expected": {"required_resources": [{"url_contains": "prospectus", "kind": "pdf", "crawlable": True}]}},
            **self._actual(resources=[
                {"url": "https://uettaxila.edu.pk/prospectus.pdf", "text": "",
                 "kind": "pdf", "crawlable": True, "nofollow": False}]),
        )
        self.assertEqual(m["resource_recall"], 1.0)
        self.assertTrue(m["passed"])

    def test_kind_mismatch_caught(self):
        # A page-type resource must not satisfy a pdf-kind spec.
        m = score_fixture(
            {"expected": {"required_resources": [{"url_contains": "x", "kind": "pdf"}]}},
            **self._actual(resources=[
                {"url": "https://uettaxila.edu.pk/x", "kind": "page", "crawlable": True, "nofollow": False}]),
        )
        self.assertEqual(m["resource_recall"], 0.0)

    def test_crawlable_mismatch_caught(self):
        m = score_fixture(
            {"expected": {"required_resources": [{"url_contains": "x", "crawlable": True}]}},
            **self._actual(resources=[
                {"url": "https://x.pdf", "kind": "pdf", "crawlable": False, "nofollow": False}]),
        )
        self.assertEqual(m["resource_recall"], 0.0)

    def test_nofollow_mismatch_caught(self):
        m = score_fixture(
            {"expected": {"required_resources": [{"url_contains": "x", "nofollow": False}]}},
            **self._actual(resources=[
                {"url": "https://x.pdf", "kind": "pdf", "crawlable": True, "nofollow": True}]),
        )
        self.assertEqual(m["resource_recall"], 0.0)

    def test_no_typed_expectation_is_vacuous(self):
        # resource_recall is None (not asserted) and does not affect passed.
        m = score_fixture({"expected": {}}, **self._actual())
        self.assertIsNone(m["resource_recall"])
        self.assertTrue(m["passed"])

    def test_forbidden_typed_resource_leaked(self):
        m = score_fixture(
            {"expected": {"forbidden_resources": [{"url_contains": "logout", "kind": "page"}]}},
            **self._actual(resources=[
                {"url": "https://uettaxila.edu.pk/logout", "kind": "page", "crawlable": False, "nofollow": False}]),
        )
        self.assertEqual(m["resource_precision"], 0.0)
        self.assertFalse(m["passed"])

    def test_critical_resource_missing_tracked(self):
        m = score_fixture(
            {"expected": {"required_resources": [
                {"url_contains": "prospectus", "kind": "pdf", "critical": True},
                {"url_contains": "logo", "kind": "image"},
            ]}},
            **self._actual(resources=[]),
        )
        self.assertEqual(m["critical_resources_total"], 1)
        self.assertEqual(m["critical_resources_matched"], 0)
        self.assertIn("prospectus", m["critical_resources_missing"])

    def test_raw_counts_populated(self):
        m = score_fixture(
            {"expected": {"required_resources": [
                {"url_contains": "a", "kind": "pdf"},
                {"url_contains": "b", "kind": "pdf"},
            ]}},
            **self._actual(resources=[
                {"url": "https://a.pdf", "kind": "pdf", "crawlable": True, "nofollow": False}]),
        )
        self.assertEqual(m["required_resources_total"], 2)
        self.assertEqual(m["required_resources_matched"], 1)


class TestImageCandidateScoring(unittest.TestCase):
    """Deliverable 2: image-candidate expectations (alt-text, source prefix)."""

    def test_alt_text_match(self):
        m = score_fixture(
            {"expected": {"required_images": [{"alt_contains": "campus map"}]}},
            title="t", markdown="m", crawl_links=[], resources=[],
            canonical_url="u", raised=False,
            image_candidates=[
                {"url": "https://x/map.png", "alt_text": "the campus map", "context": "", "score": 5.0, "source": "img:src"}],
        )
        self.assertEqual(m["image_recall"], 1.0)

    def test_alt_text_miss(self):
        m = score_fixture(
            {"expected": {"required_images": [{"alt_contains": "campus map"}]}},
            title="t", markdown="m", crawl_links=[], resources=[],
            canonical_url="u", raised=False,
            image_candidates=[
                {"url": "https://x/logo.png", "alt_text": "site logo", "context": "", "score": 1.0, "source": "img:src"}],
        )
        self.assertEqual(m["image_recall"], 0.0)
        self.assertFalse(m["passed"])

    def test_image_floor(self):
        m = score_fixture(
            {"expected": {"image_min_count": 2}},
            title="t", markdown="m", crawl_links=[], resources=[],
            canonical_url="u", raised=False,
            image_candidates=[{"url": "https://x/1.png", "alt_text": "", "context": "", "score": 1.0, "source": "img:src"}],
        )
        self.assertFalse(m["image_floor_ok"])
        self.assertFalse(m["passed"])


class TestGateWeakeningSafeguards(unittest.TestCase):
    """Deliverable 1d: relaxed thresholds require --wip, and --wip is forbidden in CI."""

    def _make_corpus(self, tmpdir):
        import hashlib, json
        from pathlib import Path
        root = Path(tmpdir)
        fx = root / "f" / "ok"
        fx.mkdir(parents=True)
        body = b"<html><head><title>Admissions</title></head><body>fee Rs 4000</body></html>"
        (fx / "body.bin").write_bytes(body)
        (fx / "response-headers.json").write_text(json.dumps({"status": 200, "headers": {"content-type": "text/html"}}))
        (fx / "meta.json").write_text(json.dumps({"content_type": "text/html", "final_url": "https://uettaxila.edu.pk/", "body_sha256": hashlib.sha256(body).hexdigest(), "body_size": len(body)}))
        (fx / "expected.json").write_text(json.dumps({"expected": {"title_contains": ["Admissions"], "required_text_blocks": [{"text": "Rs 4000"}]}}))
        return str(root)

    def test_min_pass_rate_below_one_requires_wip(self):
        import os, tempfile
        from eval.run_extraction_eval import main
        os.environ.pop("CI", None)
        with tempfile.TemporaryDirectory() as td:
            corpus = self._make_corpus(td)
            rc = main(["--corpus", corpus, "--no-determinism", "--min-pass-rate", "0.5"])
            # 0.5 without --wip → rejected (exit 1), even though the fixture passes.
            self.assertEqual(rc, 1)

    def test_min_pass_rate_below_one_allowed_with_wip(self):
        import os, tempfile
        from eval.run_extraction_eval import main
        os.environ.pop("CI", None)
        with tempfile.TemporaryDirectory() as td:
            corpus = self._make_corpus(td)
            rc = main(["--corpus", corpus, "--no-determinism", "--min-pass-rate", "0.5", "--wip"])
            # With --wip and a passing fixture → exit 0.
            self.assertEqual(rc, 0)

    def test_wip_forbidden_in_ci_without_override(self):
        import os, tempfile
        from eval.run_extraction_eval import main
        old_ci = os.environ.get("CI")
        old_override = os.environ.get("ALLOW_WEAK_EXTRACTION_GATE")
        try:
            os.environ["CI"] = "true"
            os.environ.pop("ALLOW_WEAK_EXTRACTION_GATE", None)
            with tempfile.TemporaryDirectory() as td:
                corpus = self._make_corpus(td)
                rc = main(["--corpus", corpus, "--no-determinism", "--wip"])
                self.assertEqual(rc, 1)  # --wip in CI without override → exit 1
        finally:
            if old_ci is None:
                os.environ.pop("CI", None)
            else:
                os.environ["CI"] = old_ci
            if old_override is not None:
                os.environ["ALLOW_WEAK_EXTRACTION_GATE"] = old_override

    def test_wip_allowed_in_ci_with_override(self):
        import os, tempfile
        from eval.run_extraction_eval import main
        old_ci = os.environ.get("CI")
        old_override = os.environ.get("ALLOW_WEAK_EXTRACTION_GATE")
        try:
            os.environ["CI"] = "true"
            os.environ["ALLOW_WEAK_EXTRACTION_GATE"] = "1"
            with tempfile.TemporaryDirectory() as td:
                corpus = self._make_corpus(td)
                rc = main(["--corpus", corpus, "--no-determinism", "--wip"])
                self.assertEqual(rc, 0)  # override permits --wip in CI
        finally:
            if old_ci is None:
                os.environ.pop("CI", None)
            else:
                os.environ["CI"] = old_ci
            if old_override is None:
                os.environ.pop("ALLOW_WEAK_EXTRACTION_GATE", None)
            else:
                os.environ["ALLOW_WEAK_EXTRACTION_GATE"] = old_override

    def test_critical_fixture_failure_exits_two(self):
        # A critical fixture that fails must exit 2 even if overall pass rate is high.
        import os, tempfile, hashlib, json
        from pathlib import Path
        from eval.run_extraction_eval import main
        os.environ.pop("CI", None)
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            fx = root / "f" / "crit"
            fx.mkdir(parents=True)
            body = b"<html><head><title>X</title></head><body>nothing useful</body></html>"
            (fx / "body.bin").write_bytes(body)
            (fx / "response-headers.json").write_text(json.dumps({"status": 200, "headers": {"content-type": "text/html"}}))
            (fx / "meta.json").write_text(json.dumps({"content_type": "text/html", "final_url": "https://uettaxila.edu.pk/", "body_sha256": hashlib.sha256(body).hexdigest(), "body_size": len(body)}))
            # critical fixture expecting a fact that's absent → fails
            (fx / "expected.json").write_text(json.dumps({"expected": {"criticality": "critical", "required_text_blocks": [{"text": "critical deadline"}]}}))
            rc = main(["--corpus", str(root), "--no-determinism"])
            self.assertEqual(rc, 2)

    def test_universe_change_fails_closed_without_accept(self):
        """Deliverable 1.1: a changed corpus universe vs baseline must exit 1
        (fail closed) unless --accept-corpus-change is passed — so removing a
        difficult fixture cannot slip through as a silent metric improvement."""
        import os, shutil, subprocess, sys
        os.environ.pop("CI", None)
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            self._make_corpus(td)  # creates f/ok
            # add a second fixture so the baseline has 2
            fx2 = root / "f" / "ok2"
            fx2.mkdir(parents=True)
            body2 = b"<html><title>Y</title></html>"
            (fx2 / "body.bin").write_bytes(body2)
            import hashlib, json
            (fx2 / "response-headers.json").write_text(json.dumps({"status": 200, "headers": {"content-type": "text/html"}}))
            (fx2 / "meta.json").write_text(json.dumps({"content_type": "text/html", "final_url": "https://uettaxila.edu.pk/", "body_sha256": hashlib.sha256(body2).hexdigest(), "body_size": len(body2)}))
            (fx2 / "expected.json").write_text(json.dumps({"expected": {"title_contains": ["Y"]}}))
            bp = str(root / "base.json")
            subprocess.run([sys.executable, "scripts/eval/run_extraction_eval.py", "--corpus", str(root), "--output", bp, "--no-determinism"], capture_output=True)
            # remove ok2 → universe changes
            shutil.rmtree(fx2)
            from eval.run_extraction_eval import main
            rc = main(["--corpus", str(root), "--baseline", bp, "--no-determinism"])
            self.assertEqual(rc, 1)  # fail closed


class TestCorpusUniverseDiff(unittest.TestCase):
    """Deliverable 1a: a changed corpus universe is surfaced, never silently compared."""

    def test_unchanged_universe(self):
        from eval.corpus_manifest import build_manifest, diff_manifests
        import tempfile
        from pathlib import Path
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            (root / "f" / "a").mkdir(parents=True)
            for fn, content in [("body.bin", b"x"), ("response-headers.json", "{}"),
                                ("meta.json", "{}"), ("expected.json", "{}")]:
                (root / "f" / "a" / fn).write_text(content if fn != "body.bin" else "")
            (root / "f" / "a" / "body.bin").write_bytes(b"x")
            m = build_manifest(root)
            d = diff_manifests(m, m)
            self.assertEqual(d["universe"], "unchanged")


if __name__ == "__main__":
    unittest.main()
