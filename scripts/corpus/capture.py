"""Capture real UET responses into a versioned, immutable fixture corpus.

This tool wraps the production fetch stack (``RawHttpClient`` + ``UrlPolicy`` +
``HostSafetyCache``) so every captured fixture inherits the same SSRF,
redirect, and size-bounded guarantees as a live crawl. It does **not** touch
the extractor or push anything to Convex — it only persists raw responses to
disk so that ``run_extraction_eval.py`` can replay them deterministically.

A fixture is a directory ``fixtures/<family>/<slug>/`` containing:

    request.json          requested URL + provenance
    response-headers.json status + lowercased response headers
    body.bin              raw response bytes (exact)
    meta.json             sha256/size/content-type/final-url/redirects/IP/timing

Failures (4xx/5xx, empty bodies, fetch exceptions) are captured as first-class
fixtures, not errors — they are the corpus's regression guards for graceful
handling.

Usage (run from the repository root)::

    python scripts/corpus/capture.py                       # capture the whole starter set
    python scripts/corpus/capture.py --family legacy-asp   # one family
    python scripts/corpus/capture.py --limit 4             # first N by registry order
    python scripts/corpus/capture.py --force               # re-capture even if present
"""

from __future__ import annotations

import argparse
import asyncio
import hashlib
import json
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

# Make ``scripts/`` importable so ``crawler`` and the ``uet_crawler`` package
# resolve, exactly the way the existing test suite does it.
SCRIPTS_DIR = Path(__file__).resolve().parents[1]
if str(SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPTS_DIR))

from crawler import (  # noqa: E402  (import after sys.path bootstrap)
    CliArgs,
    HostSafetyCache,
    RawHttpClient,
    UrlPolicy,
    load_settings,
)
from uet_crawler.crawl_ledger import CrawlLedger  # noqa: E402

from corpus.starter_set import STARTER_SET, slugify  # noqa: E402

CORPUS_VERSION = 1
CAPTURE_TOOL_VERSION = 1
REPO_ROOT = SCRIPTS_DIR.parent
FIXTURES_DIR = Path(__file__).resolve().parent / "fixtures"


# ─────────────────────────────────────────────────────────────────────────────
# Fetch stack construction (mirrors crawler.py:4876-4919 but with no crawl loop)
# ─────────────────────────────────────────────────────────────────────────────


def build_fetch_stack(config_path: str):
    """Construct the production fetch trio (settings, policy, client).

    Returns ``(settings, policy, host_safety, raw_http)``. We build a ``CliArgs``
    stand-in rather than parsing ``argv`` so this tool controls its own flags.
    """
    script_path = SCRIPTS_DIR / "crawler.py"
    args = CliArgs(
        limit=0,
        clean=False,
        config=config_path,
        project_root=None,
        resume=False,
        dry_run=True,           # never push, never reset
        log_level="WARNING",
        require_complete=False,
    )
    settings = load_settings(args, script_path)
    policy = UrlPolicy(settings)
    host_safety = HostSafetyCache()
    raw_http = RawHttpClient(settings, policy, host_safety)
    return settings, policy, host_safety, raw_http


# ─────────────────────────────────────────────────────────────────────────────
# Per-fixture capture
# ─────────────────────────────────────────────────────────────────────────────


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def _write_json(path: Path, payload: Any) -> None:
    path.write_text(json.dumps(payload, indent=2, sort_keys=True) + "\n", encoding="utf-8")


