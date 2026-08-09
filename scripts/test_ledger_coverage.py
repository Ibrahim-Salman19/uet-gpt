"""Tests for the per-family ledger-coverage report (Deliverable 2).

The coverage module cross-references the corpus against the real crawl ledger so
a family confirmed in the ledger but absent from the labelled corpus is surfaced
as a gap. These tests build a synthetic sqlite ledger in a tempdir so they're
hermetic and don't depend on the real ``crawl_ledger.sqlite3``.
"""

from __future__ import annotations

import sqlite3
import sys
import tempfile
import unittest
from pathlib import Path

SCRIPTS = Path(__file__).resolve().parent
if str(SCRIPTS) not in sys.path:
    sys.path.insert(0, str(SCRIPTS))

from eval.ledger_coverage import (  # noqa: E402
    build_coverage_report,
    classify_ledger_url,
)


# ── URL classification ───────────────────────────────────────────────────────


class TestClassifyLedgerUrl(unittest.TestCase):
    def test_admissions_subdomain(self):
        self.assertEqual(
            classify_ledger_url("https://admissions.uettaxila.edu.pk/FAQS.php"),
            "admissions",
        )

    def test_fms_subdomain(self):
        self.assertEqual(
            classify_ledger_url("https://fms.uettaxila.edu.pk/Profile/x"),
            "fms",
        )

    def test_main_root_apex(self):
        self.assertEqual(classify_ledger_url("https://uettaxila.edu.pk/"), "main-root")
        self.assertEqual(
            classify_ledger_url("https://www.uettaxila.edu.pk/"), "main-root"
        )

    def test_web_asp_vs_aspx_vs_other(self):
        self.assertEqual(
            classify_ledger_url("https://web.uettaxila.edu.pk/cped/courses_UG.asp"),
            "web-asp",
        )
        self.assertEqual(
            classify_ledger_url("https://web.uettaxila.edu.pk/Sports.aspx"),
            "web-aspx",
        )
        self.assertEqual(
            classify_ledger_url("https://web.uettaxila.edu.pk/itc/"), "web-other"
        )

    def test_pdf_is_host_agnostic(self):
        self.assertEqual(
            classify_ledger_url("https://admissions.uettaxila.edu.pk/Downloads/x.pdf"),
            "pdf",
        )
        self.assertEqual(
            classify_ledger_url("https://web.uettaxila.edu.pk/Downloads/y.pdf"),
            "pdf",
        )

    def test_mis_subdomain_is_aspx(self):
        self.assertEqual(
            classify_ledger_url("https://mis.uettaxila.edu.pk/Alumni/Home/Default.aspx"),
            "web-aspx",
        )

    def test_unknown_host_is_other(self):
        self.assertEqual(
            classify_ledger_url("https://entrytest.uettaxila.edu.pk/"), "other"
        )


# ── Coverage report ──────────────────────────────────────────────────────────


def _make_ledger(tmpdir: Path, rows: list[tuple[str, str, int]]) -> Path:
    """Create a synthetic crawl_ledger.sqlite3 with the given (url, state, word_count)."""
    path = tmpdir / "crawl_ledger.sqlite3"
    con = sqlite3.connect(str(path))
    con.execute(
        "CREATE TABLE crawl_urls (url TEXT, state TEXT, word_count INTEGER)"
    )
    con.executemany(
        "INSERT INTO crawl_urls (url, state, word_count) VALUES (?, ?, ?)",
        rows,
    )
    con.commit()
    con.close()
    return path


