"""Regression coverage for CrawlLedger.mark_result_if_not_terminal.

Reproduces a real bug found via scripts/crawler.py's Phase 2 local-corpus
pilot: enqueue_discovered's frontier-cap/max-depth bookkeeping applies a bulk
"not scheduled" mark_result to every co-discovered link, including ones
already terminal from earlier in the same run (e.g. a seed URL that other
seed pages also link to). An unconditional mark_result silently demoted an
already-dry_run_ready/ingested URL back to "discovered"/"skipped_depth",
making crawl_ledger.sqlite3's own state column an unreliable success count
for any run ending via a budget/URL cap rather than frontier exhaustion -
exactly the completion mode the crawler's safety defaults produce routinely.
"""

import asyncio
import tempfile
import unittest
from pathlib import Path

from uet_crawler.crawl_ledger import CrawlLedger


class TestMarkResultIfNotTerminal(unittest.TestCase):
    def setUp(self):
        self._tmpdir = tempfile.TemporaryDirectory()
        self.ledger = CrawlLedger(
            Path(self._tmpdir.name) / "test_ledger.sqlite3", session_id="test-run"
        )

    def tearDown(self):
        asyncio.run(self.ledger.close())
        self._tmpdir.cleanup()

    def test_does_not_demote_an_already_terminal_url(self):
        url = "https://example.com/already-done"

        async def scenario():
            await self.ledger.mark_started(url)
            await self.ledger.mark_result(
                url, "dry_run_ready", http_status=200, word_count=100
            )
            await self.ledger.mark_result_if_not_terminal(
                url, "discovered", error="not scheduled because configured URL limit was reached"
            )
            rows = self.ledger._connection.execute(
                "SELECT state, word_count FROM crawl_urls WHERE run_id=? AND url=?",
                (self.ledger.run_id, url),
            ).fetchall()
            return rows[0]

        row = asyncio.run(scenario())
        self.assertEqual(row["state"], "dry_run_ready")
        self.assertEqual(row["word_count"], 100)

    def test_still_updates_a_non_terminal_url(self):
        url = "https://example.com/not-yet-scheduled"

        async def scenario():
            await self.ledger.discover_many([(url, 0, None, "seed")])
            await self.ledger.mark_result_if_not_terminal(
                url, "discovered", error="not scheduled because configured URL limit was reached"
            )
            rows = self.ledger._connection.execute(
                "SELECT state, error FROM crawl_urls WHERE run_id=? AND url=?",
                (self.ledger.run_id, url),
            ).fetchall()
            return rows[0]

        row = asyncio.run(scenario())
        self.assertEqual(row["state"], "discovered")
        self.assertIn("URL limit", row["error"])

    def test_does_not_demote_a_terminal_url_to_skipped_depth(self):
        # The second real call site sharing this guard (enqueue_discovered's
        # max-depth branch): a deep page can link back to an already-processed
        # shallow URL (e.g. the site root).
        url = "https://example.com/"

        async def scenario():
            await self.ledger.mark_started(url)
            await self.ledger.mark_result(url, "ingested", http_status=200)
            await self.ledger.mark_result_if_not_terminal(
                url, "skipped_depth", error="discovered at depth 5; configured maxDepth=4"
            )
            rows = self.ledger._connection.execute(
                "SELECT state FROM crawl_urls WHERE run_id=? AND url=?",
                (self.ledger.run_id, url),
            ).fetchall()
            return rows[0]

        row = asyncio.run(scenario())
        self.assertEqual(row["state"], "ingested")

    def test_failed_extract_counts_as_terminal_for_coverage(self):
        # Reproduces a real bug found via a Phase 3 local-corpus crawl:
        # "failed_extract" (a fetch that succeeded but whose content failed
        # extraction, e.g. a low-quality PDF) is always recorded with
        # retryable=False/dlq_eligible=False in crawler.py - retrying the
        # fetch can never change the outcome - yet it was missing from
        # TERMINAL_STATES, so a run with any extraction failures could never
        # be recognized as coverage-complete no matter how many times it
        # was resumed.
        url = "https://example.com/bad.pdf"

        async def scenario():
            await self.ledger.mark_started(url)
            await self.ledger.mark_result(
                url, "failed_extract", error="no extractable content"
            )
            return await self.ledger.summary()

        summary = asyncio.run(scenario())
        self.assertTrue(summary.complete_by_state)
        self.assertEqual(summary.incomplete_urls, 0)


if __name__ == "__main__":
    unittest.main()
