"""
test_render_limit.py — RenderLimitReached must be terminal, not retryable.

A render-cap hit means the configured selective-render budget was exhausted
for this page; retrying the same page is pointless (and wastes a full
fetch + render cycle per retry). It must NOT enter the DLQ.
"""
import asyncio
import json
import tempfile
import unittest
from pathlib import Path

import crawler as c
from uet_crawler.browser_renderer import RenderLimitReached

SHELL_HTML = b"""<!doctype html>
<html><head><title>Shell</title></head>
<body><div id="root"></div></body></html>
"""


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


class _StubHttp:
    async def get(self, url, timeout=None, max_bytes=None):
        return c.HttpResult(
            requested_url=url,
            final_url=url,
            status=200,
            headers={"content-type": "text/html"},
            body=SHELL_HTML,
        )


class _StubVision:
    pass


class _RenderLimitRenderer:
    async def render(self, url):
        raise RenderLimitReached("render budget exhausted")


class RenderLimitTests(unittest.TestCase):
    """RenderLimitReached is a terminal, non-DLQ-eligible outcome."""

    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        root = Path(self.tmp.name)
        self.settings = _make_settings(root)
        self.policy = c.UrlPolicy(self.settings)

    def tearDown(self):
        self.tmp.cleanup()

    def _attempt(self, renderer):
        return asyncio.run(
            c.fetch_and_extract_once(
                "https://uet.edu.pk/page",
                self.settings,
                self.policy,
                _StubHttp(),
                _StubVision(),
                renderer,
            )
        )

    def test_render_limit_is_not_retryable(self):
        attempt = self._attempt(_RenderLimitRenderer())
        self.assertFalse(attempt.failure.retryable)

    def test_render_limit_is_not_dlq_eligible(self):
        attempt = self._attempt(_RenderLimitRenderer())
        self.assertFalse(attempt.failure.dlq_eligible)

    def test_render_limit_message_mentions_reason(self):
        attempt = self._attempt(_RenderLimitRenderer())
        self.assertIn("browser rendering required", attempt.failure.reason)
        self.assertIn("render budget exhausted", attempt.failure.reason)

    def test_ordinary_render_failure_stays_retryable(self):
        class _FailingRenderer:
            async def render(self, url):
                raise RuntimeError("chromium crashed")

        attempt = self._attempt(_FailingRenderer())
        self.assertTrue(attempt.failure.retryable)
        self.assertTrue(attempt.failure.dlq_eligible)
        self.assertIn("chromium crashed", attempt.failure.reason)


if __name__ == "__main__":
    unittest.main(verbosity=2)
