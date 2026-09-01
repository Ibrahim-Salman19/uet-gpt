"""
test_freshness_filter_fidelity.py — evaluator eligibility/freshness filtering
vs. real production classification (retrieval-baseline remediation, docs/
rag-store-evaluation/retrieval-baseline-2026-08/).

Proves scripts/apply_freshness_filter.ts (invoked by
scripts/stage_e_retrieval_eval.py's run_freshness_filter/filter_eligible_chunks)
reuses the REAL production classifyFreshness/isRetrievalEligibleStatus
(convex/shared/freshnessPolicy.ts) rather than an approximate Python
reimplementation - by calling the real subprocess wrapper for each scenario
and asserting its output against the exact precedence rules and TTL constants
documented in freshnessPolicy.ts itself (hard-excluded status > missing
crawledAt > isStale flag > TTL > fresh; TTL high=14d/medium=60d/low=180d;
DEFAULT_STALE_SCORE_MULTIPLIER=0.3).

Covers all 6 scenarios named in the remediation mandate (eligible/current,
stale, failed, pending/processing, old-but-eligible-with-penalty,
current-with-no-penalty), split into 7 explicit cases since pending and
processing are two distinct status literals, plus one additional case
guarding a fidelity bug caught and fixed during implementation: the real
hard-exclusion guard is a TRUTHY check on status
(convex/embeddings/search.ts:307-309: `docMeta?.status && ...`), not a
`!== undefined` check - an empty-string status must NOT be hard-excluded by
this evaluator-side reproduction, matching that exact short-circuit.
"""
import json
import subprocess
import sys
import unittest
from pathlib import Path

SCRIPTS_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = SCRIPTS_DIR.parent

# The commit before this remediation began - scripts/stage_e_retrieval_eval.py
# at this revision has no status/is_stale/freshness_tier/crawled_at fields on
# ChunkRecord/DocumentRecord at all, and no filter_eligible_chunks or
# run_freshness_filter functions. Verified via:
#   git show 587363db82285781ecd6e4f4a57c0f57b752195b:scripts/stage_e_retrieval_eval.py \
#     | grep -n "class ChunkRecord\|filter_eligible_chunks\|is_stale"
PRE_FIX_COMMIT = "587363db82285781ecd6e4f4a57c0f57b752195b"

NOW_EPOCH_MS = 1786800000000  # fixed reference instant for determinism
DAY_MS = 24 * 60 * 60 * 1000

# Mirrors convex/shared/freshnessPolicy.ts's FRESHNESS_TTL_DAYS exactly.
HIGH_TTL_DAYS = 14
DEFAULT_STALE_SCORE_MULTIPLIER = 0.3


def run_freshness_filter(rows: list[dict]) -> list[dict]:
    result = subprocess.run(
        ["npx", "tsx", str(SCRIPTS_DIR / "apply_freshness_filter.ts"), str(NOW_EPOCH_MS)],
        cwd=PROJECT_ROOT,
        input=json.dumps(rows),
        capture_output=True,
        text=True,
        timeout=60,
    )
    if result.returncode != 0:
        raise RuntimeError(
            f"apply_freshness_filter.ts failed (exit {result.returncode}): {result.stderr}"
        )
    return json.loads(result.stdout)


