"""
UET Taxila — production-grade RAG crawler
==========================================

A modular crawler for UET Taxila web properties that:

* crawls an exhaustive-by-default, priority-ordered public frontier;
* honours robots.txt using RFC 9309 failure semantics;
* validates every redirect and resolved host before fetching;
* streams response bodies with hard decompressed-size limits;
* extracts the complete active HTML DOM plus structured resources and PDFs with PyMuPDF4LLM;
* optionally transcribes information-rich HTML and PDF images with Gemini Vision;
* performs exact and near-duplicate detection without losing pages on push failure;
* pushes idempotent content payloads to a Convex HTTP endpoint;
* persists an atomic crash-recovery snapshot and a durable dead-letter queue.

Python 3.10+ is required.
"""

from __future__ import annotations

import argparse
import asyncio
import base64
import contextlib
import functools
import gzip
import hashlib
import hmac as hmac_lib
import inspect
import io
import ipaddress
import json
import logging
import math
import os
import random
import re
import signal
import socket
import sys
import time
import urllib.parse
import zlib
import xml.parsers.expat as expat
from collections import Counter, defaultdict, deque
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from logging.handlers import RotatingFileHandler
from pathlib import Path
from typing import Any, Callable, Iterable, Mapping, Sequence

from curl_cffi import CurlOpt
from curl_cffi.requests import AsyncSession
from curl_cffi.requests.errors import RequestsError
from dotenv import load_dotenv
import httpx
import pymupdf4llm
from pymupdf4llm.ocr import tesseract_api as pymupdf4llm_tesseract_api
from tqdm.asyncio import tqdm as atqdm

from pdf_markdown_cleaner import (
    assess_pdf_markdown_quality,
    skip_ocr_if_native_text_sufficient,
)

from uet_crawler.html_extractor import (
    HtmlExtractorOptions,
    HtmlImageCandidate,
    extract_html_document as extract_active_html_document,
)
from uet_crawler.url_policy import UrlPolicy, normalized_origin
from uet_crawler.robots_rules import RobotsRules
from uet_crawler.gemini_response import (
    extract_interaction_output_text,
    parse_transcription_text,
)
from uet_crawler.image_normalization import prepare_image_for_gemini
from uet_crawler.browser_renderer import BrowserRenderer, RenderLimitReached
from uet_crawler.crawl_ledger import CrawlLedger
from uet_crawler.target_guard import UnsafeConvexTargetError, assert_local_convex_target
from uet_crawler.corpus_sink import FilesystemCorpusSink, document_id_for_url

try:  # PyMuPDF's preferred import name in current releases.
    import pymupdf as fitz
except ImportError:  # Backward compatibility with older PyMuPDF releases.
    import fitz  # type: ignore[no-redef]

# pymupdf4llm's OCR path prints "=== Document parser messages ===" progress
# notes via pymupdf.message(), which defaults to stdout. Any code that treats
# a subprocess's stdout as a structured contract (see scripts/eval/isolation.py's
# worker, which parses stdout as one JSON object) breaks if that leaks in, so
# route it to stderr here instead.
fitz.set_messages(stream=sys.stderr)


# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

STATE_VERSION = 5
DEFAULT_CONFIG_PATH = "scripts/crawl_config.json"
DEFAULT_SEEDS = (
    "https://admissions.uettaxila.edu.pk/",
    "https://admission.uettaxila.edu.pk/",
    "https://web.uettaxila.edu.pk/",
    "https://www.uettaxila.edu.pk/",
    "https://uettaxila.edu.pk/",
    "https://entrytest.uettaxila.edu.pk/",
    "https://fms.uettaxila.edu.pk/",
)
DEFAULT_BROWSER_UA = "UETTaxilaRAGCrawler/6.0 (+https://www.uettaxila.edu.pk/)"
DEFAULT_ROBOTS_TOKEN = "UETTaxilaRAGCrawler"
REDIRECT_STATUSES = {301, 302, 303, 307, 308}
RETRYABLE_HTTP_STATUSES = {408, 425, 429, 500, 502, 503, 504, 522, 524}
# 522/524 are Cloudflare-specific (origin connection timeout / a timeout
# occurred) - they mean the origin was temporarily unreachable through
# Cloudflare, not that the URL is invalid, so they must not be treated the
# same as a real 404/410.
ROBOTS_MAX_BYTES = 512 * 1024
SITEMAP_MAX_BYTES = 50 * 1024 * 1024
SITEMAP_MAX_LOCATIONS_PER_FILE = 50_000
STREAM_CHUNK_SIZE = 64 * 1024
MAX_RETRY_AFTER_SECONDS = 60 * 60
MAX_RESPONSE_HEADER_BYTES = 64 * 1024
MAX_RESPONSE_HEADERS = 256
MAX_GEMINI_RESPONSE_BYTES = 2 * 1024 * 1024
MAX_ROBOTS_CRAWL_DELAY = 5 * 60
MAX_XML_DEPTH = 128
MAX_XML_ELEMENTS = 200_000
MAX_XML_ATTRIBUTES_PER_ELEMENT = 64
MAX_XML_ATTRIBUTE_BYTES = 32 * 1024
MAX_XML_TOKEN_BYTES = 64 * 1024
MAX_SITEMAP_URL_BYTES = 8 * 1024
MAX_GZIP_EXPANSION_RATIO = 250
MAX_CONFIG_BYTES = 8 * 1024 * 1024
MIN_SAFE_EXPAT_VERSION = (2, 7, 2)

DEFAULT_SKIP_EXTENSIONS = frozenset(
    ".doc .docx .ppt .pptx .xls .xlsx .zip .rar .7z .tar .gz .exe "
    ".jpg .jpeg .png .gif .svg .webp .bmp .tif .tiff .ico "
    ".mp4 .avi .mov .mkv .webm .mp3 .wav .ogg .flac".split()
)

DEFAULT_STRIP_PARAMS = frozenset(
    "utm_source utm_medium utm_campaign utm_term utm_content "
    "fbclid gclid msclkid".split()
)

DEFAULT_BOILERPLATE_SELECTORS = (
    # Remove only unambiguously non-content UI/infrastructure. UET places live
    # admission facts in Bootstrap modals, announcement lists, and occasionally
    # ticker-like containers, so broad modal/ticker/notice rules are unsafe.
    "[class*=cookie-banner i]",
    "[id*=cookie-banner i]",
    "[class*=cookie-consent i]",
    "[id*=cookie-consent i]",
    "script",
    "style",
    "noscript",
    "template",
    "iframe",
    "canvas",
    "input[type=hidden]",
)

log = logging.getLogger("uet_crawler")


# ---------------------------------------------------------------------------
# Generic helpers
# ---------------------------------------------------------------------------


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def retry_delay(attempt: int, base: float = 1.0, maximum: float = 60.0) -> float:
    """Full-jitter exponential backoff.

    ``attempt`` is zero-based. Full jitter avoids synchronised retry waves more
    effectively than adding a small fixed percentage to a deterministic delay.
    """

    ceiling = min(maximum, base * (2**attempt))
    return random.uniform(0.0, ceiling)


def validate_xml_runtime() -> None:
    """Require an Expat build containing the current XML security fixes."""

    raw_version = str(getattr(expat, "EXPAT_VERSION", ""))
    match = re.search(r"(\d+)\.(\d+)\.(\d+)", raw_version)
    if match is None:
        raise RuntimeError(
            f"Could not determine the Expat security version: {raw_version!r}"
        )
    version = tuple(int(part) for part in match.groups())
    if version < MIN_SAFE_EXPAT_VERSION:
        required = ".".join(str(part) for part in MIN_SAFE_EXPAT_VERSION)
        raise RuntimeError(
            f"Expat {raw_version} is below the required secure baseline "
            f"{required}; upgrade Python or the system Expat library"
        )


def parse_retry_after(
    value: str | None,
    *,
    maximum: float = MAX_RETRY_AFTER_SECONDS,
) -> float | None:
    """Parse a bounded HTTP ``Retry-After`` value.

    Servers control this header, so an otherwise valid date or delta is capped
    to prevent a single response from suspending the crawler for hours or days.
    """

    if not value or not math.isfinite(maximum) or maximum < 0:
        return None
    value = value.strip()
    try:
        if value.isdigit():
            delay = float(value)
        else:
            dt = parsedate_to_datetime(value)
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            delay = (dt - datetime.now(timezone.utc)).total_seconds()
    except (TypeError, ValueError, OverflowError):
        return None
    if not math.isfinite(delay):
        return None
    return min(maximum, max(0.0, delay))


def normalize_space(value: str) -> str:
    return re.sub(r"\s+", " ", value).strip()


def byte_len(value: str) -> int:
    return len(value.encode("utf-8"))


def local_name(tag: str) -> str:
    return tag.rsplit("}", 1)[-1].lower()


def safe_int(value: Any, default: int) -> int:
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


def safe_float(value: Any, default: float) -> float:
    try:
        result = float(value)
    except (TypeError, ValueError):
        return default
    return result if math.isfinite(result) else default


def config_int(value: Any, default: int, name: str) -> int:
    """Read a JSON integer and fail fast on accidental strings/booleans."""

    if value is None:
        return default
    if isinstance(value, bool) or not isinstance(value, int):
        raise RuntimeError(f"{name} must be a JSON integer")
    return value


def config_float(value: Any, default: float, name: str) -> float:
    """Read a finite JSON number without silently substituting a default."""

    if value is None:
        return float(default)
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        raise RuntimeError(f"{name} must be a JSON number")
    result = float(value)
    if not math.isfinite(result):
        raise RuntimeError(f"{name} must be finite")
    return result


def config_bool(value: Any, default: bool, name: str) -> bool:
    """Read a JSON boolean without Python's dangerous truthiness coercion."""

    if value is None:
        return default
    if isinstance(value, bool):
        return value
    if isinstance(value, int) and value in (0, 1):
        return bool(value)
    raise RuntimeError(f"{name} must be a JSON boolean")


def config_object(value: Any, name: str) -> dict[str, Any]:
    if value is None:
        return {}
    if not isinstance(value, dict):
        raise RuntimeError(f"{name} must be an object")
    return value


def config_string_list(
    value: Any,
    default: Sequence[str],
    name: str,
) -> tuple[str, ...]:
    """Validate a configuration array instead of iterating accidental strings."""

    if value is None:
        value = list(default)
    if not isinstance(value, list) or not all(isinstance(item, str) for item in value):
        raise RuntimeError(f"{name} must be an array of strings")
    return tuple(item for item in value)


def validated_header_value(name: str, value: Any, *, maximum: int = 512) -> str:
    result = str(value or "").strip()
    if not result or len(result) > maximum:
        raise RuntimeError(f"{name} must contain between 1 and {maximum} characters")
    if any(ord(character) < 0x20 or ord(character) == 0x7F for character in result):
        raise RuntimeError(f"{name} contains a forbidden control character")
    return result


def _fsync_directory(path: Path) -> None:
    """Best-effort directory fsync after an atomic replacement."""

    flags = os.O_RDONLY
    if hasattr(os, "O_DIRECTORY"):
        flags |= os.O_DIRECTORY
    try:
        descriptor = os.open(path, flags)
    except OSError:
        return
    try:
        os.fsync(descriptor)
    except OSError:
        pass
    finally:
        os.close(descriptor)


def detect_project_root(script_path: Path) -> Path:
    """Find a practical repository root without hard-coding ``parent.parent``."""

    candidates = [script_path.parent]
    candidates.extend(list(script_path.parents)[:4])
    for candidate in candidates:
        if (candidate / ".env.local").exists() or (candidate / "convex").exists():
            return candidate
    if script_path.parent.name.lower() == "scripts":
        return script_path.parent.parent
    return script_path.parent


def read_json_file(path: Path) -> dict[str, Any]:
    """Read one bounded UTF-8 JSON object from a regular configuration file."""

    try:
        stat = path.stat()
        if not path.is_file():
            raise RuntimeError(f"Configuration path is not a regular file: {path}")
        if stat.st_size > MAX_CONFIG_BYTES:
            raise RuntimeError(
                f"Configuration file exceeds {MAX_CONFIG_BYTES} bytes: {path}"
            )
        raw = path.read_text(encoding="utf-8")
        data = json.loads(raw)
    except FileNotFoundError as exc:
        raise RuntimeError(f"Configuration file not found: {path}") from exc
    except UnicodeDecodeError as exc:
        raise RuntimeError(f"Configuration file is not valid UTF-8: {path}") from exc
    except OSError as exc:
        raise RuntimeError(f"Could not read configuration file {path}: {exc}") from exc
    except json.JSONDecodeError as exc:
        raise RuntimeError(
            f"Invalid JSON in {path} at line {exc.lineno}, "
            f"column {exc.colno}: {exc.msg}"
        ) from exc
    if not isinstance(data, dict):
        raise RuntimeError(f"Configuration root must be an object: {path}")
    return data


def atomic_write_json(
    path: Path,
    payload: Mapping[str, Any],
    max_bytes: int | None = None,
) -> None:
    """Durably replace a JSON file without exposing a partial checkpoint."""

    path.parent.mkdir(parents=True, exist_ok=True)
    temp = path.with_name(
        f".{path.name}.{os.getpid()}.{time.time_ns()}.{random.randrange(1 << 30)}.tmp"
    )
    descriptor = -1
    try:
        descriptor = os.open(temp, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
        with os.fdopen(descriptor, "w", encoding="utf-8", newline="\n") as handle:
            descriptor = -1
            json.dump(payload, handle, ensure_ascii=False, separators=(",", ":"))
            handle.flush()
            if (
                max_bytes is not None
                and os.fstat(handle.fileno()).st_size > max_bytes
            ):
                raise ValueError(
                    f"serialized JSON exceeds safety limit of {max_bytes} bytes"
                )
            os.fsync(handle.fileno())
        os.replace(temp, path)
        _fsync_directory(path.parent)
    finally:
        if descriptor >= 0:
            os.close(descriptor)
        with contextlib.suppress(OSError):
            temp.unlink()


def configure_logging(project_root: Path, level: str) -> None:
    numeric_level = getattr(logging, level.upper(), None)
    if not isinstance(numeric_level, int):
        raise RuntimeError(f"Invalid log level: {level}")

    logs_dir = project_root / "logs"
    logs_dir.mkdir(parents=True, exist_ok=True)

    formatter = logging.Formatter(
        "%(asctime)s  %(levelname)-7s  %(message)s", datefmt="%Y-%m-%d %H:%M:%S"
    )
    stream_handler = logging.StreamHandler(sys.stdout)
    stream_handler.setFormatter(formatter)

    file_handler = RotatingFileHandler(
        logs_dir / "crawler.log",
        maxBytes=10 * 1024 * 1024,
        backupCount=5,
        encoding="utf-8",
    )
    file_handler.setFormatter(formatter)

    root = logging.getLogger()
    root.handlers.clear()
    root.setLevel(numeric_level)
    root.addHandler(stream_handler)
    root.addHandler(file_handler)


# ---------------------------------------------------------------------------
# CLI and validated settings
# ---------------------------------------------------------------------------


# A resource-consuming crawl must never default to both an unbounded URL
# frontier AND an unbounded runtime (see the August 2026 incident: a --limit-0
# default crawl with no wall-clock ceiling ran unattended for hours and queued
# ~17,000 pending embedding rows). Both defaults below are conservative and
# require an explicit, separate opt-in to relax.
DEFAULT_SAFE_CRAWL_LIMIT = 20
DEFAULT_MAX_RUNTIME_SECONDS = 3600  # 1 hour

# Bump when extraction behavior meaningfully changes (parser fixes, cleaning
# changes, kwargs changes), so a local corpus record's provenance is honest
# about which extractor version produced it. Recorded per-document by
# FilesystemCorpusSink, not enforced/checked anywhere yet.
LOCAL_CORPUS_EXTRACTION_VERSION = 1


@dataclass(frozen=True)
class CliArgs:
    limit: int
    clean: bool
    config: str
    project_root: str | None
    resume: bool
    dry_run: bool
    log_level: str
    require_complete: bool
    # Defaulted (rather than required) so the many existing direct CliArgs(...)
    # construction sites in other scripts/tests need not all be updated; only
    # parse_args()'s CLI surface needs the new safety semantics.
    max_runtime_seconds: int = DEFAULT_MAX_RUNTIME_SECONDS
    cloud_execution_authorization: str | None = None
    local_corpus_dir: str | None = None


def parse_args(argv: Sequence[str] | None = None) -> CliArgs:
    parser = argparse.ArgumentParser(description="UET Taxila production RAG crawler")
    limit_group = parser.add_mutually_exclusive_group()
    limit_group.add_argument(
        "--limit",
        type=int,
        default=None,
        help=(
            "Maximum unique URLs scheduled (must be a positive integer). "
            f"Defaults to {DEFAULT_SAFE_CRAWL_LIMIT} if neither --limit nor "
            "--exhaustive is given. Mutually exclusive with --exhaustive."
        ),
    )
    limit_group.add_argument(
        "--exhaustive",
        action="store_true",
        help=(
            "Crawl until the public frontier is exhausted, with no URL-count "
            "ceiling. High-risk: explicit opt-in only, not the default. "
            "--max-runtime-seconds still applies unless separately overridden."
        ),
    )
    parser.add_argument(
        "--max-runtime-seconds",
        type=int,
        default=None,
        help=(
            "Wall-clock budget for the whole run; the crawl stops gracefully "
            "with a resumable checkpoint once reached. 0 disables the budget "
            f"(unbounded). Defaults to {DEFAULT_MAX_RUNTIME_SECONDS}s."
        ),
    )
    parser.add_argument(
        "--cloud-execution-authorization",
        default=None,
        help=(
            "Explicit one-shot authorization phrase required to target a "
            "non-local (Convex Cloud) CONVEX_SITE_URL for this run only. "
            "Never set this via a persistent environment variable."
        ),
    )
    parser.add_argument("--clean", action="store_true", help="Reset backend data first")
    parser.add_argument(
        "--config",
        default=DEFAULT_CONFIG_PATH,
        help="Config path relative to the repository root",
    )
    parser.add_argument(
        "--project-root",
        default=None,
        help="Explicit repository root; otherwise it is auto-detected",
    )
    parser.add_argument(
        "--no-resume",
        dest="resume",
        action="store_false",
        help="Ignore and remove an existing crash-recovery snapshot",
    )
    parser.set_defaults(resume=True)
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Fetch and extract without resetting or pushing to Convex",
    )
    parser.add_argument(
        "--local-corpus-dir",
        default=None,
        help=(
            "If set, write every successfully fetched raw source and every "
            "extracted, quality-passed document to this local directory "
            "(content-addressed raw cache + append-only documents.jsonl), "
            "independent of --dry-run/Convex push outcome. See "
            "uet_crawler/corpus_sink.py."
        ),
    )
    parser.add_argument("--log-level", default="INFO")
    parser.add_argument(
        "--allow-incomplete",
        dest="require_complete",
        action="store_false",
        help="Return success even when retryable failures or a configured URL cap leave gaps",
    )
    parser.set_defaults(require_complete=True)
    ns = parser.parse_args(argv)
    if ns.exhaustive:
        resolved_limit = 0  # internal unbounded sentinel, unchanged downstream
    elif ns.limit is None:
        resolved_limit = DEFAULT_SAFE_CRAWL_LIMIT
    elif ns.limit <= 0:
        parser.error(
            "--limit must be a positive integer; pass --exhaustive to crawl "
            "until the frontier is exhausted"
        )
    else:
        resolved_limit = ns.limit
    resolved_max_runtime = (
        DEFAULT_MAX_RUNTIME_SECONDS
        if ns.max_runtime_seconds is None
        else ns.max_runtime_seconds
    )
    if resolved_max_runtime < 0:
        parser.error("--max-runtime-seconds must be zero (unbounded) or positive")
    return CliArgs(
        limit=resolved_limit,
        clean=ns.clean,
        config=ns.config,
        project_root=ns.project_root,
        resume=ns.resume,
        dry_run=ns.dry_run,
        log_level=ns.log_level,
        require_complete=ns.require_complete,
        max_runtime_seconds=resolved_max_runtime,
        cloud_execution_authorization=ns.cloud_execution_authorization,
        local_corpus_dir=ns.local_corpus_dir,
    )


@dataclass(frozen=True)
class Settings:
    project_root: Path
    config_path: Path
    seed_urls: tuple[str, ...]
    allowed_host_suffixes: tuple[str, ...]
    department_urls: tuple[str, ...]
    include_patterns: tuple[str, ...]
    exclude_patterns: tuple[str, ...]
    strip_params: frozenset[str]
    skip_extensions: frozenset[str]
    boilerplate_selectors: tuple[str, ...]
    drop_session_params: frozenset[str]
    max_url_length: int
    max_path_length: int
    max_query_length: int
    max_query_params: int
    max_query_values_per_key: int

    max_pages: int
    max_depth: int
    concurrency: int
    queue_max_size: int
    request_timeout: float
    pdf_timeout: float
    connect_timeout: float
    max_retries: int
    push_retries: int
    push_timeout: float
    min_word_count: int
    max_response_bytes: int
    max_pdf_response_bytes: int
    max_ingest_bytes: int
    max_redirects: int

    robots_enabled: bool
    robots_cache_seconds: int
    robots_stale_seconds: int
    user_agent: str
    robots_token: str
    impersonate: str
    trust_env: bool

    token_rate: float
    token_capacity: float
    min_host_delay: float
    aimd_min_delay: float
    aimd_max_delay: float
    aimd_initial_delay: float
    aimd_additive_step: float
    aimd_multiplicative_factor: float
    aimd_success_threshold: int

    sitemap_enabled: bool
    sitemap_max_files: int
    sitemap_max_urls: int

    simhash_threshold: int
    simhash_min_words: int
    state_interval: int

    pdf_table_strategy: str
    pdf_use_ocr: bool
    pdf_ocr_language: str
    describe_pdf_images: bool
    max_images_per_pdf: int
    min_image_bytes: int
    min_image_dimension: int
    max_image_bytes: int
    image_concurrency: int

    describe_html_images: bool
    max_html_images_per_page: int
    min_html_image_bytes: int
    max_html_image_bytes: int
    html_image_timeout: float
    html_image_concurrency: int

    gemini_model: str
    gemini_timeout: float
    gemini_retries: int

    render_enabled: bool
    render_timeout: float
    render_settle_ms: int
    render_concurrency: int
    render_max_pages: int
    render_min_static_words: int

    convex_site_url: str
    convex_auth_token: str | None
    require_auth_token: bool
    dry_run: bool
    max_runtime_seconds: int

    state_file: Path
    dlq_file: Path
    dead_dlq_file: Path
    dlq_max_attempts: int
    ledger_file: Path
    coverage_json_file: Path
    coverage_csv_file: Path
    require_complete: bool
    io_budget_soft_bytes: int
    io_budget_stop_bytes: int
    io_budget_max_bytes: int
    local_corpus_dir: Path | None

    @property
    def all_seeds(self) -> tuple[str, ...]:
        return self.seed_urls + self.department_urls


def _require_range(name: str, value: float, minimum: float, maximum: float) -> None:
    if not minimum <= value <= maximum:
        raise RuntimeError(f"{name} must be between {minimum} and {maximum}; got {value}")


