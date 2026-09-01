"""
test_http_retry_classification.py — Cloudflare 522/524 must be retryable, not
terminal.

Cloudflare defines 522 as an origin-connection timeout and 524 as a timeout
occurring after establishing a connection to the origin - both mean the
origin was temporarily unreachable through Cloudflare, not that the URL is
invalid. Before this fix, RETRYABLE_HTTP_STATUSES omitted both, so every 522
response was classified exactly like a real 404: permanently
`failed_fetch_terminal`, never retried, never DLQ-eligible. The real crawl
ledger (crawl_ledger.sqlite3) had 247 URLs stuck this way from a single run.
"""
import asyncio
import json
import tempfile
import unittest
from pathlib import Path

import crawler as c


def _make_settings(root: Path) -> c.Settings:
    (root / "scripts").mkdir(parents=True, exist_ok=True)
    (root / "scripts" / "crawl_config.json").write_text(
        json.dumps({}), encoding="utf-8"
    )
    args = c.CliArgs(
        0, False, "scripts/crawl_config.json", str(root), True,
        True, "INFO", True,
    )
    return c.load_settings(args, Path("/repo/scripts/crawler.py"))


class _StubVision:
    pass


class _StubRenderer:
    async def render(self, url):
        raise RuntimeError("rendering not exercised by this test")


class _StatusHttp:
    """Returns a fixed HTTP status for every request, no Retry-After header."""

    def __init__(self, status: int):
        self.status = status

    async def get(self, url, timeout=None, max_bytes=None):
        return c.HttpResult(
            requested_url=url,
            final_url=url,
            status=self.status,
            headers={},
            body=b"",
        )


class HttpRetryClassificationTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        root = Path(self.tmp.name)
        self.settings = _make_settings(root)
        self.policy = c.UrlPolicy(self.settings)

    def tearDown(self):
        self.tmp.cleanup()

    def _attempt(self, status: int):
        return asyncio.run(
            c.fetch_and_extract_once(
                "https://web.uettaxila.edu.pk/page",
                self.settings,
                self.policy,
                _StatusHttp(status),
                _StubVision(),
                _StubRenderer(),
            )
        )

    def test_522_is_retryable_and_dlq_eligible(self):
        attempt = self._attempt(522)
        self.assertTrue(attempt.failure.retryable, "522 must be retryable, not terminal")
        self.assertTrue(attempt.failure.dlq_eligible)
        self.assertEqual(attempt.failure.status, 522)

    def test_524_is_retryable_and_dlq_eligible(self):
        attempt = self._attempt(524)
        self.assertTrue(attempt.failure.retryable, "524 must be retryable, not terminal")
        self.assertTrue(attempt.failure.dlq_eligible)

    def test_500_stays_retryable(self):
        """Pre-existing behavior 522/524 must match, not a new regression."""
        attempt = self._attempt(500)
        self.assertTrue(attempt.failure.retryable)
        self.assertTrue(attempt.failure.dlq_eligible)

    def test_404_stays_terminal(self):
        """A real missing page must not become retryable by over-correction."""
        attempt = self._attempt(404)
        self.assertFalse(attempt.failure.retryable)
        self.assertFalse(attempt.failure.dlq_eligible)

    def test_410_stays_terminal(self):
        attempt = self._attempt(410)
        self.assertFalse(attempt.failure.retryable)
        self.assertFalse(attempt.failure.dlq_eligible)


if __name__ == "__main__":
    unittest.main(verbosity=2)
