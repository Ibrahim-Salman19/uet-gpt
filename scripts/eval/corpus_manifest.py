"""Corpus identity manifest — a content-addressed fingerprint of the evaluation universe.

The harness's precision/recall numbers are only meaningful if we know *exactly*
what was evaluated. Without a manifest, deleting a difficult fixture or silently
relabeling its family can improve the metrics without improving extraction
quality. This module walks the fixture tree and emits a stable, hash-pinned
manifest: any add / remove / body-change / expectation-change / criticality-change
alters ``corpus_manifest_hash``.

The manifest is attached to every report (``report["corpus_manifest"]``) and the
top-level hash (``report["corpus_manifest_hash"]``) is compared by
``detect_regression`` so a changed corpus is never silently compared as if it
were the same evaluation universe.

Pure and side-effect-free (no imports of the extractor); safe to unit-test in
isolation.
"""

from __future__ import annotations

import hashlib
import json
from pathlib import Path
from typing import Any

EVALUATION_SCHEMA_VERSION = 3

# Files that make up a fixture's identity. Each contributes its own hash so a
# baseline diff can say *what* changed (body vs expectations vs metadata), not
# just that the universe changed.
_FIXTURE_FILES = ("body.bin", "response-headers.json", "meta.json", "expected.json")


def _sha256_file(path: Path) -> str | None:
    """sha256 of a file's bytes, or None if the file is absent (malformed fixture)."""
    if not path.exists():
        return None
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(65536), b""):
            h.update(chunk)
    return h.hexdigest()


def _read_criticality(fixture_dir: Path) -> str:
    """Read ``expected.criticality`` (default ``standard``), validating the enum.

    A malformed value falls back to ``standard`` rather than crashing the manifest
    build — the per-fixture detail is preserved in the report for diagnosis.
    """
    exp_p = fixture_dir / "expected.json"
    if not exp_p.exists():
        return "standard"
    try:
        data = json.loads(exp_p.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return "standard"
    inner = data.get("expected", data) if isinstance(data, dict) else {}
    if not isinstance(inner, dict):
        return "standard"
    crit = str(inner.get("criticality", "standard")).lower()
    return crit if crit in {"critical", "standard", "diagnostic"} else "standard"


def build_manifest(corpus_root: Path) -> dict[str, Any]:
    """Walk ``corpus_root/<family>/<slug>/`` and build the content-addressed manifest.

    Returns::

        {
          "evaluation_schema_version": 3,
          "fixture_count": N,
          "corpus_manifest_hash": "<sha256 over canonical JSON of fixtures[]>",
          "fixtures": [
            {"fixture_id", "family", "criticality",
             "body_sha256", "headers_sha256", "metadata_sha256", "expectations_sha256"},
            ...
          ]
        }

    ``fixtures`` is sorted by ``fixture_id`` so the hash is order-independent.
    Missing files contribute ``None`` hashes — malformed fixtures surface via the
    integrity tests and the gate, not by crashing this walk.
    """
    corpus_root = Path(corpus_root)
    entries: list[dict[str, Any]] = []
    if corpus_root.is_dir():
        for family_dir in sorted(d for d in corpus_root.iterdir() if d.is_dir()):
            for fixture_dir in sorted(d for d in family_dir.iterdir() if d.is_dir()):
                entries.append({
                    "fixture_id": f"{family_dir.name}/{fixture_dir.name}",
                    "family": family_dir.name,
                    "criticality": _read_criticality(fixture_dir),
                    "body_sha256": _sha256_file(fixture_dir / "body.bin"),
                    "headers_sha256": _sha256_file(fixture_dir / "response-headers.json"),
                    "metadata_sha256": _sha256_file(fixture_dir / "meta.json"),
                    "expectations_sha256": _sha256_file(fixture_dir / "expected.json"),
                })

    canonical = json.dumps(entries, sort_keys=True, separators=(",", ":")).encode("utf-8")
    return {
        "evaluation_schema_version": EVALUATION_SCHEMA_VERSION,
        "fixture_count": len(entries),
        "corpus_manifest_hash": hashlib.sha256(canonical).hexdigest(),
        "fixtures": entries,
    }


def diff_manifests(current: dict[str, Any], baseline: dict[str, Any]) -> dict[str, Any]:
    """Compare two manifests and classify the universe change.

    Returns ``{"universe": "unchanged"|"changed"|"unknown", "removed": [...],
    "added": [...], "changed": [{"fixture_id", "field"}], "summary": str}``.

    ``unknown`` means one or both sides lack ``corpus_manifest_hash`` (pre-schema-v3
    baseline) — the caller should warn rather than silently compare.
    """
    cur_hash = current.get("corpus_manifest_hash")
    base_hash = baseline.get("corpus_manifest_hash")
    if cur_hash is None or base_hash is None:
        return {"universe": "unknown",
                "removed": [], "added": [], "changed": [],
                "summary": "baseline lacks corpus_manifest_hash (pre-v3 schema)"}
    if cur_hash == base_hash:
        return {"universe": "unchanged",
                "removed": [], "added": [], "changed": [],
                "summary": "corpus universe identical"}

    cur_by_id = {f["fixture_id"]: f for f in current.get("fixtures", [])}
    base_by_id = {f["fixture_id"]: f for f in baseline.get("fixtures", [])}
    removed = sorted(set(base_by_id) - set(cur_by_id))
    added = sorted(set(cur_by_id) - set(base_by_id))
    changed: list[dict[str, str]] = []
    for fid in sorted(set(cur_by_id) & set(base_by_id)):
        cur_f, base_f = cur_by_id[fid], base_by_id[fid]
        for field in ("family", "criticality", "body_sha256",
                      "headers_sha256", "metadata_sha256", "expectations_sha256"):
            if cur_f.get(field) != base_f.get(field):
                changed.append({"fixture_id": fid, "field": field,
                                "baseline": str(base_f.get(field)),
                                "current": str(cur_f.get(field))})
    return {
        "universe": "changed",
        "removed": removed,
        "added": added,
        "changed": changed,
        "summary": (f"corpus universe changed: "
                    f"{len(removed)} removed, {len(added)} added, {len(changed)} field-change(s)"),
    }