def load_settings(args: CliArgs, script_path: Path) -> Settings:
    project_root = (
        Path(args.project_root).expanduser().resolve()
        if args.project_root
        else detect_project_root(script_path)
    )
    load_dotenv(project_root / ".env.local")

    config_path = Path(args.config)
    if not config_path.is_absolute():
        config_path = project_root / config_path
    if (
        not config_path.exists()
        and args.config == DEFAULT_CONFIG_PATH
        and (project_root / "crawl_config.production.json").exists()
    ):
        config_path = project_root / "crawl_config.production.json"
    config_path = config_path.resolve()
    cfg = read_json_file(config_path)

    seeds_raw = cfg.get("seedUrls")
    if seeds_raw is None:
        seeds_raw = list(DEFAULT_SEEDS)
    if not isinstance(seeds_raw, list) or not all(isinstance(x, str) for x in seeds_raw):
        raise RuntimeError("seedUrls must be an array of URL strings")
    seed_urls = tuple(x.strip() for x in seeds_raw if x.strip())
    if not seed_urls:
        raise RuntimeError("At least one seed URL is required")

    suffixes_raw = cfg.get("allowedHostSuffixes", ["uettaxila.edu.pk"])
    if not isinstance(suffixes_raw, list) or not all(
        isinstance(value, str) for value in suffixes_raw
    ):
        raise RuntimeError("allowedHostSuffixes must be an array of DNS suffix strings")
    allowed_host_suffixes = tuple(
        sorted(
            {
                value.strip().lower().strip(".")
                for value in suffixes_raw
                if value.strip().strip(".")
            }
        )
    )
    for suffix in allowed_host_suffixes:
        if ":" in suffix or "/" in suffix or suffix == "localhost":
            raise RuntimeError(f"Invalid allowedHostSuffixes entry: {suffix}")

    explicit_department_urls = cfg.get("departmentFacultyUrls")
    if explicit_department_urls is not None:
        if not isinstance(explicit_department_urls, list) or not all(
            isinstance(x, str) for x in explicit_department_urls
        ):
            raise RuntimeError("departmentFacultyUrls must be an array of URL strings")
        department_urls = tuple(x.strip() for x in explicit_department_urls if x.strip())
    else:
        range_cfg = cfg.get("departmentFacultyRange") or {"start": 1, "end": 25}
        if not isinstance(range_cfg, dict):
            raise RuntimeError("departmentFacultyRange must be an object")
        start = config_int(range_cfg.get("start"), 1, "departmentFacultyRange.start")
        end = config_int(range_cfg.get("end"), 25, "departmentFacultyRange.end")
        if start < 0 or end < start or end - start > 500:
            raise RuntimeError("Invalid departmentFacultyRange")
        department_urls = tuple(
            f"https://web.uettaxila.edu.pk/departmentfaculty?departmentId={i}"
            for i in range(start, end + 1)
        )

    include_patterns = config_string_list(
        cfg.get("includePatterns"), (), "includePatterns"
    )
    exclude_patterns = config_string_list(
        cfg.get("excludePatterns"), (), "excludePatterns"
    )
    strip_params = frozenset(
        value.lower()
        for value in config_string_list(
            cfg.get("stripQueryParams"), sorted(DEFAULT_STRIP_PARAMS), "stripQueryParams"
        )
        if value
    )
    skip_extensions = frozenset(
        value.lower()
        for value in config_string_list(
            cfg.get("skipExtensions"), sorted(DEFAULT_SKIP_EXTENSIONS), "skipExtensions"
        )
        if value
    )
    boilerplate_selectors = config_string_list(
        cfg.get("boilerplateSelectors"),
        DEFAULT_BOILERPLATE_SELECTORS,
        "boilerplateSelectors",
    )
    url_policy_cfg = config_object(cfg.get("urlPolicy"), "urlPolicy")
    drop_session_params = frozenset(
        value.lower()
        for value in config_string_list(
            url_policy_cfg.get("dropSessionParams"),
            ("phpsessid", "asp.net_sessionid", "jsessionid", "sessionid", "sid"),
            "urlPolicy.dropSessionParams",
        )
        if value
    )
    max_url_length = config_int(url_policy_cfg.get("maxUrlLength"), 8192, "urlPolicy.maxUrlLength")
    max_path_length = config_int(url_policy_cfg.get("maxPathLength"), 4096, "urlPolicy.maxPathLength")
    max_query_length = config_int(url_policy_cfg.get("maxQueryLength"), 4096, "urlPolicy.maxQueryLength")
    max_query_params = config_int(url_policy_cfg.get("maxQueryParams"), 20, "urlPolicy.maxQueryParams")
    max_query_values_per_key = config_int(
        url_policy_cfg.get("maxQueryValuesPerKey"),
        8,
        "urlPolicy.maxQueryValuesPerKey",
    )

    max_depth = config_int(cfg.get("maxDepth"), -1, "maxDepth")
    concurrency = config_int(cfg.get("concurrency"), 5, "concurrency")
    queue_max_size = config_int(cfg.get("queueMaxSize"), 100_000, "queueMaxSize")
    request_timeout = config_float(cfg.get("requestTimeout"), 20.0, "requestTimeout")
    pdf_timeout = config_float(
        cfg.get("pdfTimeout"), max(60.0, request_timeout * 3), "pdfTimeout"
    )
    connect_timeout = config_float(
        cfg.get("connectTimeout"), min(10.0, request_timeout), "connectTimeout"
    )
    max_retries = config_int(cfg.get("maxRetries"), 3, "maxRetries")
    push_retries = config_int(cfg.get("pushRetries"), 3, "pushRetries")
    push_timeout = config_float(cfg.get("pushTimeout"), 30.0, "pushTimeout")
    min_word_count = config_int(cfg.get("minWordCount"), 80, "minWordCount")
    max_response_bytes = config_int(
        cfg.get("maxResponseBytes"), 25 * 1024 * 1024, "maxResponseBytes"
    )
    max_pdf_response_bytes = config_int(
        cfg.get("maxPdfResponseBytes"),
        max_response_bytes * 2,
        "maxPdfResponseBytes",
    )
    max_ingest_bytes = config_int(
        cfg.get("maxIngestBytes"), 4 * 1024 * 1024, "maxIngestBytes"
    )
    max_redirects = config_int(cfg.get("maxRedirects"), 5, "maxRedirects")

    robots_cfg = config_object(cfg.get("robots"), "robots")
    robots_enabled = config_bool(robots_cfg.get("enabled"), True, "robots.enabled")
    robots_cache_seconds = config_int(robots_cfg.get("cacheSeconds"), 24 * 3600, "robots.cacheSeconds")
    robots_stale_seconds = config_int(
        robots_cfg.get("staleSeconds"),
        30 * 24 * 3600,
        "robots.staleSeconds",
    )
    user_agent = validated_header_value(
        "userAgent", cfg.get("userAgent") or DEFAULT_BROWSER_UA, maximum=512
    )
    robots_token = validated_header_value(
        "robotsUserAgent", cfg.get("robotsUserAgent") or DEFAULT_ROBOTS_TOKEN,
        maximum=128,
    )
    if not re.fullmatch(r"[A-Za-z0-9._~-]+", robots_token):
        raise RuntimeError("robotsUserAgent must be a valid product token")
    impersonate = validated_header_value(
        "impersonate", cfg.get("impersonate") or "chrome", maximum=64
    )
    trust_env = config_bool(
        cfg.get("trustEnvironmentProxies"), False, "trustEnvironmentProxies"
    )
    if trust_env:
        raise RuntimeError(
            "trustEnvironmentProxies=true is incompatible with DNS-pinned SSRF protection"
        )

    token_cfg = config_object(cfg.get("tokenBucket"), "tokenBucket")
    token_rate = config_float(token_cfg.get("rate"), 8.0, "tokenBucket.rate")
    token_capacity = config_float(token_cfg.get("capacity"), 15.0, "tokenBucket.capacity")

    rate_cfg = config_object(cfg.get("rateLimiter"), "rateLimiter")
    min_host_delay = config_float(rate_cfg.get("minHostDelay"), 0.05, "rateLimiter.minHostDelay")
    aimd_min_delay = config_float(rate_cfg.get("minDelay"), 0.05, "rateLimiter.minDelay")
    aimd_max_delay = config_float(rate_cfg.get("maxDelay"), 5.0, "rateLimiter.maxDelay")
    aimd_initial_delay = config_float(rate_cfg.get("initialDelay"), 0.4, "rateLimiter.initialDelay")
    aimd_additive_step = config_float(rate_cfg.get("aiStep"), 0.01, "rateLimiter.aiStep")
    aimd_multiplicative_factor = config_float(rate_cfg.get("mdFactor"), 2.0, "rateLimiter.mdFactor")
    aimd_success_threshold = config_int(rate_cfg.get("successThreshold"), 10, "rateLimiter.successThreshold")

    sitemap_cfg = config_object(cfg.get("sitemap"), "sitemap")
    sitemap_enabled = config_bool(
        sitemap_cfg.get("enabled"), True, "sitemap.enabled"
    )
    sitemap_max_files = config_int(sitemap_cfg.get("maxFiles"), 25, "sitemap.maxFiles")
    sitemap_max_urls = config_int(
        sitemap_cfg.get("maxUrls"),
        max(1_000_000, args.limit * 4) if args.limit else 1_000_000,
        "sitemap.maxUrls",
    )

    dedup_cfg = config_object(cfg.get("deduplication"), "deduplication")
    simhash_threshold = config_int(dedup_cfg.get("simhashThreshold"), 6, "deduplication.simhashThreshold")
    simhash_min_words = config_int(dedup_cfg.get("simhashMinWords"), 120, "deduplication.simhashMinWords")

    state_interval = config_int(cfg.get("stateSaveInterval"), 25, "stateSaveInterval")

    pdf_cfg = config_object(cfg.get("pdf"), "pdf")
    pdf_table_strategy = str(pdf_cfg.get("tableStrategy") or "lines_strict")
    pdf_use_ocr = config_bool(pdf_cfg.get("useOcr"), True, "pdf.useOcr")
    pdf_ocr_language = str(pdf_cfg.get("ocrLanguage") or "eng")
    describe_pdf_images = config_bool(
        pdf_cfg.get("describeImages"), True, "pdf.describeImages"
    )
    max_images_per_pdf = config_int(pdf_cfg.get("maxImagesPerPdf"), 40, "pdf.maxImagesPerPdf")
    min_image_bytes = config_int(pdf_cfg.get("minImageBytes"), 10_000, "pdf.minImageBytes")
    min_image_dimension = config_int(pdf_cfg.get("minImageDimension"), 100, "pdf.minImageDimension")
    max_image_bytes = config_int(pdf_cfg.get("maxImageBytes"), 8 * 1024 * 1024, "pdf.maxImageBytes")
    image_concurrency = config_int(pdf_cfg.get("imageConcurrency"), 3, "pdf.imageConcurrency")

    html_cfg = config_object(cfg.get("html"), "html")
    describe_html_images = config_bool(
        html_cfg.get("describeImages"), True, "html.describeImages"
    )
    max_html_images_per_page = config_int(html_cfg.get("maxImagesPerPage"), 8, "html.maxImagesPerPage")
    min_html_image_bytes = config_int(html_cfg.get("minImageBytes"), 8_000, "html.minImageBytes")
    max_html_image_bytes = config_int(
        html_cfg.get("maxImageBytes"),
        8 * 1024 * 1024,
        "html.maxImageBytes",
    )
    html_image_timeout = config_float(html_cfg.get("imageTimeout"), 30.0, "html.imageTimeout")
    html_image_concurrency = config_int(html_cfg.get("imageConcurrency"), 3, "html.imageConcurrency")

    gemini_model = str(
        os.environ.get("GEMINI_VISION_MODEL")
        or pdf_cfg.get("geminiModel")
        or "gemini-3.6-flash"
    )
    gemini_timeout = config_float(pdf_cfg.get("geminiTimeout"), 45.0, "pdf.geminiTimeout")
    gemini_retries = config_int(pdf_cfg.get("geminiRetries"), 3, "pdf.geminiRetries")

    render_cfg = config_object(cfg.get("rendering"), "rendering")
    render_enabled = config_bool(
        render_cfg.get("enabled"), True, "rendering.enabled"
    )
    render_timeout = config_float(render_cfg.get("timeout"), 45.0, "rendering.timeout")
    render_settle_ms = config_int(render_cfg.get("settleMilliseconds"), 1200, "rendering.settleMilliseconds")
    render_concurrency = config_int(render_cfg.get("concurrency"), 2, "rendering.concurrency")
    render_max_pages = config_int(render_cfg.get("maxPages"), 500, "rendering.maxPages")
    render_min_static_words = config_int(render_cfg.get("minStaticWords"), 40, "rendering.minStaticWords")

    convex_site_url = os.environ.get("CONVEX_SITE_URL", "").strip()
    if not convex_site_url:
        public_url = os.environ.get("NEXT_PUBLIC_CONVEX_URL", "").strip()
        if public_url.endswith(".convex.cloud"):
            convex_site_url = public_url.removesuffix(".convex.cloud") + ".convex.site"
    if not args.dry_run:
        # Fail closed: only a positively-verified local (loopback) Convex
        # target is allowed by default. A cloud target requires the explicit,
        # one-shot --cloud-execution-authorization phrase for this run only.
        # See uet_crawler/target_guard.py - this check was entirely absent
        # during the August 2026 incident, when this script ran against
        # whatever CONVEX_SITE_URL happened to be in .env.local (Convex Cloud).
        try:
            convex_site_url = assert_local_convex_target(
                convex_site_url,
                cloud_execution_authorization_phrase=args.cloud_execution_authorization,
            )
        except UnsafeConvexTargetError as exc:
            raise RuntimeError(str(exc)) from exc
    else:
        convex_site_url = convex_site_url.rstrip("/")
    convex_auth_token = os.environ.get("CONVEX_AUTH_TOKEN") or os.environ.get(
        "CRAWL_WEBHOOK_SECRET"
    )
    if convex_auth_token:
        convex_auth_token = validated_header_value(
            "CONVEX_AUTH_TOKEN", convex_auth_token, maximum=8192
        )
    require_auth_token = config_bool(
        cfg.get("requireAuthToken"), True, "requireAuthToken"
    )
    if not args.dry_run and require_auth_token and not convex_auth_token:
        raise RuntimeError(
            "CONVEX_AUTH_TOKEN (or CRAWL_WEBHOOK_SECRET) is required by configuration"
        )

    dlq_max_attempts = config_int(cfg.get("dlqMaxAttempts"), 10, "dlqMaxAttempts")

    io_budget_cfg = config_object(cfg.get("ioBudget"), "ioBudget")
    io_budget_soft_bytes = config_int(
        io_budget_cfg.get("softBytes"),
        450 * 1024 * 1024,
        "ioBudget.softBytes",
    )
    io_budget_stop_bytes = config_int(
        io_budget_cfg.get("stopBytes"),
        480 * 1024 * 1024,
        "ioBudget.stopBytes",
    )
    io_budget_max_bytes = config_int(
        io_budget_cfg.get("maxBytes"),
        500 * 1024 * 1024,
        "ioBudget.maxBytes",
    )

    # Validation keeps bad configuration from causing subtle runtime behaviour.
    _require_range("maxDepth", max_depth, -1, 1000)
    _require_range("concurrency", concurrency, 1, 100)
    _require_range("requestTimeout", request_timeout, 1, 600)
    _require_range("pdfTimeout", pdf_timeout, 1, 1800)
    _require_range("connectTimeout", connect_timeout, 1, 120)
    _require_range("maxRetries", max_retries, 1, 20)
    _require_range("pushRetries", push_retries, 1, 20)
    _require_range("minWordCount", min_word_count, 1, 100_000)
    _require_range("maxRedirects", max_redirects, 0, 20)
    if robots_enabled and max_redirects < 5:
        raise RuntimeError("maxRedirects must be at least 5 when robots are enabled")
    _require_range("tokenBucket.rate", token_rate, 0.01, 10_000)
    _require_range("tokenBucket.capacity", token_capacity, 1, 100_000)
    _require_range("rateLimiter.minDelay", aimd_min_delay, 0, 60)
    _require_range("rateLimiter.maxDelay", aimd_max_delay, aimd_min_delay, 600)
    _require_range("rateLimiter.initialDelay", aimd_initial_delay, 0, aimd_max_delay)
    _require_range("rateLimiter.mdFactor", aimd_multiplicative_factor, 1.01, 20)
    _require_range("simhashThreshold", simhash_threshold, 0, 20)
    _require_range("imageConcurrency", image_concurrency, 1, 20)
    _require_range("html.maxImagesPerPage", max_html_images_per_page, 0, 50)
    _require_range("html.imageConcurrency", html_image_concurrency, 1, 20)
    _require_range("html.imageTimeout", html_image_timeout, 1, 300)
    _require_range("urlPolicy.maxUrlLength", max_url_length, 256, 65_536)
    _require_range("urlPolicy.maxPathLength", max_path_length, 64, 32_768)
    _require_range("urlPolicy.maxQueryLength", max_query_length, 0, 32_768)
    _require_range("urlPolicy.maxQueryParams", max_query_params, 0, 200)
    _require_range("urlPolicy.maxQueryValuesPerKey", max_query_values_per_key, 1, 50)
    _require_range("rendering.timeout", render_timeout, 1, 300)
    _require_range("rendering.settleMilliseconds", render_settle_ms, 0, 30_000)
    _require_range("rendering.concurrency", render_concurrency, 1, 10)
    _require_range("rendering.maxPages", render_max_pages, 0, 100_000)
    _require_range("rendering.minStaticWords", render_min_static_words, 0, 10_000)
    _require_range("queueMaxSize", queue_max_size, 1, 10_000_000)
    _require_range("pushTimeout", push_timeout, 1, 600)
    _require_range("maxResponseBytes", max_response_bytes, 1024, 512 * 1024 * 1024)
    _require_range(
        "maxPdfResponseBytes", max_pdf_response_bytes, max_response_bytes,
        1024 * 1024 * 1024,
    )
    _require_range("maxIngestBytes", max_ingest_bytes, 1024, 4 * 1024 * 1024)
    _require_range("robots.cacheSeconds", robots_cache_seconds, 0, 24 * 3600)
    _require_range(
        "robots.staleSeconds", robots_stale_seconds, robots_cache_seconds,
        90 * 24 * 3600,
    )
    _require_range("rateLimiter.minHostDelay", min_host_delay, 0, 60)
    _require_range("rateLimiter.aiStep", aimd_additive_step, 0.000001, 60)
    _require_range("rateLimiter.successThreshold", aimd_success_threshold, 1, 100_000)
    _require_range("sitemap.maxFiles", sitemap_max_files, 1, 100_000)
    _require_range("sitemap.maxUrls", sitemap_max_urls, 1, 10_000_000)
    _require_range("simhashMinWords", simhash_min_words, 1, 1_000_000)
    _require_range("stateSaveInterval", state_interval, 1, 1_000_000)
    _require_range("pdf.maxImagesPerPdf", max_images_per_pdf, 0, 1000)
    _require_range("pdf.minImageBytes", min_image_bytes, 0, 100 * 1024 * 1024)
    _require_range("pdf.minImageDimension", min_image_dimension, 1, 100_000)
    _require_range("pdf.maxImageBytes", max_image_bytes, max(1, min_image_bytes),
                   100 * 1024 * 1024)
    _require_range("html.minImageBytes", min_html_image_bytes, 0,
                   100 * 1024 * 1024)
    _require_range("html.maxImageBytes", max_html_image_bytes,
                   max(1, min_html_image_bytes), 100 * 1024 * 1024)
    _require_range("geminiTimeout", gemini_timeout, 1, 600)
    _require_range("geminiRetries", gemini_retries, 1, 20)
    _require_range("dlqMaxAttempts", dlq_max_attempts, 1, 10_000)
    _require_range("ioBudget.softBytes", io_budget_soft_bytes, 1024, io_budget_stop_bytes)
    _require_range("ioBudget.stopBytes", io_budget_stop_bytes, io_budget_soft_bytes, io_budget_max_bytes)
    _require_range(
        "ioBudget.maxBytes",
        io_budget_max_bytes,
        io_budget_stop_bytes,
        500 * 1024 * 1024,
    )
    if not re.fullmatch(r"[A-Za-z0-9._/-]{1,128}", gemini_model):
        raise RuntimeError("GEMINI_VISION_MODEL contains unsupported characters")
    if pdf_table_strategy not in {"lines", "lines_strict", "text"}:
        raise RuntimeError("pdf.tableStrategy must be lines, lines_strict, or text")
    if not re.fullmatch(r"[A-Za-z0-9_+.-]{1,64}", pdf_ocr_language):
        raise RuntimeError("pdf.ocrLanguage is invalid")

    return Settings(
        project_root=project_root,
        config_path=config_path,
        seed_urls=seed_urls,
        allowed_host_suffixes=allowed_host_suffixes,
        department_urls=department_urls,
        include_patterns=include_patterns,
        exclude_patterns=exclude_patterns,
        strip_params=strip_params,
        skip_extensions=skip_extensions,
        boilerplate_selectors=boilerplate_selectors,
        drop_session_params=drop_session_params,
        max_url_length=max_url_length,
        max_path_length=max_path_length,
        max_query_length=max_query_length,
        max_query_params=max_query_params,
        max_query_values_per_key=max_query_values_per_key,
        max_pages=args.limit,
        max_depth=max_depth,
        concurrency=concurrency,
        queue_max_size=queue_max_size,
        request_timeout=request_timeout,
        pdf_timeout=pdf_timeout,
        connect_timeout=connect_timeout,
        max_retries=max_retries,
        push_retries=push_retries,
        push_timeout=push_timeout,
        min_word_count=min_word_count,
        max_response_bytes=max_response_bytes,
        max_pdf_response_bytes=max_pdf_response_bytes,
        max_ingest_bytes=max_ingest_bytes,
        max_redirects=max_redirects,
        robots_enabled=robots_enabled,
        robots_cache_seconds=robots_cache_seconds,
        robots_stale_seconds=robots_stale_seconds,
        user_agent=user_agent,
        robots_token=robots_token,
        impersonate=impersonate,
        trust_env=trust_env,
        token_rate=token_rate,
        token_capacity=token_capacity,
        min_host_delay=min_host_delay,
        aimd_min_delay=aimd_min_delay,
        aimd_max_delay=aimd_max_delay,
        aimd_initial_delay=aimd_initial_delay,
        aimd_additive_step=aimd_additive_step,
        aimd_multiplicative_factor=aimd_multiplicative_factor,
        aimd_success_threshold=aimd_success_threshold,
        sitemap_enabled=sitemap_enabled,
        sitemap_max_files=sitemap_max_files,
        sitemap_max_urls=sitemap_max_urls,
        simhash_threshold=simhash_threshold,
        simhash_min_words=simhash_min_words,
        state_interval=state_interval,
        pdf_table_strategy=pdf_table_strategy,
        pdf_use_ocr=pdf_use_ocr,
        pdf_ocr_language=pdf_ocr_language,
        describe_pdf_images=describe_pdf_images,
        max_images_per_pdf=max_images_per_pdf,
        min_image_bytes=min_image_bytes,
        min_image_dimension=min_image_dimension,
        max_image_bytes=max_image_bytes,
        image_concurrency=image_concurrency,
        describe_html_images=describe_html_images,
        max_html_images_per_page=max_html_images_per_page,
        min_html_image_bytes=min_html_image_bytes,
        max_html_image_bytes=max_html_image_bytes,
        html_image_timeout=html_image_timeout,
        html_image_concurrency=html_image_concurrency,
        gemini_model=gemini_model,
        gemini_timeout=gemini_timeout,
        gemini_retries=gemini_retries,
        render_enabled=render_enabled,
        render_timeout=render_timeout,
        render_settle_ms=render_settle_ms,
        render_concurrency=render_concurrency,
        render_max_pages=render_max_pages,
        render_min_static_words=render_min_static_words,
        convex_site_url=convex_site_url,
        convex_auth_token=convex_auth_token,
        require_auth_token=require_auth_token,
        dry_run=args.dry_run,
        max_runtime_seconds=args.max_runtime_seconds,
        state_file=project_root / "crawler_state.json",
        dlq_file=project_root / "dlq.jsonl",
        dead_dlq_file=project_root / "dlq_dead.jsonl",
        dlq_max_attempts=dlq_max_attempts,
        ledger_file=project_root / "crawl_ledger.sqlite3",
        coverage_json_file=project_root / "crawl_coverage.json",
        coverage_csv_file=project_root / "crawl_coverage.csv",
        require_complete=args.require_complete,
        io_budget_soft_bytes=io_budget_soft_bytes,
        io_budget_stop_bytes=io_budget_stop_bytes,
        io_budget_max_bytes=io_budget_max_bytes,
        local_corpus_dir=(
            Path(args.local_corpus_dir).expanduser().resolve()
            if args.local_corpus_dir
            else None
        ),
    )