class TestBuildCoverageReport(unittest.TestCase):
    def test_returns_none_when_ledger_absent(self):
        """CI ships only the corpus — the ledger may be absent. The block is
        omitted (None) rather than degraded or erroring."""
        with tempfile.TemporaryDirectory() as td:
            cov = build_coverage_report(
                corpus_root=Path(td),
                ledger_path=Path(td) / "nonexistent.sqlite3",
                per_family_stats={},
            )
        self.assertIsNone(cov)

    def test_gap_family_surfaced(self):
        """A ledger family with ingested content but no labelled corpus fixture
        must appear in coverage_gaps — the directive's core requirement."""
        with tempfile.TemporaryDirectory() as td:
            ledger = _make_ledger(
                Path(td),
                [
                    # web-other: 3 ingested, but the corpus has NO web-other family
                    ("https://web.uettaxila.edu.pk/itc/", "ingested", 500),
                    ("https://web.uettaxila.edu.pk/civil/", "ingested", 300),
                    ("https://web.uettaxila.edu.pk/civil/", "discovered", 0),
                    # admissions: 1 ingested, corpus has a labelled admissions-php family
                    ("https://admissions.uettaxila.edu.pk/FAQS.php", "ingested", 800),
                ],
            )
            per_family = {
                "admissions-php": {"fixtures": 6, "labelled": 6, "assertion_count": 25},
                # NOTE: no "web-other" corpus family here
            }
            cov = build_coverage_report(
                corpus_root=Path(td),
                ledger_path=ledger,
                per_family_stats=per_family,
            )
        self.assertIsNotNone(cov)
        fams = {f["ledger_family"]: f for f in cov["families"]}
        # web-other has ingested content (2) but no corpus representation
        self.assertEqual(fams["web-other"]["ledger_ingested_ok"], 2)
        self.assertEqual(fams["web-other"]["corpus_fixtures"], 0)
        self.assertFalse(fams["web-other"]["labelled"])
        self.assertIn("web-other", cov["coverage_gaps"])
        # admissions is represented + labelled
        self.assertTrue(fams["admissions"]["labelled"])
        self.assertNotIn("admissions", cov["coverage_gaps"])

    def test_discovered_only_not_a_gap(self):
        """A family with only 'discovered' (not 'ingested') URLs is not a real
        coverage gap — there's no confirmed crawlable content to represent."""
        with tempfile.TemporaryDirectory() as td:
            ledger = _make_ledger(
                Path(td),
                [
                    ("https://web.uettaxila.edu.pk/x/", "discovered", 0),
                    ("https://web.uettaxila.edu.pk/y/", "discovered", 0),
                ],
            )
            cov = build_coverage_report(
                corpus_root=Path(td),
                ledger_path=ledger,
                per_family_stats={},
            )
        fams = {f["ledger_family"]: f for f in cov["families"]}
        self.assertEqual(fams["web-other"]["ledger_ingested_ok"], 0)
        self.assertNotIn("web-other", cov["coverage_gaps"])

    def test_corpus_family_attracts_correct_ledger_family(self):
        """The corpus→ledger map must attribute corpus fixtures to the right
        ledger family (e.g. legacy-asp → web-asp, not web-other)."""
        with tempfile.TemporaryDirectory() as td:
            ledger = _make_ledger(
                Path(td),
                [
                    ("https://web.uettaxila.edu.pk/cped/courses_UG.asp", "ingested", 400),
                    ("https://web.uettaxila.edu.pk/itc/", "ingested", 200),
                ],
            )
            per_family = {
                "legacy-asp": {"fixtures": 6, "labelled": 3, "assertion_count": 7},
            }
            cov = build_coverage_report(
                corpus_root=Path(td),
                ledger_path=ledger,
                per_family_stats=per_family,
            )
        fams = {f["ledger_family"]: f for f in cov["families"]}
        # legacy-asp corpus family represents the web-asp ledger family
        self.assertEqual(fams["web-asp"]["corpus_families"], ["legacy-asp"])
        self.assertEqual(fams["web-asp"]["corpus_fixtures"], 6)
        self.assertEqual(fams["web-asp"]["corpus_labelled"], 3)
        self.assertTrue(fams["web-asp"]["labelled"])
        # web-other has content but no representing corpus family
        self.assertFalse(fams["web-other"]["labelled"])
        self.assertIn("web-other", cov["coverage_gaps"])

    def test_totals_sum_across_families(self):
        with tempfile.TemporaryDirectory() as td:
            ledger = _make_ledger(
                Path(td),
                [
                    ("https://admissions.uettaxila.edu.pk/a", "ingested", 100),
                    ("https://fms.uettaxila.edu.pk/b", "ingested", 100),
                    ("https://uettaxila.edu.pk/", "discovered", 0),
                ],
            )
            cov = build_coverage_report(
                corpus_root=Path(td),
                ledger_path=ledger,
                per_family_stats={},
            )
        self.assertEqual(cov["ledger_total_urls"], 3)
        self.assertEqual(cov["ledger_ingested_ok"], 2)


if __name__ == "__main__":
    unittest.main()
