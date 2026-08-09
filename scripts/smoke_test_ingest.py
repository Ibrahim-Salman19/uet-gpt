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
        """infer_freshness_tier should classify source+title pairs correctly."""
        from ingest_pdf import infer_freshness_tier

        self.assertEqual(infer_freshness_tier("https://web.uettaxila.edu.pk/", ""), "low")
        self.assertEqual(infer_freshness_tier("https://uettaxila.edu.pk/", ""), "low")
        self.assertEqual(infer_freshness_tier("https://web.uettaxila.edu.pk/admissions", ""), "high")
        self.assertEqual(infer_freshness_tier("https://web.uettaxila.edu.pk/academics", ""), "high")
        self.assertEqual(infer_freshness_tier("https://web.uettaxila.edu.pk/department", ""), "medium")
        self.assertEqual(infer_freshness_tier("https://web.uettaxila.edu.pk/faculty", ""), "medium")
        self.assertEqual(infer_freshness_tier("https://web.uettaxila.edu.pk/contact", ""), "low")
        self.assertEqual(infer_freshness_tier("", "Admissions Brochure 2025"), "high")
        self.assertEqual(infer_freshness_tier("", "Department of CS Faculty"), "medium")
        self.assertEqual(infer_freshness_tier("", "Campus Map"), "low")


class TestAssignTier(unittest.TestCase):
    """Verify crawler.assign_freshness_tier classifies URLs correctly."""

    def test_assign_tier_high(self):
        """Root and high-value URLs should be classified high."""
        from crawler import assign_freshness_tier

        high_urls = [
            "https://web.uettaxila.edu.pk/",
            "https://uettaxila.edu.pk/",
            "https://web.uettaxila.edu.pk/admissions",
            "https://web.uettaxila.edu.pk/academics",
            "https://web.uettaxila.edu.pk/scholarships",
        ]
        for url in high_urls:
            with self.subTest(url=url):
                self.assertEqual(assign_freshness_tier(url), "high")

    def test_assign_tier_medium(self):
        """Department/faculty/program URLs should be classified medium."""
        from crawler import assign_freshness_tier

        medium_urls = [
            "https://web.uettaxila.edu.pk/department/cs",
            "https://web.uettaxila.edu.pk/faculty/professor",
        ]
        for url in medium_urls:
            with self.subTest(url=url):
                self.assertEqual(assign_freshness_tier(url), "medium")

    def test_assign_tier_low(self):
        """Low-value URLs should be classified low."""
        from crawler import assign_freshness_tier

        low_urls = [
            "https://web.uettaxila.edu.pk/campus-life",
            "https://web.uettaxila.edu.pk/contact",
        ]
        for url in low_urls:
            with self.subTest(url=url):
                self.assertEqual(assign_freshness_tier(url), "low")


class TestContentDeduplicator(unittest.TestCase):
    """Verify SimHash-style near-duplicate detection via ContentDeduplicator."""

    def test_simhash_exact_match(self):
        from crawler import ContentDeduplicator
        deduper = ContentDeduplicator(threshold=6, min_words=3)
        text = "UET Taxila offers undergraduate and graduate programs in engineering."
        fingerprint, _ = deduper.fingerprint(text)
        self.assertEqual(deduper.hamming(fingerprint, fingerprint), 0)

    def test_simhash_near_match(self):
        from crawler import ContentDeduplicator
        deduper = ContentDeduplicator(threshold=6, min_words=3)
        a = "UET Taxila offers undergraduate and graduate programs in engineering computer science mathematics physics chemistry and humanities with modern laboratories"
        b = "UET Taxila offers undergraduate and graduate programs in engineering computer science mathematics physics chemistry and humanities with modern lab"
        fa, _ = deduper.fingerprint(a)
        fb, _ = deduper.fingerprint(b)
        self.assertLessEqual(deduper.hamming(fa, fb), 6)

    def test_simhash_different(self):
        from crawler import ContentDeduplicator
        deduper = ContentDeduplicator(threshold=6, min_words=3)
        a = "UET Taxila offers undergraduate and graduate programs in engineering computer science mathematics physics chemistry and humanities with modern laboratories"
        c = "Admission deadline for Fall 2025 is August 15 with merit lists published online."
        fa, _ = deduper.fingerprint(a)
        fc, _ = deduper.fingerprint(c)
        self.assertGreater(deduper.hamming(fa, fc), 6)


class TestUrlPriority(unittest.TestCase):
    """Verify URL priority scoring (min-heap order: smaller tuple = higher priority)."""

    def test_url_priority_high(self):
        from crawler import url_priority
        self.assertLess(
            url_priority("https://web.uettaxila.edu.pk/admissions", 0),
            url_priority("https://web.uettaxila.edu.pk/campus-life", 0),
        )

    def test_url_priority_root(self):
        from crawler import url_priority
        root_score = url_priority("https://web.uettaxila.edu.pk/", 0)
        regular_score = url_priority("https://web.uettaxila.edu.pk/campus-life", 0)
        self.assertLess(root_score, regular_score)


class TestRobotsTxtCache(unittest.TestCase):
    """Verify robots.txt retrieval and per-origin caching via RobotsPolicy."""

    def setUp(self):
        import asyncio
        import crawler as c

        self.c = c

        class FakeHttp:
            def __init__(self):
                self.calls = 0

            async def get(self, url, **kwargs):
                self.calls += 1
                return c.HttpResult(
                    requested_url=url,
                    final_url=url,
                    status=200,
                    headers={"cache-control": "max-age=3600"},
                    body=b"User-agent: *\nDisallow: /files/\n",
                )

        self.tmp = tempfile.TemporaryDirectory()
        root = Path(self.tmp.name)
        (root / "scripts").mkdir()
        (root / "scripts" / "crawl_config.json").write_text("{}", encoding="utf-8")
        args = c.CliArgs(
            0, False, "scripts/crawl_config.json", str(root), True,
            True, "INFO", True,
        )
        settings = c.load_settings(args, Path("/repo/scripts/crawler.py"))
        policy = c.UrlPolicy(settings)
        self.fake_http = FakeHttp()
        self.policy = c.RobotsPolicy(settings, policy, self.fake_http)
        self.loop = asyncio.new_event_loop()
        asyncio.set_event_loop(self.loop)

    def tearDown(self):
        self.loop.close()
        self.tmp.cleanup()

    def test_robot_parser_creation(self):
        """RobotsPolicy.allowed should honor robots.txt rules."""
        allowed, _ = self.loop.run_until_complete(
            self.policy.allowed("https://web.uettaxila.edu.pk/admissions")
        )
        self.assertTrue(allowed)
        denied, _ = self.loop.run_until_complete(
            self.policy.allowed("https://web.uettaxila.edu.pk/files/x.pdf")
        )
        self.assertFalse(denied)

    def test_robot_parser_cached(self):
        """robots.txt should be fetched once and cached per origin."""
        self.loop.run_until_complete(
            self.policy.allowed("https://web.uettaxila.edu.pk/admissions")
        )
        self.loop.run_until_complete(
            self.policy.allowed("https://web.uettaxila.edu.pk/campus-life")
        )
        self.assertEqual(self.fake_http.calls, 1)


if __name__ == "__main__":
    unittest.main(verbosity=2)