# ---------------------------------------------------------------------------
# URL policy and host safety
# ---------------------------------------------------------------------------



@dataclass(frozen=True, slots=True)
class HostResolution:
    """A validated DNS answer that can be pinned into the transport request."""

    host: str
    port: int
    addresses: tuple[str, ...]

    def curl_resolve_entry(self) -> str:
        values = ",".join(
            f"[{address}]" if ":" in address else address
            for address in self.addresses
        )
        return f"{self.host}:{self.port}:{values}"


class HostSafetyCache:
    """Resolve, validate, cache, and expose public IPs for transport pinning.

    Merely resolving a host before a request is vulnerable to DNS rebinding: the
    HTTP stack can perform a second resolution and receive a different address.
    ``resolve()`` therefore returns the exact validated address set so
    ``RawHttpClient`` can bind libcurl to it with ``CURLOPT_RESOLVE``.
    """

    def __init__(
        self,
        ttl_seconds: float = 60.0,
        negative_ttl_seconds: float = 10.0,
        dns_timeout_seconds: float = 10.0,
    ):
        self.ttl_seconds = max(1.0, float(ttl_seconds))
        self.negative_ttl_seconds = max(1.0, float(negative_ttl_seconds))
        self.dns_timeout_seconds = max(1.0, float(dns_timeout_seconds))
        self._cache: dict[str, tuple[float, tuple[str, ...]]] = {}
        self._locks: dict[str, asyncio.Lock] = {}
        self._locks_guard = asyncio.Lock()

    @staticmethod
    def _is_public_ip(ip_text: str) -> bool:
        try:
            ip = ipaddress.ip_address(ip_text.split("%", 1)[0])
        except ValueError:
            return False
        if isinstance(ip, ipaddress.IPv6Address):
            if ip.ipv4_mapped is not None:
                return HostSafetyCache._is_public_ip(str(ip.ipv4_mapped))
            if ip.sixtofour is not None:
                return HostSafetyCache._is_public_ip(str(ip.sixtofour))
            # Teredo tunnels make the effective endpoint harder to reason about;
            # they are unnecessary for this crawler and rejected fail-closed.
            if ip.teredo is not None:
                return False
        return bool(ip.is_global and not ip.is_multicast and not ip.is_unspecified)

    async def _lock_for(self, host: str) -> asyncio.Lock:
        async with self._locks_guard:
            return self._locks.setdefault(host, asyncio.Lock())

    @staticmethod
    def _normalise_addresses(values: Iterable[str]) -> tuple[str, ...]:
        output: set[str] = set()
        for value in values:
            try:
                address = ipaddress.ip_address(str(value).split("%", 1)[0])
            except ValueError:
                continue
            output.add(address.compressed)
        return tuple(sorted(output, key=lambda item: (":" in item, item)))

    async def resolve(self, url: str) -> HostResolution | None:
        try:
            parsed = urllib.parse.urlsplit(url)
            host = (parsed.hostname or "").lower().rstrip(".")
            port = parsed.port or (443 if parsed.scheme.lower() == "https" else 80)
        except (ValueError, UnicodeError):
            return None
        if not host or parsed.scheme.lower() not in {"http", "https"}:
            return None

        now = time.monotonic()
        cached = self._cache.get(host)
        if cached and cached[0] > now:
            addresses = cached[1]
            return HostResolution(host, port, addresses) if addresses else None

        lock = await self._lock_for(host)
        async with lock:
            now = time.monotonic()
            cached = self._cache.get(host)
            if cached and cached[0] > now:
                addresses = cached[1]
                return HostResolution(host, port, addresses) if addresses else None

            try:
                literal = ipaddress.ip_address(host)
            except ValueError:
                try:
                    infos = await asyncio.wait_for(
                        asyncio.to_thread(
                            socket.getaddrinfo,
                            host,
                            port,
                            socket.AF_UNSPEC,
                            socket.SOCK_STREAM,
                            socket.IPPROTO_TCP,
                        ),
                        timeout=self.dns_timeout_seconds,
                    )
                except (asyncio.TimeoutError, socket.gaierror, UnicodeError, OSError):
                    addresses = ()
                else:
                    addresses = self._normalise_addresses(info[4][0] for info in infos)
                    if len(addresses) > 16:
                        log.warning("Blocked host %s with an excessive DNS answer set", host)
                        addresses = ()
            else:
                addresses = (literal.compressed,)

            safe = bool(addresses) and all(self._is_public_ip(value) for value in addresses)
            if not safe:
                if addresses:
                    log.warning(
                        "Blocked host %s because its DNS answer contains non-global "
                        "addresses: %s",
                        host,
                        list(addresses),
                    )
                addresses = ()
            ttl = self.ttl_seconds if addresses else self.negative_ttl_seconds
            self._cache[host] = (now + ttl, addresses)
            return HostResolution(host, port, addresses) if addresses else None

    async def is_safe(self, url: str) -> bool:
        return await self.resolve(url) is not None


# ---------------------------------------------------------------------------
# Streaming HTTP transport
# ---------------------------------------------------------------------------


@dataclass
class HttpResult:
    requested_url: str
    final_url: str
    status: int
    headers: dict[str, str]
    body: bytes
    redirect_chain: tuple[str, ...] = ()

    @property
    def content_type(self) -> str:
        return self.headers.get("content-type", "").lower()

    @property
    def retry_after(self) -> float | None:
        return parse_retry_after(self.headers.get("retry-after"))


class ResponseTooLarge(RuntimeError):
    pass


class UnsafeUrl(RuntimeError):
    pass


class PushTerminalError(RuntimeError):
    """The payload or backend response will not succeed unchanged."""


class PushRetryableError(RuntimeError):
    """The backend could not accept a valid payload after bounded retries."""


class RawHttpClient:
    """SSRF-hardened, redirect-aware, size-bounded HTTP transport."""

    def __init__(
        self,
        settings: Settings,
        policy: UrlPolicy,
        host_safety: HostSafetyCache,
        session_factory: Callable[..., AsyncSession] | None = None,
    ):
        self.settings = settings
        self.policy = policy
        self.host_safety = host_safety
        self._session_factory = session_factory or AsyncSession

    @staticmethod
    def _curl_options(
        resolution: HostResolution,
        max_bytes: int,
    ) -> dict[Any, Any]:
        options: dict[Any, Any] = {
            CurlOpt.RESOLVE: [resolution.curl_resolve_entry()],
        }
        max_file_size = getattr(CurlOpt, "MAXFILESIZE_LARGE", None)
        if max_file_size is not None:
            # Enforce the body ceiling in libcurl as well as in the Python
            # streaming loop. The loop remains authoritative on older libcurl
            # builds and validates the decompressed bytes exposed to callers.
            options[max_file_size] = max_bytes
        # A fresh connection guarantees the validated address set is used rather
        # than an older pooled connection established under different DNS data.
        for name, value in (
            ("FRESH_CONNECT", 1),
            ("FORBID_REUSE", 1),
            ("NOSIGNAL", 1),
        ):
            option = getattr(CurlOpt, name, None)
            if option is not None:
                options[option] = value
        return options

    @staticmethod
    def _headers(response: Any) -> dict[str, str]:
        headers: dict[str, str] = {}
        total = 0
        for index, (raw_key, raw_value) in enumerate(response.headers.items()):
            if index >= MAX_RESPONSE_HEADERS:
                raise RuntimeError("response contains too many headers")
            key = str(raw_key).lower().strip()
            value = str(raw_value).strip()
            total += len(key.encode("utf-8", "replace")) + len(
                value.encode("utf-8", "replace")
            )
            if total > MAX_RESPONSE_HEADER_BYTES:
                raise RuntimeError("response headers exceed the configured safety limit")
            if any(ord(character) < 0x20 and character != "\t" for character in value):
                raise RuntimeError("response header contains a forbidden control character")
            headers[key] = value
        return headers

    async def get(
        self,
        url: str,
        *,
        timeout: float,
        max_bytes: int,
        read_error_bodies: bool = False,
    ) -> HttpResult:
        if not math.isfinite(timeout) or timeout <= 0:
            raise ValueError("timeout must be finite and positive")
        if max_bytes <= 0:
            raise ValueError("max_bytes must be positive")

        requested = self.policy.canonicalize(url)
        if not requested:
            raise UnsafeUrl(f"Invalid URL: {url}")

        current = requested
        chain: list[str] = []
        visited = {current}
        for redirect_no in range(self.settings.max_redirects + 1):
            if not self.policy.is_network_target(current):
                raise UnsafeUrl(
                    f"URL is outside the configured origin allowlist: {current}"
                )
            resolution = await self.host_safety.resolve(current)
            if resolution is None:
                raise UnsafeUrl(
                    f"URL resolves to a non-global or invalid address: {current}"
                )

            response = None
            try:
                async with self._session_factory(
                    impersonate=self.settings.impersonate,
                    max_clients=2,
                    headers={"User-Agent": self.settings.user_agent},
                    trust_env=False,
                    curl_options=self._curl_options(resolution, max_bytes),
                ) as session:
                    response = await session.get(
                        current,
                        timeout=(self.settings.connect_timeout, timeout),
                        allow_redirects=False,
                        max_redirects=0,
                        stream=True,
                        headers={"User-Agent": self.settings.user_agent},
                        discard_cookies=True,
                    )
                    headers = self._headers(response)
                    status = int(response.status_code)

                    if status in REDIRECT_STATUSES:
                        location = headers.get("location")
                        if not location:
                            return HttpResult(
                                requested, current, status, headers, b"", tuple(chain)
                            )
                        if len(location) > self.settings.max_url_length:
                            raise UnsafeUrl(f"Oversized redirect target from {current}")
                        if redirect_no >= self.settings.max_redirects:
                            raise RequestsError(
                                f"Too many redirects (>{self.settings.max_redirects}) "
                                f"for {requested}"
                            )
                        next_url = self.policy.canonicalize(
                            urllib.parse.urljoin(current, location)
                        )
                        if not next_url:
                            raise UnsafeUrl(
                                f"Invalid redirect target from {current}: {location}"
                            )
                        if next_url in visited:
                            raise RequestsError(f"Redirect loop detected for {requested}")
                        visited.add(next_url)
                        chain.append(next_url)
                        current = next_url
                        continue

                    should_read = 200 <= status < 300 or read_error_bodies
                    if not should_read:
                        return HttpResult(
                            requested, current, status, headers, b"", tuple(chain)
                        )

                    declared = headers.get("content-length", "")
                    if declared:
                        if not declared.isdecimal():
                            raise RuntimeError("invalid Content-Length response header")
                        if int(declared) > max_bytes:
                            raise ResponseTooLarge(
                                f"Declared response size {declared} exceeds limit {max_bytes}"
                            )

                    chunks: list[bytes] = []
                    total = 0
                    async for chunk in response.aiter_content(chunk_size=STREAM_CHUNK_SIZE):
                        if not chunk:
                            continue
                        total += len(chunk)
                        if total > max_bytes:
                            raise ResponseTooLarge(
                                f"Streamed response exceeds limit {max_bytes} bytes"
                            )
                        chunks.append(bytes(chunk))
                    return HttpResult(
                        requested,
                        current,
                        status,
                        headers,
                        b"".join(chunks),
                        tuple(chain),
                    )
            finally:
                if response is not None:
                    with contextlib.suppress(Exception):
                        await response.aclose()

        raise RequestsError(f"Redirect limit exhausted for {requested}")


# ---------------------------------------------------------------------------
# Robots policy — RFC 9309 semantics
# ---------------------------------------------------------------------------


@dataclass
class RobotsEntry:
    mode: str  # "rules", "allow", or "deny"
    parser: RobotsRules | None
    fetched_at: float
    expires_at: float
    stale_until: float
    sitemaps: tuple[str, ...] = ()
    crawl_delay: float | None = None



class RobotsPolicy:
    """RFC 9309 retrieval semantics around the hardened ``RobotsRules`` adapter."""

    def __init__(self, settings: Settings, policy: UrlPolicy, raw_http: RawHttpClient):
        self.settings = settings
        self.policy = policy
        self.raw_http = raw_http
        self._entries: dict[str, RobotsEntry] = {}
        self._locks: dict[str, asyncio.Lock] = {}
        self._locks_guard = asyncio.Lock()

    async def _lock_for(self, origin: str) -> asyncio.Lock:
        async with self._locks_guard:
            return self._locks.setdefault(origin, asyncio.Lock())

    def _fresh_ttl(self, headers: Mapping[str, str], now_wall: datetime) -> float:
        configured = min(24 * 3600, max(0, self.settings.robots_cache_seconds))
        cache_control = headers.get("cache-control", "")
        directives = {
            part.partition("=")[0].strip().lower(): part.partition("=")[2].strip()
            for part in cache_control.split(",")
            if part.strip()
        }
        if "no-store" in directives or "no-cache" in directives:
            return 0.0
        ttl = float(configured)
        if directives.get("max-age", "").isdecimal():
            ttl = min(ttl, float(directives["max-age"]))
        elif headers.get("expires"):
            try:
                expires = parsedate_to_datetime(headers["expires"])
                if expires.tzinfo is None:
                    expires = expires.replace(tzinfo=timezone.utc)
                ttl = min(ttl, max(0.0, (expires - now_wall).total_seconds()))
            except (TypeError, ValueError, OverflowError):
                pass
        age = headers.get("age", "")
        if age.isdecimal():
            ttl = max(0.0, ttl - float(age))
        return min(24 * 3600.0, ttl)

    def _entry(
        self,
        *,
        mode: str,
        parser: RobotsRules | None,
        now: float,
        ttl: float,
        sitemaps: tuple[str, ...] = (),
        crawl_delay: float | None = None,
    ) -> RobotsEntry:
        return RobotsEntry(
            mode=mode,
            parser=parser,
            fetched_at=now,
            expires_at=now + max(0.0, ttl),
            stale_until=now + self.settings.robots_stale_seconds,
            sitemaps=sitemaps,
            crawl_delay=crawl_delay,
        )

    async def _load(self, origin: str) -> RobotsEntry:
        now = time.monotonic()
        existing = self._entries.get(origin)
        if existing and existing.expires_at > now:
            return existing

        lock = await self._lock_for(origin)
        async with lock:
            now = time.monotonic()
            existing = self._entries.get(origin)
            if existing and existing.expires_at > now:
                return existing

            robots_url = f"{origin}/robots.txt"
            try:
                result = await self.raw_http.get(
                    robots_url,
                    timeout=min(self.settings.request_timeout, 20.0),
                    max_bytes=ROBOTS_MAX_BYTES,
                    read_error_bodies=False,
                )
            except Exception as exc:
                if existing and existing.parser is not None and existing.stale_until > now:
                    log.warning(
                        "robots.txt refresh failed for %s; using stale cached rules: %s",
                        origin,
                        exc,
                    )
                    return existing
                log.warning("robots.txt unreachable for %s; temporarily disallowing", origin)
                entry = self._entry(
                    mode="deny",
                    parser=None,
                    now=now,
                    ttl=min(900, self.settings.robots_cache_seconds),
                )
                self._entries[origin] = entry
                return entry

            cache_control = result.headers.get("cache-control", "").lower()
            forbid_stale_reuse = any(
                directive.strip().partition("=")[0] == "no-store"
                for directive in cache_control.split(",")
            )
            ttl = self._fresh_ttl(result.headers, datetime.now(timezone.utc))
            if 200 <= result.status < 300:
                if not result.body.strip(b" \t\r\n\xef\xbb\xbf"):
                    parser = RobotsRules.allow_all()
                    entry = self._entry(
                        mode="rules", parser=parser, now=now, ttl=ttl
                    )
                else:
                    parser = RobotsRules.parse(
                        result.body,
                        max_bytes=ROBOTS_MAX_BYTES,
                    )
                    sitemaps = tuple(
                        dict.fromkeys(
                            canonical
                            for value in parser.sitemaps
                            if (canonical := self.policy.canonicalize(value))
                            and self.policy.is_network_target(canonical)
                        )
                    )
                    delay = parser.crawl_delay(self.settings.robots_token)
                    if delay is not None and delay > MAX_ROBOTS_CRAWL_DELAY:
                        log.warning(
                            "Capping robots Crawl-delay %.1fs to %.1fs for %s",
                            delay,
                            MAX_ROBOTS_CRAWL_DELAY,
                            origin,
                        )
                        delay = MAX_ROBOTS_CRAWL_DELAY
                    entry = self._entry(
                        mode="rules",
                        parser=parser,
                        now=now,
                        ttl=ttl,
                        sitemaps=sitemaps,
                        crawl_delay=delay,
                    )
                if forbid_stale_reuse:
                    entry.stale_until = now
                log.info("Loaded robots.txt for %s", origin)
            elif (
                400 <= result.status < 500
                and result.status not in RETRYABLE_HTTP_STATUSES
            ):
                entry = self._entry(mode="allow", parser=None, now=now, ttl=ttl)
                log.info(
                    "robots.txt returned HTTP %d for %s; allowing",
                    result.status,
                    origin,
                )
            else:
                if existing and existing.parser is not None and existing.stale_until > now:
                    log.warning(
                        "robots.txt returned HTTP %d for %s; using stale rules",
                        result.status,
                        origin,
                    )
                    return existing
                entry = self._entry(
                    mode="deny",
                    parser=None,
                    now=now,
                    ttl=min(900, self.settings.robots_cache_seconds),
                )
                log.warning(
                    "robots.txt returned HTTP %d for %s; temporarily disallowing",
                    result.status,
                    origin,
                )

            self._entries[origin] = entry
            return entry

    async def allowed(self, url: str) -> tuple[bool, float | None]:
        if not self.settings.robots_enabled:
            return True, None
        origin = normalized_origin(url)
        if not origin:
            return False, None
        entry = await self._load(origin)
        if entry.mode == "allow":
            return True, entry.crawl_delay
        if entry.mode == "deny":
            return False, entry.crawl_delay
        if entry.parser is None:
            return False, entry.crawl_delay
        return (
            entry.parser.can_fetch(url, self.settings.robots_token),
            entry.crawl_delay,
        )

    async def sitemap_urls(self, root_url: str) -> tuple[str, ...]:
        if not self.settings.robots_enabled:
            return ()
        origin = normalized_origin(root_url)
        if not origin:
            return ()
        return (await self._load(origin)).sitemaps


# ---------------------------------------------------------------------------
# Rate control
# ---------------------------------------------------------------------------


class AsyncTokenBucket:
    def __init__(self, rate: float, capacity: float):
        self.rate = rate
        self.capacity = capacity
        self.tokens = capacity
        self.last_refill = time.monotonic()
        self._lock = asyncio.Lock()

    async def acquire(self, amount: float = 1.0) -> None:
        while True:
            async with self._lock:
                now = time.monotonic()
                elapsed = now - self.last_refill
                self.tokens = min(self.capacity, self.tokens + elapsed * self.rate)
                self.last_refill = now
                if self.tokens >= amount:
                    self.tokens -= amount
                    return
                wait_for = (amount - self.tokens) / self.rate
            await asyncio.sleep(wait_for + random.uniform(0, wait_for * 0.1))


class AIMDRateLimiter:
    def __init__(self, settings: Settings):
        self.min_delay = settings.aimd_min_delay
        self.max_delay = settings.aimd_max_delay
        self.current_delay = settings.aimd_initial_delay
        self.ai_step = settings.aimd_additive_step
        self.md_factor = settings.aimd_multiplicative_factor
        self.success_threshold = settings.aimd_success_threshold
        self.success_streak = 0
        self._lock = asyncio.Lock()

    async def wait(self) -> None:
        async with self._lock:
            delay = self.current_delay
        if delay > 0:
            await asyncio.sleep(delay + random.uniform(0, delay * 0.1))

    async def on_success(self) -> None:
        async with self._lock:
            self.success_streak += 1
            if self.success_streak >= self.success_threshold:
                self.current_delay = max(self.min_delay, self.current_delay - self.ai_step)
                self.success_streak = 0

    async def on_failure(self, status: int = 0) -> None:
        if status not in (0, 429, 503):
            return
        async with self._lock:
            self.current_delay = min(self.max_delay, self.current_delay * self.md_factor)
            self.success_streak = 0


class HostPacer:
    def __init__(self, minimum_delay: float):
        self.minimum_delay = minimum_delay
        self._next_allowed: dict[str, float] = {}
        self._locks: defaultdict[str, asyncio.Lock] = defaultdict(asyncio.Lock)

    async def wait(self, url: str, robots_delay: float | None = None) -> None:
        origin = normalized_origin(url)
        delay = max(self.minimum_delay, robots_delay or 0.0)
        if not origin or delay <= 0:
            return
        async with self._locks[origin]:
            now = time.monotonic()
            slot = max(now, self._next_allowed.get(origin, now))
            self._next_allowed[origin] = slot + delay
            wait_for = slot - now
        if wait_for > 0:
            await asyncio.sleep(wait_for)


# ---------------------------------------------------------------------------
# Extraction data structures
# ---------------------------------------------------------------------------


@dataclass
class ExtractedDocument:
    url: str
    title: str
    markdown: str
    links: list[str]
    source_type: str
    content_hash: str
    word_count: int
    html_image_candidates: list[HtmlImageCandidate] = field(default_factory=list)


@dataclass
class FetchFailure:
    reason: str
    status: int = 0
    retryable: bool = False
    retry_after: float | None = None
    dlq_eligible: bool = True


@dataclass
class FetchAttempt:
    document: ExtractedDocument | None = None
    failure: FetchFailure | None = None
    fetched: bool = False
    raw_sha256: str | None = None


@dataclass
class PdfImageCandidate:
    page_number: int
    data: bytes
    mime_type: str
    width: int
    height: int
    score: float
    digest: str


# ---------------------------------------------------------------------------
# HTML extraction
# ---------------------------------------------------------------------------


def decode_body(body: bytes, content_type: str) -> str:
    declared: str | None = None
    match = re.search(r"charset\s*=\s*[\"']?([^;\s\"']+)", content_type, re.I)
    if match:
        declared = match.group(1).strip()
    candidates = [declared, "utf-8", "windows-1252"]
    tried: set[str] = set()
    for encoding in candidates:
        if not encoding or encoding.lower() in tried:
            continue
        tried.add(encoding.lower())
        try:
            return body.decode(encoding)
        except (LookupError, UnicodeDecodeError):
            continue
    return body.decode("utf-8", errors="replace")


