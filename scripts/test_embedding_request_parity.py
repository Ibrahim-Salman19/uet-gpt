"""
test_embedding_request_parity.py — evaluator vs. production Gemini embedding
request-construction parity (retrieval-baseline remediation, docs/
rag-store-evaluation/retrieval-baseline-2026-08/).

Proves scripts/stage_e_retrieval_eval.py's GeminiEmbeddingClient._request_for()
constructs the same request shape production's
buildGeminiBatchEmbedContentsRequestItem (convex/embeddings/generate.ts) sends
to Gemini's batchEmbedContents endpoint - via scripts/print_embedding_request.ts,
which imports and calls the real production function directly, not a
hand-copied spec. This tests request CONSTRUCTION, not equality of returned
floating-point vectors (the remote model's output may legitimately vary
between calls).

Also proves the divergence this remediation fixed was real, by loading the
actual pre-fix module from git history (not a hardcoded guess) and showing it
fails the same assertion the current code now passes:
  - RED:   commit 587363d's _request_for() nested outputDimensionality under
           an embedContentConfig object with an extra autoTruncate field.
  - GREEN: the current _request_for() uses a flat top-level
           outputDimensionality, matching production.
"""
import importlib.util
import json
import subprocess
import sys
import types
import unittest
from pathlib import Path

SCRIPTS_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = SCRIPTS_DIR.parent

# The commit at which this remediation began; scripts/stage_e_retrieval_eval.py
# at this revision still has the pre-fix GeminiEmbeddingClient._request_for()
# (embedContentConfig-nested shape). Verified present via:
#   git show 587363db82285781ecd6e4f4a57c0f57b752195b:scripts/stage_e_retrieval_eval.py | grep embedContentConfig
PRE_FIX_COMMIT = "587363db82285781ecd6e4f4a57c0f57b752195b"

FIXED_TEXT = "How can I apply for admission at UET Taxila?"
FIXED_DIMENSIONS = 768
FIXED_MODEL = "gemini-embedding-2"


def _production_batch_item_shape(text: str, dimensions: int) -> dict:
    """Calls the REAL production TS function via scripts/print_embedding_request.ts."""
    result = subprocess.run(
        ["npx", "tsx", str(SCRIPTS_DIR / "print_embedding_request.ts"), text, str(dimensions)],
        cwd=PROJECT_ROOT,
        capture_output=True,
        text=True,
        timeout=60,
    )
    if result.returncode != 0:
        raise RuntimeError(
            f"print_embedding_request.ts failed (exit {result.returncode}): {result.stderr}"
        )
    return json.loads(result.stdout)["batchItem"]


def _load_module_from_source(source: str, module_name: str) -> types.ModuleType:
    """Loads a standalone copy of stage_e_retrieval_eval.py from source text
    under a distinct module name, isolated from sys.modules, so a historical
    git snapshot can be exercised for real in the same test process alongside
    the currently-imported (fixed) module."""
    spec = importlib.util.spec_from_loader(module_name, loader=None)
    assert spec is not None
    module = importlib.util.module_from_spec(spec)
    # The module's own top-level code computes PROJECT_ROOT from __file__
    # (Path(__file__).resolve().parents[1]); point it at this file's real
    # location on disk so that resolves correctly even though the executed
    # source text came from a git blob, not this path.
    module.__file__ = str(SCRIPTS_DIR / "stage_e_retrieval_eval.py")
    # dataclasses' string-annotation resolution (ClassVar/InitVar detection)
    # looks the module up via sys.modules[cls.__module__] - register it like
    # a real import would, since this module defines @dataclass classes.
    sys.modules[module_name] = module
    exec(compile(source, f"<{module_name}>", "exec"), module.__dict__)
    return module


