"""
test_hybrid_topology_fidelity.py — evaluator hybrid-ranking topology vs. real
production hybridRank() (retrieval-baseline remediation, docs/
rag-store-evaluation/retrieval-baseline-2026-08/, mandatory remediation 2).

No live Convex database is available yet to run a numeric before/after
comparison (task #59 is blocked pending real corpus credentials), so this is
a STRUCTURAL red-green proof instead of a score-comparison one:

  - RED:   commit 587363d's local Python reciprocal_rank_fusion() - now
           removed entirely, not patched - is loaded from git history and
           shown, by inspecting its real signature, to be a fixed 2-channel,
           equally-weighted fusion with no adaptive weighting and no FAQ
           input. That is exactly the "fixed 2-channel substitute" the
           remediation mandate explicitly prohibits as an authoritative
           baseline.
  - GREEN: the current evaluator contains no local hybrid/RRF reimplementation
           at all - convex/rag/evalRetrieval.ts instead calls production's
           real internal.embeddings.search.searchDocumentsAction and
           internal.reranking.cascade.cascadeRerank verbatim, and that real
           searchDocumentsAction (convex/embeddings/search.ts) is confirmed
           by source inspection to exercise the full topology: adaptive
           query-dependent weighting (estimateIdf), the real hybridRank()
           with RRF_K=60, and FAQ injection - none of which the old local
           reimplementation had.

This test reads source text rather than executing convex/rag/evalRetrieval.ts
(which requires a live Convex deployment) - it is a static fidelity check,
not a runtime one. The runtime check happens when the real baseline is
executed (task #59).
"""
import importlib.util
import inspect
import re
import subprocess
import sys
import types
import unittest
from pathlib import Path

SCRIPTS_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = SCRIPTS_DIR.parent
PRE_FIX_COMMIT = "587363db82285781ecd6e4f4a57c0f57b752195b"


def _load_module_from_source(source: str, module_name: str) -> types.ModuleType:
    spec = importlib.util.spec_from_loader(module_name, loader=None)
    assert spec is not None
    module = importlib.util.module_from_spec(spec)
    module.__file__ = str(SCRIPTS_DIR / "stage_e_retrieval_eval.py")
    sys.modules[module_name] = module
    exec(compile(source, f"<{module_name}>", "exec"), module.__dict__)
    return module


def _git_show(path: str, commit: str = "HEAD") -> str:
    return subprocess.run(
        ["git", "show", f"{commit}:{path}"],
        cwd=PROJECT_ROOT,
        capture_output=True,
        text=True,
        timeout=30,
        check=True,
    ).stdout


class RedOldLocalReimplementationWasStructurallyLimited(unittest.TestCase):
    """RED: the removed local RRF function, executed for real from git
    history, is structurally a fixed 2-channel equal-weight fusion."""

    @classmethod
    def setUpClass(cls):
        cls.source = _git_show("scripts/stage_e_retrieval_eval.py", PRE_FIX_COMMIT)
        cls.pre_fix_module = _load_module_from_source(
            cls.source, "stage_e_retrieval_eval_pre_fix_rrf"
        )

    def test_old_function_took_exactly_two_ranking_channels(self):
        fn = self.pre_fix_module.reciprocal_rank_fusion
        params = inspect.signature(fn).parameters
        channel_params = [
            name for name in params if "documents" in name or "channel" in name
        ]
        self.assertEqual(
            sorted(channel_params),
            ["bm25_documents", "dense_documents"],
            "the old evaluator's local RRF took exactly dense+bm25 - no third "
            "(chunk-level lexical) channel, matching the mandate's description "
            "of the prohibited 'fixed 2-channel substitute'",
        )

    def test_old_function_had_no_adaptive_weighting_or_faq_parameter(self):
        fn = self.pre_fix_module.reciprocal_rank_fusion
        params = set(inspect.signature(fn).parameters)
        self.assertNotIn("weights", params)
        self.assertNotIn("adaptive_weights", params)
        self.assertNotIn("faq", params)
        self.assertNotIn("faq_results", params)

    def test_old_function_body_used_equal_weight_per_channel(self):
        # Checked against the raw git-show source text directly (not
        # inspect.getsource(), which requires linecache to resolve real
        # on-disk lines matching __file__ - this module's __file__ was
        # pointed at the current file for PROJECT_ROOT resolution, so its
        # line numbers don't correspond to the historical content).
        # Both channels fold into the same unweighted accumulator via the
        # identical `1.0 / (rrf_k + rank)` term inside one shared loop over
        # (dense_documents, bm25_documents) - no per-channel coefficient.
        self.assertIn("for ranking in (dense_documents, bm25_documents):", self.source)
        self.assertIn("scores[url] += 1.0 / (rrf_k + rank)", self.source)


class GreenCurrentEvaluatorHasNoLocalReimplementation(unittest.TestCase):
    """GREEN: the current evaluator has removed the local RRF entirely and
    reuses the real production ranking implementation instead."""

    def test_current_module_has_no_reciprocal_rank_fusion(self):
        import stage_e_retrieval_eval as current

        self.assertFalse(
            hasattr(current, "reciprocal_rank_fusion"),
            "the local RRF reimplementation must be removed, not patched - "
            "the mandate requires reusing production's real hybridRank(), "
            "not a corrected second copy of it",
        )
        self.assertFalse(hasattr(current, "DEFAULT_RRF_K"))

    def test_eval_retrieval_endpoint_calls_real_production_functions(self):
        eval_retrieval_source = (PROJECT_ROOT / "convex" / "rag" / "evalRetrieval.ts").read_text()
        self.assertIn(
            "internal.embeddings.search.searchDocumentsAction", eval_retrieval_source
        )
        self.assertIn("internal.reranking.cascade.cascadeRerank", eval_retrieval_source)
        # No hand-rolled fusion formula should be reintroduced in the eval
        # endpoint itself - it must be a thin pass-through, not a second
        # implementation.
        self.assertNotIn("1 / (", eval_retrieval_source)
        self.assertNotIn("1.0 / (", eval_retrieval_source)

    def test_real_search_documents_action_exercises_full_topology(self):
        # Static confirmation that the real function evalRetrieval.ts calls
        # actually contains the full topology the old local RRF lacked:
        # adaptive weighting, RRF_K=60 hybridRank, and FAQ injection.
        search_source = (PROJECT_ROOT / "convex" / "embeddings" / "search.ts").read_text()
        self.assertIn("estimateIdf", search_source)
        self.assertIn("RRF_K = 60", search_source)
        self.assertIn("hybridRank(", search_source)
        self.assertIn("fetchActiveFaqs", search_source)
        self.assertIn("export const searchDocumentsAction", search_source)

    def test_eval_retrieval_endpoint_is_internal_only(self):
        # Security discipline established by lifecycleTest.ts: evaluation-only
        # Convex functions must be internalAction/internalQuery, never part
        # of the public application surface. Matches Convex's own export
        # convention (`export const foo = internalAction({...})` vs the
        # public `export const foo = action({...})`) - the regex requires
        # "action(" to start immediately after "= " with nothing else
        # between, so it does not match "= internalAction(".
        eval_retrieval_source = (PROJECT_ROOT / "convex" / "rag" / "evalRetrieval.ts").read_text()
        self.assertIn("internalAction(", eval_retrieval_source)
        self.assertIsNone(
            re.search(r"=\s*action\(", eval_retrieval_source),
            "found a plain (non-internal) action() export - evaluation-only "
            "Convex functions must never be reachable from the public API",
        )


if __name__ == "__main__":
    unittest.main(verbosity=2)