def normalize_markdown(markdown: str) -> str:
    markdown = markdown.replace("\x00", "")
    markdown = re.sub(r"[\u200b\u200c\u200d\ufeff]", "", markdown)
    lines = [line.rstrip() for line in markdown.splitlines()]
    compact: list[str] = []
    previous_nonempty = ""
    for line in lines:
        stripped = line.strip()
        # Drop consecutive exact duplicate short UI lines while preserving real
        # repeated prose and table rows.
        if stripped and stripped == previous_nonempty and len(stripped) <= 120:
            continue
        compact.append(line)
        if stripped:
            previous_nonempty = stripped
    text = "\n".join(compact)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def extract_html_document_sync(
    body: bytes,
    content_type: str,
    final_url: str,
    settings: Settings,
    policy: UrlPolicy,
) -> ExtractedDocument | None:
    """Extract the complete active DOM while excluding inactive source history.

    Bootstrap modals, accordions, tabs, and initially hidden announcement
    panels are retained because JavaScript can reveal them. HTML comments are
    removed because UET pages use comments to retain stale notices and old
    deadlines. The dedicated extractor also returns ranked page-image
    candidates so advertisements and fee/schedule graphics can be described by
    the same vision pipeline used for PDF figures.
    """

    extracted = extract_active_html_document(
        body,
        content_type,
        final_url,
        policy,
        HtmlExtractorOptions(
            max_image_candidates=settings.max_html_images_per_page,
            include_footer_contacts=True,
            include_resource_manifest=True,
            include_visual_manifest=True,
            follow_nofollow_links=True,
            remove_selectors=settings.boilerplate_selectors,
        ),
    )
    if extracted is None:
        return None
    log.debug(
        "HTML extraction diagnostics for %s: %s",
        final_url,
        extracted.diagnostics,
    )
    return ExtractedDocument(
        url=extracted.canonical_url,
        title=extracted.title,
        markdown=extracted.markdown,
        links=extracted.crawl_links,
        source_type="html",
        content_hash=extracted.content_hash,
        word_count=extracted.word_count,
        html_image_candidates=extracted.image_candidates,
    )


# ---------------------------------------------------------------------------
# PDF extraction and Gemini image descriptions
# ---------------------------------------------------------------------------


def _supported_to_markdown_kwargs(candidate_kwargs: dict[str, Any]) -> dict[str, Any]:
    """Filter kwargs for compatibility with installed PyMuPDF4LLM versions.

    In pymupdf4llm >= ~1.26, ``to_markdown`` is a thin ``(*args, **kwargs)``
    shim that forwards everything to an internal implementation (see
    ``pymupdf4llm/__init__.py``); ``inspect.signature`` on the shim itself
    exposes only the ``*args``/``**kwargs`` catch-all parameters, never the
    real option names. Filtering candidate_kwargs against that would silently
    drop every kwarg - including ocr_function, page_chunks, and table_strategy
    - reverting extraction to undocumented defaults (auto-selected OCR
    backend, single-string non-chunked output) with no error raised. When the
    signature is just a forwarding catch-all there is nothing meaningful to
    filter against, so pass candidate_kwargs through unchanged; real filtering
    still applies for a hypothetical future version with an explicit,
    non-forwarding signature.
    """

    try:
        parameters = inspect.signature(pymupdf4llm.to_markdown).parameters
    except (TypeError, ValueError):
        return candidate_kwargs
    if any(p.kind is inspect.Parameter.VAR_KEYWORD for p in parameters.values()):
        return candidate_kwargs
    return {key: value for key, value in candidate_kwargs.items() if key in parameters}


def _pdf_title(doc: Any, url: str) -> str:
    metadata = getattr(doc, "metadata", None) or {}
    title = normalize_space(str(metadata.get("title") or ""))
    if title:
        return title[:500]
    name = Path(urllib.parse.unquote(urllib.parse.urlsplit(url).path)).name
    return name or url


def _clean_pdf_pages(page_texts: list[str]) -> list[str]:
    """Remove image placeholders and repeated top/bottom page furniture."""

    cleaned_pages: list[list[str]] = []
    edge_counts: Counter[str] = Counter()
    for text in page_texts:
        # pymupdf4llm wraps OCR output from *inside* an image/picture bounding
        # box (logos, seals, decorative graphics) in these markers - per its
        # own source comment it "cannot be sure about the formatting" of that
        # region. Full-page scanned body text is OCRed through the normal
        # paragraph path and never wrapped this way. Measured against real
        # UET PDFs, the wrapped content is OCR misreads of decorative
        # crests/seals (e.g. "ND)<br>WY =-- W<br>Ne SE<br>"), not legitimate
        # body text, so it is dropped rather than left to pollute the corpus.
        text = re.sub(
            r"<!--\s*Start of picture text\s*-->.*?<!--\s*End of picture text\s*-->\n?",
            "",
            text,
            flags=re.IGNORECASE | re.DOTALL,
        )
        lines = []
        for line in text.splitlines():
            if "intentionally omitted" in line.lower():
                continue
            if re.search(r"\[=>?\s*\d+\s*[x×]\s*\d+\s*\]", line, re.I):
                continue
            lines.append(line.rstrip())
        cleaned_pages.append(lines)
        nonempty = [normalize_space(line) for line in lines if normalize_space(line)]
        for edge in set(nonempty[:3] + nonempty[-3:]):
            if len(edge) <= 100:
                edge_counts[edge] += 1

    page_count = max(1, len(page_texts))
    threshold = max(3, math.ceil(page_count * 0.2))
    repeated_edges = {line for line, count in edge_counts.items() if count >= threshold}

    output: list[str] = []
    for lines in cleaned_pages:
        result: list[str] = []
        for line in lines:
            stripped = normalize_space(line)
            if stripped in repeated_edges:
                continue
            if re.fullmatch(r"\s*[*_#-]*\s*\d+\s*[*_#-]*\s*", line):
                continue
            result.append(line)
        page = normalize_markdown("\n".join(result))
        output.append(page)
    return output


def extract_pdf_sync(
    body: bytes,
    url: str,
    settings: Settings,
) -> tuple[str, list[str], list[PdfImageCandidate]]:
    doc = fitz.open(stream=body, filetype="pdf")
    try:
        title = _pdf_title(doc, url)
        kwargs = _supported_to_markdown_kwargs(
            {
                "page_chunks": True,
                "table_strategy": settings.pdf_table_strategy,
                "write_images": False,
                "embed_images": False,
                "show_progress": False,
                "header": False,
                "footer": False,
                "page_separators": False,
                "use_ocr": settings.pdf_use_ocr,
                "ocr_language": settings.pdf_ocr_language,
                "force_text": True,
                # Explicit engine, not PyMuPDF4LLM's auto-selected default: the
                # installed rapidocr_onnxruntime no longer exposes the
                # `text_detector` attribute PyMuPDF4LLM's rapidocr/rapidtess
                # backends call (upstream PyMuPDF/RAG#398), which crashes on
                # every OCR-eligible PDF. tesseract_api uses PyMuPDF's built-in
                # Tesseract integration and has no RapidOCR dependency.
                # skip_ocr_if_native_text_sufficient avoids a separate defect:
                # PyMuPDF4LLM's own OCR-need heuristic misfires on dot-leader
                # layouts (e.g. tables of contents) with already-complete
                # native text, appending a redundant/garbled OCR reading.
                "ocr_function": skip_ocr_if_native_text_sufficient(
                    pymupdf4llm_tesseract_api.exec_ocr
                ),
            }
        )
        try:
            converted = pymupdf4llm.to_markdown(doc, **kwargs)
        except Exception as first_error:
            # OCR dependencies are often absent in deployment images. Retry
            # without OCR before treating the whole PDF as unextractable.
            if kwargs.get("use_ocr"):
                log.warning("PDF OCR failed for %s; retrying text-only: %s", url, first_error)
                kwargs["use_ocr"] = False
                converted = pymupdf4llm.to_markdown(doc, **kwargs)
            else:
                raise

        if isinstance(converted, list):
            page_texts = [str(item.get("text") or "") for item in converted]
        else:
            page_texts = [str(converted or "")]
        page_texts = _clean_pdf_pages(page_texts)

        candidates: list[PdfImageCandidate] = []
        seen_digests: set[str] = set()
        if settings.describe_pdf_images:
            for page in doc:
                page_number = page.number + 1
                for image_info in page.get_images(full=True):
                    xref = image_info[0]
                    try:
                        image = doc.extract_image(xref)
                        data = bytes(image["image"])
                        width = int(image.get("width", 0))
                        height = int(image.get("height", 0))
                        extension = str(image.get("ext", "png")).lower()
                    except Exception:
                        continue
                    if not (
                        settings.min_image_bytes <= len(data) <= settings.max_image_bytes
                        and width >= settings.min_image_dimension
                        and height >= settings.min_image_dimension
                    ):
                        continue
                    digest = hashlib.sha256(data).hexdigest()
                    if digest in seen_digests:
                        continue
                    seen_digests.add(digest)
                    mime = {
                        "jpg": "image/jpeg",
                        "jpeg": "image/jpeg",
                        "png": "image/png",
                        "webp": "image/webp",
                        "gif": "image/gif",
                    }.get(extension)
                    if not mime:
                        continue
                    area = width * height
                    # Prefer large, information-dense images while avoiding a
                    # pure byte-size ranking that over-selects photographic noise.
                    score = math.log1p(area) * math.log1p(len(data))
                    candidates.append(
                        PdfImageCandidate(
                            page_number=page_number,
                            data=data,
                            mime_type=mime,
                            width=width,
                            height=height,
                            score=score,
                            digest=digest,
                        )
                    )
            candidates.sort(key=lambda item: item.score, reverse=True)
            candidates = candidates[: settings.max_images_per_pdf]

        return title, page_texts, candidates
    finally:
        doc.close()



def build_gemini_interaction_payload(
    prompt: str,
    image_data: bytes,
    mime_type: str,
    model: str,
) -> dict[str, object]:
    """Build a v1/interactions vision request for the Gemini Interactions API.

    The endpoint accepts only ``content`` input items; the text prompt and the
    inline image are wrapped as content parts. ``data`` is base64-encoded.
    """

    return {
        "model": model,
        "input": [
            {
                "type": "content",
                "content": [
                    {"type": "text", "text": prompt},
                    {
                        "type": "image",
                        "data": base64.b64encode(image_data).decode("ascii"),
                        "mime_type": mime_type,
                        "resolution": "high",
                    },
                ],
            }
        ],
        "store": False,
        "response_format": {
            "type": "text",
            "mime_type": "application/json",
            "schema": {
                "type": "object",
                "properties": {
                    "decorative": {"type": "boolean"},
                    "markdown": {"type": "string"},
                    "unreadable_items": {
                        "type": "array",
                        "items": {"type": "string"},
                    },
                },
                "required": ["decorative", "markdown", "unreadable_items"],
                "additionalProperties": False,
            },
        },
        "generation_config": {
            "temperature": 0.0,
            "max_output_tokens": 700,
            "thinking_level": "low",
        },
    }



class GeminiVisionClient:
    """Concurrency- and response-bounded Gemini image transcription client."""

    def __init__(self, settings: Settings):
        self.settings = settings
        raw_api_key = (
            os.environ.get("GEMINI_API_KEY")
            or os.environ.get("GEMINI_API_KEY_1")
            or os.environ.get("GEMINI_API_KEY_2")
            or os.environ.get("GOOGLE_GENERATIVE_AI_API_KEY")
        )
        self.api_key = (
            validated_header_value("GEMINI_API_KEY", raw_api_key, maximum=1024)
            if raw_api_key
            else None
        )
        concurrency = max(settings.image_concurrency, settings.html_image_concurrency)
        self._semaphore = asyncio.Semaphore(concurrency)
        timeout = httpx.Timeout(
            settings.gemini_timeout,
            connect=min(15.0, settings.gemini_timeout),
        )
        self._client = httpx.AsyncClient(
            timeout=timeout,
            limits=httpx.Limits(
                max_connections=max(4, concurrency * 2),
                max_keepalive_connections=max(2, concurrency),
                keepalive_expiry=30.0,
            ),
            follow_redirects=False,
            trust_env=False,
        )

    async def aclose(self) -> None:
        await self._client.aclose()

    @property
    def enabled(self) -> bool:
        return bool(self.api_key)

    async def describe(self, candidate: PdfImageCandidate) -> str | None:
        if not self.enabled or not self.settings.describe_pdf_images:
            return None
        prompt = (
            f"This image appears on page {candidate.page_number} of a university "
            "document. Extract only factual, searchable information visible in "
            "the image. Transcribe important names, labels, dates, fees, "
            "deadlines, program names and numerical values. For a table, preserve "
            "row and column relationships in concise Markdown. For a diagram or "
            "map, explain labeled relationships or locations. Do not infer "
            "unreadable text. If the image is merely decorative, answer exactly "
            "DECORATIVE."
        )
        return await self._describe_image(candidate.data, candidate.mime_type, prompt)

    async def describe_html(
        self,
        image_bytes: bytes,
        mime_type: str,
        candidate: HtmlImageCandidate,
        page_url: str,
    ) -> str | None:
        if not self.enabled or not self.settings.describe_html_images:
            return None
        context = candidate.context[:1200] if candidate.context else "No nearby text."
        prompt = (
            "This image is an official visual resource on a university webpage. "
            f"Page URL: {page_url}. Image URL: {candidate.url}. "
            f"DOM label: {candidate.alt_text}. Nearby page context: {context}. "
            "Transcribe every factual item that a student could need: headings, "
            "program names, dates, deadlines, fees, eligibility conditions, merit "
            "information, schedules, contact details, URLs, and footnotes. Preserve "
            "tables and grouped lists in concise Markdown. Distinguish text actually "
            "visible in the image from nearby DOM context. Never guess unreadable "
            "characters. If the image is only decorative or a portrait/logo, answer "
            "exactly DECORATIVE."
        )
        return await self._describe_image(image_bytes, mime_type, prompt)

    @staticmethod
    async def _read_response_limited(response: httpx.Response) -> bytes:
        declared = response.headers.get("content-length", "")
        if declared.isdecimal() and int(declared) > MAX_GEMINI_RESPONSE_BYTES:
            raise RuntimeError("Gemini response Content-Length exceeds safety limit")
        chunks: list[bytes] = []
        total = 0
        async for chunk in response.aiter_bytes():
            total += len(chunk)
            if total > MAX_GEMINI_RESPONSE_BYTES:
                raise RuntimeError("Gemini response exceeds safety limit")
            chunks.append(chunk)
        return b"".join(chunks)

    @staticmethod
    def _extract_text(data: Mapping[str, Any]) -> str:
        text = extract_interaction_output_text(data)
        if text:
            return text
        # Defensive compatibility with the GA Interactions ``steps`` schema.
        for step in reversed(data.get("steps") or []):
            if not isinstance(step, Mapping):
                continue
            direct = step.get("text")
            if isinstance(direct, str) and direct:
                return direct
            content = step.get("content")
            if isinstance(content, Mapping):
                content_items: Sequence[Any] = (content,)
            elif isinstance(content, list):
                content_items = content
            else:
                content_items = ()
            for item in reversed(content_items):
                if not isinstance(item, Mapping):
                    continue
                value = item.get("text")
                if isinstance(value, str) and value:
                    return value
        return ""

    async def _describe_image(
        self, image_bytes: bytes, mime_type: str, prompt: str
    ) -> str | None:
        if not self.enabled:
            return None
        prepared = await asyncio.to_thread(
            prepare_image_for_gemini,
            image_bytes,
            mime_type,
            maximum_bytes=min(self.settings.max_image_bytes, 12 * 1024 * 1024),
        )
        if prepared is None:
            return None

        endpoint = "https://generativelanguage.googleapis.com/v1/interactions"
        payload = build_gemini_interaction_payload(
            prompt,
            prepared.data,
            prepared.mime_type,
            self.settings.gemini_model,
        )
        payload_bytes = json.dumps(payload, separators=(",", ":")).encode("utf-8")
        if len(payload_bytes) >= 20 * 1024 * 1024:
            log.warning("Skipping Gemini request above the inline-request size limit")
            return None
        headers = {
            "x-goog-api-key": str(self.api_key),
            "Content-Type": "application/json",
        }

        async with self._semaphore:
            for attempt in range(self.settings.gemini_retries):
                try:
                    async with self._client.stream(
                        "POST", endpoint, content=payload_bytes, headers=headers
                    ) as response:
                        status = response.status_code
                        if status == 200:
                            body = await self._read_response_limited(response)
                            data = json.loads(body)
                            if not isinstance(data, Mapping):
                                return None
                            parsed = parse_transcription_text(self._extract_text(data))
                            return normalize_markdown(parsed) if parsed else None
                        retry_after = parse_retry_after(
                            response.headers.get("retry-after")
                        )
                except (httpx.HTTPError, RuntimeError, ValueError, json.JSONDecodeError) as exc:
                    if attempt + 1 >= self.settings.gemini_retries:
                        log.warning("Gemini image transcription failed: %s", exc)
                        return None
                    await asyncio.sleep(
                        retry_delay(attempt, base=1.0, maximum=30.0)
                    )
                    continue

                if status not in RETRYABLE_HTTP_STATUSES:
                    log.warning(
                        "Gemini rejected image transcription with HTTP %d", status
                    )
                    return None
                if attempt + 1 >= self.settings.gemini_retries:
                    return None
                await asyncio.sleep(
                    retry_after
                    if retry_after is not None
                    else retry_delay(attempt, base=1.0, maximum=30.0)
                )
        return None


class PdfExtractionQualityError(RuntimeError):
    """A fetched PDF produced non-empty but unusably low-quality Markdown."""


async def build_pdf_document(
    body: bytes,
    final_url: str,
    settings: Settings,
    vision: GeminiVisionClient,
) -> ExtractedDocument | None:
    title, page_texts, candidates = await asyncio.to_thread(
        extract_pdf_sync, body, final_url, settings
    )

    descriptions: defaultdict[int, list[str]] = defaultdict(list)
    if candidates and vision.enabled:
        log.info(
            "PDF %s: describing %d selected image(s) with %s",
            final_url,
            len(candidates),
            settings.gemini_model,
        )
        results = await asyncio.gather(
            *(vision.describe(candidate) for candidate in candidates),
            return_exceptions=True,
        )
        for candidate, result in zip(candidates, results):
            if isinstance(result, BaseException):
                log.debug("Image description exception: %s", result)
            elif result:
                descriptions[candidate.page_number].append(result)

    sections: list[str] = [f"# {title}"]
    for page_number, page_text in enumerate(page_texts, start=1):
        page_parts: list[str] = [f"## Page {page_number}"]
        if page_text:
            page_parts.append(page_text)
        if descriptions.get(page_number):
            page_parts.append("### Figures and visual data")
            page_parts.extend(f"- {description}" for description in descriptions[page_number])
        if len(page_parts) > 1:
            sections.append("\n\n".join(page_parts))

    markdown = normalize_markdown("\n\n".join(sections))
    if not markdown:
        return None

    # A non-empty result can still be unusable (e.g. OCR read a stylized
    # cover as short, plausible-looking gibberish rather than throwing).
    # min_word_count formula matches ingest_pdf.py's document_min_words, the
    # existing, already-considered threshold for the sibling ingestion path,
    # rather than inventing a new one for this path specifically.
    document_min_words = min(50, max(8, len(page_texts) * 4))
    quality = assess_pdf_markdown_quality(
        markdown, min_word_count=document_min_words, clean_before_assessment=False
    )
    if quality.is_garbage:
        raise PdfExtractionQualityError(
            f"score={quality.score:.2f} reasons={quality.reasons} "
            f"word_count={quality.word_count}"
        )

    content_hash = hashlib.sha256(markdown.encode("utf-8")).hexdigest()
    return ExtractedDocument(
        url=final_url,
        title=title,
        markdown=markdown,
        links=[],
        source_type="pdf",
        content_hash=content_hash,
        word_count=len(markdown.split()),
    )


def sniff_image_mime(result: HttpResult) -> str | None:
    content_type = result.content_type.split(";", 1)[0].strip()
    if content_type in {
        "image/jpeg",
        "image/png",
        "image/webp",
        "image/gif",
        "image/bmp",
        "image/tiff",
    }:
        return content_type
    prefix = result.body[:16]
    if prefix.startswith(b"\xff\xd8\xff"):
        return "image/jpeg"
    if prefix.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png"
    if prefix.startswith((b"GIF87a", b"GIF89a")):
        return "image/gif"
    if prefix.startswith(b"BM"):
        return "image/bmp"
    if prefix[:4] in (b"II*\x00", b"MM\x00*"):
        return "image/tiff"
    if len(prefix) >= 12 and prefix[:4] == b"RIFF" and prefix[8:12] == b"WEBP":
        return "image/webp"
    return None


async def enrich_html_document_images(
    document: ExtractedDocument,
    settings: Settings,
    raw_http: RawHttpClient,
    vision: GeminiVisionClient,
) -> ExtractedDocument:
    """Fetch and transcribe ranked informational images from an HTML page."""

    candidates = document.html_image_candidates[: settings.max_html_images_per_page]
    if (
        not candidates
        or not settings.describe_html_images
        or not vision.enabled
        or settings.max_html_images_per_page <= 0
    ):
        return document

    semaphore = asyncio.Semaphore(settings.html_image_concurrency)

    async def process(
        candidate: HtmlImageCandidate,
    ) -> tuple[HtmlImageCandidate, str | None]:
        async with semaphore:
            try:
                result = await raw_http.get(
                    candidate.url,
                    timeout=settings.html_image_timeout,
                    max_bytes=settings.max_html_image_bytes,
                )
            except Exception as exc:
                log.debug("HTML image fetch failed for %s: %s", candidate.url, exc)
                return candidate, None

            if not 200 <= result.status < 300:
                log.debug(
                    "HTML image returned HTTP %d: %s",
                    result.status,
                    candidate.url,
                )
                return candidate, None
            if len(result.body) < settings.min_html_image_bytes:
                return candidate, None
            mime_type = sniff_image_mime(result)
            if not mime_type:
                log.debug(
                    "Unsupported HTML image content type %s: %s",
                    result.content_type,
                    candidate.url,
                )
                return candidate, None
            description = await vision.describe_html(
                result.body, mime_type, candidate, document.url
            )
            return candidate, description

    log.info(
        "HTML %s: transcribing %d selected visual resource(s) with %s",
        document.url,
        len(candidates),
        settings.gemini_model,
    )
    results = await asyncio.gather(
        *(process(candidate) for candidate in candidates),
        return_exceptions=True,
    )

    sections: list[str] = []
    for result in results:
        if isinstance(result, BaseException):
            log.debug("HTML image transcription exception: %s", result)
            continue
        candidate, description = result
        if not description:
            continue
        sections.append(
            "\n".join(
                (
                    f"### {candidate.alt_text}",
                    f"Source image: {candidate.url}",
                    description,
                )
            )
        )

    if not sections:
        return document
    enriched = normalize_markdown(
        document.markdown
        + "\n\n## Information transcribed from official page images\n\n"
        + "\n\n".join(sections)
    )
    document.markdown = enriched
    document.content_hash = hashlib.sha256(enriched.encode("utf-8")).hexdigest()
    document.word_count = len(enriched.split())
    return document


# ---------------------------------------------------------------------------
# Fetch + extract pipeline
# ---------------------------------------------------------------------------


def sniff_content_kind(result: HttpResult, policy: UrlPolicy) -> str:
    content_type = result.content_type
    prefix = result.body[:1024].lstrip()
    if (
        "application/pdf" in content_type
        or prefix.startswith(b"%PDF-")
        or policy.is_probable_pdf_url(result.final_url)
    ):
        return "pdf"
    if (
        "text/html" in content_type
        or "application/xhtml" in content_type
        or prefix.startswith((b"<!doctype html", b"<html", b"<HTML"))
    ):
        return "html"
    return "unsupported"