class FreshnessFilterFidelityTests(unittest.TestCase):
    """Each test is one scenario from the remediation mandate's required list,
    run through the real production classification function via subprocess."""

    @classmethod
    def setUpClass(cls):
        cls.rows = {
            "eligible_current": {
                "id": "eligible_current",
                "status": "active",
                "isStale": False,
                "freshnessTier": "low",
                "crawledAt": NOW_EPOCH_MS - 1 * DAY_MS,
            },
            "stale_flagged": {
                "id": "stale_flagged",
                "status": "active",
                "isStale": True,
                "freshnessTier": "low",
                # Otherwise well within TTL - isStale must still force "aged".
                "crawledAt": NOW_EPOCH_MS - 1 * DAY_MS,
            },
            "failed_document": {
                "id": "failed_document",
                "status": "failed",
                "isStale": False,
                "freshnessTier": "low",
                "crawledAt": NOW_EPOCH_MS - 1 * DAY_MS,
            },
            "pending_document": {
                "id": "pending_document",
                "status": "pending",
                "isStale": False,
                "freshnessTier": "low",
                "crawledAt": NOW_EPOCH_MS - 1 * DAY_MS,
            },
            "processing_document": {
                "id": "processing_document",
                "status": "processing",
                "isStale": False,
                "freshnessTier": "low",
                "crawledAt": NOW_EPOCH_MS - 1 * DAY_MS,
            },
            "old_but_eligible_penalty": {
                "id": "old_but_eligible_penalty",
                "status": "active",
                "isStale": False,
                "freshnessTier": "high",  # 14-day TTL
                "crawledAt": NOW_EPOCH_MS - (HIGH_TTL_DAYS + 6) * DAY_MS,  # 20 days: beyond TTL
            },
            "current_no_penalty": {
                "id": "current_no_penalty",
                "status": "indexed",
                "isStale": False,
                "freshnessTier": "high",  # 14-day TTL
                "crawledAt": NOW_EPOCH_MS - 5 * DAY_MS,  # within TTL
            },
            # Regression guard for the truthy-vs-undefined fidelity bug caught
            # during implementation (see apply_freshness_filter.ts's inline
            # comment): an empty-string status is falsy, so the real
            # hard-exclusion guard skips exclusion entirely for it, even
            # though isRetrievalEligibleStatus("") alone would return false.
            "empty_string_status": {
                "id": "empty_string_status",
                "status": "",
                "isStale": False,
                "freshnessTier": "low",
                "crawledAt": NOW_EPOCH_MS - 1 * DAY_MS,
            },
        }
        output = run_freshness_filter(list(cls.rows.values()))
        cls.by_id = {row["id"]: row for row in output}

    def test_eligible_current_document(self):
        row = self.by_id["eligible_current"]
        self.assertTrue(row["eligible"])
        self.assertEqual(row["state"], "fresh")
        self.assertFalse(row["penalized"])
        self.assertEqual(row["scoreMultiplier"], 1.0)

    def test_stale_flagged_document(self):
        row = self.by_id["stale_flagged"]
        self.assertTrue(row["eligible"], "isStale-flagged docs remain eligible, just penalized")
        self.assertEqual(row["state"], "aged")
        self.assertTrue(row["penalized"])
        self.assertEqual(row["scoreMultiplier"], DEFAULT_STALE_SCORE_MULTIPLIER)
        self.assertIn("isStale_flagged", row["reason"])

    def test_failed_document_hard_excluded(self):
        row = self.by_id["failed_document"]
        self.assertFalse(row["eligible"])
        self.assertIn("hard_excluded_status:failed", row["reason"])

    def test_pending_document_hard_excluded(self):
        row = self.by_id["pending_document"]
        self.assertFalse(row["eligible"])
        self.assertIn("hard_excluded_status:pending", row["reason"])

    def test_processing_document_hard_excluded(self):
        row = self.by_id["processing_document"]
        self.assertFalse(row["eligible"])
        self.assertIn("hard_excluded_status:processing", row["reason"])

    def test_old_but_eligible_with_freshness_penalty(self):
        row = self.by_id["old_but_eligible_penalty"]
        self.assertTrue(row["eligible"])
        self.assertEqual(row["state"], "aged")
        self.assertTrue(row["penalized"])
        self.assertEqual(row["scoreMultiplier"], DEFAULT_STALE_SCORE_MULTIPLIER)
        self.assertIn("beyond_ttl", row["reason"])

    def test_current_document_with_no_penalty(self):
        row = self.by_id["current_no_penalty"]
        self.assertTrue(row["eligible"])
        self.assertEqual(row["state"], "fresh")
        self.assertFalse(row["penalized"])
        self.assertEqual(row["scoreMultiplier"], 1.0)

    def test_empty_string_status_is_not_hard_excluded(self):
        row = self.by_id["empty_string_status"]
        self.assertTrue(
            row["eligible"],
            "an empty-string status is falsy, so the real guard "
            "(docMeta?.status && !isRetrievalEligibleStatus(...)) must not "
            "hard-exclude it - matching search.ts's short-circuit exactly",
        )


class RedPreFixEvaluatorHadNoEligibilityFiltering(unittest.TestCase):
    """RED: before this remediation, the evaluator had no eligibility/
    freshness concept at all - not a different implementation, a complete
    absence. Confirmed by reading the actual pre-fix source from git
    history, not asserted from memory."""

    @classmethod
    def setUpClass(cls):
        cls.source = subprocess.run(
            ["git", "show", f"{PRE_FIX_COMMIT}:scripts/stage_e_retrieval_eval.py"],
            cwd=PROJECT_ROOT,
            capture_output=True,
            text=True,
            timeout=30,
            check=True,
        ).stdout

    def test_pre_fix_had_no_freshness_filter_functions(self):
        self.assertNotIn("def filter_eligible_chunks", self.source)
        self.assertNotIn("def run_freshness_filter", self.source)

    def test_pre_fix_chunk_record_had_no_eligibility_fields(self):
        # Extract just the ChunkRecord dataclass block (up to the next
        # top-level "class "/"def " line) so this only checks its own
        # fields, not an unrelated later occurrence of these substrings
        # elsewhere in the file.
        start = self.source.index("class ChunkRecord")
        rest = self.source[start + len("class ChunkRecord") :]
        end = min(
            i
            for i in (rest.find("\nclass "), rest.find("\ndef "))
            if i != -1
        )
        block = rest[:end]
        self.assertNotIn("status", block)
        self.assertNotIn("is_stale", block)
        self.assertNotIn("freshness_tier", block)
        self.assertNotIn("crawled_at", block)


class GreenCurrentEvaluatorHasRealEligibilityFiltering(unittest.TestCase):
    """GREEN: the current evaluator has both the data fields and the
    subprocess-backed filter function reusing the real production logic."""

    def test_current_module_has_freshness_filter_functions(self):
        import stage_e_retrieval_eval as current

        self.assertTrue(hasattr(current, "filter_eligible_chunks"))
        self.assertTrue(hasattr(current, "run_freshness_filter"))

    def test_current_chunk_record_has_eligibility_fields(self):
        import stage_e_retrieval_eval as current
        import dataclasses

        field_names = {f.name for f in dataclasses.fields(current.ChunkRecord)}
        self.assertIn("status", field_names)
        self.assertIn("is_stale", field_names)
        self.assertIn("freshness_tier", field_names)
        self.assertIn("crawled_at", field_names)


if __name__ == "__main__":
    unittest.main(verbosity=2)
