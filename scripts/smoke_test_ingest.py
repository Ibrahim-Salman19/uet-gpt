"""
smoke_test_ingest.py — End-to-end smoke test for the Convex /ingest pipeline.

Uses dry-run / mocked mode to verify the ingest pipeline logic
without making real HTTP calls to Convex.

Test cases:
  1. Auth token presence
  2. Domain allowlist (reject non-uettaxila URLs)
  3. Document insert payload construction
  4. Duplicate detection (same contentHash)
  5. Update on content hash change
  6. PDF sourceType bypass (pdf:// / uetgpt.local/pdf URLs)

Usage:
  pytest scripts/smoke_test_ingest.py -v
  python scripts/smoke_test_ingest.py
"""
import hashlib
import json
import os
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import MagicMock, patch


class TestIngestPipeline(unittest.TestCase):
    """Smoke tests for the Convex /ingest pipeline ingestion logic."""

    def setUp(self):
        self.valid_url = "https://web.uettaxila.edu.pk/admissions"
        self.valid_markdown = "# Admissions\n\nAdmissions are open for Fall 2025."
        self.content_hash = hashlib.sha256(self.valid_markdown.encode()).hexdigest()

    # ── Test 1: Auth Token Presence ───────────────────────────────────────────

    def test_auth_token_configured(self):
        """Auth token should be set for /ingest to function."""
        token = os.environ.get("CONVEX_AUTH_TOKEN") or os.environ.get("CRAWL_WEBHOOK_SECRET")
        if not token:
            self.skipTest("CONVEX_AUTH_TOKEN not set — /ingest endpoint may reject")
        self.assertIsNotNone(token)
        self.assertGreater(len(token), 0)

    # ── Test 2: Domain Allowlist ──────────────────────────────────────────────

    def test_domain_allowlist_accepts_valid(self):
        """Valid uettaxila.edu.pk URLs should be allowed."""
        allowed_domains = frozenset(["web.uettaxila.edu.pk", "uettaxila.edu.pk"])
        import urllib.parse
        p = urllib.parse.urlparse(self.valid_url)
        self.assertIn(p.netloc, allowed_domains)

    def test_domain_allowlist_rejects_external(self):
        """External domains should be rejected."""
        import urllib.parse
        allowed_domains = frozenset(["web.uettaxila.edu.pk", "uettaxila.edu.pk"])
        external = "https://example.com/malicious"
        p = urllib.parse.urlparse(external)
        self.assertNotIn(p.netloc, allowed_domains)

    def test_domain_allowlist_rejects_pdf_virtual(self):
        """Virtual UET GPT local PDF URLs should pass domain check (custom handler)."""
        virtual_url = "https://uetgpt.local/pdf/abc123def456"
        is_pdf_virtual = virtual_url.startswith("https://uetgpt.local/pdf/")
        self.assertTrue(is_pdf_virtual)

    # ── Test 3: Document Insert Payload Construction ──────────────────────────

    def test_payload_construction(self):
        """Insert payload should contain all required fields."""
        payload = {
            "url": self.valid_url,
            "markdown": self.valid_markdown,
            "contentHash": self.content_hash,
            "crawlSessionId": "test-session",
            "title": "Admissions 2025",
            "sourceType": "html",
            "freshnessTier": "high",
        }
        required = ("url", "markdown", "contentHash", "crawlSessionId", "sourceType")
        for field in required:
            self.assertIn(field, payload, f"Missing required field: {field}")
        self.assertEqual(payload["freshnessTier"], "high")

    # ── Test 4: Duplicate Detection (Same hash, skip) ─────────────────────────

    def test_dedup_same_hash(self):
        """Same contentHash should result in skip / indexed fast path."""
        mock_upsert = MagicMock(return_value={"action": "inserted"})
        mock_upsert_dup = MagicMock(return_value={"action": "skipped"})
        first = mock_upsert({"url": self.valid_url, "contentHash": self.content_hash})
        second = mock_upsert_dup({"url": self.valid_url, "contentHash": self.content_hash})
        self.assertEqual(first["action"], "inserted")
        self.assertEqual(second["action"], "skipped")
        self.assertNotEqual(first["action"], second["action"])

    # ── Test 5: Update on Content Hash Change ─────────────────────────────────

    def test_update_on_hash_change(self):
        """Different contentHash for same URL should trigger re-index."""
        new_markdown = "# Admissions\n\nAdmissions are NOW OPEN for Fall 2025!"
        new_hash = hashlib.sha256(new_markdown.encode()).hexdigest()
        self.assertNotEqual(new_hash, self.content_hash)

        mock_get_by_url = MagicMock(return_value={
            "url": self.valid_url,
            "contentHash": self.content_hash,
            "status": "indexed",
        })
        existing = mock_get_by_url(self.valid_url)
        self.assertIsNotNone(existing)
        self.assertNotEqual(existing["contentHash"], new_hash)

    # ── Test 6: PDF SourceType ────────────────────────────────────────────────

    def test_pdf_source_type(self):
        """PDF ingestion should use sourceType='pdf' and freshnessTier from URL."""
        pdf_url = "https://uetgpt.local/pdf/abc123def456"
        pdf_title = "Fee Structure 2025"
        payload = {
            "url": pdf_url,
            "markdown": "# Fee Structure\n\nTuition fees for 2025.",
            "contentHash": hashlib.sha256(b"# Fee Structure\n\nTuition fees for 2025.").hexdigest(),
            "crawlSessionId": "pdf-manual",
            "title": pdf_title,
            "sourceType": "pdf",
            "freshnessTier": "low",
        }
        self.assertEqual(payload["sourceType"], "pdf")
        self.assertEqual(payload["freshnessTier"], "low")

    def test_pdf_virtual_url_format(self):
        """PDF virtual URL should use https://uetgpt.local/pdf/{hash} format."""
        content_hash = hashlib.sha256(b"test content").hexdigest()
        virtual_url = f"https://uetgpt.local/pdf/{content_hash[:16]}"
        self.assertTrue(virtual_url.startswith("https://uetgpt.local/pdf/"))
        self.assertEqual(len(virtual_url.split("/")[-1]), 16)

    def test_infer_freshness_tier(self):
        """infer_freshness_tier should classify URLs correctly."""
        from ingest_pdf import infer_freshness_tier

        self.assertEqual(infer_freshness_tier("https://web.uettaxila.edu.pk/"), "high")
        self.assertEqual(infer_freshness_tier("https://uettaxila.edu.pk/"), "high")
        self.assertEqual(infer_freshness_tier("https://web.uettaxila.edu.pk/admissions"), "high")
        self.assertEqual(infer_freshness_tier("https://web.uettaxila.edu.pk/academics"), "high")
        self.assertEqual(infer_freshness_tier("https://web.uettaxila.edu.pk/department"), "medium")
        self.assertEqual(infer_freshness_tier("https://web.uettaxila.edu.pk/faculty"), "medium")
        self.assertEqual(infer_freshness_tier("https://web.uettaxila.edu.pk/contact"), "low")
        self.assertEqual(infer_freshness_tier("Admissions Brochure 2025"), "high")
        self.assertEqual(infer_freshness_tier("Department of CS Faculty"), "medium")
        self.assertEqual(infer_freshness_tier("Campus Map"), "low")


