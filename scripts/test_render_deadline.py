"""
test_render_deadline.py — aggregate per-render deadline.

A pathological page must not pin a crawl worker indefinitely; the total
render budget is timeout_seconds * 2 even when individual navigation calls
are bounded.  Uses a subclass so no Chromium is required.
"""
import asyncio
import time
import unittest

from uet_crawler.browser_renderer import BrowserRenderer, BrowserRendererError


class _StallingRenderer(BrowserRenderer):
    def __init__(self, timeout_seconds: float = 30):
        super().__init__(
            enabled=True,
            timeout_seconds=timeout_seconds,
            max_pages=10,
        )

    async def _validate_official_url(self, url):
        return url

    async def _ensure_started(self):
        pass

    async def _render_locked(self, requested, attempt_number, started):
        await asyncio.sleep(60)
        return None


class _PromptRenderer(_StallingRenderer):
    async def _render_locked(self, requested, attempt_number, started):
        return None


class RenderDeadlineTests(unittest.TestCase):
    """render() enforces an aggregate deadline around the render body."""

    def test_stalled_render_raises_within_deadline(self):
        renderer = _StallingRenderer(timeout_seconds=0.2)
        started = time.monotonic()
        with self.assertRaises(BrowserRendererError) as ctx:
            asyncio.run(renderer.render("https://uet.edu.pk/page"))
        elapsed = time.monotonic() - started
        self.assertLess(elapsed, 10.0)
        self.assertIn("total deadline", str(ctx.exception))

    def test_prompt_render_still_returns(self):
        renderer = _PromptRenderer(timeout_seconds=30)
        self.assertIsNone(
            asyncio.run(renderer.render("https://uet.edu.pk/page"))
        )


if __name__ == "__main__":
    unittest.main(verbosity=2)