def html_render_reason(
    body: bytes,
    content_type: str,
    document: ExtractedDocument | None,
    settings: Settings,
) -> str | None:
    """Return why browser rendering is required, or ``None`` for static HTML."""

    if not settings.render_enabled:
        return None
    text = decode_body(body[:1_000_000], content_type).lower()
    shell_markers = (
        "you need to enable javascript",
        "please enable javascript",
        '<div id="root"></div>',
        '<div id="app"></div>',
        '<app-root></app-root>',
        '<noscript>you need to enable javascript',
        'id="__next"',
        "__next_data__",
    )
    if any(marker in text for marker in shell_markers):
        return "javascript application shell"
    script_heavy = text.count("<script") >= 2 or any(
        marker in text for marker in ("webpack", "vite", "react", "angular", "vue")
    )
    if document is None and script_heavy:
        return "no static extractable content on a script-driven page"
    if (
        document is not None
        and document.word_count < settings.render_min_static_words
        and script_heavy
    ):
        return f"thin script-driven static DOM ({document.word_count} words)"
    return None



async def fetch_and_extract_once(
    url: str,
    settings: Settings,
    policy: UrlPolicy,
    raw_http: RawHttpClient,
    vision: GeminiVisionClient,
    renderer: BrowserRenderer,
    corpus_sink: FilesystemCorpusSink | None = None,
) -> FetchAttempt:
    probable_pdf = policy.is_probable_pdf_url(url)
    timeout = settings.pdf_timeout if probable_pdf else settings.request_timeout
    max_bytes = settings.max_pdf_response_bytes

    try:
        result = await raw_http.get(url, timeout=timeout, max_bytes=max_bytes)
    except (ResponseTooLarge, UnsafeUrl) as exc:
        return FetchAttempt(
            failure=FetchFailure(str(exc), retryable=False, dlq_eligible=False)
        )
    except (asyncio.TimeoutError, TimeoutError):
        return FetchAttempt(
            failure=FetchFailure("timeout", retryable=True, dlq_eligible=True)
        )
    except Exception as exc:
        return FetchAttempt(
            failure=FetchFailure(
                f"network error: {type(exc).__name__}: {exc}",
                retryable=True,
                dlq_eligible=True,
            )
        )

    if not 200 <= result.status < 300:
        retryable = result.status in RETRYABLE_HTTP_STATUSES
        return FetchAttempt(
            failure=FetchFailure(
                f"HTTP {result.status}",
                status=result.status,
                retryable=retryable,
                retry_after=result.retry_after,
                dlq_eligible=retryable,
            )
        )

    kind = sniff_content_kind(result, policy)
    effective_max = (
        settings.max_pdf_response_bytes if kind == "pdf" else settings.max_response_bytes
    )
    if len(result.body) > effective_max:
        return FetchAttempt(
            failure=FetchFailure(
                f"response body exceeds {effective_max} bytes",
                status=result.status,
                retryable=False,
                dlq_eligible=False,
            ),
            fetched=True,
        )

    raw_sha256: str | None = None
    if corpus_sink is not None:
        # Preserve raw bytes for every successful fetch, before extraction is
        # attempted, so a future extractor fix or a failed extraction can be
        # re-parsed without a second network request ("fetch once, parse many
        # times" - see corpus_sink.py's module docstring).
        raw_record = await asyncio.to_thread(
            corpus_sink.write_raw,
            result.body,
            canonical_url=url,
            final_url=result.final_url,
            http_status=result.status,
            content_type=result.content_type,
            etag=result.headers.get("etag"),
            last_modified=result.headers.get("last-modified"),
        )
        raw_sha256 = raw_record.sha256

    try:
        if kind == "pdf":
            document = await build_pdf_document(
                result.body, result.final_url, settings, vision
            )
        elif kind == "html":
            static_document = await asyncio.to_thread(
                extract_html_document_sync,
                result.body,
                result.content_type,
                result.final_url,
                settings,
                policy,
            )
            document = static_document
            render_reason = html_render_reason(
                result.body, result.content_type, static_document, settings
            )
            if render_reason is not None:
                rendered = None
                render_error: Exception | None = None
                try:
                    rendered = await renderer.render(result.final_url)
                except RenderLimitReached as exc:
                    # The selective-render budget was exhausted for this page;
                    # retrying the same page would repeat a full fetch+render
                    # cycle. This is a terminal, non-DLQ outcome.
                    return FetchAttempt(
                        failure=FetchFailure(
                            f"browser rendering required ({render_reason}) but "
                            f"failed: {exc}",
                            status=result.status,
                            retryable=False,
                            dlq_eligible=False,
                        ),
                        fetched=True,
                    )
                except Exception as exc:
                    render_error = exc

                if rendered is not None:
                    rendered_document = await asyncio.to_thread(
                        extract_html_document_sync,
                        rendered.html,
                        "text/html; charset=utf-8",
                        rendered.final_url,
                        settings,
                        policy,
                    )
                else:
                    rendered_document = None

                if rendered_document is None:
                    static_usable = bool(
                        static_document is not None
                        and static_document.word_count >= settings.render_min_static_words
                    )
                    if not static_usable:
                        detail = (
                            f"{type(render_error).__name__}: {render_error}"
                            if render_error is not None
                            else "renderer produced no extractable page"
                        )
                        return FetchAttempt(
                            failure=FetchFailure(
                                f"browser rendering required ({render_reason}) but failed: "
                                f"{detail}",
                                status=result.status,
                                retryable=True,
                                dlq_eligible=True,
                            ),
                            fetched=True,
                        )
                    log.warning(
                        "Using usable static extraction after render failure for %s: %s",
                        result.final_url,
                        render_error or "no rendered document",
                    )
                else:
                    if static_document is not None:
                        rendered_document.links = list(
                            dict.fromkeys(
                                [*static_document.links, *rendered_document.links]
                            )
                        )
                        rendered_document.html_image_candidates = list(
                            {
                                candidate.url: candidate
                                for candidate in [
                                    *static_document.html_image_candidates,
                                    *rendered_document.html_image_candidates,
                                ]
                            }.values()
                        )
                    document = rendered_document
                    log.info(
                        "Browser-rendered DOM selected for %s (%s; words=%d links=%d)",
                        rendered.final_url,
                        render_reason,
                        rendered_document.word_count,
                        len(rendered_document.links),
                    )
            if document is not None:
                document = await enrich_html_document_images(
                    document, settings, raw_http, vision
                )
        else:
            return FetchAttempt(
                failure=FetchFailure(
                    f"unsupported content-type: {result.content_type or 'unknown'}",
                    status=result.status,
                    retryable=False,
                    dlq_eligible=False,
                ),
                fetched=True,
            )
    except Exception as exc:
        return FetchAttempt(
            failure=FetchFailure(
                f"{kind} extraction failed: {type(exc).__name__}: {exc}",
                status=result.status,
                retryable=False,
                dlq_eligible=False,
            ),
            fetched=True,
        )

    if document is None:
        return FetchAttempt(
            failure=FetchFailure(
                "no extractable content",
                status=result.status,
                retryable=False,
                dlq_eligible=False,
            ),
            fetched=True,
        )
    return FetchAttempt(document=document, fetched=True, raw_sha256=raw_sha256)


# ---------------------------------------------------------------------------
# Near-duplicate detection
# ---------------------------------------------------------------------------


@dataclass
class FingerprintRecord:
    fingerprint: int
    word_count: int
    url: str



@dataclass(frozen=True, slots=True)
class DedupeReservation:
    token: str
    content_hash: str
    record: FingerprintRecord | None


class ContentDeduplicator:
    """Race-free exact and near-duplicate reservations for concurrent workers.

    A worker that encounters equivalent content currently being pushed waits for
    that reservation to resolve. If the first push commits, the waiter observes a
    duplicate; if it fails or is cancelled, one waiter may reserve and retry the
    content. This prevents both duplicate ingestion and content loss.
    """

    def __init__(self, threshold: int, min_words: int):
        self.threshold = threshold
        self.min_words = min_words
        self.exact_hashes: set[str] = set()
        self.records: list[FingerprintRecord] = []
        self.bands: defaultdict[tuple[int, int], set[int]] = defaultdict(set)
        self._pending_hashes: dict[str, str] = {}
        self._pending_records: dict[str, FingerprintRecord] = {}
        self._pending_bands: defaultdict[tuple[int, int], set[str]] = defaultdict(set)
        self._pending_futures: dict[str, asyncio.Future[bool]] = {}
        self._lock = asyncio.Lock()

    @staticmethod
    def _token_hash(token: str) -> int:
        digest = hashlib.blake2b(token.encode("utf-8"), digest_size=8).digest()
        return int.from_bytes(digest, "big")

    def fingerprint(self, text: str) -> tuple[int, int]:
        words = re.findall(r"[^\W_]{2,}", text.lower(), flags=re.UNICODE)[:8000]
        word_count = len(words)
        if not words:
            return 0, 0
        shingles = (
            [" ".join(words[index : index + 3]) for index in range(len(words) - 2)]
            if len(words) >= 3
            else words
        )
        frequencies = Counter(shingles)
        vector = [0] * 64
        for token, count in frequencies.items():
            weight = min(4, count)
            hashed = self._token_hash(token)
            for bit in range(64):
                vector[bit] += weight if hashed & (1 << bit) else -weight
        value = 0
        for bit, score in enumerate(vector):
            if score > 0:
                value |= 1 << bit
        return value, word_count

    @staticmethod
    def hamming(a: int, b: int) -> int:
        return (a ^ b).bit_count()

    @staticmethod
    def _band_keys(fingerprint: int) -> Iterable[tuple[int, int]]:
        mask = 0xF
        for band in range(16):
            yield band, (fingerprint >> (band * 4)) & mask

    def _committed_near_duplicate_reason(
        self, fingerprint: int, words: int
    ) -> str | None:
        if not fingerprint or words < self.min_words:
            return None
        if self.threshold <= 15:
            indices: set[int] = set()
            for key in self._band_keys(fingerprint):
                indices.update(self.bands.get(key, ()))
            candidates = (self.records[index] for index in sorted(indices))
        else:
            candidates = iter(self.records)
        for record in candidates:
            ratio = words / max(1, record.word_count)
            if 0.70 <= ratio <= 1.43 and self.hamming(
                fingerprint, record.fingerprint
            ) <= self.threshold:
                return f"near duplicate of {record.url}"
        return None

    def _pending_near_token(self, fingerprint: int, words: int) -> str | None:
        if not fingerprint or words < self.min_words:
            return None
        if self.threshold <= 15:
            tokens: set[str] = set()
            for key in self._band_keys(fingerprint):
                tokens.update(self._pending_bands.get(key, ()))
            candidates = (
                (token, self._pending_records[token])
                for token in sorted(tokens)
                if token in self._pending_records
            )
        else:
            candidates = iter(sorted(self._pending_records.items()))
        for token, record in candidates:
            ratio = words / max(1, record.word_count)
            if 0.70 <= ratio <= 1.43 and self.hamming(
                fingerprint, record.fingerprint
            ) <= self.threshold:
                return token
        return None

    def _remove_pending_locked(
        self, reservation: DedupeReservation
    ) -> tuple[FingerprintRecord | None, asyncio.Future[bool] | None]:
        if self._pending_hashes.get(reservation.content_hash) == reservation.token:
            self._pending_hashes.pop(reservation.content_hash, None)
        record = self._pending_records.pop(reservation.token, None)
        if record is not None:
            for key in self._band_keys(record.fingerprint):
                values = self._pending_bands.get(key)
                if values is not None:
                    values.discard(reservation.token)
                    if not values:
                        self._pending_bands.pop(key, None)
        return record, self._pending_futures.pop(reservation.token, None)

    async def reserve(
        self, document: ExtractedDocument
    ) -> tuple[str | None, DedupeReservation | None]:
        fingerprint, words = await asyncio.to_thread(
            self.fingerprint, document.markdown
        )
        while True:
            waiter: asyncio.Future[bool] | None = None
            async with self._lock:
                if document.content_hash in self.exact_hashes:
                    return "exact duplicate", None
                duplicate = self._committed_near_duplicate_reason(
                    fingerprint, words
                )
                if duplicate:
                    return duplicate, None

                pending_token = self._pending_hashes.get(document.content_hash)
                if pending_token is None:
                    pending_token = self._pending_near_token(fingerprint, words)
                if pending_token is not None:
                    waiter = self._pending_futures.get(pending_token)
                    if waiter is None:
                        # Defensive recovery from impossible partial state. Remove
                        # stale indices and retry under a fresh lock acquisition.
                        self._pending_hashes = {
                            key: value
                            for key, value in self._pending_hashes.items()
                            if value in self._pending_futures
                        }
                        self._pending_records.pop(pending_token, None)
                        for key in tuple(self._pending_bands):
                            values = self._pending_bands[key]
                            values.intersection_update(self._pending_futures)
                            if not values:
                                self._pending_bands.pop(key, None)
                        continue
                else:
                    token = hashlib.sha256(
                        f"{document.url}\0{document.content_hash}".encode("utf-8")
                    ).hexdigest()
                    record = (
                        FingerprintRecord(fingerprint, words, document.url)
                        if fingerprint and words >= self.min_words
                        else None
                    )
                    future = asyncio.get_running_loop().create_future()
                    self._pending_hashes[document.content_hash] = token
                    self._pending_futures[token] = future
                    if record is not None:
                        self._pending_records[token] = record
                        for key in self._band_keys(record.fingerprint):
                            self._pending_bands[key].add(token)
                    return None, DedupeReservation(
                        token, document.content_hash, record
                    )

            if waiter is not None:
                # Shield prevents a cancelled waiter from cancelling the shared
                # completion signal needed by other workers. Re-check state after
                # the owner commits or releases.
                await asyncio.shield(waiter)

    async def release(self, reservation: DedupeReservation) -> None:
        async with self._lock:
            _record, future = self._remove_pending_locked(reservation)
            if future is not None and not future.done():
                future.set_result(False)

    async def commit_reserved(self, reservation: DedupeReservation) -> None:
        async with self._lock:
            record, future = self._remove_pending_locked(reservation)
            if reservation.content_hash not in self.exact_hashes:
                self.exact_hashes.add(reservation.content_hash)
                if record is not None:
                    index = len(self.records)
                    self.records.append(record)
                    for key in self._band_keys(record.fingerprint):
                        self.bands[key].add(index)
            if future is not None and not future.done():
                future.set_result(True)

    # Backward-compatible synchronous helpers used by older tests. They should
    # only be called before workers start or after they stop.
    def duplicate_reason(self, document: ExtractedDocument) -> str | None:
        if document.content_hash in self.exact_hashes:
            return "exact duplicate"
        fingerprint, words = self.fingerprint(document.markdown)
        return self._committed_near_duplicate_reason(fingerprint, words)

    def commit(self, document: ExtractedDocument) -> None:
        if document.content_hash in self.exact_hashes:
            return
        self.exact_hashes.add(document.content_hash)
        fingerprint, words = self.fingerprint(document.markdown)
        if not fingerprint or words < self.min_words:
            return
        index = len(self.records)
        self.records.append(FingerprintRecord(fingerprint, words, document.url))
        for key in self._band_keys(fingerprint):
            self.bands[key].add(index)

    def snapshot(self) -> dict[str, Any]:
        return {
            "exact": sorted(self.exact_hashes),
            "records": [asdict(record) for record in self.records],
        }

    async def snapshot_async(self) -> dict[str, Any]:
        async with self._lock:
            return self.snapshot()

    def restore(self, payload: Mapping[str, Any]) -> None:
        for future in self._pending_futures.values():
            if not future.done():
                future.set_result(False)
        self.exact_hashes.clear()
        self.records.clear()
        self.bands.clear()
        self._pending_hashes.clear()
        self._pending_records.clear()
        self._pending_bands.clear()
        self._pending_futures.clear()
        self.exact_hashes = {str(value) for value in payload.get("exact", [])}
        for raw in payload.get("records", []):
            try:
                record = FingerprintRecord(
                    fingerprint=int(raw["fingerprint"]),
                    word_count=int(raw["word_count"]),
                    url=str(raw["url"]),
                )
            except (TypeError, ValueError, KeyError):
                continue
            index = len(self.records)
            self.records.append(record)
            for key in self._band_keys(record.fingerprint):
                self.bands[key].add(index)


# ---------------------------------------------------------------------------
# Frontier, state and DLQ
# ---------------------------------------------------------------------------


def url_priority(url: str, depth: int) -> tuple[int, float]:
    lower = url.lower()
    score = 0.0
    if lower.rstrip("/") in {
        "https://web.uettaxila.edu.pk",
        "https://uettaxila.edu.pk",
    }:
        score += 200
    if "admission" in lower or "academic" in lower:
        score += 150
    if any(keyword in lower for keyword in ("fee", "merit", "prospectus", "deadline")):
        score += 100
    if "department" in lower or "faculty" in lower or "program" in lower:
        score += 75
    segment_count = len([part for part in urllib.parse.urlsplit(url).path.split("/") if part])
    score += max(0, 20 - segment_count)
    # Breadth-first remains the primary ordering, score breaks ties.
    return depth, -score


@dataclass
class FrontierEntry:
    url: str
    depth: int
    priority: tuple[int, float]


class Frontier:
    def __init__(self, max_scheduled: int, maxsize: int):
        # max_scheduled == 0 means exhaustive frontier traversal. The priority
        # queue is intentionally unbounded: silently dropping a discovered URL
        # is worse than allowing memory to grow on this finite university site.
        self.max_scheduled = max_scheduled
        self.configured_maxsize = maxsize
        self.queue: asyncio.PriorityQueue[tuple[tuple[int, float], int, str, int]] = (
            asyncio.PriorityQueue(maxsize=0)
        )
        self.seen: set[str] = set()
        self.pending: dict[str, FrontierEntry] = {}
        self.in_flight: dict[str, FrontierEntry] = {}
        self.scheduled = 0
        self.cap_reached = False
        self._sequence = 0
        self._high_water_warned = False
        self._lock = asyncio.Lock()

    async def enqueue(self, url: str, depth: int) -> bool:
        async with self._lock:
            if url in self.seen:
                return False
            if self.max_scheduled > 0 and self.scheduled >= self.max_scheduled:
                self.cap_reached = True
                return False
            priority = url_priority(url, depth)
            self._sequence += 1
            item = (priority, self._sequence, url, depth)
            self.queue.put_nowait(item)
            self.seen.add(url)
            self.pending[url] = FrontierEntry(url, depth, priority)
            self.scheduled += 1
            if (
                not self._high_water_warned
                and self.configured_maxsize > 0
                and len(self.pending) >= self.configured_maxsize
            ):
                self._high_water_warned = True
                log.warning(
                    "Frontier pending count reached queueMaxSize=%d; continuing "
                    "without dropping URLs to preserve exhaustive coverage",
                    self.configured_maxsize,
                )
            return True

    async def enqueue_retry(self, url: str, depth: int) -> bool:
        """Schedule a failed URL even when it already exists in ``seen``.

        Restored checkpoints retain historical ``seen`` entries, while completed
        failures live in the DLQ rather than the pending frontier. A normal enqueue
        would suppress those retries. Existing URLs do not consume another unique
        scheduling slot; genuinely new DLQ URLs still respect the configured cap.
        """

        async with self._lock:
            if url in self.pending or url in self.in_flight:
                return False
            known = url in self.seen
            if (
                not known
                and self.max_scheduled > 0
                and self.scheduled >= self.max_scheduled
            ):
                self.cap_reached = True
                return False
            priority = url_priority(url, depth)
            self._sequence += 1
            self.queue.put_nowait((priority, self._sequence, url, depth))
            if not known:
                self.seen.add(url)
                self.scheduled += 1
            self.pending[url] = FrontierEntry(url, depth, priority)
            return True

    async def get(self) -> FrontierEntry:
        priority, _sequence, url, depth = await self.queue.get()
        entry = FrontierEntry(url, depth, priority)
        async with self._lock:
            self.pending.pop(url, None)
            self.in_flight[url] = entry
        return entry

    async def done(self, url: str) -> None:
        async with self._lock:
            self.in_flight.pop(url, None)
        self.queue.task_done()

    async def requeue_cancelled(self, entry: FrontierEntry) -> None:
        """Return a cancelled in-flight URL to the pending frontier.

        The original queue item is marked done and an equivalent item is added
        without consuming another crawl-budget slot.
        """

        async with self._lock:
            self.in_flight.pop(entry.url, None)
            self._sequence += 1
            self.queue.put_nowait(
                (entry.priority, self._sequence, entry.url, entry.depth)
            )
            self.pending[entry.url] = entry
        self.queue.task_done()

    async def snapshot(self) -> dict[str, Any]:
        async with self._lock:
            entries = list(self.pending.values()) + list(self.in_flight.values())
            entries.sort(key=lambda item: item.priority)
            return {
                "seen": sorted(self.seen),
                "scheduled": self.scheduled,
                "entries": [
                    {"url": item.url, "depth": item.depth} for item in entries
                ],
            }

    async def restore(self, payload: Mapping[str, Any], policy: UrlPolicy) -> int:
        seen = {
            canonical
            for raw in payload.get("seen", [])
            if (canonical := policy.canonicalize(str(raw)))
            and policy.is_crawl_candidate(canonical)
        }
        entries: list[FrontierEntry] = []
        for raw in payload.get("entries", []):
            try:
                canonical = policy.canonicalize(str(raw["url"]))
                depth = int(raw["depth"])
            except (TypeError, ValueError, KeyError):
                continue
            if not canonical or not policy.is_crawl_candidate(canonical):
                continue
            entries.append(FrontierEntry(canonical, depth, url_priority(canonical, depth)))

        entries.sort(key=lambda item: item.priority)
        async with self._lock:
            self.seen = seen
        # A checkpoint with an empty frontier queue but a populated ``seen``
        # set means every previously-discovered URL was already dispatched -
        # this is the normal steady state as an exhaustive crawl approaches
        # completion, not just a crash-abandoned run. ``self.seen`` is
        # restored above regardless, so ``enqueue()`` still correctly skips
        # those already-processed URLs when seeds/sitemap/DLQ entries are
        # rescanned on this resume; only the resumable queue itself (below)
        # has nothing left to restore.
        if not entries:
            return 0

        async with self._lock:
            restored_scheduled = max(
                safe_int(payload.get("scheduled"), len(seen)), len(seen)
            )
            self.scheduled = (
                min(self.max_scheduled, restored_scheduled)
                if self.max_scheduled > 0
                else restored_scheduled
            )
            restored = 0
            for entry in entries:
                if self.max_scheduled > 0 and restored >= self.max_scheduled:
                    self.cap_reached = True
                    break
                if entry.url not in self.seen:
                    self.seen.add(entry.url)
                    self.scheduled = (
                        min(self.max_scheduled, self.scheduled + 1)
                        if self.max_scheduled > 0
                        else self.scheduled + 1
                    )
                self._sequence += 1
                self.queue.put_nowait(
                    (entry.priority, self._sequence, entry.url, entry.depth)
                )
                self.pending[entry.url] = entry
                restored += 1
            return restored