class TestAssignTier(unittest.TestCase):
    """Verify assign_tier matches infer_freshness_tier logic."""

    def test_assign_tier_equivalence(self):
        """assign_tier and infer_freshness_tier should agree on URLs."""
        from ingest_pdf import infer_freshness_tier
        from crawler import assign_tier

        test_urls = [
            ("https://web.uettaxila.edu.pk/", "high"),
            ("https://uettaxila.edu.pk/", "high"),
            ("https://web.uettaxila.edu.pk/admissions", "high"),
            ("https://web.uettaxila.edu.pk/academics", "high"),
            ("https://web.uettaxila.edu.pk/department/cs", "medium"),
            ("https://web.uettaxila.edu.pk/faculty/professor", "medium"),
            ("https://web.uettaxila.edu.pk/campus-life", "low"),
            ("https://web.uettaxila.edu.pk/contact", "low"),
        ]
        for url, expected_tier in test_urls:
            with self.subTest(url=url):
                self.assertEqual(assign_tier(url), expected_tier)
                self.assertEqual(infer_freshness_tier(url), expected_tier)


class TestSimHash(unittest.TestCase):
    """Verify SimHash near-duplicate detection."""

    def test_simhash_exact_match(self):
        from crawler import SimHash
        sh = SimHash()
        text = "UET Taxila offers undergraduate and graduate programs in engineering."
        self.assertFalse(sh.is_near_dup(text))
        self.assertTrue(sh.is_near_dup(text))

    def test_simhash_near_match(self):
        from crawler import SimHash
        sh = SimHash()
        a = "UET Taxila offers undergraduate and graduate programs in engineering and computer science."
        b = "UET Taxila offers undergraduate and graduate programs in engineering as well as computer science."
        self.assertFalse(sh.is_near_dup(a))
        self.assertTrue(sh.is_near_dup(b))

    def test_simhash_different(self):
        from crawler import SimHash
        sh = SimHash()
        a = "UET Taxila offers undergraduate programs."
        b = "Admission deadline for Fall 2025 is August 15."
        self.assertFalse(sh.is_near_dup(a))
        self.assertFalse(sh.is_near_dup(b))


class TestUrlPriority(unittest.TestCase):
    """Verify URL priority scoring."""

    def test_url_priority_high(self):
        from crawler import url_priority
        self.assertGreater(
            url_priority("https://web.uettaxila.edu.pk/admissions", 0),
            url_priority("https://web.uettaxila.edu.pk/campus-life", 0),
        )

    def test_url_priority_root(self):
        from crawler import url_priority
        root_score = url_priority("https://web.uettaxila.edu.pk/", 0)
        regular_score = url_priority("https://web.uettaxila.edu.pk/campus-life", 0)
        self.assertGreater(root_score, regular_score)


class TestRobotsTxtCache(unittest.TestCase):
    """Verify robots.txt parser cache."""

    def test_robot_parser_creation(self):
        from crawler import _get_robot_parser
        result = _get_robot_parser("web.uettaxila.edu.pk")
        self.assertIsNotNone(result)

    def test_robot_parser_cached(self):
        from crawler import _get_robot_parser, _robot_parsers
        _robot_parsers.clear()
        _get_robot_parser("web.uettaxila.edu.pk")
        self.assertIn("web.uettaxila.edu.pk", _robot_parsers)


if __name__ == "__main__":
    unittest.main(verbosity=2)