async def capture_one(
    family: str,
    url: str,
    *,
    raw_http: RawHttpClient,
    host_safety: HostSafetyCache,
    settings,
    delay: float,
) -> dict[str, Any]:
    """Fetch one URL and persist its fixture. Returns a capture record dict.

    Never raises for ordinary HTTP failures or fetch exceptions — those become
    ``ok=False`` fixtures so the eval can score graceful handling. Only
    filesystem errors propagate.
    """
    slug = slugify(url)
    fixture_dir = FIXTURES_DIR / family / slug
    fixture_dir.mkdir(parents=True, exist_ok=True)

    fetched_at = _utc_now_iso()
    t0 = time.perf_counter()
    record: dict[str, Any] = {
        "family": family,
        "requested_url": url,
        "fixture_id": f"{family}/{slug}",
        "slug": slug,
        "fetched_at": fetched_at,
        "ok": False,
        "error": None,
    }

    try:
        result = await raw_http.get(
            url,
            timeout=settings.request_timeout,
            max_bytes=settings.max_response_bytes,
        )
        elapsed_ms = int((time.perf_counter() - t0) * 1000)

        # Best-effort remote IP (the fetch pins it internally; resolve() returns
        # the same validated address set, or None for a private/failed lookup).
        resolution = await host_safety.resolve(result.final_url or url)
        remote_ip = ",".join(resolution.addresses) if resolution else None

        body_sha = hashlib.sha256(result.body).hexdigest()
        _write_json(fixture_dir / "request.json", {
            "requested_url": url,
            "captured_at": fetched_at,
            "capture_tool_version": CAPTURE_TOOL_VERSION,
            "corpus_version": CORPUS_VERSION,
        })
        _write_json(fixture_dir / "response-headers.json", {
            "status": result.status,
            "headers": dict(result.headers),
        })
        (fixture_dir / "body.bin").write_bytes(result.body)
        _write_json(fixture_dir / "meta.json", {
            "body_sha256": body_sha,
            "body_size": len(result.body),
            "content_type": result.content_type,
            "status": result.status,
            "final_url": result.final_url,
            "requested_url": result.requested_url,
            "redirect_chain": list(result.redirect_chain),
            "remote_ip": remote_ip,
            "fetched_at": fetched_at,
            "elapsed_ms": elapsed_ms,
        })
        record.update(
            status=result.status,
            body_size=len(result.body),
            body_sha256=body_sha,
            ok=True,
        )
    except Exception as exc:  # noqa: BLE001 — capture any fetch-layer failure as a fixture
        elapsed_ms = int((time.perf_counter() - t0) * 1000)
        record["error"] = f"{type(exc).__name__}: {exc}"
        record["elapsed_ms"] = elapsed_ms
        # Persist a marker so the fixture is still a complete, replayable unit.
        _write_json(fixture_dir / "request.json", {
            "requested_url": url,
            "captured_at": fetched_at,
            "capture_tool_version": CAPTURE_TOOL_VERSION,
            "corpus_version": CORPUS_VERSION,
        })
        _write_json(fixture_dir / "response-headers.json", {"status": None, "headers": {}})
        (fixture_dir / "body.bin").write_bytes(b"")
        _write_json(fixture_dir / "meta.json", {
            "body_sha256": hashlib.sha256(b"").hexdigest(),
            "body_size": 0,
            "content_type": "",
            "status": None,
            "final_url": url,
            "requested_url": url,
            "redirect_chain": [],
            "remote_ip": None,
            "fetched_at": fetched_at,
            "elapsed_ms": elapsed_ms,
            "error": record["error"],
        })

    if delay > 0:
        await asyncio.sleep(delay)
    return record


# ─────────────────────────────────────────────────────────────────────────────
# MANIFEST
# ─────────────────────────────────────────────────────────────────────────────


def write_manifest(records: list[dict[str, Any]]) -> None:
    """Write the corpus MANIFEST.json with per-family counts.

    The MANIFEST is the eval's fast index; it is regenerated from the fixtures
    on disk, so it never drifts from reality.
    """
    by_family: dict[str, int] = {}
    for r in records:
        by_family[r["family"]] = by_family.get(r["family"], 0) + 1
    manifest = {
        "corpus_version": CORPUS_VERSION,
        "generated_at": _utc_now_iso(),
        "fixture_count": len(records),
        "families": dict(sorted(by_family.items())),
        "fixtures": [
            {
                "fixture_id": r["fixture_id"],
                "family": r["family"],
                "requested_url": r["requested_url"],
                "status": r.get("status"),
                "ok": r["ok"],
            }
            for r in sorted(records, key=lambda x: x["fixture_id"])
        ],
    }
    _write_json(Path(__file__).resolve().parent / "MANIFEST.json", manifest)