@dataclass
class CrawlStats:
    attempted: int = 0
    fetched: int = 0
    pushed: int = 0
    dry_run_ready: int = 0
    skipped_short: int = 0
    skipped_duplicate: int = 0
    skipped_robots: int = 0
    skipped_unsupported: int = 0
    failed_fetch: int = 0
    failed_extract: int = 0
    failed_push: int = 0
    dlq: int = 0
    discovered: int = 0
    coverage_complete: bool = False
    completion_reason: str = "UNKNOWN"
    action_counts: dict[str, int] = field(default_factory=dict)
    started_at_epoch: float = field(default_factory=time.time)
    _lock: asyncio.Lock = field(default_factory=asyncio.Lock, repr=False, compare=False)

    async def increment(self, field_name: str, amount: int = 1) -> None:
        async with self._lock:
            setattr(self, field_name, int(getattr(self, field_name)) + amount)

    async def record_action(self, action: str) -> None:
        async with self._lock:
            self.action_counts[action] = self.action_counts.get(action, 0) + 1

    async def snapshot(self) -> dict[str, Any]:
        async with self._lock:
            return {
                "attempted": self.attempted,
                "fetched": self.fetched,
                "pushed": self.pushed,
                "dry_run_ready": self.dry_run_ready,
                "skipped_short": self.skipped_short,
                "skipped_duplicate": self.skipped_duplicate,
                "skipped_robots": self.skipped_robots,
                "skipped_unsupported": self.skipped_unsupported,
                "failed_fetch": self.failed_fetch,
                "failed_extract": self.failed_extract,
                "failed_push": self.failed_push,
                "dlq": self.dlq,
                "discovered": self.discovered,
                "coverage_complete": self.coverage_complete,
                "action_counts": dict(self.action_counts),
                "started_at_epoch": self.started_at_epoch,
            }

    def restore(self, payload: Mapping[str, Any]) -> None:
        for name in (
            "attempted",
            "fetched",
            "pushed",
            "dry_run_ready",
            "skipped_short",
            "skipped_duplicate",
            "skipped_robots",
            "skipped_unsupported",
            "failed_fetch",
            "failed_extract",
            "failed_push",
            "dlq",
            "discovered",
        ):
            setattr(self, name, safe_int(payload.get(name), getattr(self, name)))
        self.coverage_complete = bool(
            payload.get("coverage_complete", self.coverage_complete)
        )
        actions = payload.get("action_counts")
        if isinstance(actions, dict):
            self.action_counts = {str(k): safe_int(v, 0) for k, v in actions.items()}
        self.started_at_epoch = safe_float(
            payload.get("started_at_epoch"), self.started_at_epoch
        )

    def summary(self) -> str:
        elapsed = max(0, int(time.time() - self.started_at_epoch))
        return (
            f"Elapsed {elapsed // 60}m{elapsed % 60:02d}s | "
            f"Attempt {self.attempted} | Fetch {self.fetched} | Push {self.pushed} | "
            f"Skip {self.skipped_short + self.skipped_duplicate + self.skipped_robots + self.skipped_unsupported} | "
            f"Fail {self.failed_fetch + self.failed_extract + self.failed_push} | DLQ {self.dlq}"
        )



class StateStore:
    MAX_STATE_BYTES = 256 * 1024 * 1024

    def __init__(self, path: Path, run_id: str):
        self.path = path
        self.run_id = run_id
        self._lock = asyncio.Lock()

    @classmethod
    def _read_payload(cls, path: Path) -> dict[str, Any]:
        stat = path.stat()
        if not path.is_file() or stat.st_size > cls.MAX_STATE_BYTES:
            raise ValueError("state file is not a bounded regular file")
        payload = json.loads(path.read_text(encoding="utf-8"))
        if not isinstance(payload, dict):
            raise ValueError("state root is not an object")
        return payload

    @staticmethod
    def resumable_run_id(path: Path) -> str | None:
        if not path.exists():
            return None
        try:
            payload = StateStore._read_payload(path)
        except Exception:
            return None
        if payload.get("version") != STATE_VERSION:
            return None
        value = str(payload.get("runId") or "").strip()
        return value or None

    def load(self) -> dict[str, Any] | None:
        if not self.path.exists():
            return None
        try:
            payload = self._read_payload(self.path)
            if payload.get("version") != STATE_VERSION:
                raise ValueError("unsupported state version")
            return payload
        except Exception as exc:
            quarantine = self.path.with_suffix(f".corrupt.{int(time.time())}.json")
            try:
                os.replace(self.path, quarantine)
                _fsync_directory(self.path.parent)
            except OSError:
                pass
            log.warning("Ignored corrupt crawler state: %s", exc)
            return None

    async def save(
        self,
        frontier: Frontier,
        stats: CrawlStats,
        deduper: ContentDeduplicator,
    ) -> None:
        async with self._lock:
            frontier_payload, stats_payload, dedupe_payload = await asyncio.gather(
                frontier.snapshot(),
                stats.snapshot(),
                deduper.snapshot_async(),
            )
            payload = {
                "version": STATE_VERSION,
                "savedAt": utc_now_iso(),
                "runId": self.run_id,
                "frontier": frontier_payload,
                "stats": stats_payload,
                "deduper": dedupe_payload,
            }
            await asyncio.to_thread(
                atomic_write_json, self.path, payload, self.MAX_STATE_BYTES
            )

    def remove(self) -> None:
        try:
            self.path.unlink(missing_ok=True)
            _fsync_directory(self.path.parent)
        except OSError:
            pass


@dataclass
class DlqEntry:
    url: str
    depth: int
    reason: str
    status: int
    attempts: int
    last_failed_at: str



class DeadLetterQueue:
    """Crash-durable retry inventory with atomic compaction.

    The active JSONL file is a compact snapshot, not an append-only event log. A
    claimed processing file is deleted only after the merged active snapshot has
    been durably replaced, eliminating the crash window that could lose retries.
    """

    MAX_LINE_BYTES = 64 * 1024

    def __init__(self, active_path: Path, dead_path: Path, max_attempts: int):
        self.active_path = active_path
        self.dead_path = dead_path
        self.malformed_path = active_path.with_name("dlq_malformed.jsonl")
        self.max_attempts = max_attempts
        self._lock = asyncio.Lock()
        self._attempts_by_url: dict[str, int] = {}
        self._pending_by_url: dict[str, DlqEntry] = {}

    @staticmethod
    def _parse_line(line: str) -> DlqEntry | None:
        try:
            raw = json.loads(line)
            if not isinstance(raw, Mapping):
                return None
            return DlqEntry(
                url=str(raw["url"]),
                depth=max(0, int(raw.get("depth", 0))),
                reason=str(raw.get("reason", "unknown"))[:1000],
                status=int(raw.get("status", 0)),
                attempts=max(1, int(raw.get("attempts", 1))),
                last_failed_at=str(raw.get("lastFailedAt") or utc_now_iso()),
            )
        except (json.JSONDecodeError, TypeError, ValueError, KeyError):
            return None

    @staticmethod
    def _entry_payload(entry: DlqEntry) -> dict[str, Any]:
        return {
            "url": entry.url,
            "depth": entry.depth,
            "reason": entry.reason,
            "status": entry.status,
            "attempts": entry.attempts,
            "lastFailedAt": entry.last_failed_at,
        }

    @classmethod
    def _append_sync(cls, path: Path, entry: DlqEntry) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        new_file = not path.exists()
        with path.open("a", encoding="utf-8", newline="\n") as handle:
            handle.write(
                json.dumps(
                    cls._entry_payload(entry),
                    ensure_ascii=False,
                    separators=(",", ":"),
                )
            )
            handle.write("\n")
            handle.flush()
            os.fsync(handle.fileno())
        if new_file:
            _fsync_directory(path.parent)

    @classmethod
    def _write_active_sync(
        cls, path: Path, entries: Sequence[DlqEntry]
    ) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        ordered = sorted(entries, key=lambda item: (item.depth, item.url))
        if not ordered:
            with contextlib.suppress(FileNotFoundError):
                path.unlink()
                _fsync_directory(path.parent)
            return
        temp = path.with_name(
            f".{path.name}.{os.getpid()}.{time.time_ns()}.tmp"
        )
        descriptor = os.open(
            temp, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600
        )
        try:
            with os.fdopen(
                descriptor, "w", encoding="utf-8", newline="\n"
            ) as handle:
                for entry in ordered:
                    line = json.dumps(
                        cls._entry_payload(entry),
                        ensure_ascii=False,
                        separators=(",", ":"),
                    )
                    if len(line.encode("utf-8")) > cls.MAX_LINE_BYTES:
                        raise ValueError("DLQ entry exceeds line safety limit")
                    handle.write(line)
                    handle.write("\n")
                handle.flush()
                os.fsync(handle.fileno())
            os.replace(temp, path)
            _fsync_directory(path.parent)
        finally:
            with contextlib.suppress(FileNotFoundError):
                temp.unlink()

    @staticmethod
    def _append_malformed_sync(path: Path, source: Path, line: str) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        record = {
            "source": str(source),
            "capturedAt": utc_now_iso(),
            "line": line[:4000],
        }
        with path.open("a", encoding="utf-8", newline="\n") as handle:
            handle.write(
                json.dumps(record, ensure_ascii=False, separators=(",", ":"))
            )
            handle.write("\n")
            handle.flush()
            os.fsync(handle.fileno())

    async def _persist_active_locked(self) -> None:
        await asyncio.to_thread(
            self._write_active_sync,
            self.active_path,
            tuple(self._pending_by_url.values()),
        )

    async def add(
        self,
        url: str,
        depth: int,
        reason: str,
        status: int = 0,
        previous_attempts: int = 0,
    ) -> None:
        async with self._lock:
            existing = self._pending_by_url.get(url)
            known_attempts = max(
                previous_attempts,
                self._attempts_by_url.get(url, 0),
                existing.attempts if existing is not None else 0,
            )
            entry = DlqEntry(
                url=url,
                depth=max(0, depth),
                reason=reason[:1000],
                status=status,
                attempts=known_attempts + 1,
                last_failed_at=utc_now_iso(),
            )
            if entry.attempts >= self.max_attempts:
                # Write the terminal record before removing the active retry so a
                # crash cannot lose both copies.
                await asyncio.to_thread(self._append_sync, self.dead_path, entry)
                self._pending_by_url.pop(url, None)
            else:
                self._pending_by_url[url] = entry
            self._attempts_by_url[url] = entry.attempts
            await self._persist_active_locked()

    def mark_success(self, url: str) -> None:
        """Compatibility helper matching the original in-memory acknowledgement.

        Production callers must use :meth:`acknowledge_success`, which also
        removes the durable active retry record. This synchronous method is kept
        for older tests and integrations that only maintained the attempt map.
        """

        self._attempts_by_url.pop(url, None)

    async def acknowledge_success(self, url: str) -> None:
        """Durably acknowledge a successful or terminally handled retry."""

        async with self._lock:
            self._attempts_by_url.pop(url, None)
            if self._pending_by_url.pop(url, None) is not None:
                await self._persist_active_locked()

    @classmethod
    def _read_processing_file(
        cls, path: Path
    ) -> tuple[list[DlqEntry], list[str]]:
        entries: list[DlqEntry] = []
        malformed: list[str] = []
        with path.open("r", encoding="utf-8", errors="replace") as handle:
            for line in handle:
                if len(line.encode("utf-8", "replace")) > cls.MAX_LINE_BYTES:
                    malformed.append(line[:4000])
                    continue
                stripped = line.strip()
                if not stripped:
                    continue
                entry = cls._parse_line(stripped)
                if entry is None:
                    malformed.append(stripped[:4000])
                else:
                    entries.append(entry)
        return entries, malformed

    async def load_into(self, frontier: Frontier, policy: UrlPolicy) -> int:
        """Atomically merge, persist, validate, and replay active records."""

        async with self._lock:
            candidates = sorted(
                self.active_path.parent.glob("dlq*.processing.*.jsonl")
            )
            if self.active_path.exists():
                claimed = self.active_path.with_name(
                    f"dlq.processing.{time.time_ns()}.{os.getpid()}.jsonl"
                )
                try:
                    os.replace(self.active_path, claimed)
                    _fsync_directory(self.active_path.parent)
                    candidates.append(claimed)
                except OSError as exc:
                    log.warning("Could not claim DLQ file: %s", exc)

            entries_by_url: dict[str, DlqEntry] = dict(self._pending_by_url)
            malformed_count = 0
            readable_candidates: list[Path] = []
            for candidate_path in dict.fromkeys(candidates):
                try:
                    entries, malformed = await asyncio.to_thread(
                        self._read_processing_file, candidate_path
                    )
                except OSError as exc:
                    log.warning(
                        "Could not read DLQ processing file %s: %s",
                        candidate_path,
                        exc,
                    )
                    continue
                readable_candidates.append(candidate_path)
                for line in malformed:
                    malformed_count += 1
                    await asyncio.to_thread(
                        self._append_malformed_sync,
                        self.malformed_path,
                        candidate_path,
                        line,
                    )
                for entry in entries:
                    existing = entries_by_url.get(entry.url)
                    if existing is None or entry.attempts > existing.attempts:
                        entries_by_url[entry.url] = entry

            canonical_entries: dict[str, DlqEntry] = {}
            for entry in entries_by_url.values():
                canonical = policy.canonicalize(entry.url)
                if not canonical or not policy.is_crawl_candidate(canonical):
                    rejected = DlqEntry(
                        url=entry.url,
                        depth=entry.depth,
                        reason=(
                            f"DLQ URL rejected by current policy: {entry.reason}"
                        )[:1000],
                        status=entry.status,
                        attempts=max(entry.attempts, self.max_attempts),
                        last_failed_at=utc_now_iso(),
                    )
                    await asyncio.to_thread(
                        self._append_sync, self.dead_path, rejected
                    )
                    continue
                canonical_entry = DlqEntry(
                    canonical,
                    entry.depth,
                    entry.reason,
                    entry.status,
                    entry.attempts,
                    entry.last_failed_at,
                )
                existing = canonical_entries.get(canonical)
                if existing is None or canonical_entry.attempts > existing.attempts:
                    canonical_entries[canonical] = canonical_entry

            self._pending_by_url = canonical_entries
            self._attempts_by_url = {
                url: entry.attempts
                for url, entry in canonical_entries.items()
            }
            # Durably establish the merged active snapshot before deleting any
            # claimed source. Re-reading duplicates after a crash is harmless.
            await self._persist_active_locked()
            for candidate_path in readable_candidates:
                with contextlib.suppress(OSError):
                    candidate_path.unlink()
            if readable_candidates:
                _fsync_directory(self.active_path.parent)

            loaded = 0
            for entry in sorted(
                canonical_entries.values(), key=lambda item: (item.depth, item.url)
            ):
                if await frontier.enqueue_retry(entry.url, entry.depth):
                    loaded += 1

            if malformed_count:
                log.warning(
                    "Quarantined %d malformed DLQ line(s) in %s",
                    malformed_count,
                    self.malformed_path,
                )
            return loaded


# ---------------------------------------------------------------------------
# Sitemap discovery
# ---------------------------------------------------------------------------



class SitemapParseError(ValueError):
    pass


@dataclass(frozen=True, slots=True)
class ParsedSitemap:
    kind: str
    locations: tuple[str, ...]


def _gzip_decompress_limited(data: bytes, maximum: int) -> bytes:
    output = bytearray()
    try:
        with gzip.GzipFile(fileobj=io.BytesIO(data)) as stream:
            while True:
                chunk = stream.read(
                    min(STREAM_CHUNK_SIZE, maximum + 1 - len(output))
                )
                if not chunk:
                    break
                output.extend(chunk)
                if len(output) > maximum:
                    raise SitemapParseError(
                        "decompressed sitemap exceeds size limit"
                    )
                if data and len(output) > max(
                    1024 * 1024, len(data) * MAX_GZIP_EXPANSION_RATIO
                ):
                    raise SitemapParseError(
                        "sitemap gzip expansion ratio is excessive"
                    )
    except (gzip.BadGzipFile, EOFError, OSError, zlib.error) as exc:
        raise SitemapParseError("invalid gzip sitemap") from exc
    return bytes(output)


def _has_oversized_xml_token(data: bytes) -> bool:
    run = 0
    delimiters = b"<>/=&;\"' \t\r\n"
    for value in data:
        if value in delimiters:
            run = 0
        else:
            run += 1
            if run > MAX_XML_TOKEN_BYTES:
                return True
    return False


def _normalise_sitemap_location(value: str) -> str:
    location = value.strip()
    if not location:
        return ""
    if any(character.isspace() or ord(character) < 0x20 for character in location):
        raise SitemapParseError("sitemap URL contains raw whitespace or controls")
    if len(location.encode("utf-8")) > MAX_SITEMAP_URL_BYTES:
        raise SitemapParseError("sitemap URL exceeds safety limit")
    if not location.startswith(("http://", "https://")):
        raise SitemapParseError("sitemap contains a non-absolute URL")
    return location


def _parse_xml_sitemap(data: bytes) -> ParsedSitemap:
    if _has_oversized_xml_token(data):
        raise SitemapParseError("XML token exceeds safety limit")
    lowered = data[: min(len(data), 1024 * 1024)].lower()
    if b"<!doctype" in lowered or b"<!entity" in lowered:
        raise SitemapParseError("DTD and entity declarations are forbidden")

    parser = expat.ParserCreate(namespace_separator="}")
    parser.buffer_text = True
    depth = 0
    element_count = 0
    root_kind = ""
    stack: list[str] = []
    capture: str | None = None
    captured: list[str] = []
    captured_chars = 0
    locations: list[str] = []

    def name_only(value: str) -> str:
        return value.rsplit("}", 1)[-1].rsplit(":", 1)[-1].lower()

    def reject_doctype(*_args: Any) -> None:
        raise SitemapParseError("DOCTYPE is forbidden")

    def reject_entity(*_args: Any) -> int:
        raise SitemapParseError("external entities are forbidden")

    def start(name: str, attrs: Mapping[str, str]) -> None:
        nonlocal depth, element_count, root_kind, capture, captured, captured_chars
        depth += 1
        element_count += 1
        if element_count > MAX_XML_ELEMENTS:
            raise SitemapParseError("XML element count exceeds safety limit")
        if len(attrs) > MAX_XML_ATTRIBUTES_PER_ELEMENT:
            raise SitemapParseError("XML element has too many attributes")
        attribute_bytes = sum(
            len(str(key).encode("utf-8", "replace"))
            + len(str(value).encode("utf-8", "replace"))
            for key, value in attrs.items()
        )
        if attribute_bytes > MAX_XML_ATTRIBUTE_BYTES:
            raise SitemapParseError("XML attributes exceed safety limit")
        if depth > MAX_XML_DEPTH:
            raise SitemapParseError("XML nesting exceeds safety limit")
        current = name_only(name)
        stack.append(current)
        if not root_kind:
            root_kind = current
        if current == "loc" or (root_kind == "rss" and current == "link"):
            capture = current
            captured = []
            captured_chars = 0
        elif root_kind == "feed" and current == "link":
            normalised = {name_only(str(k)): str(v) for k, v in attrs.items()}
            relation = normalised.get("rel", "alternate").lower()
            href = normalised.get("href", "")
            if relation in {"", "alternate"} and href:
                location = _normalise_sitemap_location(href)
                if location:
                    locations.append(location)
                    if len(locations) > SITEMAP_MAX_LOCATIONS_PER_FILE:
                        raise SitemapParseError(
                            "sitemap exceeds 50,000 locations"
                        )

    def character(value: str) -> None:
        nonlocal captured_chars
        if capture is None:
            return
        captured_chars += len(value)
        if captured_chars > MAX_SITEMAP_URL_BYTES:
            raise SitemapParseError("sitemap URL exceeds safety limit")
        captured.append(value)

    def end(name: str) -> None:
        nonlocal depth, capture, captured, captured_chars
        current = name_only(name)
        if capture == current:
            value = _normalise_sitemap_location("".join(captured))
            if value:
                locations.append(value)
                if len(locations) > SITEMAP_MAX_LOCATIONS_PER_FILE:
                    raise SitemapParseError("sitemap exceeds 50,000 locations")
            capture = None
            captured = []
            captured_chars = 0
        if stack:
            stack.pop()
        depth -= 1

    with contextlib.suppress(AttributeError, expat.ExpatError):
        parser.SetParamEntityParsing(expat.XML_PARAM_ENTITY_PARSING_NEVER)
    parser.StartElementHandler = start
    parser.EndElementHandler = end
    parser.CharacterDataHandler = character
    parser.StartDoctypeDeclHandler = reject_doctype
    parser.EntityDeclHandler = reject_doctype
    parser.ExternalEntityRefHandler = reject_entity
    try:
        for offset in range(0, len(data), STREAM_CHUNK_SIZE):
            parser.Parse(data[offset : offset + STREAM_CHUNK_SIZE], False)
        parser.Parse(b"", True)
    except (expat.ExpatError, SitemapParseError) as exc:
        raise SitemapParseError(str(exc)) from exc
    if root_kind not in {"urlset", "sitemapindex", "rss", "feed"}:
        raise SitemapParseError(f"unsupported sitemap root: {root_kind or 'empty'}")
    return ParsedSitemap(root_kind, tuple(dict.fromkeys(locations)))


def _parse_text_sitemap(data: bytes) -> ParsedSitemap:
    try:
        text = data.decode("utf-8-sig", errors="strict")
    except UnicodeDecodeError as exc:
        raise SitemapParseError("text sitemap is not valid UTF-8") from exc
    locations: list[str] = []
    for line in text.splitlines():
        raw = line.strip()
        if not raw or raw.startswith("#"):
            continue
        value = _normalise_sitemap_location(raw)
        locations.append(value)
        if len(locations) > SITEMAP_MAX_LOCATIONS_PER_FILE:
            raise SitemapParseError("text sitemap exceeds 50,000 locations")
    return ParsedSitemap("text", tuple(dict.fromkeys(locations)))


def _parse_sitemap_body(
    body: bytes,
    content_type: str,
    final_url: str,
) -> ParsedSitemap:
    lowered_type = content_type.lower()
    path = urllib.parse.urlsplit(final_url).path.lower()
    if body.startswith(b"\x1f\x8b") or path.endswith(".gz") or "gzip" in lowered_type:
        body = _gzip_decompress_limited(body, SITEMAP_MAX_BYTES)
    if len(body) > SITEMAP_MAX_BYTES:
        raise SitemapParseError("sitemap exceeds uncompressed size limit")
    if not body.strip():
        raise SitemapParseError("empty sitemap")
    stripped = body.lstrip(b"\xef\xbb\xbf \t\r\n")
    text_declared = "text/plain" in lowered_type or path.endswith(".txt")
    if stripped.startswith(b"<"):
        return _parse_xml_sitemap(body)
    if text_declared:
        return _parse_text_sitemap(body)
    raise SitemapParseError("non-XML sitemap was not declared as text/plain")