def _request_for_via_client(module: types.ModuleType, text: str, model: str, dimensions: int) -> dict:
    """Builds a GeminiEmbeddingClient without running its network-touching
    __init__ (bypassed via __new__), sets only the attributes _request_for
    reads, and calls the real method - not a copy of its logic."""
    client = module.GeminiEmbeddingClient.__new__(module.GeminiEmbeddingClient)
    client.model = model
    client.dimensions = dimensions
    return client._request_for(text)


class EmbeddingRequestParityTests(unittest.TestCase):
    """Current (post-fix) evaluator code vs. real production code."""

    @classmethod
    def setUpClass(cls):
        cls.production_shape = _production_batch_item_shape(FIXED_TEXT, FIXED_DIMENSIONS)

    def test_current_evaluator_matches_production_batch_item_shape(self):
        import stage_e_retrieval_eval as current

        actual = _request_for_via_client(current, FIXED_TEXT, FIXED_MODEL, FIXED_DIMENSIONS)
        self.assertEqual(
            actual,
            self.production_shape,
            "evaluator's _request_for() must byte-for-byte match production's "
            "buildGeminiBatchEmbedContentsRequestItem for the same text/dimensions",
        )

    def test_current_evaluator_has_no_embedContentConfig_wrapper(self):
        import stage_e_retrieval_eval as current

        actual = _request_for_via_client(current, FIXED_TEXT, FIXED_MODEL, FIXED_DIMENSIONS)
        self.assertNotIn("embedContentConfig", actual)
        self.assertNotIn("autoTruncate", actual)
        self.assertEqual(actual["outputDimensionality"], FIXED_DIMENSIONS)

    def test_prepare_embedding_input_sends_raw_text_no_prefix(self):
        # Mandatory remediation 1 also removed the evaluator-only task-type
        # prefix/title-wrapping transformation - raw text only, matching
        # production (gemini-embedding-2's taskType parameter is a confirmed
        # no-op; see convex/embeddings/generate.ts's model comment).
        import stage_e_retrieval_eval as current

        prepared = current.prepare_embedding_input(
            current.EmbedInput("query", FIXED_TEXT)
        )
        self.assertEqual(prepared, FIXED_TEXT)


class EmbeddingRequestRedGreenTests(unittest.TestCase):
    """Proves the fixed divergence was real by executing the actual pre-fix
    code (loaded from git history, not hardcoded) and showing it fails the
    same assertion the current code now passes."""

    @classmethod
    def setUpClass(cls):
        cls.production_shape = _production_batch_item_shape(FIXED_TEXT, FIXED_DIMENSIONS)
        source = subprocess.run(
            ["git", "show", f"{PRE_FIX_COMMIT}:scripts/stage_e_retrieval_eval.py"],
            cwd=PROJECT_ROOT,
            capture_output=True,
            text=True,
            timeout=30,
            check=True,
        ).stdout
        cls.pre_fix_module = _load_module_from_source(source, "stage_e_retrieval_eval_pre_fix")

    def test_red_pre_fix_code_diverges_from_production(self):
        """RED: the actual pre-fix code, executed for real, does NOT match
        production - proving the divergence this remediation fixed was genuine."""
        actual = _request_for_via_client(
            self.pre_fix_module, FIXED_TEXT, FIXED_MODEL, FIXED_DIMENSIONS
        )
        self.assertNotEqual(
            actual,
            self.production_shape,
            f"expected commit {PRE_FIX_COMMIT[:12]}'s _request_for() to diverge from "
            "production (that was the bug) - if this now matches, the historical "
            "snapshot or the production reference has changed and this test needs review",
        )
        self.assertIn("embedContentConfig", actual)
        self.assertIn("autoTruncate", actual["embedContentConfig"])

    def test_green_current_code_no_longer_diverges(self):
        """GREEN: the current, fixed code, executed for real, matches production."""
        import stage_e_retrieval_eval as current

        actual = _request_for_via_client(current, FIXED_TEXT, FIXED_MODEL, FIXED_DIMENSIONS)
        self.assertEqual(actual, self.production_shape)


if __name__ == "__main__":
    unittest.main(verbosity=2)
