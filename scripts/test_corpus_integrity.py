"""Integrity tests for the captured corpus.

Every fixture must be a complete, internally-consistent unit:
  - body.bin sha256 matches meta.json.body_sha256
  - the required artifact files all exist
  - expected.json is valid JSON with the expected top-level shape
  - MANIFEST.json agrees with the fixtures on disk

Run from the repository root::

    python -m pytest scripts/test_corpus_integrity.py -v
    # or:
    python scripts/test_corpus_integrity.py
"""

from __future__ import annotations

import hashlib
import json
import sys
import unittest
from pathlib import Path

SCRIPTS = Path(__file__).resolve().parent
CORPUS = SCRIPTS / "corpus" / "fixtures"
MANIFEST = SCRIPTS / "corpus" / "MANIFEST.json"


def _iter_fixtures(root: Path):
    if not root.exists():
        return
    for meta in sorted(root.glob("*/*/meta.json")):
        yield meta.parent


REQUIRED_FILES = ("request.json", "response-headers.json", "body.bin", "meta.json")


class TestCorpusIntegrity(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.fixtures = list(_iter_fixtures(CORPUS))
        # Fail loudly (but as a skipped test, not an error) if the corpus was
        # never captured — running these tests on a fresh clone is meaningful.
        if not cls.fixtures:
            raise unittest.SkipTest(
                "No fixtures found under scripts/corpus/fixtures. "
                "Run: python scripts/corpus/capture.py"
            )

    def test_every_fixture_has_required_files(self):
        for d in self.fixtures:
            for name in REQUIRED_FILES:
                self.assertTrue((d / name).exists(), f"missing {name} in {d}")

    def test_body_sha256_matches_meta(self):
        for d in self.fixtures:
            meta = json.loads((d / "meta.json").read_text(encoding="utf-8"))
            body = (d / "body.bin").read_bytes()
            actual = hashlib.sha256(body).hexdigest()
            self.assertEqual(
                actual, meta["body_sha256"],
                f"sha256 mismatch in {d.name}: body changed after meta was written",
            )
            self.assertEqual(meta["body_size"], len(body))

    def test_expected_json_well_formed(self):
        for d in self.fixtures:
            exp_p = d / "expected.json"
            self.assertTrue(exp_p.exists(), f"missing expected.json in {d}")
            data = json.loads(exp_p.read_text(encoding="utf-8"))
            self.assertIn("expected", data, f"{d}: expected.json must have an 'expected' object")
            exp = data["expected"]
            # A no-content fixture (e.g. a 404/522 capture) only needs the
            # explicit outcome marker — it asserts the extractor produces
            # nothing and does not raise. Every other fixture must carry the
            # full assertion-key set so the scorer has a well-formed contract.
            if str(exp.get("outcome", "")).lower() == "no_content":
                self.assertNotIn(
                    "required_text_blocks", exp,
                    f"{d}: no_content fixtures must not also assert required_text_blocks "
                    "(they expect no extraction)",
                )
                continue
            for key in ("title_contains", "title_not_contains", "required_text_blocks",
                        "forbidden_text_blocks", "required_links_contain",
                        "forbidden_links_contain", "resource_min_count"):
                self.assertIn(key, exp, f"{d}: expected.{key} missing")
            # required_text_blocks entries must be {text, why} or strings
            for block in exp["required_text_blocks"]:
                if isinstance(block, dict):
                    self.assertIn("text", block, f"{d}: required_text_blocks entry without 'text'")

    def test_manifest_agrees_with_disk(self):
        if not MANIFEST.exists():
            self.skipTest("MANIFEST.json not yet generated.")
        manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
        on_disk = {f"{d.parent.name}/{d.name}" for d in self.fixtures}
        manifest_ids = {f["fixture_id"] for f in manifest.get("fixtures", [])}
        self.assertEqual(
            on_disk, manifest_ids,
            "MANIFEST.json is out of sync with fixtures on disk — re-run capture.py",
        )
        # Per-family counts agree.
        from collections import Counter
        disk_counts = Counter(d.parent.name for d in self.fixtures)
        self.assertEqual(dict(manifest["families"]), dict(disk_counts))

    def test_no_content_fixtures_are_explicit(self):
        """Dead-link fixtures must declare ``outcome: no_content`` explicitly.

        This guards the defect-6 fix: graceful failure must not be *inferred*
        from empty expectations (that inflated quality scores), it must be an
        explicit declaration. If a 4xx/5xx/empty fixture is found without the
        marker, the migration was reverted or a new dead-link fixture was added
        without the marker.
        """
        for d in self.fixtures:
            headers = json.loads((d / "response-headers.json").read_text(encoding="utf-8"))
            status = headers.get("status")
            if not (isinstance(status, int) and status >= 400):
                continue
            exp = json.loads((d / "expected.json").read_text(encoding="utf-8"))["expected"]
            self.assertEqual(
                str(exp.get("outcome", "")).lower(), "no_content",
                f"{d}: status {status} fixture must declare expected.outcome='no_content' "
                "explicitly (defect 6: graceful failure must not be inferred)",
            )

    def test_criticality_is_valid_enum_when_present(self):
        """``expected.criticality`` (Deliverable 1c) must be in the small enum."""
        valid = {"critical", "standard", "diagnostic"}
        for d in self.fixtures:
            data = json.loads((d / "expected.json").read_text(encoding="utf-8"))
            exp = data.get("expected", {})
            crit = exp.get("criticality")
            if crit is not None:
                self.assertIn(
                    crit, valid,
                    f"{d}: criticality {crit!r} not in {valid}",
                )

    def test_max_duration_ms_positive_when_present(self):
        """``expected.max_duration_ms`` (Deliverable 1b timeout tier) must be a positive int."""
        for d in self.fixtures:
            data = json.loads((d / "expected.json").read_text(encoding="utf-8"))
            exp = data.get("expected", {})
            mdm = exp.get("max_duration_ms")
            if mdm is not None:
                self.assertIsInstance(
                    mdm, int, f"{d}: max_duration_ms must be an int, got {type(mdm).__name__}")
                self.assertGreater(mdm, 0, f"{d}: max_duration_ms must be positive")


if __name__ == "__main__":
    unittest.main()
