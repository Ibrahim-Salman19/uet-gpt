#!/usr/bin/env python3
"""Audit HTML extraction without running the network crawler or Convex ingest.

This command is intentionally dependency-light. It exercises the same active-DOM
HTML extractor and URL policy used by the production crawler, then emits:

* extracted Markdown for human inspection;
* a machine-readable JSON report;
* a non-zero exit code when required facts disappear or stale commented facts leak.
"""

from __future__ import annotations

import argparse
import json
import sys
import urllib.parse
from dataclasses import dataclass
from pathlib import Path
from typing import Any

PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from uet_crawler.html_extractor import HtmlExtractorOptions, extract_html_document
from uet_crawler.url_policy import UrlPolicy


DEFAULT_REQUIRED = (
    "The Undergraduate Admissions 2026 Second merit list has been uploaded",
    "Admission Application Processing Fee: Rs. 4,000",
    "TCAT Registration Fee: Rs. 3,000",
    "Engineering Technology Program has been extended until 24",
    "Software Engineering Technology",
    "ug.admission@uettaxila.edu.pk",
    "+92-51-9047400-412",
)

DEFAULT_FORBIDDEN = (
    "Application for Downgrading/Freezing",
    "27-07-2026  Batch - I",
    "First merit list has been uploaded to the Admission Portal on 8th June 2026",
    "Students who have been offered admission need to complete the following steps",
    "DOMContentLoaded",
    "bootstrap.Modal",
    "__cf$cv$params",
)

DEFAULT_EXPECTED_IMAGES = (
    "/images/UG-Admission-AD-Fall-2026-ENP.png",
    "/images/TCAT-V.png",
    "/images/S-category-AD.png",
    "/images/UG-Technology%20Programs%20AD-Fall%202026.png",
)


@dataclass(frozen=True)
class AuditSettings:
    all_seeds: tuple[str, ...]
    allowed_host_suffixes: tuple[str, ...]
    strip_params: frozenset[str]
    skip_extensions: frozenset[str]
    include_patterns: tuple[str, ...]
    exclude_patterns: tuple[str, ...]


def _tuple_strings(value: Any) -> tuple[str, ...]:
    if not isinstance(value, list):
        return ()
    return tuple(str(item).strip() for item in value if str(item).strip())


def load_policy(config_path: Path) -> UrlPolicy:
    payload = json.loads(config_path.read_text(encoding="utf-8"))
    seeds = _tuple_strings(payload.get("seedUrls"))
    if not seeds:
        raise ValueError("crawl config must define at least one seedUrls entry")
    settings = AuditSettings(
        all_seeds=seeds,
        allowed_host_suffixes=_tuple_strings(payload.get("allowedHostSuffixes")),
        strip_params=frozenset(
            str(item).strip().lower()
            for item in payload.get(
                "stripParams",
                [
                    "utm_source",
                    "utm_medium",
                    "utm_campaign",
                    "utm_term",
                    "utm_content",
                    "fbclid",
                    "gclid",
                    "msclkid",
                    "ref",
                    "source",
                ],
            )
            if str(item).strip()
        ),
        skip_extensions=frozenset(
            str(item).strip().lower()
            for item in payload.get(
                "skipExtensions",
                [
                    ".doc",
                    ".docx",
                    ".ppt",
                    ".pptx",
                    ".xls",
                    ".xlsx",
                    ".zip",
                    ".rar",
                    ".exe",
                    ".jpg",
                    ".jpeg",
                    ".png",
                    ".gif",
                    ".svg",
                    ".webp",
                    ".mp4",
                    ".avi",
                    ".mp3",
                    ".wav",
                ],
            )
            if str(item).strip()
        ),
        include_patterns=_tuple_strings(payload.get("includePatterns")),
        exclude_patterns=_tuple_strings(payload.get("excludePatterns")),
    )
    return UrlPolicy(settings)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Audit UET HTML extraction")
    parser.add_argument(
        "--html",
        type=Path,
        default=PROJECT_ROOT / "tests" / "fixtures" / "admissions_home_2026.html",
        help="Saved HTML response to audit",
    )
    parser.add_argument(
        "--url",
        default="https://admissions.uettaxila.edu.pk/",
        help="Final page URL used to resolve relative links",
    )
    parser.add_argument(
        "--config",
        type=Path,
        default=PROJECT_ROOT / "crawl_config.production.json",
        help="Crawler configuration containing seeds and URL scope",
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=PROJECT_ROOT / "audit_output",
        help="Directory for Markdown and JSON audit artifacts",
    )
    parser.add_argument(
        "--no-fixture-assertions",
        action="store_true",
        help="Extract arbitrary HTML without applying the admissions fixture assertions",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    policy = load_policy(args.config.resolve())
    body = args.html.resolve().read_bytes()
    result = extract_html_document(
        body,
        "text/html; charset=utf-8",
        args.url,
        policy,
        HtmlExtractorOptions(max_image_candidates=8),
    )
    if result is None:
        print("ERROR: extractor returned no document", file=sys.stderr)
        return 2

    required_missing: list[str] = []
    forbidden_present: list[str] = []
    expected_images_missing: list[str] = []
    if not args.no_fixture_assertions:
        required_missing = [item for item in DEFAULT_REQUIRED if item not in result.markdown]
        forbidden_present = [item for item in DEFAULT_FORBIDDEN if item in result.markdown]
        candidate_paths = {
            urllib.parse.urlsplit(item.url).path
            for item in result.image_candidates
        }
        expected_images_missing = [
            item for item in DEFAULT_EXPECTED_IMAGES if item not in candidate_paths
        ]

    report = {
        "source_file": str(args.html.resolve()),
        "source_url": args.url,
        "canonical_url": result.canonical_url,
        "title": result.title,
        "word_count": result.word_count,
        "content_sha256": result.content_hash,
        "crawl_link_count": len(result.crawl_links),
        "resource_count": len(result.resources),
        "image_candidate_count": len(result.image_candidates),
        "image_candidates": [
            {
                "url": item.url,
                "alt_text": item.alt_text,
                "score": round(item.score, 3),
                "source": item.source,
            }
            for item in result.image_candidates
        ],
        "diagnostics": result.diagnostics,
        "assertions": {
            "required_missing": required_missing,
            "forbidden_present": forbidden_present,
            "expected_images_missing": expected_images_missing,
        },
    }
    report["passed"] = not any(
        (required_missing, forbidden_present, expected_images_missing)
    )

    args.output_dir.mkdir(parents=True, exist_ok=True)
    markdown_path = args.output_dir / "extracted.md"
    report_path = args.output_dir / "audit.json"
    markdown_path.write_text(result.markdown + "\n", encoding="utf-8")
    report_path.write_text(
        json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )

    print(json.dumps(report, ensure_ascii=False, indent=2))
    print(f"\nMarkdown: {markdown_path}")
    print(f"Audit:    {report_path}")
    return 0 if report["passed"] else 1


if __name__ == "__main__":
    raise SystemExit(main())