async def discover_sitemaps(
    settings: Settings,
    policy: UrlPolicy,
    raw_http: RawHttpClient,
    robots: RobotsPolicy,
    roots: Sequence[str] | None = None,
    stop_event: asyncio.Event | None = None,
) -> list[str]:
    if not settings.sitemap_enabled:
        return []

    sitemap_queue: deque[str] = deque()
    queued_sitemaps: set[str] = set()
    seen_sitemaps: set[str] = set()
    discovered_pages: set[str] = set()

    def queue_sitemap(value: str) -> None:
        canonical = policy.canonicalize(value)
        if (
            canonical
            and canonical not in seen_sitemaps
            and canonical not in queued_sitemaps
            and policy.is_network_target(canonical)
            and len(seen_sitemaps) + len(queued_sitemaps)
            < settings.sitemap_max_files
        ):
            sitemap_queue.append(canonical)
            queued_sitemaps.add(canonical)

    root_values = tuple(roots or settings.seed_urls)
    common_names = (
        "sitemap.xml",
        "sitemap_index.xml",
        "sitemap-index.xml",
        "sitemap.xml.gz",
        "sitemap.txt",
    )
    for root in root_values:
        origin = normalized_origin(root)
        if not origin:
            continue
        for value in await robots.sitemap_urls(root):
            queue_sitemap(value)
        for name in common_names:
            queue_sitemap(f"{origin}/{name}")

    while (
        sitemap_queue
        and len(seen_sitemaps) < settings.sitemap_max_files
        and len(discovered_pages) < settings.sitemap_max_urls
    ):
        if stop_event is not None and stop_event.is_set():
            log.info("Sitemap discovery interrupted by stop event")
            break
        sitemap_url = sitemap_queue.popleft()
        queued_sitemaps.discard(sitemap_url)
        if sitemap_url in seen_sitemaps:
            continue
        seen_sitemaps.add(sitemap_url)
        try:
            result = await raw_http.get(
                sitemap_url,
                timeout=min(settings.request_timeout, 30.0),
                max_bytes=SITEMAP_MAX_BYTES,
            )
            if not 200 <= result.status < 300:
                continue
            parsed = await asyncio.to_thread(
                _parse_sitemap_body,
                result.body,
                result.content_type,
                result.final_url,
            )
        except Exception as exc:
            log.debug("Sitemap rejected for %s: %s", sitemap_url, exc)
            continue

        if parsed.kind == "sitemapindex":
            for location in parsed.locations:
                queue_sitemap(location)
        else:
            for location in parsed.locations:
                canonical = policy.canonicalize(location)
                if canonical and policy.is_crawl_candidate(canonical):
                    discovered_pages.add(canonical)
                    if len(discovered_pages) >= settings.sitemap_max_urls:
                        break
        log.info(
            "Sitemap %s: %d location(s), %d crawl URL(s) accumulated",
            sitemap_url,
            len(parsed.locations),
            len(discovered_pages),
        )

    if sitemap_queue and len(seen_sitemaps) >= settings.sitemap_max_files:
        log.warning("Sitemap file cap reached at %d", settings.sitemap_max_files)
    if len(discovered_pages) >= settings.sitemap_max_urls:
        log.warning("Sitemap URL cap reached at %d", settings.sitemap_max_urls)
    return sorted(discovered_pages, key=lambda url: url_priority(url, 0))


# ---------------------------------------------------------------------------
# Convex push client
# ---------------------------------------------------------------------------


def assign_freshness_tier(url: str) -> str:
    lower = url.lower()
    high_keywords = (
        "admission",
        "academic",
        "merit",
        "fee",
        "schedule",
        "seat",
        "result",
        "exam",
        "deadline",
        "notice",
        "scholarship",
        "prospectus",
    )
    if lower.rstrip("/") in {
        "https://web.uettaxila.edu.pk",
        "https://uettaxila.edu.pk",
    } or any(keyword in lower for keyword in high_keywords):
        return "high"
    if any(keyword in lower for keyword in ("department", "faculty", "program")):
        return "medium"
    return "low"


def is_high_value_short_document(document: ExtractedDocument) -> bool:
    """Keep concise notices that are more useful than generic long pages."""

    if document.word_count < 8:
        return False
    haystack = f"{document.url} {document.title} {document.markdown}".lower()
    high_value_terms = (
        "admission",
        "deadline",
        "eligibility",
        "fee",
        "merit list",
        "notice",
        "result",
        "schedule",
        "scholarship",
        "seat allocation",
        "tcat",
        "ecat",
    )
    return any(term in haystack for term in high_value_terms)



class ConvexClient:
    """Bounded, retrying and idempotent Convex ingestion client."""

    MAX_RESPONSE_BYTES = 1024 * 1024

    def __init__(self, settings: Settings, session: AsyncSession):
        self.settings = settings
        self.session = session

    @property
    def headers(self) -> dict[str, str]:
        headers = {"Content-Type": "application/json"}
        if self.settings.convex_auth_token:
            headers["Authorization"] = (
                f"Bearer {self.settings.convex_auth_token}"
            )
        return headers

    def _reset_headers(self, body: str) -> dict[str, str]:
        """Headers for /api/reset - HMAC+timestamp, not the plain bearer
        token /ingest uses (August 2026 incident remediation: matches
        convex/crawl/webhook.ts's resetWebhook, which moved off a static
        bearer-token compare after that exact token was separately found
        leaked in plaintext). Mirrors verifySignature in webhook.ts exactly:
        HMAC-SHA256(secret, f"{timestamp}.{body}"), hex-encoded.
        """
        headers = {"Content-Type": "application/json"}
        token = self.settings.convex_auth_token
        if token:
            timestamp = str(int(time.time() * 1000))
            signature = hmac_lib.new(
                token.encode("utf-8"),
                f"{timestamp}.{body}".encode("utf-8"),
                hashlib.sha256,
            ).hexdigest()
            headers["x-crawl-timestamp"] = timestamp
            headers["x-crawl-signature"] = signature
        return headers

    @classmethod
    async def _read_limited(cls, response: Any) -> bytes:
        declared = str(response.headers.get("content-length", ""))
        if declared:
            if not declared.isdecimal():
                raise PushTerminalError("Convex returned an invalid Content-Length")
            if int(declared) > cls.MAX_RESPONSE_BYTES:
                raise PushTerminalError("Convex response exceeds 1 MiB safety limit")
        chunks: list[bytes] = []
        total = 0
        async for chunk in response.aiter_content(chunk_size=STREAM_CHUNK_SIZE):
            if not chunk:
                continue
            total += len(chunk)
            if total > cls.MAX_RESPONSE_BYTES:
                raise PushTerminalError("Convex response exceeds 1 MiB safety limit")
            chunks.append(bytes(chunk))
        return b"".join(chunks)

    async def reset(self) -> None:
        if self.settings.dry_run:
            return
        endpoint = f"{self.settings.convex_site_url}/api/reset"
        last_error = "unknown"
        for attempt in range(self.settings.push_retries):
            response = None
            try:
                # Recomputed fresh each attempt (not hoisted above the loop):
                # the timestamp must stay within the server's 5-minute skew
                # window even on a retry several minutes into a slow backoff.
                response = await self.session.post(
                    endpoint,
                    headers=self._reset_headers(""),
                    timeout=self.settings.push_timeout,
                    allow_redirects=False,
                    discard_cookies=True,
                    stream=True,
                )
                status = int(response.status_code)
                if 200 <= status < 300:
                    log.info("Pipeline data reset successfully")
                    return
                last_error = f"HTTP {status}"
                retryable = status in RETRYABLE_HTTP_STATUSES
                retry_after = parse_retry_after(
                    response.headers.get("retry-after")
                )
                if 400 <= status < 500 and not retryable:
                    break
            except asyncio.CancelledError:
                raise
            except Exception as exc:
                last_error = f"network error: {type(exc).__name__}: {exc}"
                retryable = True
                retry_after = None
            finally:
                if response is not None:
                    with contextlib.suppress(Exception):
                        await response.aclose()
            if not retryable or attempt + 1 >= self.settings.push_retries:
                break
            await asyncio.sleep(
                retry_after
                if retry_after is not None
                else retry_delay(attempt, base=1.0, maximum=30.0)
            )
        raise RuntimeError(f"Pipeline reset failed: {last_error}")

    async def push(self, document: ExtractedDocument, session_id: str) -> str:
        if self.settings.dry_run:
            return "dry-run"
        payload = {
            "url": document.url,
            "markdown": document.markdown,
            "contentHash": document.content_hash,
            "crawlSessionId": session_id,
            "title": document.title,
            "sourceType": document.source_type,
            "freshnessTier": assign_freshness_tier(document.url),
        }
        payload_bytes = json.dumps(
            payload, ensure_ascii=False, separators=(",", ":")
        ).encode("utf-8")
        if len(payload_bytes) > self.settings.max_ingest_bytes:
            raise PushTerminalError(
                f"ingest payload is {len(payload_bytes)} bytes, above configured "
                f"maxIngestBytes={self.settings.max_ingest_bytes}; split this "
                "document server-side before storing it in Convex"
            )

        endpoint = f"{self.settings.convex_site_url}/ingest"
        idempotency_key = hashlib.sha256(
            document.url.encode("utf-8")
            + b"\0"
            + document.content_hash.encode("utf-8")
        ).hexdigest()
        last_error = "unknown"
        for attempt in range(self.settings.push_retries):
            response = None
            try:
                response = await self.session.post(
                    endpoint,
                    content=payload_bytes,
                    headers={**self.headers, "Idempotency-Key": idempotency_key},
                    timeout=self.settings.push_timeout,
                    allow_redirects=False,
                    discard_cookies=True,
                    stream=True,
                )
                status = int(response.status_code)
                if 200 <= status < 300:
                    body = await self._read_limited(response)
                    if status == 204 or not body:
                        return "accepted"
                    try:
                        data = json.loads(body)
                    except (UnicodeDecodeError, ValueError):
                        return "accepted"
                    if not isinstance(data, Mapping):
                        return "accepted"
                    action = str(data.get("action") or "accepted").strip()
                    return action[:100] or "accepted"
                retryable = status in RETRYABLE_HTTP_STATUSES
                retry_after = parse_retry_after(
                    response.headers.get("retry-after")
                )
                last_error = f"HTTP {status}"
                if 400 <= status < 500 and not retryable:
                    raise PushTerminalError(f"Convex rejected payload: {last_error}")
            except asyncio.CancelledError:
                raise
            except PushTerminalError:
                raise
            except Exception as exc:
                last_error = f"network error: {type(exc).__name__}: {exc}"
                retryable = True
                retry_after = None
            finally:
                if response is not None:
                    with contextlib.suppress(Exception):
                        await response.aclose()

            if not retryable or attempt + 1 >= self.settings.push_retries:
                break
            await asyncio.sleep(
                retry_after
                if retry_after is not None
                else retry_delay(attempt, base=1.0, maximum=30.0)
            )
        raise PushRetryableError(
            f"Failed to push to Convex after {self.settings.push_retries} "
            f"attempt(s): {last_error}"
        )


# ---------------------------------------------------------------------------
# Crawler orchestration
# ---------------------------------------------------------------------------


class IoBudgetExceeded(RuntimeError):
    """Persistent I/O budget exhausted; the crawl must stop immediately."""


class IoBudgetMonitor:
    """Enforces the persistent I/O budget across all crawl-side durable files.

    The crawl persists state to the SQLite ledger (plus its WAL/SHM/journal
    sidecars), the crash-state JSON, the dead-letter queue, and the coverage
    reports. This monitor sums the on-disk sizes of every tracked path and
    enforces three thresholds:

      soft — a warning is logged once; crawling continues.
      stop — the shared stop event is set so the crawl ends gracefully with
             a resumable checkpoint (workers finish their current entry).
      hard — raises IoBudgetExceeded; the crawl aborts immediately.

    Thresholds are validated at load time (soft < stop <= max, max capped at
    500 MiB), so an invalid budget configuration fails fast at startup.
    """

    def __init__(self, settings: Settings, stop_event: asyncio.Event) -> None:
        self._settings = settings
        self._stop_event = stop_event
        ledger = settings.ledger_file
        self._paths = (
            ledger,
            Path(str(ledger) + "-wal"),
            Path(str(ledger) + "-shm"),
            Path(str(ledger) + "-journal"),
            settings.state_file,
            settings.dlq_file,
            settings.dead_dlq_file,
            settings.coverage_json_file,
            settings.coverage_csv_file,
        )
        # The ledger quarantines unreadable DLQ lines into a sibling file and
        # writes crash-recovery work files next to the DLQ; both must count
        # against the persistent I/O budget.
        self._dlq_dir = settings.dlq_file.parent
        self.malformed_path = settings.dlq_file.with_name("dlq_malformed.jsonl")
        self._soft_warned = False
        self._stop_requested = False

    def usage_bytes(self) -> int:
        total = 0
        for path in self._paths:
            try:
                total += path.stat().st_size
            except OSError:
                pass
        try:
            total += self.malformed_path.stat().st_size
        except OSError:
            pass
        try:
            for path in self._dlq_dir.glob("dlq*.processing.*.jsonl"):
                total += path.stat().st_size
        except OSError:
            pass
        return total

    @property
    def stop_requested(self) -> bool:
        return self._stop_requested

    def check(self) -> int:
        usage = self.usage_bytes()
        if usage >= self._settings.io_budget_max_bytes:
            raise IoBudgetExceeded(
                f"persistent I/O usage {usage} bytes reached the hard "
                f"limit of {self._settings.io_budget_max_bytes} bytes"
            )
        if usage >= self._settings.io_budget_stop_bytes:
            if not self._stop_requested:
                self._stop_requested = True
                log.critical(
                    "Persistent I/O usage %d bytes reached the stop threshold "
                    "of %d bytes; stopping the crawl with a resumable "
                    "checkpoint",
                    usage,
                    self._settings.io_budget_stop_bytes,
                )
            self._stop_event.set()
        elif usage >= self._settings.io_budget_soft_bytes and not self._soft_warned:
            self._soft_warned = True
            log.warning(
                "Persistent I/O usage %d bytes reached the soft threshold "
                "of %d bytes",
                usage,
                self._settings.io_budget_soft_bytes,
            )
        return usage


class RuntimeBudgetMonitor:
    """Enforces a wall-clock ceiling on total crawl runtime.

    The August 2026 incident crawl ran unattended for 10h24m with no time
    limit at all (see
    docs/rag-store-evaluation/fresh-corpus-crawl-2026-08/pre-crawl-evidence.json).
    Mirrors IoBudgetMonitor's pattern: once the budget is exceeded, the shared
    stop event is set so the crawl ends gracefully with a resumable
    checkpoint (workers finish their current entry) rather than a hard abort.
    A max_runtime_seconds of 0 means unbounded (explicit opt-in only, see
    --max-runtime-seconds).
    """

    def __init__(
        self, settings: Settings, stop_event: asyncio.Event, start_monotonic: float
    ) -> None:
        self._max_runtime_seconds = settings.max_runtime_seconds
        self._stop_event = stop_event
        self._start_monotonic = start_monotonic
        self._stop_requested = False

    @property
    def stop_requested(self) -> bool:
        return self._stop_requested

    def check(self) -> float:
        elapsed = time.monotonic() - self._start_monotonic
        if self._max_runtime_seconds > 0 and elapsed >= self._max_runtime_seconds:
            if not self._stop_requested:
                self._stop_requested = True
                log.critical(
                    "Crawl runtime %.0fs reached the configured wall-clock "
                    "budget of %.0fs; stopping with a resumable checkpoint",
                    elapsed,
                    self._max_runtime_seconds,
                )
            self._stop_event.set()
        return elapsed


@dataclass
class Runtime:
    settings: Settings
    policy: UrlPolicy
    frontier: Frontier
    stats: CrawlStats
    deduper: ContentDeduplicator
    state_store: StateStore
    dlq: DeadLetterQueue
    raw_http: RawHttpClient
    robots: RobotsPolicy
    token_bucket: AsyncTokenBucket
    aimd: AIMDRateLimiter
    host_pacer: HostPacer
    vision: GeminiVisionClient
    renderer: BrowserRenderer
    convex: ConvexClient
    ledger: CrawlLedger
    corpus_sink: FilesystemCorpusSink | None
    io_budget: IoBudgetMonitor
    runtime_budget: RuntimeBudgetMonitor
    session_id: str
    progress: Any
    stop_event: asyncio.Event
    checkpoint_lock: asyncio.Lock
    origin_lock: asyncio.Lock
    known_origins: set[str]
    last_checkpoint: int = 0


def can_descend(settings: Settings, current_depth: int) -> bool:
    return settings.max_depth < 0 or current_depth < settings.max_depth


async def _probe_new_origin_sitemaps(runtime: Runtime, urls: Sequence[str]) -> int:
    """Discover sitemap inventories for newly encountered official origins.

    UET Taxila publishes content across many subdomains. Restricting sitemap
    probes to startup seeds leaves pages undiscovered when a new official
    subdomain first appears deep in a page. Origins are claimed under a lock
    before network work, so concurrent workers probe each origin only once.
    """

    roots: list[str] = []
    async with runtime.origin_lock:
        for url in urls:
            origin = normalized_origin(url)
            if not origin or origin in runtime.known_origins:
                continue
            runtime.known_origins.add(origin)
            roots.append(origin + "/")
    if not roots:
        return 0

    log.info("Discovering sitemap inventory for %d new official origin(s)", len(roots))
    sitemap_urls = await discover_sitemaps(
        runtime.settings,
        runtime.policy,
        runtime.raw_http,
        runtime.robots,
        roots=roots,
    )
    return await enqueue_discovered(
        runtime,
        sitemap_urls,
        0,
        discovered_from=None,
        discovery_source="sitemap",
        probe_new_origins=True,
    )


async def enqueue_discovered(
    runtime: Runtime,
    links: Sequence[str],
    depth: int,
    *,
    discovered_from: str | None = None,
    discovery_source: str = "page-link",
    probe_new_origins: bool = True,
) -> int:
    """Inventory and schedule every valid discovered URL without silent drops."""

    canonical_links = sorted(
        {
            canonical
            for raw in links
            if (canonical := runtime.policy.canonicalize(raw))
            and runtime.policy.is_crawl_candidate(canonical)
        },
        key=lambda value: url_priority(value, depth),
    )
    if not canonical_links:
        return 0

    await runtime.ledger.discover_many(
        (url, depth, discovered_from, discovery_source) for url in canonical_links
    )

    if runtime.settings.max_depth >= 0 and depth > runtime.settings.max_depth:
        for url in canonical_links:
            # mark_result_if_not_terminal: this same URL may have already
            # been successfully processed at an earlier, shallower depth (a
            # deep page can easily link back to the site root or a seed).
            await runtime.ledger.mark_result_if_not_terminal(
                url,
                "skipped_depth",
                error=f"discovered at depth {depth}; configured maxDepth={runtime.settings.max_depth}",
            )
        return 0

    added = 0
    for link in canonical_links:
        if await runtime.frontier.enqueue(link, depth):
            added += 1
        elif runtime.frontier.cap_reached:
            # The URL remains visible in the ledger. This is intentionally an
            # incomplete state so a capped run cannot claim exhaustive coverage.
            # mark_result_if_not_terminal (not mark_result) because the same
            # URL can be rediscovered as a link on many pages after the cap is
            # reached - if it was itself already successfully (or terminally)
            # processed earlier in this run, a plain mark_result would
            # silently demote it back to "discovered", corrupting the
            # ledger's own success count for this run.
            await runtime.ledger.mark_result_if_not_terminal(
                link,
                "discovered",
                error="not scheduled because configured URL limit was reached",
            )
    if added:
        await runtime.stats.increment("discovered", added)

    if probe_new_origins:
        await _probe_new_origin_sitemaps(runtime, canonical_links)
    return added



async def _cancellation_safe(awaitable: Any) -> Any:
    """Finish one critical mutation before propagating caller cancellation."""

    task = asyncio.create_task(awaitable)
    try:
        return await asyncio.shield(task)
    except asyncio.CancelledError:
        with contextlib.suppress(Exception):
            await task
        raise


async def _finish_after_irreversible_side_effect(awaitable: Any) -> Any:
    """Complete local bookkeeping after an accepted external write.

    Once Convex has accepted an idempotent ingestion request, re-queuing the URL
    during shutdown can overwrite its ledger outcome as a duplicate. Cancellation
    is therefore intentionally deferred until this short local transaction ends.
    """

    task = asyncio.create_task(awaitable)
    try:
        return await asyncio.shield(task)
    except asyncio.CancelledError:
        log.info("Deferring worker cancellation to finalize accepted ingestion")
        return await task


async def _finalize_successful_push(
    runtime: Runtime,
    entry: FrontierEntry,
    reservation: DedupeReservation,
    action: str,
    ledger_common: Mapping[str, Any],
    document: ExtractedDocument,
    raw_sha256: str | None,
) -> str:
    if runtime.corpus_sink is not None:
        # Inside the same cancellation-shielded section as the ledger update
        # below (see _finish_after_irreversible_side_effect), so a document
        # can never be written locally without its ledger row also reaching
        # a terminal state, or vice versa - a budget-limit cancellation that
        # lands between the two would otherwise leave documents.jsonl ahead
        # of what the ledger considers done, silently.
        await asyncio.to_thread(
            runtime.corpus_sink.write_document,
            {
                "documentId": document_id_for_url(document.url),
                "canonicalUrl": document.url,
                "sourceUrl": entry.url,
                "title": document.title,
                "contentHash": document.content_hash,
                "rawHash": raw_sha256,
                "contentType": document.source_type,
                "extractionMethod": (
                    "pymupdf4llm+tesseract"
                    if document.source_type == "pdf"
                    else "html_extractor"
                ),
                "extractionVersion": LOCAL_CORPUS_EXTRACTION_VERSION,
                "crawlTimestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                "status": "extracted",
                "wordCount": document.word_count,
                "markdown": document.markdown,
            },
        )

    state = "dry_run_ready" if runtime.settings.dry_run else "ingested"
    await runtime.ledger.mark_result(entry.url, state, **ledger_common)
    await runtime.dlq.acknowledge_success(entry.url)
    await runtime.stats.increment(
        "dry_run_ready" if runtime.settings.dry_run else "pushed"
    )
    await runtime.stats.record_action(action)
    # Resolve waiting duplicate workers only after all durable bookkeeping has
    # succeeded. On an earlier failure the caller releases the reservation, so
    # another worker can safely repeat the idempotent backend request.
    await runtime.deduper.commit_reserved(reservation)
    return state


