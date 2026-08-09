"""
test_io_budget.py — Persistent I/O budget enforcement tests.

Verifies IoBudgetMonitor threshold behavior (soft warn / stop event / hard
abort) and the fail-fast load-time validation of the ioBudget configuration.
"""
import asyncio
import json
import tempfile
import unittest
from pathlib import Path

import crawler as c


def _make_settings(root: Path, io_budget: dict) -> c.Settings:
    (root / "scripts").mkdir(parents=True, exist_ok=True)
    (root / "scripts" / "crawl_config.json").write_text(
        json.dumps({"ioBudget": io_budget}), encoding="utf-8"
    )
    args = c.CliArgs(
        0, False, "scripts/crawl_config.json", str(root), True,
        True, "INFO", True,
    )
    return c.load_settings(args, Path("/repo/scripts/crawler.py"))


class IoBudgetValidationTests(unittest.TestCase):
    """Fail-fast validation of ioBudget thresholds at load time."""

    def test_defaults_are_valid(self):
        with tempfile.TemporaryDirectory() as directory:
            settings = _make_settings(Path(directory), {})
            self.assertEqual(
                settings.io_budget_max_bytes,
                500 * 1024 * 1024,
            )
            self.assertEqual(
                settings.io_budget_stop_bytes,
                480 * 1024 * 1024,
            )
            self.assertEqual(
                settings.io_budget_soft_bytes,
                450 * 1024 * 1024,
            )

    def test_soft_above_stop_rejected(self):
        with tempfile.TemporaryDirectory() as directory:
            with self.assertRaises(RuntimeError):
                _make_settings(Path(directory), {"softBytes": 500000000, "stopBytes": 1000000})

    def test_stop_above_max_rejected(self):
        with tempfile.TemporaryDirectory() as directory:
            with self.assertRaises(RuntimeError):
                _make_settings(
                    Path(directory),
                    {"softBytes": 1000000, "stopBytes": 700000000, "maxBytes": 600000000},
                )

    def test_max_above_500_mib_rejected(self):
        with tempfile.TemporaryDirectory() as directory:
            with self.assertRaises(RuntimeError):
                _make_settings(
                    Path(directory),
                    {"softBytes": 1000000, "stopBytes": 2000000, "maxBytes": 600000000},
                )

    def test_tiny_thresholds_rejected(self):
        with tempfile.TemporaryDirectory() as directory:
            with self.assertRaises(RuntimeError):
                _make_settings(
                    Path(directory),
                    {"softBytes": 10, "stopBytes": 1000000, "maxBytes": 2000000},
                )


class IoBudgetMonitorTests(unittest.TestCase):
    """Threshold behavior of IoBudgetMonitor.check()."""

    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name)
        self.settings = _make_settings(
            self.root,
            {"softBytes": 1500, "stopBytes": 2500, "maxBytes": 3500},
        )
        self.stop_event = asyncio.Event()
        self.monitor = c.IoBudgetMonitor(self.settings, self.stop_event)
        self.files = (
            self.settings.ledger_file,
            Path(str(self.settings.ledger_file) + "-wal"),
            Path(str(self.settings.ledger_file) + "-shm"),
            Path(str(self.settings.ledger_file) + "-journal"),
            self.settings.state_file,
            self.settings.dlq_file,
            self.settings.dead_dlq_file,
            self.settings.coverage_json_file,
            self.settings.coverage_csv_file,
        )

    def tearDown(self):
        self.tmp.cleanup()

    def _write(self, total: int) -> None:
        # Spread the bytes across tracked files so any OSError path still
        # leaves the sum exact for files that exist.
        budget = total
        for path in self.files:
            if budget <= 0:
                break
            chunk = min(budget, 512)
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(b"x" * chunk)
            budget -= chunk

    def test_below_soft_is_silent(self):
        self._write(500)
        self.assertEqual(self.monitor.check(), 500)
        self.assertFalse(self.stop_event.is_set())

    def test_soft_warns_once_without_stop(self):
        self._write(2000)
        self.assertEqual(self.monitor.check(), 2000)
        self.assertFalse(self.stop_event.is_set())
        self.assertEqual(self.monitor.check(), 2000)
        self.assertFalse(self.stop_event.is_set())

    def test_stop_sets_stop_event(self):
        self._write(3000)
        self.assertEqual(self.monitor.check(), 3000)
        self.assertTrue(self.stop_event.is_set())

    def test_hard_raises(self):
        self._write(3600)
        with self.assertRaises(c.IoBudgetExceeded):
            self.monitor.check()

    def test_missing_files_count_zero(self):
        self.assertEqual(self.monitor.usage_bytes(), 0)

    def test_malformed_and_processing_files_counted(self):
        malformed = self.settings.dlq_file.with_name("dlq_malformed.jsonl")
        processing = self.settings.dlq_file.with_name(
            "dlq.processing.123.456.jsonl"
        )
        malformed.parent.mkdir(parents=True, exist_ok=True)
        malformed.write_bytes(b"x" * 1000)
        processing.write_bytes(b"y" * 2000)
        self.assertEqual(self.monitor.usage_bytes(), 3000)
        self.assertEqual(self.monitor.check(), 3000)

    def test_hard_limit_triggered_by_malformed_alone(self):
        malformed = self.settings.dlq_file.with_name("dlq_malformed.jsonl")
        malformed.parent.mkdir(parents=True, exist_ok=True)
        malformed.write_bytes(b"x" * 4000)
        with self.assertRaises(c.IoBudgetExceeded):
            self.monitor.check()


if __name__ == "__main__":
    unittest.main(verbosity=2)
