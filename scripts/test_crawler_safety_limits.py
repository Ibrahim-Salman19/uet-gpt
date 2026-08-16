"""
test_crawler_safety_limits.py — Resource-safety remediation regression tests.

Covers the crawler-side fixes for the August 2026 incident:
  * --limit defaults to a small finite number, not exhaustive (parse_args)
  * exhaustive crawling requires the explicit --exhaustive opt-in
  * --limit/--exhaustive are mutually exclusive; --limit 0 is a user error
  * a wall-clock runtime budget exists and terminates the crawl (RuntimeBudgetMonitor)
  * load_settings() fails closed on a non-local Convex target (target_guard integration)

Run:  pytest scripts/test_crawler_safety_limits.py
"""

import asyncio
import json
import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import crawler as c


# ─── parse_args(): --limit / --exhaustive / --max-runtime-seconds ────────────


class ParseArgsLimitTests(unittest.TestCase):
    def test_no_args_defaults_to_small_finite_limit(self):
        args = c.parse_args([])
        self.assertEqual(args.limit, c.DEFAULT_SAFE_CRAWL_LIMIT)
        self.assertGreater(args.limit, 0)

    def test_no_args_defaults_to_finite_runtime_budget(self):
        args = c.parse_args([])
        self.assertEqual(args.max_runtime_seconds, c.DEFAULT_MAX_RUNTIME_SECONDS)
        self.assertGreater(args.max_runtime_seconds, 0)

    def test_explicit_limit_used_verbatim(self):
        args = c.parse_args(["--limit", "50"])
        self.assertEqual(args.limit, 50)

    def test_exhaustive_flag_maps_to_unbounded_sentinel(self):
        args = c.parse_args(["--exhaustive"])
        self.assertEqual(args.limit, 0)

    def test_limit_zero_without_exhaustive_is_rejected(self):
        # The old silent "0 means exhaustive" meaning must not survive under
        # a different name - it must require the explicit flag.
        with self.assertRaises(SystemExit):
            c.parse_args(["--limit", "0"])

    def test_negative_limit_is_rejected(self):
        with self.assertRaises(SystemExit):
            c.parse_args(["--limit", "-5"])

    def test_limit_and_exhaustive_are_mutually_exclusive(self):
        with self.assertRaises(SystemExit):
            c.parse_args(["--limit", "10", "--exhaustive"])

    def test_max_runtime_seconds_zero_means_unbounded_and_is_explicit(self):
        args = c.parse_args(["--max-runtime-seconds", "0"])
        self.assertEqual(args.max_runtime_seconds, 0)

    def test_max_runtime_seconds_override(self):
        args = c.parse_args(["--max-runtime-seconds", "120"])
        self.assertEqual(args.max_runtime_seconds, 120)

    def test_negative_max_runtime_seconds_is_rejected(self):
        with self.assertRaises(SystemExit):
            c.parse_args(["--max-runtime-seconds", "-1"])

    def test_cloud_execution_authorization_defaults_to_none(self):
        args = c.parse_args([])
        self.assertIsNone(args.cloud_execution_authorization)

    def test_cloud_execution_authorization_is_threaded_through(self):
        args = c.parse_args(["--cloud-execution-authorization", "some-phrase"])
        self.assertEqual(args.cloud_execution_authorization, "some-phrase")


# ─── RuntimeBudgetMonitor ──────────────────────────────────────────────────────


def _make_settings(root: Path, *, max_runtime_seconds: int, dry_run: bool = True) -> "c.Settings":
    (root / "scripts").mkdir(parents=True, exist_ok=True)
    (root / "scripts" / "crawl_config.json").write_text(json.dumps({}), encoding="utf-8")
    args = c.CliArgs(
        limit=0,
        clean=False,
        config="scripts/crawl_config.json",
        project_root=str(root),
        resume=True,
        dry_run=dry_run,
        log_level="INFO",
        require_complete=True,
        max_runtime_seconds=max_runtime_seconds,
        cloud_execution_authorization=None,
    )
    return c.load_settings(args, Path("/repo/scripts/crawler.py"))


class RuntimeBudgetMonitorTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        self.stop_event = asyncio.Event()

    def test_under_budget_does_not_stop(self):
        settings = _make_settings(self.root, max_runtime_seconds=3600)
        monitor = c.RuntimeBudgetMonitor(settings, self.stop_event, start_monotonic=__import__("time").monotonic())
        monitor.check()
        self.assertFalse(self.stop_event.is_set())

    def test_elapsed_past_budget_sets_stop_event(self):
        import time as _time

        settings = _make_settings(self.root, max_runtime_seconds=1)
        # Start time far enough in the past that the budget is already exceeded.
        start = _time.monotonic() - 10
        monitor = c.RuntimeBudgetMonitor(settings, self.stop_event, start_monotonic=start)
        monitor.check()
        self.assertTrue(self.stop_event.is_set())

    def test_zero_budget_is_unbounded_and_never_stops(self):
        import time as _time

        settings = _make_settings(self.root, max_runtime_seconds=0)
        start = _time.monotonic() - 999999
        monitor = c.RuntimeBudgetMonitor(settings, self.stop_event, start_monotonic=start)
        monitor.check()
        self.assertFalse(self.stop_event.is_set())

    def test_check_is_idempotent_once_stopped(self):
        import time as _time

        settings = _make_settings(self.root, max_runtime_seconds=1)
        start = _time.monotonic() - 10
        monitor = c.RuntimeBudgetMonitor(settings, self.stop_event, start_monotonic=start)
        monitor.check()
        monitor.check()  # must not raise or misbehave on a second call
        self.assertTrue(self.stop_event.is_set())


# ─── load_settings() target-guard integration ─────────────────────────────────


class LoadSettingsTargetGuardTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)

    def test_dry_run_skips_target_verification_entirely(self):
        with patch.dict(os.environ, {"CONVEX_SITE_URL": ""}, clear=False):
            # Must not raise even though no target is configured, since
            # dry-run makes zero Convex requests.
            settings = _make_settings(self.root, max_runtime_seconds=60, dry_run=True)
            self.assertEqual(settings.convex_site_url, "")

    def test_non_dry_run_rejects_cloud_target(self):
        with patch.dict(
            os.environ, {"CONVEX_SITE_URL": "https://rugged-bird-156.convex.site"}, clear=False
        ):
            with self.assertRaises(RuntimeError):
                _make_settings(self.root, max_runtime_seconds=60, dry_run=False)

    def test_non_dry_run_rejects_missing_target(self):
        with patch.dict(os.environ, {"CONVEX_SITE_URL": ""}, clear=False):
            with self.assertRaises(RuntimeError):
                _make_settings(self.root, max_runtime_seconds=60, dry_run=False)

    def test_non_dry_run_accepts_local_target(self):
        # CONVEX_AUTH_TOKEN is a separate, pre-existing requirement unrelated
        # to target verification - set it so this test isolates the
        # target-guard behavior specifically.
        with patch.dict(
            os.environ,
            {
                "CONVEX_SITE_URL": "http://127.0.0.1:3211",
                "CONVEX_AUTH_TOKEN": "test-token",
            },
            clear=False,
        ):
            settings = _make_settings(self.root, max_runtime_seconds=60, dry_run=False)
            self.assertEqual(settings.convex_site_url, "http://127.0.0.1:3211")


if __name__ == "__main__":
    unittest.main(verbosity=2)
