"""Generate a skeleton ``expected.json`` for each captured fixture.

A skeleton is auto-filled from the *current* extractor's output — title,
canonical host, and a sample of discovered links — and clearly flagged
``"_auto_generated": true``. The intention is to remove the blank-page cost of
authoring golden expectations: a human curates only the
``required_text_blocks`` / ``forbidden_text_blocks`` (the load-bearing parts)
and deletes the flag once reviewed.

Skeletons are only written where no ``expected.json`` exists, so this tool is
safe to re-run; it never overwrites a curated expectation.

Usage (from the repo root)::

    python scripts/corpus/bootstrap_expectations.py
    python scripts/corpus/bootstrap_expectations.py --family legacy-asp
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from urllib.parse import urlsplit

SCRIPTS_DIR = Path(__file__).resolve().parents[1]
if str(SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPTS_DIR))

from html_extractor import extract_html_document  # noqa: E402

FIXTURES_DIR = Path(__file__).resolve().parent / "fixtures"


class _ReplayPolicy:
    def canonicalize(self, url: str) -> str:
        return url

    def is_network_target(self, url: str) -> bool:
        return True

    def is_crawl_candidate(self, url: str) -> bool:
        return True


def _host(url: str) -> str:
    return urlsplit(url).netloc.lower()


def _build_skeleton(fixture_dir: Path) -> dict | None:
    """Return a skeleton expectation, or None for a non-extractable fixture.

    Failure-mode fixtures (4xx/5xx, empty body) get a minimal skeleton that
    only asserts the extractor did not raise and produced no false content —
    those are the regression guards for graceful handling.
    """
    body = (fixture_dir / "body.bin").read_bytes()
    meta = json.loads((fixture_dir / "meta.json").read_text(encoding="utf-8"))
    status = meta.get("status")
    content_type = meta.get("content_type", "")
    final_url = meta.get("final_url") or meta.get("requested_url", "")

    is_failure = (not status) or status >= 400 or len(body) == 0
    family = fixture_dir.parent.name

    skeleton = {
        "_auto_generated": True,
        "fixture_id": f"{family}/{fixture_dir.name}",
        "family": family,
        "expected": {},
    }

    if is_failure:
        skeleton["expected"] = {
            # The extractor must not crash on a dead link, and must not invent
            # content from an empty/HTML-error body. No required text.
            "title_contains": [],
            "title_not_contains": [],
            "canonical_host": _host(final_url) or None,
            "required_text_blocks": [],
            "forbidden_text_blocks": [],
            "required_links_contain": [],
            "forbidden_links_contain": ["logout", "login"],
            "resource_min_count": 0,
        }
        skeleton["_note"] = (
            "Failure-mode fixture: asserts only that extraction does not raise "
            "and produces no false content. Curate as needed."
        )
        return skeleton

    try:
        result = extract_html_document(body, content_type, final_url, _ReplayPolicy())
    except Exception as exc:  # noqa: BLE001 — record the crash for the curator
        skeleton["_note"] = (
            f"Extractor raised during bootstrap ({type(exc).__name__}: {exc}); "
            "skeleton is minimal. Investigate before authoring expectations."
        )
        skeleton["expected"] = {
            "title_contains": [],
            "title_not_contains": [],
            "canonical_host": _host(final_url),
            "required_text_blocks": [],
            "forbidden_text_blocks": [],
            "required_links_contain": [],
            "forbidden_links_contain": ["logout", "login"],
            "resource_min_count": 0,
        }
        return skeleton

    if result is None:
        skeleton["_note"] = "Extractor returned None during bootstrap; skeleton is minimal."
        skeleton["expected"] = {
            "title_contains": [],
            "title_not_contains": [],
            "canonical_host": _host(final_url),
            "required_text_blocks": [],
            "forbidden_text_blocks": [],
            "required_links_contain": [],
            "forbidden_links_contain": ["logout", "login"],
            "resource_min_count": 0,
        }
        return skeleton

    # Sample up to 8 internal links for the curator to pick required ones from.
    sample_links = [u for u in result.crawl_links if "uettaxila.edu.pk" in u][:8]
    skeleton["expected"] = {
        "title_contains": [result.title] if result.title else [],
        "title_not_contains": ["Untitled", "404", "Error"],
        "canonical_host": _host(result.canonical_url or final_url),
        "required_text_blocks": [
            # Hint: the curator should replace these with the *critical* facts
            # on the page (deadlines, fees, program names), not generic prose.
            {"text": "", "why": "TODO: paste a critical fact that must survive extraction"},
        ],
        "forbidden_text_blocks": [
            "Skip to main content",
            "©",
            "All rights reserved",
        ],
        "required_links_contain": sample_links,
        "forbidden_links_contain": ["logout", "login"],
        "resource_min_count": len(result.resources) if result.resources else 0,
    }
    skeleton["_extracted_word_count"] = result.word_count
    skeleton["_extracted_title"] = result.title
    return skeleton


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description="Bootstrap expected.json skeletons.")
    p.add_argument("--family", default=None)
    args = p.parse_args(argv)

    if not FIXTURES_DIR.exists():
        print(f"No fixtures dir at {FIXTURES_DIR}", file=sys.stderr)
        return 1

    written = 0
    skipped = 0
    for fam_dir in sorted(d for d in FIXTURES_DIR.iterdir() if d.is_dir()):
        if args.family and fam_dir.name != args.family:
            continue
        for fixture_dir in sorted(d for d in fam_dir.iterdir() if d.is_dir()):
            exp_p = fixture_dir / "expected.json"
            if exp_p.exists():
                skipped += 1
                continue
            skeleton = _build_skeleton(fixture_dir)
            if skeleton is None:
                continue
            exp_p.write_text(
                json.dumps(skeleton, indent=2, sort_keys=True) + "\n",
                encoding="utf-8",
            )
            print(f"  WROTE {fam_dir.name}/{fixture_dir.name}")
            written += 1
    print(f"\nWrote {written} skeletons, skipped {skipped} existing.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
