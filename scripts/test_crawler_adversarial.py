"""Adversarial regression tests for scripts/crawler.py.

Run from the repository root:
    python -m unittest -v test_crawler_adversarial.py
"""
from __future__ import annotations

import asyncio
import gzip
import json
import os
import sys
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest import mock

ROOT = Path(__file__).resolve().parent
SCRIPTS = ROOT / "scripts"
if SCRIPTS.is_dir():
    sys.path.insert(0, str(SCRIPTS))

import crawler as c  # noqa: E402


class FakePolicy:
    def canonicalize(self, value: str) -> str:
        return value if value.startswith("https://www.uettaxila.edu.pk/") else ""

    def is_network_target(self, value: str) -> bool:
        return value.startswith("https://www.uettaxila.edu.pk/")

    def is_crawl_candidate(self, value: str) -> bool:
        return self.is_network_target(value)


class FakeResponse:
    def __init__(self, status: int = 200, headers=None, body: bytes = b""):
        self.status_code = status
        self.headers = dict(headers or {})
        self.body = body
        self.closed = False

    async def aiter_content(self, chunk_size=None):
        del chunk_size
        if self.body:
            midpoint = max(1, len(self.body) // 2)
            yield self.body[:midpoint]
            yield self.body[midpoint:]

    async def aclose(self):
        self.closed = True


class FakeGetSession:
    def __init__(self, responses, constructed=None):
        self.responses = list(responses)
        self.calls = []
        self.constructed = constructed

    async def __aenter__(self):
        return self

    async def __aexit__(self, *_exc):
        return False

    async def get(self, url, **kwargs):
        self.calls.append((url, kwargs))
        return self.responses.pop(0)


class FakeSessionFactory:
    """Session factory that records the construction kwargs per call."""

    def __init__(self, responses):
        self.responses = list(responses)
        self.constructed = []

    def __call__(self, **kwargs):
        self.constructed.append(kwargs)
        return FakeGetSession(self.responses, kwargs)


class FakePostSession:
    def __init__(self, responses):
        self.responses = list(responses)
        self.calls = []

    async def post(self, url, **kwargs):
        self.calls.append((url, kwargs))
        item = self.responses.pop(0)
        if isinstance(item, BaseException):
            raise item
        return item


class FakeSafety:
    async def resolve(self, _url):
        return c.HostResolution(
            "www.uettaxila.edu.pk", 443, ("8.8.8.8", "2001:4860:4860::8888")
        )


class TestPureHelpers(unittest.TestCase):
    def test_expat_security_baseline_is_enforced(self):
        with mock.patch.object(c.expat, "EXPAT_VERSION", "expat_2.7.2"):
            c.validate_xml_runtime()
        with mock.patch.object(c.expat, "EXPAT_VERSION", "expat_2.7.1"):
            with self.assertRaises(RuntimeError):
                c.validate_xml_runtime()

    def test_retry_after_is_bounded(self):
        self.assertEqual(c.parse_retry_after("999999"), c.MAX_RETRY_AFTER_SECONDS)
        self.assertIsNone(c.parse_retry_after("not-a-date"))
        self.assertIsNone(c.parse_retry_after("nan"))

    def test_public_ip_classifier(self):
        self.assertTrue(c.HostSafetyCache._is_public_ip("8.8.8.8"))
        for value in ("127.0.0.1", "10.0.0.1", "169.254.1.1", "::1", "fe80::1"):
            self.assertFalse(c.HostSafetyCache._is_public_ip(value), value)

    def test_gemini_steps_content_array(self):
        data = {
            "steps": [
                {
                    "type": "model_output",
                    "content": [{"type": "text", "text": "final text"}],
                }
            ]
        }
        with mock.patch.object(c, "extract_interaction_output_text", return_value=""):
            self.assertEqual(c.GeminiVisionClient._extract_text(data), "final text")

    def test_configuration_file_is_bounded_and_utf8(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "crawl_config.json"
            path.write_bytes(b"\xff")
            with self.assertRaises(RuntimeError):
                c.read_json_file(path)

            with mock.patch.object(c, "MAX_CONFIG_BYTES", 8):
                path.write_text('{"value": 123}', encoding="utf-8")
                with self.assertRaises(RuntimeError):
                    c.read_json_file(path)

    def test_atomic_json_limit_does_not_replace_previous_state(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "state.json"
            c.atomic_write_json(path, {"old": True})
            with self.assertRaises(ValueError):
                c.atomic_write_json(path, {"large": "x" * 1000}, max_bytes=32)
            self.assertEqual(json.loads(path.read_text()), {"old": True})

    def test_strict_numeric_configuration(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "scripts").mkdir()
            config = root / "scripts" / "crawl_config.json"
            args = c.CliArgs(
                0, False, "scripts/crawl_config.json", str(root), True,
                True, "INFO", True,
            )
            config.write_text("{}", encoding="utf-8")
            settings = c.load_settings(args, Path("/repo/scripts/crawler.py"))
            self.assertEqual(settings.concurrency, 5)
            for bad in (
                {"concurrency": "5"},
                {"requestTimeout": "20"},
                {"robots": {"enabled": "false"}},
                {"seedUrls": []},
                {"maxRedirects": 4},
                {"trustEnvironmentProxies": True},
            ):
                config.write_text(json.dumps(bad), encoding="utf-8")
                with self.subTest(bad=bad), self.assertRaises(RuntimeError):
                    c.load_settings(args, Path("/repo/scripts/crawler.py"))


class TestSitemaps(unittest.TestCase):
    def test_valid_xml_text_and_gzip(self):
        xml = (
            b'<?xml version="1.0"?><urlset xmlns="http://www.sitemaps.org/'
            b'schemas/sitemap/0.9"><url><loc>https://www.uettaxila.edu.pk/a'
            b'</loc></url></urlset>'
        )
        parsed = c._parse_sitemap_body(
            xml, "application/xml", "https://www.uettaxila.edu.pk/sitemap.xml"
        )
        self.assertEqual(parsed.locations, ("https://www.uettaxila.edu.pk/a",))
        compressed = gzip.compress(xml)
        parsed = c._parse_sitemap_body(
            compressed,
            "application/gzip",
            "https://www.uettaxila.edu.pk/sitemap.xml.gz",
        )
        self.assertEqual(parsed.kind, "urlset")
        text = b"https://www.uettaxila.edu.pk/a\n"
        self.assertEqual(
            c._parse_sitemap_body(
                text, "text/plain", "https://www.uettaxila.edu.pk/sitemap.txt"
            ).kind,
            "text",
        )

    def test_dtd_whitespace_and_bad_gzip_are_rejected(self):
        bad_values = (
            (
                b'<!DOCTYPE x [<!ENTITY e "x">]><urlset><url><loc>&e;</loc>'
                b"</url></urlset>",
                "application/xml",
                "https://www.uettaxila.edu.pk/sitemap.xml",
            ),
            (
                b"<urlset><url><loc>https://www.uettaxila.edu.pk/a b</loc>"
                b"</url></urlset>",
                "application/xml",
                "https://www.uettaxila.edu.pk/sitemap.xml",
            ),
            (
                b"\x1f\x8bnot-gzip",
                "application/gzip",
                "https://www.uettaxila.edu.pk/sitemap.xml.gz",
            ),
        )
        for body, content_type, url in bad_values:
            with self.subTest(body=body[:20]), self.assertRaises(c.SitemapParseError):
                c._parse_sitemap_body(body, content_type, url)

    def test_xml_structural_limits(self):
        xml = b"<urlset><a/><b/><c/></urlset>"
        with mock.patch.object(c, "MAX_XML_ELEMENTS", 3):
            with self.assertRaises(c.SitemapParseError):
                c._parse_xml_sitemap(xml)
        xml = b'<urlset><url a="1" b="2"><loc>https://www.uettaxila.edu.pk/a</loc></url></urlset>'
        with mock.patch.object(c, "MAX_XML_ATTRIBUTES_PER_ELEMENT", 1):
            with self.assertRaises(c.SitemapParseError):
                c._parse_xml_sitemap(xml)


class TestConcurrentComponents(unittest.IsolatedAsyncioTestCase):
    @staticmethod
    def document(content_hash="hash"):
        return c.ExtractedDocument(
            "https://www.uettaxila.edu.pk/a",
            "Title",
            "one two three four five",
            [],
            "html",
            content_hash,
            5,
        )

    async def test_dedupe_waits_for_commit(self):
        deduper = c.ContentDeduplicator(6, 3)
        document = self.document()
        tasks = [asyncio.create_task(deduper.reserve(document)) for _ in range(20)]
        done, pending = await asyncio.wait(tasks, return_when=asyncio.FIRST_COMPLETED)
        first = done.pop().result()
        self.assertIsNotNone(first[1])
        await deduper.commit_reserved(first[1])
        results = [first, *await asyncio.gather(*pending)]
        self.assertEqual(sum(result[1] is not None for result in results), 1)
        self.assertTrue(all(result[0] for result in results if result[1] is None))

    async def test_dedupe_release_transfers_ownership_and_waiter_cancel_is_safe(self):
        deduper = c.ContentDeduplicator(6, 3)
        document = self.document()
        _, owner = await deduper.reserve(document)
        self.assertIsNotNone(owner)
        cancelled_waiter = asyncio.create_task(deduper.reserve(document))
        await asyncio.sleep(0)
        cancelled_waiter.cancel()
        with self.assertRaises(asyncio.CancelledError):
            await cancelled_waiter
        next_waiter = asyncio.create_task(deduper.reserve(document))
        await asyncio.sleep(0)
        await deduper.release(owner)
        reason, new_owner = await asyncio.wait_for(next_waiter, 1)
        self.assertIsNone(reason)
        self.assertIsNotNone(new_owner)
        await deduper.commit_reserved(new_owner)

    async def test_frontier_retry_bypasses_historical_seen_without_double_counting(self):
        frontier = c.Frontier(10, 100)
        url = "https://www.uettaxila.edu.pk/a"
        self.assertTrue(await frontier.enqueue(url, 0))
        entry = await frontier.get()
        await frontier.done(entry.url)
        self.assertEqual(frontier.scheduled, 1)
        self.assertTrue(await frontier.enqueue_retry(url, 0))
        self.assertEqual(frontier.scheduled, 1)

    async def test_frontier_restore_keeps_seen_when_checkpoint_queue_is_empty(self):
        # Reproduces a real bug found via a Phase 3 local-corpus crawl: once an
        # exhaustive crawl's live queue legitimately drains to empty (the
        # normal steady state as it approaches completion, not just a
        # crash-abandoned run), restore() returned early before assigning
        # self.seen, discarding the entire historical seen set. The next
        # resume's seed/sitemap enqueue then had no memory of already-
        # processed URLs and re-fetched hundreds of them.
        already_processed = "https://www.uettaxila.edu.pk/already-processed"
        frontier = c.Frontier(0, 100)
        restored = await frontier.restore(
            {"seen": [already_processed], "scheduled": 1, "entries": []},
            FakePolicy(),
        )
        self.assertEqual(restored, 0)
        self.assertIn(already_processed, frontier.seen)
        self.assertFalse(await frontier.enqueue(already_processed, 0))

    async def test_dlq_snapshot_survives_load_until_success(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            active = root / "dlq.jsonl"
            dead = root / "dead.jsonl"
            url = "https://www.uettaxila.edu.pk/a"
            writer = c.DeadLetterQueue(active, dead, 5)
            await writer.add(url, 0, "temporary failure")
            self.assertTrue(active.exists())

            frontier = c.Frontier(10, 100)
            await frontier.enqueue(url, 0)
            previous = await frontier.get()
            await frontier.done(previous.url)

            reader = c.DeadLetterQueue(active, dead, 5)
            loaded = await reader.load_into(frontier, FakePolicy())
            self.assertEqual(loaded, 1)
            self.assertTrue(active.exists(), "active retry must remain durable")
            await reader.acknowledge_success(url)
            self.assertFalse(active.exists())

    async def test_dlq_add_reports_dead_letter_on_final_attempt(self):
        # Reproduces a real bug found via the same Phase 3 local-corpus crawl:
        # DeadLetterQueue.add() decides internally when a URL's retry budget
        # is exhausted and moves it into the dead-letter file, but previously
        # returned None either way. Every caller wrote "failed_fetch_retryable"
        # (a non-terminal ledger state) to the ledger regardless of that
        # outcome, so once a URL was actually dead-lettered its ledger row
        # stayed parked in a non-terminal state forever - even though
        # dlq.jsonl no longer had it and nothing would ever retry it again -
        # permanently blocking the run from being recognized as
        # coverage-complete. add() must report the dead-letter outcome so
        # callers can promote the ledger row to a terminal state.
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            active = root / "dlq.jsonl"
            dead = root / "dead.jsonl"
            url = "https://www.uettaxila.edu.pk/flaky"
            dlq = c.DeadLetterQueue(active, dead, 3)
            self.assertFalse(await dlq.add(url, 0, "HTTP 500"))
            self.assertFalse(await dlq.add(url, 0, "HTTP 500"))
            self.assertTrue(await dlq.add(url, 0, "HTTP 500"))
            self.assertTrue(dead.exists())
            self.assertFalse(active.exists())

    async def test_raw_http_pins_dns_and_bounds_body(self):
        settings = SimpleNamespace(
            max_redirects=5,
            connect_timeout=2.0,
            user_agent="TestCrawler/1.0",
            max_url_length=8192,
            impersonate=None,
        )
        response = FakeResponse(200, {"content-length": "2"}, b"ok")
        factory = FakeSessionFactory([response])
        client = c.RawHttpClient(settings, FakePolicy(), FakeSafety(), factory)
        result = await client.get(
            "https://www.uettaxila.edu.pk/a", timeout=2.0, max_bytes=10
        )
        self.assertEqual(result.body, b"ok")
        self.assertEqual(len(factory.constructed), 1)
        options = factory.constructed[0]["curl_options"]
        self.assertIn(c.CurlOpt.RESOLVE, options)
        self.assertIn("8.8.8.8", options[c.CurlOpt.RESOLVE][0])
        max_file_size = getattr(c.CurlOpt, "MAXFILESIZE_LARGE", None)
        if max_file_size is not None:
            self.assertEqual(options[max_file_size], 10)
        self.assertTrue(response.closed)

    async def test_raw_http_rejects_oversized_stream(self):
        settings = SimpleNamespace(
            max_redirects=5,
            connect_timeout=2.0,
            user_agent="TestCrawler/1.0",
            max_url_length=8192,
            impersonate=None,
        )
        response = FakeResponse(200, {}, b"0123456789")
        factory = FakeSessionFactory([response])
        client = c.RawHttpClient(settings, FakePolicy(), FakeSafety(), factory)
        with self.assertRaises(c.ResponseTooLarge):
            await client.get(
                "https://www.uettaxila.edu.pk/a", timeout=2.0, max_bytes=5
            )
        self.assertTrue(response.closed)

    async def test_convex_response_is_stream_bounded(self):
        settings = SimpleNamespace(
            dry_run=False,
            convex_auth_token="secret",
            max_ingest_bytes=1024 * 1024,
            convex_site_url="https://example.convex.site",
            push_retries=1,
            push_timeout=2.0,
        )
        body = json.dumps({"action": "inserted"}).encode()
        response = FakeResponse(200, {"content-length": str(len(body))}, body)
        client = c.ConvexClient(settings, FakePostSession([response]))
        action = await client.push(self.document(), "run")
        self.assertEqual(action, "inserted")
        self.assertTrue(response.closed)

        oversized = FakeResponse(
            200,
            {"content-length": str(c.ConvexClient.MAX_RESPONSE_BYTES + 1)},
            b"",
        )
        client = c.ConvexClient(settings, FakePostSession([oversized]))
        with self.assertRaises(c.PushTerminalError):
            await client.push(self.document("hash-2"), "run")

    async def test_irreversible_finalizer_defers_cancellation(self):
        completed = asyncio.Event()

        async def operation():
            await asyncio.sleep(0.02)
            completed.set()
            return 7

        task = asyncio.create_task(c._finish_after_irreversible_side_effect(operation()))
        await asyncio.sleep(0)
        task.cancel()
        self.assertEqual(await task, 7)
        self.assertTrue(completed.is_set())

    async def test_robots_no_store_is_not_reused_stale_and_429_denies(self):
        class FakeRules:
            sitemaps = ()

            @classmethod
            def allow_all(cls):
                return cls()

            @classmethod
            def parse(cls, _body, **_kwargs):
                return cls()

            def crawl_delay(self, _agent):
                return None

            def can_fetch(self, _url, _agent):
                return True

        class Raw:
            def __init__(self, result):
                self.result = result

            async def get(self, *_args, **_kwargs):
                return self.result

        settings = SimpleNamespace(
            robots_cache_seconds=3600,
            robots_stale_seconds=86400,
            request_timeout=10.0,
            robots_token="TestBot",
            robots_enabled=True,
        )
        policy = SimpleNamespace(
            canonicalize=lambda value: value,
            is_network_target=lambda _value: True,
        )
        with mock.patch.object(c, "RobotsRules", FakeRules):
            result = c.HttpResult(
                "https://www.uettaxila.edu.pk/robots.txt",
                "https://www.uettaxila.edu.pk/robots.txt",
                200,
                {"cache-control": "no-store"},
                b"",
            )
            robots = c.RobotsPolicy(settings, policy, Raw(result))
            entry = await robots._load("https://www.uettaxila.edu.pk")
            self.assertEqual(entry.stale_until, entry.fetched_at)

            result = c.HttpResult(
                "https://www.uettaxila.edu.pk/robots.txt",
                "https://www.uettaxila.edu.pk/robots.txt",
                429,
                {},
                b"",
            )
            robots = c.RobotsPolicy(settings, policy, Raw(result))
            entry = await robots._load("https://www.uettaxila.edu.pk")
            self.assertEqual(entry.mode, "deny")


if __name__ == "__main__":
    unittest.main()