# ─────────────────────────────────────────────────────────────────────────────
# CLI
# ─────────────────────────────────────────────────────────────────────────────


async def run(args: argparse.Namespace) -> int:
    config_path = args.config
    # Validate the path the same way the crawler would.
    cp = Path(config_path)
    if not cp.is_absolute():
        cp = REPO_ROOT / cp
    if not cp.exists():
        print(f"ERROR: config not found: {cp}", file=sys.stderr)
        return 2

    settings, _policy, host_safety, raw_http = build_fetch_stack(args.config)

    targets = STARTER_SET
    if args.family:
        targets = tuple(t for t in STARTER_SET if t[0] == args.family)
    if args.limit:
        targets = targets[: args.limit]
    if not targets:
        print("No fixtures matched the given filters.", file=sys.stderr)
        return 1

    print(f"Capturing {len(targets)} fixtures into {FIXTURES_DIR} (delay={args.delay}s) ...")
    records: list[dict[str, Any]] = []
    for family, url in targets:
        fixture_id = f"{family}/{slugify(url)}"
        if not args.force and (FIXTURES_DIR / family / slugify(url) / "meta.json").exists():
            print(f"  SKIP  {fixture_id}  (already captured; use --force to re-capture)")
            continue
        rec = await capture_one(
            family, url, raw_http=raw_http, host_safety=host_safety,
            settings=settings, delay=args.delay,
        )
        status = rec.get("status")
        marker = "OK" if rec["ok"] else "FAIL"
        detail = f"status={status} bytes={rec.get('body_size')}" if rec["ok"] else rec["error"]
        print(f"  {marker:4} {fixture_id}  {detail}")
        records.append(rec)

    # Always rebuild the MANIFEST from every fixture on disk (not just this run)
    # so it stays consistent after partial/skipped runs.
    all_records = _scan_existing_fixtures()
    write_manifest(all_records)
    print(f"\nMANIFEST regenerated: {len(all_records)} fixtures on disk.")
    return 0


def _scan_existing_fixtures() -> list[dict[str, Any]]:
    """Re-read minimal metadata from every fixture directory under fixtures/."""
    records: list[dict[str, Any]] = []
    if not FIXTURES_DIR.exists():
        return records
    for meta_path in sorted(FIXTURES_DIR.glob("*/*/meta.json")):
        try:
            meta = json.loads(meta_path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            continue
        family = meta_path.parent.parent.name
        slug = meta_path.parent.name
        records.append({
            "family": family,
            "fixture_id": f"{family}/{slug}",
            "requested_url": meta.get("requested_url", ""),
            "status": meta.get("status"),
            "ok": meta.get("status") is not None and "error" not in meta,
        })
    return records


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description="Capture the UET extraction corpus.")
    p.add_argument("--config", default="scripts/crawl_config.production.json",
                   help="Crawler config path (relative to repo root).")
    p.add_argument("--family", default=None,
                   help="Only capture URLs whose family matches (e.g. legacy-asp).")
    p.add_argument("--limit", type=int, default=0,
                   help="Capture at most N fixtures (0 = all).")
    p.add_argument("--delay", type=float, default=2.0,
                   help="Politeness delay in seconds between requests (default 2.0).")
    p.add_argument("--force", action="store_true",
                   help="Re-capture fixtures that already exist.")
    return asyncio.run(run(p.parse_args(argv)))


if __name__ == "__main__":
    raise SystemExit(main())