async def process_entry(runtime: Runtime, entry: FrontierEntry) -> None:
    settings = runtime.settings
    await runtime.stats.increment("attempted")
    await runtime.ledger.mark_started(entry.url)

    allowed, crawl_delay = await runtime.robots.allowed(entry.url)
    if not allowed:
        await runtime.stats.increment("skipped_robots")
        await runtime.ledger.mark_result(
            entry.url, "skipped_robots", error="disallowed by robots.txt"
        )
        await runtime.dlq.acknowledge_success(entry.url)
        log.info("[robots ] depth=%d | %s", entry.depth, entry.url)
        return

    await runtime.host_pacer.wait(entry.url, crawl_delay)
    await runtime.token_bucket.acquire()
    await runtime.aimd.wait()

    attempt_result: FetchAttempt | None = None
    for attempt_number in range(settings.max_retries):
        attempt_result = await fetch_and_extract_once(
            entry.url,
            settings,
            runtime.policy,
            runtime.raw_http,
            runtime.vision,
            runtime.renderer,
            runtime.corpus_sink,
        )
        if attempt_result.fetched:
            await runtime.stats.increment("fetched")
        if attempt_result.document is not None:
            await runtime.aimd.on_success()
            break
        if attempt_result.failure is None:
            raise RuntimeError("fetch attempt returned neither a document nor a failure")
        failure = attempt_result.failure
        if not failure.retryable:
            break
        await runtime.aimd.on_failure(failure.status)
        if attempt_number + 1 < settings.max_retries:
            delay = (
                failure.retry_after
                if failure.retry_after is not None
                else retry_delay(attempt_number, base=1.0, maximum=60.0)
            )
            log.warning(
                "Retry %d/%d in %.1fs for %s: %s",
                attempt_number + 1,
                settings.max_retries,
                delay,
                entry.url,
                failure.reason,
            )
            await asyncio.sleep(delay)

    if attempt_result is None:
        raise RuntimeError("no fetch attempt was executed")
    if attempt_result.document is None:
        if attempt_result.failure is None:
            raise RuntimeError("missing failure details")
        failure = attempt_result.failure
        if failure.reason.startswith("unsupported content-type"):
            state = "skipped_unsupported"
            await runtime.stats.increment("skipped_unsupported")
        elif "extraction failed" in failure.reason or failure.reason == "no extractable content":
            state = "failed_extract"
            await runtime.stats.increment("failed_extract")
        else:
            state = "failed_fetch_retryable" if failure.retryable else "failed_fetch_terminal"
            await runtime.stats.increment("failed_fetch")
        await runtime.ledger.mark_result(
            entry.url,
            state,
            http_status=failure.status,
            error=failure.reason,
        )
        if failure.retryable and failure.dlq_eligible:
            await runtime.dlq.add(
                entry.url, entry.depth, failure.reason, status=failure.status
            )
            await runtime.stats.increment("dlq")
        if not (failure.retryable and failure.dlq_eligible):
            await runtime.dlq.acknowledge_success(entry.url)
        log.error(
            "[fetch_fail] depth=%d status=%d | %s | %s",
            entry.depth,
            failure.status,
            entry.url,
            failure.reason,
        )
        return

    document = attempt_result.document

    if can_descend(settings, entry.depth):
        await enqueue_discovered(
            runtime,
            document.links,
            entry.depth + 1,
            discovered_from=document.url,
            discovery_source=document.source_type + "-link",
        )

    ledger_common = {
        "http_status": 200,
        "final_url": document.url,
        "title": document.title,
        "word_count": document.word_count,
        "content_hash": document.content_hash,
    }

    if document.word_count < settings.min_word_count and not is_high_value_short_document(document):
        await runtime.stats.increment("skipped_short")
        await runtime.ledger.mark_result(entry.url, "skipped_short", **ledger_common)
        await runtime.dlq.acknowledge_success(entry.url)
        log.info(
            "[short   ] depth=%d words=%d | %s",
            entry.depth,
            document.word_count,
            document.url,
        )
        return

    duplicate, reservation = await runtime.deduper.reserve(document)
    if duplicate:
        await runtime.stats.increment("skipped_duplicate")
        await runtime.ledger.mark_result(
            entry.url, "skipped_duplicate", error=duplicate, **ledger_common
        )
        await runtime.dlq.acknowledge_success(entry.url)
        log.info("[duplicate] %s | %s", document.url, duplicate)
        return
    if reservation is None:
        raise RuntimeError("dedupe reservation unexpectedly missing")

    try:
        action = await runtime.convex.push(document, runtime.session_id)
    except asyncio.CancelledError:
        await _cancellation_safe(runtime.deduper.release(reservation))
        raise
    except PushTerminalError as exc:
        await runtime.deduper.release(reservation)
        await runtime.stats.increment("failed_push")
        await runtime.ledger.mark_result(
            entry.url, "failed_push_terminal", error=str(exc), **ledger_common
        )
        await runtime.dlq.acknowledge_success(entry.url)
        log.error("[push_terminal] %s | %s", document.url, exc)
        return
    except Exception as exc:
        await runtime.deduper.release(reservation)
        await runtime.stats.increment("failed_push")
        await runtime.dlq.add(entry.url, entry.depth, f"push failed: {exc}")
        await runtime.stats.increment("dlq")
        await runtime.ledger.mark_result(
            entry.url, "failed_push", error=str(exc), **ledger_common
        )
        log.error("[push_fail] %s | %s", document.url, exc)
        return

    try:
        await _finish_after_irreversible_side_effect(
            _finalize_successful_push(
                runtime,
                entry,
                reservation,
                action,
                ledger_common,
                document,
                attempt_result.raw_sha256,
            )
        )
    except BaseException:
        await _cancellation_safe(runtime.deduper.release(reservation))
        raise
    log.info(
        "[%-8s] depth=%d words=%d bytes=%d | %s",
        action,
        entry.depth,
        document.word_count,
        byte_len(document.markdown),
        document.url,
    )



async def _requeue_cancelled_entry(runtime: Runtime, entry: FrontierEntry) -> None:
    await runtime.ledger.mark_result(
        entry.url, "discovered", error="worker cancelled; URL requeued"
    )
    await runtime.frontier.requeue_cancelled(entry)


async def worker(runtime: Runtime, worker_id: int) -> None:
    while not runtime.stop_event.is_set():
        try:
            entry = await runtime.frontier.get()
        except asyncio.CancelledError:
            raise

        requeued = False
        completed = False
        try:
            await process_entry(runtime, entry)
            completed = True
        except asyncio.CancelledError:
            await _cancellation_safe(_requeue_cancelled_entry(runtime, entry))
            requeued = True
            raise
        except Exception as exc:
            completed = True
            reason = f"unhandled worker error: {type(exc).__name__}: {exc}"
            log.exception("Unhandled worker %d error for %s", worker_id, entry.url)
            try:
                await runtime.stats.increment("failed_fetch")
                await runtime.dlq.add(entry.url, entry.depth, reason)
                await runtime.stats.increment("dlq")
                await runtime.ledger.mark_result(
                    entry.url,
                    "failed_fetch_retryable",
                    error=reason,
                )
            except Exception as recording_error:
                log.exception(
                    "Could not persist worker failure for %s: %s",
                    entry.url,
                    recording_error,
                )
                raise
        finally:
            if not requeued:
                await runtime.frontier.done(entry.url)
            if completed:
                runtime.progress.update(1)
                runtime.progress.set_postfix_str(
                    runtime.stats.summary(), refresh=False
                )
                checkpoint_value: int | None = None
                async with runtime.checkpoint_lock:
                    if (
                        runtime.stats.attempted - runtime.last_checkpoint
                        >= runtime.settings.state_interval
                    ):
                        checkpoint_value = runtime.stats.attempted
                        runtime.last_checkpoint = checkpoint_value
                if checkpoint_value is not None:
                    try:
                        await runtime.state_store.save(
                            runtime.frontier, runtime.stats, runtime.deduper
                        )
                    except Exception as exc:
                        async with runtime.checkpoint_lock:
                            if runtime.last_checkpoint == checkpoint_value:
                                runtime.last_checkpoint = max(
                                    0,
                                    checkpoint_value
                                    - runtime.settings.state_interval,
                                )
                        log.warning("Could not save crawl state: %s", exc)
                runtime.io_budget.check()
                runtime.runtime_budget.check()


async def initialise_frontier(
    runtime: Runtime, resume: bool, stop_event: asyncio.Event | None = None
) -> bool:
    """Restore recoverable work, then inventory seeds and sitemap URLs."""

    restored = False
    if resume:
        state = runtime.state_store.load()
        if state:
            count = await runtime.frontier.restore(
                state.get("frontier") or {}, runtime.policy
            )
            restored = count > 0
            if restored:
                runtime.stats.restore(state.get("stats") or {})
                runtime.deduper.restore(state.get("deduper") or {})
            else:
                # An empty checkpoint is still useful for preserving the run id
                # across a DLQ retry, but it has no frontier state to restore.
                runtime.state_store.remove()
            log.info("Restored %d frontier URL(s) from crash state", count)
    else:
        runtime.state_store.remove()

    dlq_count = await runtime.dlq.load_into(runtime.frontier, runtime.policy)
    if dlq_count:
        log.info("Loaded %d URL(s) from the dead-letter queue", dlq_count)

    # Synchronize directly restored/DLQ-scheduled entries into the durable
    # inventory. Existing rows from a resumed run retain their original source.
    frontier_snapshot = await runtime.frontier.snapshot()
    await runtime.ledger.discover_many(
        (str(item["url"]), int(item["depth"]), None, "resume-or-dlq")
        for item in frontier_snapshot.get("entries", [])
    )

    # Critical seeds are always considered before sitemap bulk URLs.
    await enqueue_discovered(
        runtime,
        runtime.settings.all_seeds,
        0,
        discovered_from=None,
        discovery_source="seed",
        probe_new_origins=False,
    )

    sitemap_urls = await discover_sitemaps(
        runtime.settings,
        runtime.policy,
        runtime.raw_http,
        runtime.robots,
        roots=runtime.settings.all_seeds,
        stop_event=stop_event,
    )
    await enqueue_discovered(
        runtime,
        sitemap_urls,
        0,
        discovered_from=None,
        discovery_source="sitemap",
        probe_new_origins=True,
    )

    return restored



async def _watch_workers(
    workers: Sequence[asyncio.Task[Any]],
    stop_event: asyncio.Event,
) -> None:
    done, _ = await asyncio.wait(workers, return_when=asyncio.FIRST_COMPLETED)
    if stop_event.is_set():
        return
    for task in done:
        if task.cancelled():
            raise RuntimeError(f"worker {task.get_name()} was cancelled unexpectedly")
        exception = task.exception()
        if exception is not None:
            raise RuntimeError(f"worker {task.get_name()} failed") from exception
        raise RuntimeError(f"worker {task.get_name()} exited unexpectedly")


async def crawl(settings: Settings, args: CliArgs) -> CrawlStats:
    validate_xml_runtime()
    # Validate the security-sensitive parser dependency before scheduling any
    # network work, so an obsolete Protego installation fails clearly rather
    # than turning every URL into an opaque worker failure.
    if settings.robots_enabled:
        RobotsRules.allow_all()
    policy = UrlPolicy(settings)
    invalid_seeds = [
        seed
        for seed in settings.all_seeds
        if not (
            (canonical := policy.canonicalize(seed))
            and policy.is_network_target(canonical)
            and policy.is_crawl_candidate(canonical)
        )
    ]
    if invalid_seeds:
        preview = ", ".join(repr(value) for value in invalid_seeds[:5])
        raise RuntimeError(f"Configured seed URL is not crawlable: {preview}")
    frontier = Frontier(settings.max_pages, settings.queue_max_size)
    stats = CrawlStats()
    deduper = ContentDeduplicator(settings.simhash_threshold, settings.simhash_min_words)

    resumable_id = (
        StateStore.resumable_run_id(settings.state_file)
        if args.resume and not args.clean
        else None
    )
    session_id = resumable_id or f"{int(time.time() * 1000)}-{os.getpid()}"
    state_store = StateStore(settings.state_file, session_id)
    ledger = CrawlLedger(settings.ledger_file, session_id)
    dlq = DeadLetterQueue(
        settings.dlq_file, settings.dead_dlq_file, settings.dlq_max_attempts
    )
    stop_event = asyncio.Event()

    progress = atqdm(
        total=settings.max_pages if settings.max_pages > 0 else None,
        desc="Crawling",
        unit="url",
        dynamic_ncols=True,
        colour="green",
    )

    async with AsyncSession(
        max_clients=max(5, settings.concurrency),
        trust_env=False,
    ) as push_session:
        host_safety = HostSafetyCache()
        raw_http = RawHttpClient(settings, policy, host_safety)
        robots = RobotsPolicy(settings, policy, raw_http)
        vision: GeminiVisionClient | None = None
        renderer: BrowserRenderer | None = None
        try:
            vision = GeminiVisionClient(settings)
            renderer = BrowserRenderer(
                enabled=settings.render_enabled,
                policy=policy,
                is_safe_url=host_safety.is_safe,
                user_agent=settings.user_agent,
                timeout_seconds=settings.render_timeout,
                settle_milliseconds=settings.render_settle_ms,
                concurrency=settings.render_concurrency,
                max_pages=settings.render_max_pages,
            )
            if settings.render_enabled and not renderer.available:
                raise RuntimeError(
                    "JavaScript rendering is enabled but Playwright is unavailable. "
                    "Install dependencies and run: "
                    "python -m playwright install --with-deps chromium"
                )
            convex = ConvexClient(settings, push_session)
            corpus_sink = (
                FilesystemCorpusSink(settings.local_corpus_dir)
                if settings.local_corpus_dir is not None
                else None
            )
            io_budget = IoBudgetMonitor(settings, stop_event)
            runtime_budget = RuntimeBudgetMonitor(settings, stop_event, time.monotonic())
            runtime = Runtime(
                settings=settings,
                policy=policy,
                frontier=frontier,
                stats=stats,
                deduper=deduper,
                state_store=state_store,
                dlq=dlq,
                raw_http=raw_http,
                robots=robots,
                token_bucket=AsyncTokenBucket(
                    settings.token_rate, settings.token_capacity
                ),
                aimd=AIMDRateLimiter(settings),
                host_pacer=HostPacer(settings.min_host_delay),
                vision=vision,
                renderer=renderer,
                convex=convex,
                ledger=ledger,
                corpus_sink=corpus_sink,
                io_budget=io_budget,
                runtime_budget=runtime_budget,
                session_id=session_id,
                progress=progress,
                stop_event=stop_event,
                checkpoint_lock=asyncio.Lock(),
                origin_lock=asyncio.Lock(),
                known_origins={
                    origin
                    for seed in settings.all_seeds
                    if (origin := normalized_origin(seed))
                },
            )
            await ledger.begin_run(
                exhaustive=settings.max_depth < 0 and settings.max_pages == 0,
                metadata={
                    "config": str(settings.config_path),
                    "dryRun": settings.dry_run,
                    "maxPages": settings.max_pages,
                    "maxDepth": settings.max_depth,
                    "startedAt": utc_now_iso(),
                },
            )
        except BaseException:
            if renderer is not None:
                with contextlib.suppress(Exception):
                    await renderer.close()
            if vision is not None:
                with contextlib.suppress(Exception):
                    await vision.aclose()
            with contextlib.suppress(Exception):
                await ledger.close()
            progress.close()
            raise

        assert vision is not None and renderer is not None

        loop = asyncio.get_running_loop()
        installed_signals: list[signal.Signals] = []
        for sig in (signal.SIGINT, signal.SIGTERM):
            try:
                loop.add_signal_handler(sig, stop_event.set)
                installed_signals.append(sig)
            except (NotImplementedError, RuntimeError):
                pass

        interrupted = False
        frontier_exhausted = False
        crawl_error: BaseException | None = None
        workers: list[asyncio.Task[Any]] = []
        coordination_tasks: list[asyncio.Task[Any]] = []
        try:
            if args.clean:
                if settings.dry_run:
                    log.warning("Ignoring --clean in --dry-run mode")
                else:
                    await convex.reset()

            restored = await initialise_frontier(
                runtime, args.resume and not args.clean, stop_event
            )
            if runtime.stats.attempted:
                runtime.progress.update(runtime.stats.attempted)
                runtime.last_checkpoint = runtime.stats.attempted
            baseline_usage = runtime.io_budget.check()
            log.info(
                "Persistent I/O usage at startup: %d bytes (soft=%d stop=%d "
                "hard=%d)",
                baseline_usage,
                settings.io_budget_soft_bytes,
                settings.io_budget_stop_bytes,
                settings.io_budget_max_bytes,
            )
            log.info(
                "Frontier ready with %d URL(s); scheduled=%d; restored=%s",
                runtime.frontier.queue.qsize(),
                runtime.frontier.scheduled,
                restored,
            )
            if runtime.frontier.queue.empty():
                log.warning("No crawlable URLs were scheduled")

            workers = [
                asyncio.create_task(
                    worker(runtime, index), name=f"crawler-worker-{index}"
                )
                for index in range(settings.concurrency)
            ]
            join_task = asyncio.create_task(
                runtime.frontier.queue.join(), name="frontier-join"
            )
            stop_task = asyncio.create_task(stop_event.wait(), name="stop-wait")
            worker_watch = asyncio.create_task(
                _watch_workers(workers, stop_event), name="worker-watch"
            )
            coordination_tasks = [join_task, stop_task, worker_watch]
            done, _ = await asyncio.wait(
                coordination_tasks, return_when=asyncio.FIRST_COMPLETED
            )

            if worker_watch in done:
                await worker_watch
            interrupted = (
                stop_task in done and stop_event.is_set() and not join_task.done()
            )
            stop_event.set()

            for task in workers:
                task.cancel()
            await asyncio.gather(*workers, return_exceptions=True)
            for task in coordination_tasks:
                if not task.done():
                    task.cancel()
            await asyncio.gather(*coordination_tasks, return_exceptions=True)

            frontier_snapshot = await frontier.snapshot()
            frontier_exhausted = bool(
                not interrupted
                and not frontier_snapshot.get("entries")
                and frontier.queue.empty()
            )
        except BaseException as exc:
            crawl_error = exc
            stop_event.set()
            for task in workers:
                task.cancel()
            for task in coordination_tasks:
                task.cancel()
            if workers or coordination_tasks:
                await asyncio.gather(
                    *workers, *coordination_tasks, return_exceptions=True
                )
        finally:
            try:
                stats.coverage_complete = await ledger.finish_run(
                    frontier_exhausted=frontier_exhausted,
                    cap_reached=frontier.cap_reached,
                    metadata={
                        "finishedAt": utc_now_iso(),
                        "interrupted": interrupted,
                        "scheduled": frontier.scheduled,
                        "stats": await stats.snapshot(),
                    },
                )
                await ledger.write_reports(
                    settings.coverage_json_file, settings.coverage_csv_file
                )
            except Exception as report_error:
                stats.coverage_complete = False
                log.exception(
                    "Could not finalize crawl coverage report: %s", report_error
                )

            # Budget/cancellation/error reasons take precedence over the
            # narrower frontier_exhausted signal (which only means "this
            # run's own scheduler queue drained", not "no eligible URL
            # remains anywhere" - see CrawlLedger.finish_run's
            # coverage_complete gating). Only when none of those apply is a
            # drained queue actually FRONTIER_EXHAUSTED.
            if crawl_error is not None:
                stats.completion_reason = "ERROR"
            elif runtime.io_budget.stop_requested:
                stats.completion_reason = "BUDGET_IO_LIMIT"
            elif runtime.runtime_budget.stop_requested:
                stats.completion_reason = "BUDGET_RUNTIME_LIMIT"
            elif frontier.cap_reached:
                stats.completion_reason = "BUDGET_PAGE_LIMIT"
            elif interrupted:
                stats.completion_reason = "MANUALLY_CANCELED"
            elif stats.coverage_complete:
                stats.completion_reason = "FRONTIER_EXHAUSTED"
            elif frontier_exhausted:
                stats.completion_reason = "QUEUE_DRAINED_INCOMPLETE"
            else:
                stats.completion_reason = "UNKNOWN"
            log.info("Run completion reason: %s", stats.completion_reason)

            if interrupted or crawl_error is not None or not stats.coverage_complete:
                try:
                    await state_store.save(frontier, stats, deduper)
                except Exception as state_error:
                    log.exception(
                        "Could not save resumable crawl state: %s", state_error
                    )
            else:
                state_store.remove()

            for sig in installed_signals:
                with contextlib.suppress(Exception):
                    loop.remove_signal_handler(sig)
            for label, closer in (
                ("browser renderer", renderer.close),
                ("Gemini client", vision.aclose),
                ("crawl ledger", ledger.close),
            ):
                try:
                    await closer()
                except Exception as close_error:
                    log.warning(
                        "Could not close %s cleanly: %s", label, close_error
                    )
            progress.close()

        if interrupted:
            raise KeyboardInterrupt
        if crawl_error is not None:
            raise crawl_error

    return stats


# ---------------------------------------------------------------------------
# Entrypoint
# ---------------------------------------------------------------------------


async def async_main(argv: Sequence[str] | None = None) -> int:
    args = parse_args(argv)
    script_path = Path(__file__).resolve()
    try:
        settings = load_settings(args, script_path)
        configure_logging(settings.project_root, args.log_level)
    except RuntimeError as exc:
        print(f"[ERROR] {exc}", file=sys.stderr)
        return 2

    log.info("=" * 72)
    log.info("UET Taxila RAG Crawler — Coverage-Verified Edition")
    log.info("Config: %s", settings.config_path)
    log.info(
        "Limit=%s depth=%s concurrency=%d dry_run=%s",
        "exhaustive" if settings.max_pages == 0 else settings.max_pages,
        "unlimited" if settings.max_depth < 0 else settings.max_depth,
        settings.concurrency,
        settings.dry_run,
    )
    log.info("=" * 72)

    try:
        stats = await crawl(settings, args)
    except KeyboardInterrupt:
        log.warning("Crawl interrupted; state has been preserved")
        return 130
    except Exception:
        log.exception("Crawler terminated unexpectedly")
        return 1

    log.info("=" * 72)
    log.info("CRAWL COMPLETE | %s", stats.summary())
    if stats.action_counts:
        log.info("Backend actions: %s", stats.action_counts)
    log.info("Coverage complete: %s", stats.coverage_complete)
    log.info("Completion reason: %s", stats.completion_reason)
    log.info("Coverage JSON: %s", settings.coverage_json_file)
    log.info("Coverage CSV: %s", settings.coverage_csv_file)
    log.info("=" * 72)
    if settings.require_complete and not stats.coverage_complete:
        log.error(
            "Crawl finished with unresolved coverage gaps. Re-run with resume enabled "
            "after correcting transient failures, or pass --allow-incomplete explicitly."
        )
        return 3
    return 0


def main(argv: Sequence[str] | None = None) -> int:
    if sys.platform == "win32":
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    return asyncio.run(async_main(argv))


if __name__ == "__main__":
    raise SystemExit(main())


# ---------------------------------------------------------------------------
# Backward-compatibility security wrappers for test_crawler_security.py
# ---------------------------------------------------------------------------

ALLOWED_DOMAINS = frozenset(
    ["uettaxila.edu.pk", "web.uettaxila.edu.pk", "admissions.uettaxila.edu.pk"]
)


def _is_public_ip(ip_text: str) -> bool:
    return HostSafetyCache._is_public_ip(ip_text)


def is_safe_host(host_or_url: str) -> bool:
    """Compatibility helper with no import-time DNS or configuration I/O."""

    value = str(host_or_url or "").strip()
    if not value:
        return False
    try:
        parsed = urllib.parse.urlsplit(
            value if "://" in value else "//" + value
        )
        raw_host = (parsed.hostname or "").rstrip(".")
    except (ValueError, UnicodeError):
        return False
    if not raw_host:
        return False
    try:
        literal = ipaddress.ip_address(raw_host)
    except ValueError:
        try:
            infos = socket.getaddrinfo(
                raw_host,
                None,
                socket.AF_UNSPEC,
                socket.SOCK_STREAM,
                socket.IPPROTO_TCP,
            )
        except (socket.gaierror, OSError, UnicodeError):
            return False
        addresses = {info[4][0] for info in infos}
        return bool(addresses) and all(_is_public_ip(value) for value in addresses)
    return _is_public_ip(str(literal))


@functools.lru_cache(maxsize=1)
def _legacy_policy() -> UrlPolicy:
    seeds = tuple(f"https://{host}/" for host in sorted(ALLOWED_DOMAINS))
    settings = {
        "all_seeds": seeds,
        "allowed_host_suffixes": ("uettaxila.edu.pk",),
        "strip_params": tuple(DEFAULT_STRIP_PARAMS),
        "drop_session_params": (
            "phpsessid",
            "asp.net_sessionid",
            "jsessionid",
            "sessionid",
            "sid",
        ),
        "skip_extensions": tuple(DEFAULT_SKIP_EXTENSIONS),
        "include_patterns": (),
        "exclude_patterns": (),
        "max_url_length": 8192,
        "max_path_length": 4096,
        "max_query_length": 4096,
        "max_query_params": 20,
        "max_query_values_per_key": 8,
    }
    return UrlPolicy(settings)


def is_allowed_url(url: str) -> bool:
    return _legacy_policy().is_network_target(url)


def is_fetchable_url(url: str) -> bool:
    policy = _legacy_policy()
    return policy.is_crawl_candidate(url) and is_safe_host(url)


def canonicalize_url(url: str) -> str:
    canonical = _legacy_policy().canonicalize(url)
    if not canonical:
        return canonical
    try:
        parsed = urllib.parse.urlsplit(canonical)
    except ValueError:
        return canonical
    path = parsed.path
    if len(path) > 1 and path.endswith("/"):
        path = path[:-1]
        canonical = urllib.parse.urlunsplit(
            (parsed.scheme, parsed.netloc, path, parsed.query, parsed.fragment)
        )
    return canonical


def _get_robot_parser(netloc: str):
    # Retained only for legacy import compatibility; runtime robots state is
    # asynchronous, authority-scoped, and must not be represented by a singleton.
    return None
