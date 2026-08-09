"""Tests for the corpus identity manifest (Deliverable 1a).

The manifest is the content-addressed fingerprint of the evaluation universe —
its core contract is that any add/remove/body-change/expectation-change/
criticality-change alters ``corpus_manifest_hash``. These tests build synthetic
fixture trees in a tempdir so they're hermetic and don't touch the real corpus.
"""

from __future__ import annotations

import hashlib
import json
import sys
import tempfile
import unittest
from pathlib import Path

SCRIPTS = Path(__file__).resolve().parent
if str(SCRIPTS) not in sys.path:
    sys.path.insert(0, str(SCRIPTS))

from eval.corpus_manifest import build_manifest, diff_manifests, EVALUATION_SCHEMA_VERSION  # noqa: E402


def _make_fixture(root: Path, family: str, slug: str, *, body: bytes = b"<html></html>",
                  headers: dict | None = None, meta: dict | None = None,
                  expected: dict | None = None, criticality: str | None = None) -> Path:
    d = root / family / slug
    d.mkdir(parents=True, exist_ok=True)
    (d / "body.bin").write_bytes(body)
    (d / "response-headers.json").write_text(json.dumps(headers or {"status": 200, "headers": {}}))
    (d / "meta.json").write_text(json.dumps(meta or {"final_url": "https://x/", "body_sha256": hashlib.sha256(body).hexdigest(), "body_size": len(body)}))
    exp = expected or {}
    if criticality:
        exp.setdefault("expected", {})["criticality"] = criticality
    (d / "expected.json").write_text(json.dumps(exp or {"expected": {"title_contains": []}}))
    return d


class TestCorpusManifest(unittest.TestCase):
    def test_stable_across_calls(self):
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            _make_fixture(root, "f", "a")
            m1 = build_manifest(root)
            m2 = build_manifest(root)
            self.assertEqual(m1["corpus_manifest_hash"], m2["corpus_manifest_hash"])

    def test_schema_version(self):
        with tempfile.TemporaryDirectory() as td:
            m = build_manifest(Path(td))
            self.assertEqual(m["evaluation_schema_version"], EVALUATION_SCHEMA_VERSION)

    def test_removing_fixture_changes_hash(self):
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            _make_fixture(root, "f", "a")
            _make_fixture(root, "f", "b")
            m1 = build_manifest(root)
            # remove fixture b
            import shutil
            shutil.rmtree(root / "f" / "b")
            m2 = build_manifest(root)
            self.assertNotEqual(m1["corpus_manifest_hash"], m2["corpus_manifest_hash"])

    def test_adding_fixture_changes_hash(self):
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            _make_fixture(root, "f", "a")
            m1 = build_manifest(root)
            _make_fixture(root, "f", "b")
            m2 = build_manifest(root)
            self.assertNotEqual(m1["corpus_manifest_hash"], m2["corpus_manifest_hash"])

    def test_editing_body_changes_hash(self):
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            _make_fixture(root, "f", "a", body=b"original")
            m1 = build_manifest(root)
            (root / "f" / "a" / "body.bin").write_bytes(b"changed")
            m2 = build_manifest(root)
            self.assertNotEqual(m1["corpus_manifest_hash"], m2["corpus_manifest_hash"])

    def test_editing_expected_changes_hash(self):
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            _make_fixture(root, "f", "a")
            m1 = build_manifest(root)
            # rewrite expected.json with different content
            (root / "f" / "a" / "expected.json").write_text(
                json.dumps({"expected": {"title_contains": ["Different"]}}))
            m2 = build_manifest(root)
            self.assertNotEqual(m1["corpus_manifest_hash"], m2["corpus_manifest_hash"])

    def test_changing_criticality_changes_hash(self):
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            _make_fixture(root, "f", "a", criticality="standard")
            m1 = build_manifest(root)
            # bump to critical
            (root / "f" / "a" / "expected.json").write_text(
                json.dumps({"expected": {"criticality": "critical"}}))
            m2 = build_manifest(root)
            self.assertNotEqual(m1["corpus_manifest_hash"], m2["corpus_manifest_hash"])

    def test_malformed_fixture_yields_null_hashes_no_crash(self):
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            # fixture dir with ONLY meta.json (missing body.bin, headers, expected)
            (root / "f" / "broken").mkdir(parents=True)
            (root / "f" / "broken" / "meta.json").write_text("{}")
            m = build_manifest(root)
            entry = m["fixtures"][0]
            self.assertIsNone(entry["body_sha256"])
            self.assertIsNone(entry["headers_sha256"])
            self.assertEqual(entry["criticality"], "standard")  # default

    def test_diff_unchanged(self):
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            _make_fixture(root, "f", "a")
            m = build_manifest(root)
            d = diff_manifests(m, m)
            self.assertEqual(d["universe"], "unchanged")

    def test_diff_removed_added_changed(self):
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            _make_fixture(root, "f", "a", body=b"a")
            _make_fixture(root, "f", "b", body=b"b")
            base = build_manifest(root)
            # remove b, change a's body, add c
            import shutil
            shutil.rmtree(root / "f" / "b")
            (root / "f" / "a" / "body.bin").write_bytes(b"changed")
            _make_fixture(root, "f", "c", body=b"c")
            cur = build_manifest(root)
            d = diff_manifests(cur, base)
            self.assertEqual(d["universe"], "changed")
            self.assertEqual(d["removed"], ["f/b"])
            self.assertEqual(d["added"], ["f/c"])
            changed_fields = {c["fixture_id"] for c in d["changed"]}
            self.assertIn("f/a", changed_fields)

    def test_diff_unknown_when_baseline_lacks_hash(self):
        with tempfile.TemporaryDirectory() as td:
            m = build_manifest(Path(td))
            d = diff_manifests(m, {})  # baseline has no corpus_manifest
            self.assertEqual(d["universe"], "unknown")


if __name__ == "__main__":
    unittest.main()
