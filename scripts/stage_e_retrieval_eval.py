#!/usr/bin/env python3
"""
stage_e_retrieval_eval.py — reproducible retrieval-quality evaluation for UET RAG.

This evaluator supports two corpus modes:

1. Backend-export mode (recommended)
   Loads the exact documents/chunks stored by the production backend. This is the
   only mode that can establish retrieval parity with the deployed Convex corpus.

2. Live-refetch proxy mode
   Re-fetches the Stage D URLs with the production crawler and applies a local
   fallback chunker. This is useful for diagnosing extraction and embedding
   quality, but it does not prove that the stored Convex chunks are retrievable.

The evaluator:
- uses exact canonical URL relevance judgments (never substring matching);
- uses Gemini Embedding 2 retrieval prefixes recommended by Google;
- embeds documents and queries separately;
- batches, retries, rate-limits, validates, normalizes, and caches embeddings;
- evaluates dense, BM25, and reciprocal-rank-fusion hybrid retrieval;
- reports Precision, Recall, Hit Rate, MRR, MAP, and nDCG at 1/3/5/10;
- produces deterministic JSON, CSV, and Markdown artifacts;
- penalizes missing relevant documents instead of silently dropping them;
- records corpus/query/configuration hashes for reproducibility.

Recommended usage with an exported backend corpus:

    python scripts/stage_e_retrieval_eval.py \
      --corpus-json audit/stage-d-convex-export.json \
      --require-backend-chunks

Live-refetch proxy mode:

    python scripts/stage_e_retrieval_eval.py --refresh-corpus

Optional quality gates:

    python scripts/stage_e_retrieval_eval.py \
      --corpus-json audit/stage-d-convex-export.json \
      --require-backend-chunks \
      --gate-strategy dense \
      --min-recall-at-5 0.80 \
      --min-mrr-at-5 0.75 \
      --min-ndcg-at-5 0.80

Backend export formats accepted:

    {"chunks": [
      {
        "url": "https://...",
        "title": "...",
        "text": "...",
        "chunk_id": "...",
        "source_url": "https://..."
      }
    ]}

or:

    {"documents": [
      {
        "url": "https://...",
        "title": "...",
        "source_url": "https://...",
        "chunks": [{"text": "...", "chunk_id": "..."}]
      }
    ]}

Documents containing only ``markdown`` are accepted, but are locally chunked and
therefore are not considered backend-chunk parity.
"""

from __future__ import annotations

import argparse
import asyncio
import csv
import hashlib
import importlib.metadata
import json
import math
import os
import random
import re
import sqlite3
import statistics
import struct
import subprocess
import sys
import tempfile
import time
import unicodedata
import urllib.parse
from collections import Counter, defaultdict
from dataclasses import dataclass, field
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from pathlib import Path
from typing import Any, Iterable, Mapping, Sequence

PROJECT_ROOT = Path(__file__).resolve().parents[1]
SCRIPTS_DIR = PROJECT_ROOT / "scripts"

DEFAULT_MODEL = "gemini-embedding-2"
DEFAULT_DIMENSIONS = 768
DEFAULT_MAX_CHUNK = 3000
DEFAULT_OVERLAP = 300
DEFAULT_BATCH_SIZE = 32
DEFAULT_BATCH_BYTES = 2 * 1024 * 1024
DEFAULT_RESPONSE_BYTES = 16 * 1024 * 1024
DEFAULT_CUTOFFS = (1, 3, 5, 10)
DEFAULT_BOOTSTRAP_SAMPLES = 5000
DEFAULT_RANDOM_SEED = 20260802
DEFAULT_RRF_K = 60
MAX_QUERY_COUNT = 10_000
MAX_CORPUS_CHUNKS = 1_000_000
MAX_TEXT_CHARS = 100_000
MAX_TITLE_CHARS = 1000
MAX_JSON_BYTES = 512 * 1024 * 1024
RETRYABLE_HTTP_STATUSES = frozenset({408, 425, 429, 500, 502, 503, 504})
MODEL_NAME_RE = re.compile(r"^[A-Za-z0-9._-]{1,128}$")
TOKEN_RE = re.compile(r"[^\W_]+", re.UNICODE)

PUSHED_URLS = (
    "https://admission.uettaxila.edu.pk/application/index.php",
    "https://web.uettaxila.edu.pk/departmentfaculty?departmentId=1",
    "https://web.uettaxila.edu.pk/departmentfaculty?departmentId=14",
    "https://web.uettaxila.edu.pk/departmentfaculty?departmentId=16",
    "https://web.uettaxila.edu.pk/departmentfaculty?departmentId=6",
    "https://web.uettaxila.edu.pk/departmentfaculty?departmentId=18",
    "https://web.uettaxila.edu.pk/departmentfaculty?departmentId=17",
    "https://admissions.uettaxila.edu.pk/",
    "https://web.uettaxila.edu.pk/departmentfaculty?departmentId=9",
    "https://web.uettaxila.edu.pk/departmentfaculty?departmentId=10",
    "https://web.uettaxila.edu.pk/departmentfaculty?departmentId=4",
    "https://web.uettaxila.edu.pk/departmentfaculty?departmentId=19",
    "https://web.uettaxila.edu.pk/",
    "https://web.uettaxila.edu.pk/departmentfaculty?departmentId=7",
    "https://web.uettaxila.edu.pk/departmentfaculty?departmentId=13",
    "https://web.uettaxila.edu.pk/departmentfaculty?departmentId=2",
)

# These preserve the original manual judgments, but use exact URLs rather than
# unsafe substring fragments. Review these labels with a domain expert before
# treating the scores as an acceptance benchmark.
DEFAULT_QUERY_ROWS: tuple[dict[str, Any], ...] = (
    {
        "id": "q1",
        "question": "How can I apply for admission at UET Taxila?",
        "relevance": {
            "https://admission.uettaxila.edu.pk/application/index.php": 1.0,
            "https://admissions.uettaxila.edu.pk/": 1.0,
        },
    },
    {
        "id": "q2",
        "question": "What is the contact address of the Mechanical Engineering department?",
        "relevance": {
            "https://web.uettaxila.edu.pk/departmentfaculty?departmentId=1": 1.0,
            "https://web.uettaxila.edu.pk/departmentfaculty?departmentId=2": 1.0,
        },
    },
    {
        "id": "q3",
        "question": "Which departments does the Civil Engineering department contain?",
        "relevance": {
            "https://web.uettaxila.edu.pk/departmentfaculty?departmentId=2": 1.0,
            "https://web.uettaxila.edu.pk/departmentfaculty?departmentId=4": 1.0,
            "https://web.uettaxila.edu.pk/departmentfaculty?departmentId=6": 1.0,
        },
    },
    {
        "id": "q4",
        "question": "Who is the head of the Electrical Engineering department?",
        "relevance": {
            "https://web.uettaxila.edu.pk/departmentfaculty?departmentId=4": 1.0,
            "https://web.uettaxila.edu.pk/departmentfaculty?departmentId=9": 1.0,
            "https://web.uettaxila.edu.pk/departmentfaculty?departmentId=10": 1.0,
        },
    },
    {
        "id": "q5",
        "question": "What is the main university website about?",
        "relevance": {
            "https://web.uettaxila.edu.pk/": 1.0,
            "https://web.uettaxila.edu.pk/departmentfaculty?departmentId=1": 1.0,
        },
    },
    {
        "id": "q6",
        "question": "How many faculty members work in the Computer Engineering department?",
        "relevance": {
            "https://web.uettaxila.edu.pk/departmentfaculty?departmentId=6": 1.0,
            "https://web.uettaxila.edu.pk/departmentfaculty?departmentId=7": 1.0,
        },
    },
)


@dataclass(frozen=True)
class QuerySpec:
    query_id: str
    question: str
    relevance: Mapping[str, float]


@dataclass(frozen=True)
class DocumentRecord:
    url: str
    title: str
    markdown: str
    word_count: int
    source_url: str | None = None
    aliases: tuple[str, ...] = ()


@dataclass(frozen=True)
class ChunkRecord:
    chunk_id: str
    url: str
    title: str
    text: str
    chunk_index: int
    source_url: str | None = None
    aliases: tuple[str, ...] = ()
    content_hash: str = ""


@dataclass(frozen=True)
class CorpusLoadResult:
    chunks: tuple[ChunkRecord, ...]
    source_mode: str
    exact_backend_chunks: bool
    warnings: tuple[str, ...] = ()
    fetch_failures: tuple[Mapping[str, Any], ...] = ()


@dataclass(frozen=True)
class EmbedInput:
    kind: str  # "document" or "query"
    text: str
    title: str | None = None
    task: str = "question answering"


@dataclass
class StrategyResult:
    query_id: str
    question: str
    strategy: str
    relevance: dict[str, float]
    missing_relevant: list[str]
    ranked_documents: list[dict[str, Any]]
    ranked_chunks: list[dict[str, Any]]
    metrics: dict[str, float]


@dataclass
class EvaluationResult:
    strategies: dict[str, list[StrategyResult]] = field(default_factory=dict)
    aggregate: dict[str, dict[str, float]] = field(default_factory=dict)
    confidence_intervals: dict[str, dict[str, tuple[float, float]]] = field(
        default_factory=dict
    )
    paired_comparisons: dict[str, dict[str, Mapping[str, Any]]] = field(
        default_factory=dict
    )


class EvaluationError(RuntimeError):
    """Raised for a reproducibility, corpus, API, or evaluation failure."""


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def sha256_text(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def canonical_json_bytes(value: Any) -> bytes:
    return json.dumps(
        value,
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
    ).encode("utf-8")


def comparison_url(raw_url: object) -> str:
    """Create a conservative exact-match URL key without changing query semantics."""

    if not isinstance(raw_url, str):
        return ""
    value = raw_url.strip()
    if not value or len(value) > 65_536 or "\\" in value:
        return ""
    try:
        parsed = urllib.parse.urlsplit(value)
        scheme = parsed.scheme.lower()
        host = (parsed.hostname or "").lower().rstrip(".")
        port = parsed.port
    except (ValueError, UnicodeError):
        return ""
    if scheme not in {"http", "https"} or not host:
        return ""
    if parsed.username is not None or parsed.password is not None:
        return ""
    default_port = 80 if scheme == "http" else 443
    host_text = f"[{host}]" if ":" in host else host
    netloc = host_text if port in (None, default_port) else f"{host_text}:{port}"
    path = parsed.path or "/"
    return urllib.parse.urlunsplit((scheme, netloc, path, parsed.query, ""))


def clean_text(value: object, *, maximum: int, field_name: str) -> str:
    if not isinstance(value, str):
        raise EvaluationError(f"{field_name} must be a string")
    result = value.replace("\x00", "").strip()
    if not result:
        raise EvaluationError(f"{field_name} must not be empty")
    if len(result) > maximum:
        raise EvaluationError(
            f"{field_name} exceeds the {maximum:,}-character safety limit"
        )
    return result


def safe_read_json(path: Path, *, max_bytes: int = MAX_JSON_BYTES) -> Any:
    try:
        stat = path.stat()
    except FileNotFoundError as exc:
        raise EvaluationError(f"JSON file not found: {path}") from exc
    if not path.is_file():
        raise EvaluationError(f"JSON path is not a regular file: {path}")
    if stat.st_size > max_bytes:
        raise EvaluationError(
            f"JSON file is {stat.st_size:,} bytes, above limit {max_bytes:,}: {path}"
        )
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except UnicodeDecodeError as exc:
        raise EvaluationError(f"JSON file is not valid UTF-8: {path}") from exc
    except json.JSONDecodeError as exc:
        raise EvaluationError(
            f"Invalid JSON in {path} at line {exc.lineno}, "
            f"column {exc.colno}: {exc.msg}"
        ) from exc


def atomic_write_bytes(path: Path, payload: bytes) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    descriptor, temporary = tempfile.mkstemp(
        prefix=f".{path.name}.", suffix=".tmp", dir=path.parent
    )
    temp_path = Path(temporary)
    try:
        with os.fdopen(descriptor, "wb") as handle:
            handle.write(payload)
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(temp_path, path)
        try:
            directory_fd = os.open(path.parent, os.O_RDONLY)
        except OSError:
            directory_fd = -1
        if directory_fd >= 0:
            try:
                os.fsync(directory_fd)
            except OSError:
                pass
            finally:
                os.close(directory_fd)
    finally:
        try:
            temp_path.unlink(missing_ok=True)
        except OSError:
            pass


def atomic_write_json(path: Path, value: Any) -> None:
    atomic_write_bytes(path, json.dumps(value, ensure_ascii=False, indent=2).encode("utf-8"))


def parse_cutoffs(raw: str) -> tuple[int, ...]:
    values: set[int] = set()
    for part in raw.split(","):
        part = part.strip()
        if not part:
            continue
        try:
            value = int(part)
        except ValueError as exc:
            raise argparse.ArgumentTypeError(f"invalid cutoff: {part}") from exc
        if not 1 <= value <= 10_000:
            raise argparse.ArgumentTypeError("cutoffs must be between 1 and 10,000")
        values.add(value)
    if not values:
        raise argparse.ArgumentTypeError("at least one cutoff is required")
    return tuple(sorted(values))


def parse_args(argv: Sequence[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Evaluate UET RAG retrieval with exact labels and reproducible artifacts"
    )
    parser.add_argument(
        "--config",
        default="scripts/crawl_config.production.json",
        help="Crawler config used only in live-refetch mode",
    )
    parser.add_argument(
        "--corpus-json",
        type=Path,
        default=None,
        help="Exported Convex/backend corpus. Preferred over live re-fetching.",
    )
    parser.add_argument(
        "--queries-json",
        type=Path,
        default=None,
        help="Manual query judgments JSON. Defaults to the six Stage E labels.",
    )
    parser.add_argument(
        "--backend-rankings-json",
        type=Path,
        default=None,
        help=(
            "Optional rankings exported from the real Convex search path. "
            "Adds a 'backend' strategy to the evaluation."
        ),
    )
    parser.add_argument(
        "--snapshot-json",
        type=Path,
        default=PROJECT_ROOT / "audit" / "stage-e-corpus-snapshot.json",
        help="Live-refetch snapshot path",
    )
    parser.add_argument(
        "--refresh-corpus",
        action="store_true",
        help="Ignore an existing live snapshot and fetch the Stage D URLs again",
    )
    parser.add_argument(
        "--require-backend-chunks",
        action="store_true",
        help="Fail unless the corpus export contains exact backend chunks",
    )
    parser.add_argument(
        "--allow-partial",
        action="store_true",
        help="Continue when expected documents fail to load; missing gold docs remain penalized",
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=PROJECT_ROOT / "audit",
    )
    parser.add_argument(
        "--cache",
        type=Path,
        default=PROJECT_ROOT / "audit" / "stage-e-embeddings.sqlite3",
    )
    parser.add_argument("--no-cache", action="store_true")
    parser.add_argument(
        "--offline",
        action="store_true",
        help="Use cached embeddings only and make no Gemini embedding requests",
    )
    parser.add_argument("--model", default=DEFAULT_MODEL)
    parser.add_argument(
        "--retrieval-task",
        choices=("question-answering", "search-result", "fact-checking"),
        default="question-answering",
        help="Gemini Embedding 2 asymmetric retrieval instruction",
    )
    parser.add_argument("--dimensions", type=int, default=DEFAULT_DIMENSIONS)
    parser.add_argument("--batch-size", type=int, default=DEFAULT_BATCH_SIZE)
    parser.add_argument("--batch-bytes", type=int, default=DEFAULT_BATCH_BYTES)
    parser.add_argument("--embedding-concurrency", type=int, default=2)
    parser.add_argument("--max-retries", type=int, default=6)
    parser.add_argument("--max-chunk", type=int, default=DEFAULT_MAX_CHUNK)
    parser.add_argument("--overlap", type=int, default=DEFAULT_OVERLAP)
    parser.add_argument("--cutoffs", type=parse_cutoffs, default=DEFAULT_CUTOFFS)
    parser.add_argument("--rrf-k", type=int, default=DEFAULT_RRF_K)
    parser.add_argument(
        "--bootstrap-samples", type=int, default=DEFAULT_BOOTSTRAP_SAMPLES
    )
    parser.add_argument("--seed", type=int, default=DEFAULT_RANDOM_SEED)
    parser.add_argument(
        "--gate-strategy",
        choices=("dense", "bm25", "hybrid", "backend"),
        default="dense",
    )
    parser.add_argument("--min-recall-at-5", type=float, default=None)
    parser.add_argument("--min-mrr-at-5", type=float, default=None)
    parser.add_argument("--min-ndcg-at-5", type=float, default=None)
    parser.add_argument(
        "--top-results",
        type=int,
        default=10,
        help="Number of document and chunk rankings retained in artifacts",
    )
    parser.add_argument("--verbose", action="store_true")
    args = parser.parse_args(argv)

    if args.model != DEFAULT_MODEL:
        parser.error(
            "this evaluator implements Gemini Embedding 2 prompt formatting; "
            f"use --model {DEFAULT_MODEL}"
        )
    if args.no_cache and args.offline:
        parser.error("--offline cannot be combined with --no-cache")
    if args.corpus_json is not None and args.refresh_corpus:
        parser.error("--refresh-corpus is only valid in live-refetch mode")
    args.cutoffs = tuple(sorted(set(args.cutoffs) | {5}))
    if not 128 <= args.dimensions <= 3072:
        parser.error("--dimensions must be between 128 and 3072")
    if not 1 <= args.batch_size <= 256:
        parser.error("--batch-size must be between 1 and 256")
    if not 1024 <= args.batch_bytes <= 32 * 1024 * 1024:
        parser.error("--batch-bytes must be between 1 KiB and 32 MiB")
    if not 1 <= args.embedding_concurrency <= 16:
        parser.error("--embedding-concurrency must be between 1 and 16")
    if not 1 <= args.max_retries <= 12:
        parser.error("--max-retries must be between 1 and 12")
    if not 256 <= args.max_chunk <= 100_000:
        parser.error("--max-chunk must be between 256 and 100,000")
    if not 0 <= args.overlap < args.max_chunk:
        parser.error("--overlap must be non-negative and smaller than --max-chunk")
    if not 1 <= args.rrf_k <= 100_000:
        parser.error("--rrf-k must be between 1 and 100,000")
    if not 0 <= args.bootstrap_samples <= 100_000:
        parser.error("--bootstrap-samples must be between 0 and 100,000")
    if not 1 <= args.top_results <= 1000:
        parser.error("--top-results must be between 1 and 1000")
    for name in ("min_recall_at_5", "min_mrr_at_5", "min_ndcg_at_5"):
        value = getattr(args, name)
        if value is not None and not 0.0 <= value <= 1.0:
            parser.error(f"--{name.replace('_', '-')} must be between 0 and 1")
    return args


def normalize_title(value: str | None) -> str:
    title = unicodedata.normalize("NFKC", value or "").replace("|", " ").strip()
    title = re.sub(r"\s+", " ", title)
    return title[:MAX_TITLE_CHARS] or "none"


def prepare_embedding_input(item: EmbedInput) -> str:
    text = unicodedata.normalize("NFKC", item.text).strip()
    if not text:
        raise EvaluationError("cannot embed empty text")
    if len(text) > MAX_TEXT_CHARS:
        raise EvaluationError(
            f"embedding input exceeds {MAX_TEXT_CHARS:,} characters"
        )
    if item.kind == "query":
        task = item.task.strip().replace("-", " ")
        if task not in {"question answering", "search result", "fact checking"}:
            raise EvaluationError(f"unsupported Gemini retrieval task: {item.task}")
        return f"task: {task} | query: {text}"
    if item.kind == "document":
        return f"title: {normalize_title(item.title)} | text: {text}"
    raise EvaluationError(f"unsupported embedding kind: {item.kind}")


def l2_normalize(vector: Sequence[float], expected_dimensions: int) -> list[float]:
    if len(vector) != expected_dimensions:
        raise EvaluationError(
            f"embedding dimension mismatch: expected {expected_dimensions}, got {len(vector)}"
        )
    values = [float(value) for value in vector]
    if any(not math.isfinite(value) for value in values):
        raise EvaluationError("embedding contains a non-finite value")
    norm_squared = math.fsum(value * value for value in values)
    if not math.isfinite(norm_squared) or norm_squared <= 0:
        raise EvaluationError("embedding has an invalid zero or non-finite norm")
    inverse = 1.0 / math.sqrt(norm_squared)
    return [value * inverse for value in values]


def cosine(a: Sequence[float], b: Sequence[float]) -> float:
    if len(a) != len(b):
        raise EvaluationError(
            f"cannot compare vectors of dimensions {len(a)} and {len(b)}"
        )
    return math.fsum(x * y for x, y in zip(a, b))


class EmbeddingCache:
    def __init__(self, path: Path, enabled: bool, dimensions: int):
        self.path = path
        self.enabled = enabled
        self.dimensions = dimensions
        self.connection: sqlite3.Connection | None = None
        if not enabled:
            return
        path.parent.mkdir(parents=True, exist_ok=True)
        self.connection = sqlite3.connect(path, timeout=30)
        self.connection.execute("PRAGMA journal_mode=WAL")
        self.connection.execute("PRAGMA synchronous=FULL")
        self.connection.execute("PRAGMA busy_timeout=30000")
        self.connection.execute(
            """
            CREATE TABLE IF NOT EXISTS embeddings (
                cache_key TEXT PRIMARY KEY,
                model TEXT NOT NULL,
                dimensions INTEGER NOT NULL,
                vector BLOB NOT NULL,
                created_at TEXT NOT NULL
            )
            """
        )
        self.connection.commit()

    def close(self) -> None:
        if self.connection is not None:
            self.connection.close()
            self.connection = None

    def get(self, cache_key: str, model: str) -> list[float] | None:
        if self.connection is None:
            return None
        row = self.connection.execute(
            """
            SELECT vector
            FROM embeddings
            WHERE cache_key = ? AND model = ? AND dimensions = ?
            """,
            (cache_key, model, self.dimensions),
        ).fetchone()
        if row is None:
            return None
        raw = bytes(row[0])
        expected_bytes = self.dimensions * 8
        if len(raw) != expected_bytes:
            self.connection.execute(
                "DELETE FROM embeddings WHERE cache_key = ?", (cache_key,)
            )
            self.connection.commit()
            return None
        vector = list(struct.unpack(f"<{self.dimensions}d", raw))
        try:
            return l2_normalize(vector, self.dimensions)
        except EvaluationError:
            self.connection.execute(
                "DELETE FROM embeddings WHERE cache_key = ?", (cache_key,)
            )
            self.connection.commit()
            return None

    def put_many(
        self,
        rows: Sequence[tuple[str, str, Sequence[float]]],
    ) -> None:
        if self.connection is None or not rows:
            return
        timestamp = utc_now_iso()
        payload = []
        for cache_key, model, vector in rows:
            normalized = l2_normalize(vector, self.dimensions)
            blob = struct.pack(f"<{self.dimensions}d", *normalized)
            payload.append(
                (cache_key, model, self.dimensions, sqlite3.Binary(blob), timestamp)
            )
        with self.connection:
            self.connection.executemany(
                """
                INSERT INTO embeddings(cache_key, model, dimensions, vector, created_at)
                VALUES (?, ?, ?, ?, ?)
                ON CONFLICT(cache_key) DO UPDATE SET
                    model = excluded.model,
                    dimensions = excluded.dimensions,
                    vector = excluded.vector,
                    created_at = excluded.created_at
                """,
                payload,
            )


def parse_retry_after(value: str | None) -> float | None:
    if not value:
        return None
    raw = value.strip()
    try:
        seconds = float(raw)
    except ValueError:
        try:
            parsed = parsedate_to_datetime(raw)
        except (TypeError, ValueError, OverflowError):
            return None
        if parsed.tzinfo is None:
            parsed = parsed.replace(tzinfo=timezone.utc)
        seconds = (parsed - datetime.now(timezone.utc)).total_seconds()
    if not math.isfinite(seconds):
        return None
    return min(120.0, max(0.0, seconds))


def retry_delay(attempt: int, *, base: float = 1.0, maximum: float = 60.0) -> float:
    ceiling = min(maximum, base * (2**attempt))
    return random.uniform(0.0, ceiling)


class GeminiEmbeddingClient:
    def __init__(
        self,
        *,
        api_key: str | None,
        model: str,
        dimensions: int,
        batch_size: int,
        batch_bytes: int,
        concurrency: int,
        max_retries: int,
        cache: EmbeddingCache,
        offline: bool,
        verbose: bool,
    ):
        if not MODEL_NAME_RE.fullmatch(model):
            raise EvaluationError(f"unsafe Gemini model name: {model!r}")
        self.api_key = api_key
        self.model = model
        self.dimensions = dimensions
        self.batch_size = batch_size
        self.batch_bytes = batch_bytes
        self.max_retries = max_retries
        self.cache = cache
        self.offline = offline
        self.verbose = verbose
        self._semaphore = asyncio.Semaphore(concurrency)
        self._client: Any = None

    async def __aenter__(self) -> "GeminiEmbeddingClient":
        if not self.offline:
            if not self.api_key:
                raise EvaluationError(
                    "GEMINI_API_KEY is required for uncached embeddings"
                )
            try:
                import httpx
            except ImportError as exc:
                raise EvaluationError("httpx is required for embedding requests") from exc
            timeout = httpx.Timeout(90.0, connect=15.0, read=90.0, write=90.0)
            self._client = httpx.AsyncClient(
                timeout=timeout,
                follow_redirects=False,
                trust_env=False,
                limits=httpx.Limits(
                    max_connections=8,
                    max_keepalive_connections=4,
                    keepalive_expiry=30.0,
                ),
                headers={
                    "x-goog-api-key": self.api_key,
                    "content-type": "application/json",
                    "user-agent": "UETTaxila-StageE-RetrievalEval/2.0",
                },
            )
        return self

    async def __aexit__(self, exc_type: Any, exc: Any, tb: Any) -> None:
        if self._client is not None:
            await self._client.aclose()
            self._client = None

    def _cache_key(self, prepared_text: str) -> str:
        return sha256_text(
            f"stage-e-v2\0{self.model}\0{self.dimensions}\0{prepared_text}"
        )

    def _request_for(self, prepared_text: str) -> dict[str, Any]:
        return {
            "model": f"models/{self.model}",
            "content": {"parts": [{"text": prepared_text}]},
            "embedContentConfig": {
                "outputDimensionality": self.dimensions,
                "autoTruncate": False,
            },
        }

    def _build_batches(
        self,
        pending: Sequence[tuple[int, str, str]],
    ) -> list[list[tuple[int, str, str]]]:
        batches: list[list[tuple[int, str, str]]] = []
        current: list[tuple[int, str, str]] = []
        current_bytes = len(b'{"requests":[]}')
        for row in pending:
            request_bytes = len(
                canonical_json_bytes(self._request_for(row[2]))
            ) + 1
            if request_bytes > self.batch_bytes:
                raise EvaluationError(
                    "one embedding request exceeds --batch-bytes; "
                    "reduce chunk size rather than silently truncating"
                )
            if current and (
                len(current) >= self.batch_size
                or current_bytes + request_bytes > self.batch_bytes
            ):
                batches.append(current)
                current = []
                current_bytes = len(b'{"requests":[]}')
            current.append(row)
            current_bytes += request_bytes
        if current:
            batches.append(current)
        return batches

    async def embed(self, inputs: Sequence[EmbedInput]) -> list[list[float]]:
        prepared = [prepare_embedding_input(item) for item in inputs]
        results: list[list[float] | None] = [None] * len(prepared)
        pending: list[tuple[int, str, str]] = []

        for index, text in enumerate(prepared):
            key = self._cache_key(text)
            cached = self.cache.get(key, self.model)
            if cached is not None:
                results[index] = cached
            else:
                pending.append((index, key, text))

        if pending and self.offline:
            raise EvaluationError(
                f"{len(pending)} embedding(s) are absent from cache in --offline mode"
            )

        batches = self._build_batches(pending)
        if self.verbose:
            print(
                f"embedding cache hits={len(inputs) - len(pending)} "
                f"misses={len(pending)} batches={len(batches)}"
            )

        async def process(batch: list[tuple[int, str, str]]) -> None:
            async with self._semaphore:
                vectors = await self._embed_batch_recursive(batch)
            cache_rows: list[tuple[str, str, Sequence[float]]] = []
            for (index, key, _), vector in zip(batch, vectors):
                normalized = l2_normalize(vector, self.dimensions)
                results[index] = normalized
                cache_rows.append((key, self.model, normalized))
            self.cache.put_many(cache_rows)

        await asyncio.gather(*(process(batch) for batch in batches))
        if any(value is None for value in results):
            raise EvaluationError("embedding result set is incomplete")
        return [value for value in results if value is not None]

    async def _read_response_limited(self, response: Any) -> bytes:
        declared = response.headers.get("content-length", "")
        if declared.isdecimal() and int(declared) > DEFAULT_RESPONSE_BYTES:
            raise EvaluationError("Gemini response Content-Length exceeds safety limit")
        chunks: list[bytes] = []
        total = 0
        async for chunk in response.aiter_bytes():
            total += len(chunk)
            if total > DEFAULT_RESPONSE_BYTES:
                raise EvaluationError("Gemini response exceeds safety limit")
            chunks.append(bytes(chunk))
        return b"".join(chunks)

    async def _embed_batch_recursive(
        self,
        batch: list[tuple[int, str, str]],
    ) -> list[list[float]]:
        if not batch:
            return []
        try:
            return await self._embed_batch_once(batch)
        except EvaluationError as exc:
            message = str(exc)
            splittable = (
                len(batch) > 1
                and (
                    "HTTP 400" in message
                    or "HTTP 413" in message
                    or "HTTP 422" in message
                    or "response count mismatch" in message
                )
            )
            if not splittable:
                raise
            midpoint = len(batch) // 2
            left = await self._embed_batch_recursive(batch[:midpoint])
            right = await self._embed_batch_recursive(batch[midpoint:])
            return left + right

    async def _embed_batch_once(
        self,
        batch: list[tuple[int, str, str]],
    ) -> list[list[float]]:
        if self._client is None:
            raise EvaluationError("embedding HTTP client is not initialized")
        endpoint = (
            "https://generativelanguage.googleapis.com/v1beta/models/"
            f"{self.model}:batchEmbedContents"
        )
        payload = {
            "requests": [self._request_for(prepared) for _, _, prepared in batch]
        }

        last_error = "unknown error"
        for attempt in range(self.max_retries):
            try:
                async with self._client.stream(
                    "POST", endpoint, json=payload
                ) as response:
                    body = await self._read_response_limited(response)
                    status = int(response.status_code)
                    retry_after = parse_retry_after(
                        response.headers.get("retry-after")
                    )
            except asyncio.CancelledError:
                raise
            except Exception as exc:
                status = 0
                body = b""
                retry_after = None
                last_error = f"network error: {type(exc).__name__}: {exc}"
            else:
                if 200 <= status < 300:
                    try:
                        data = json.loads(body)
                    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
                        raise EvaluationError(
                            "Gemini returned invalid JSON"
                        ) from exc
                    embeddings = data.get("embeddings")
                    if not isinstance(embeddings, list):
                        raise EvaluationError(
                            "Gemini response does not contain an embeddings list"
                        )
                    if len(embeddings) != len(batch):
                        raise EvaluationError(
                            "Gemini response count mismatch: "
                            f"expected {len(batch)}, got {len(embeddings)}"
                        )
                    vectors: list[list[float]] = []
                    for item in embeddings:
                        if not isinstance(item, Mapping):
                            raise EvaluationError(
                                "Gemini embedding response item is not an object"
                            )
                        values = item.get("values")
                        if not isinstance(values, list):
                            raise EvaluationError(
                                "Gemini embedding response item lacks values"
                            )
                        vectors.append(
                            l2_normalize(values, self.dimensions)
                        )
                    return vectors

                excerpt = body[:1000].decode("utf-8", "replace")
                last_error = f"HTTP {status}: {excerpt}"
                if status not in RETRYABLE_HTTP_STATUSES:
                    raise EvaluationError(last_error)

            if attempt + 1 >= self.max_retries:
                break
            delay = (
                retry_after
                if retry_after is not None
                else retry_delay(attempt, base=1.0, maximum=60.0)
            )
            if self.verbose:
                print(
                    f"Gemini embedding retry {attempt + 1}/{self.max_retries - 1} "
                    f"after {delay:.2f}s ({last_error[:160]})"
                )
            await asyncio.sleep(delay)

        raise EvaluationError(
            f"Gemini embedding failed after {self.max_retries} attempts: {last_error}"
        )


def split_oversized_block(
    block: str,
    *,
    max_chunk: int,
    overlap: int,
) -> list[str]:
    if len(block) <= max_chunk:
        return [block]
    pieces: list[str] = []
    start = 0
    while start < len(block):
        hard_end = min(len(block), start + max_chunk)
        end = hard_end
        if hard_end < len(block):
            lower_bound = start + max(1, int(max_chunk * 0.6))
            candidates = [
                block.rfind("\n", lower_bound, hard_end),
                block.rfind(". ", lower_bound, hard_end),
                block.rfind("; ", lower_bound, hard_end),
                block.rfind(" ", lower_bound, hard_end),
            ]
            best = max(candidates)
            if best > start:
                end = best + (2 if block[best : best + 2] in {". ", "; "} else 1)
        piece = block[start:end].strip()
        if piece:
            pieces.append(piece)
        if end >= len(block):
            break
        next_start = max(start + 1, end - overlap)
        if next_start <= start:
            next_start = end
        start = next_start
    return pieces


def chunk_markdown_fallback(
    text: str,
    *,
    max_chunk: int,
    overlap: int,
) -> list[str]:
    """Approximate the documented 3000/300 paragraph chunker safely.

    This is intentionally labeled a fallback. Exact production evaluation should
    consume exported backend chunks rather than assuming TypeScript/Python parity.
    """

    normalized = text.replace("\r\n", "\n").replace("\r", "\n").strip()
    raw_blocks = [block.strip() for block in re.split(r"\n{2,}", normalized) if block.strip()]
    blocks: list[str] = []
    for block in raw_blocks:
        blocks.extend(
            split_oversized_block(block, max_chunk=max_chunk, overlap=overlap)
        )

    chunks: list[str] = []
    current = ""
    for block in blocks:
        if not current:
            current = block
            continue
        candidate = f"{current}\n\n{block}"
        if len(candidate) <= max_chunk:
            current = candidate
            continue
        if len(current.strip()) >= 40:
            chunks.append(current.strip())
        window = current[-overlap:] if overlap else ""
        current = f"{window}\n\n{block}".strip()
        if len(current) > max_chunk:
            split = split_oversized_block(
                current, max_chunk=max_chunk, overlap=overlap
            )
            chunks.extend(piece for piece in split[:-1] if len(piece) >= 40)
            current = split[-1] if split else ""
    if len(current.strip()) >= 40:
        chunks.append(current.strip())
    return chunks


def make_chunk(
    *,
    url: str,
    title: str,
    text: str,
    index: int,
    source_url: str | None,
    aliases: Sequence[str],
    chunk_id: str | None = None,
) -> ChunkRecord:
    clean = clean_text(text, maximum=MAX_TEXT_CHARS, field_name="chunk text")
    canonical = comparison_url(url)
    if not canonical:
        raise EvaluationError(f"invalid chunk URL: {url!r}")
    digest = sha256_text(clean)
    stable_id = chunk_id or sha256_text(
        f"{canonical}\0{index}\0{digest}"
    )
    normalized_aliases = tuple(
        dict.fromkeys(
            candidate
            for candidate in (
                comparison_url(source_url) if source_url else "",
                *(comparison_url(value) for value in aliases),
            )
            if candidate and candidate != canonical
        )
    )
    return ChunkRecord(
        chunk_id=stable_id,
        url=canonical,
        title=normalize_title(title),
        text=clean,
        chunk_index=index,
        source_url=comparison_url(source_url) if source_url else None,
        aliases=normalized_aliases,
        content_hash=digest,
    )


def chunks_from_documents(
    documents: Sequence[DocumentRecord],
    *,
    max_chunk: int,
    overlap: int,
) -> tuple[ChunkRecord, ...]:
    chunks: list[ChunkRecord] = []
    for document in documents:
        parts = chunk_markdown_fallback(
            document.markdown,
            max_chunk=max_chunk,
            overlap=overlap,
        )
        for index, text in enumerate(parts):
            chunks.append(
                make_chunk(
                    url=document.url,
                    title=document.title,
                    text=text,
                    index=index,
                    source_url=document.source_url,
                    aliases=document.aliases,
                )
            )
    return tuple(chunks)


def _document_from_mapping(raw: Mapping[str, Any]) -> DocumentRecord:
    url = comparison_url(raw.get("url"))
    if not url:
        raise EvaluationError(f"document has invalid URL: {raw.get('url')!r}")
    title = normalize_title(str(raw.get("title") or ""))
    markdown = clean_text(
        raw.get("markdown") or raw.get("text"),
        maximum=max(MAX_TEXT_CHARS, 20_000_000),
        field_name=f"document markdown for {url}",
    )
    words_raw = raw.get("word_count", raw.get("words"))
    if words_raw is None:
        word_count = len(TOKEN_RE.findall(markdown))
    else:
        try:
            word_count = max(0, int(words_raw))
        except (TypeError, ValueError) as exc:
            raise EvaluationError(f"invalid word count for {url}") from exc
    source_url = comparison_url(raw.get("source_url") or raw.get("requested_url"))
    aliases_raw = raw.get("aliases") or []
    if isinstance(aliases_raw, str):
        aliases_raw = [aliases_raw]
    if not isinstance(aliases_raw, list):
        raise EvaluationError(f"aliases must be an array for {url}")
    aliases = tuple(value for value in (comparison_url(x) for x in aliases_raw) if value)
    return DocumentRecord(
        url=url,
        title=title,
        markdown=markdown,
        word_count=word_count,
        source_url=source_url or None,
        aliases=aliases,
    )


def load_corpus_json(
    path: Path,
    *,
    max_chunk: int,
    overlap: int,
) -> CorpusLoadResult:
    data = safe_read_json(path)
    warnings: list[str] = []
    exact = False
    chunks: list[ChunkRecord] = []

    if isinstance(data, list):
        root: Mapping[str, Any] = {"documents": data}
    elif isinstance(data, Mapping):
        root = data
    else:
        raise EvaluationError("corpus JSON root must be an object or array")

    root_chunks = root.get("chunks")
    if root_chunks is not None:
        if not isinstance(root_chunks, list):
            raise EvaluationError("corpus 'chunks' must be an array")
        exact = True
        per_url_index: defaultdict[str, int] = defaultdict(int)
        for raw in root_chunks:
            if not isinstance(raw, Mapping):
                raise EvaluationError("each corpus chunk must be an object")
            url = comparison_url(raw.get("url") or raw.get("document_url"))
            if not url:
                raise EvaluationError("corpus chunk has an invalid URL")
            index_raw = raw.get("chunk_index")
            if index_raw is None:
                index = per_url_index[url]
            else:
                try:
                    index = int(index_raw)
                except (TypeError, ValueError) as exc:
                    raise EvaluationError(f"invalid chunk_index for {url}") from exc
            per_url_index[url] = max(per_url_index[url], index + 1)
            aliases_raw = raw.get("aliases") or []
            if isinstance(aliases_raw, str):
                aliases_raw = [aliases_raw]
            if not isinstance(aliases_raw, list):
                raise EvaluationError(f"chunk aliases must be an array for {url}")
            chunks.append(
                make_chunk(
                    url=url,
                    title=str(raw.get("title") or ""),
                    text=raw.get("text") or raw.get("markdown"),
                    index=index,
                    source_url=raw.get("source_url") or raw.get("requested_url"),
                    aliases=[str(value) for value in aliases_raw],
                    chunk_id=str(raw.get("chunk_id") or raw.get("id") or "") or None,
                )
            )

    documents_raw = root.get("documents")
    if documents_raw is not None:
        if not isinstance(documents_raw, list):
            raise EvaluationError("corpus 'documents' must be an array")
        local_documents: list[DocumentRecord] = []
        for raw in documents_raw:
            if not isinstance(raw, Mapping):
                raise EvaluationError("each corpus document must be an object")
            nested_chunks = raw.get("chunks")
            if nested_chunks is not None:
                if not isinstance(nested_chunks, list):
                    raise EvaluationError("document chunks must be an array")
                exact = True
                url = comparison_url(raw.get("url"))
                if not url:
                    raise EvaluationError("document with chunks has an invalid URL")
                aliases_raw = raw.get("aliases") or []
                if isinstance(aliases_raw, str):
                    aliases_raw = [aliases_raw]
                for index, nested in enumerate(nested_chunks):
                    if not isinstance(nested, Mapping):
                        raise EvaluationError("nested chunk must be an object")
                    chunks.append(
                        make_chunk(
                            url=url,
                            title=str(raw.get("title") or ""),
                            text=nested.get("text") or nested.get("markdown"),
                            index=int(nested.get("chunk_index", index)),
                            source_url=raw.get("source_url") or raw.get("requested_url"),
                            aliases=[str(value) for value in aliases_raw],
                            chunk_id=str(
                                nested.get("chunk_id") or nested.get("id") or ""
                            )
                            or None,
                        )
                    )
            elif raw.get("markdown") is not None or raw.get("text") is not None:
                local_documents.append(_document_from_mapping(raw))
            else:
                raise EvaluationError(
                    "document must contain either 'chunks' or 'markdown'/'text'"
                )
        if local_documents:
            warnings.append(
                "Some corpus documents lacked backend chunks and were locally chunked."
            )
            chunks.extend(
                chunks_from_documents(
                    local_documents,
                    max_chunk=max_chunk,
                    overlap=overlap,
                )
            )

    if not chunks:
        raise EvaluationError("corpus JSON contains no usable chunks")
    if len(chunks) > MAX_CORPUS_CHUNKS:
        raise EvaluationError(
            f"corpus has {len(chunks):,} chunks, above safety limit {MAX_CORPUS_CHUNKS:,}"
        )

    deduped: list[ChunkRecord] = []
    seen_ids: set[str] = set()
    for chunk in chunks:
        if chunk.chunk_id in seen_ids:
            raise EvaluationError(f"duplicate chunk_id in corpus: {chunk.chunk_id}")
        seen_ids.add(chunk.chunk_id)
        deduped.append(chunk)

    return CorpusLoadResult(
        chunks=tuple(deduped),
        source_mode=f"backend_export:{path}",
        exact_backend_chunks=exact and not any(
            "locally chunked" in warning for warning in warnings
        ),
        warnings=tuple(warnings),
    )


def load_queries(path: Path | None) -> tuple[QuerySpec, ...]:
    raw_rows = DEFAULT_QUERY_ROWS if path is None else safe_read_json(path)
    if isinstance(raw_rows, Mapping):
        raw_rows = raw_rows.get("queries")
    if not isinstance(raw_rows, (list, tuple)):
        raise EvaluationError("queries JSON must be an array or {'queries': [...]} object")
    if not 1 <= len(raw_rows) <= MAX_QUERY_COUNT:
        raise EvaluationError(
            f"query count must be between 1 and {MAX_QUERY_COUNT:,}"
        )

    queries: list[QuerySpec] = []
    seen_ids: set[str] = set()
    for raw in raw_rows:
        if not isinstance(raw, Mapping):
            raise EvaluationError("each query must be an object")
        query_id = clean_text(
            raw.get("id") or raw.get("query_id"),
            maximum=200,
            field_name="query id",
        )
        if query_id in seen_ids:
            raise EvaluationError(f"duplicate query id: {query_id}")
        seen_ids.add(query_id)
        question = clean_text(
            raw.get("question") or raw.get("query"),
            maximum=10_000,
            field_name=f"question for {query_id}",
        )
        relevance_raw = raw.get("relevance") or raw.get("relevant")
        relevance: dict[str, float] = {}
        if isinstance(relevance_raw, list):
            for value in relevance_raw:
                url = comparison_url(value)
                if not url:
                    raise EvaluationError(
                        f"query {query_id} has invalid relevant URL: {value!r}"
                    )
                relevance[url] = 1.0
        elif isinstance(relevance_raw, Mapping):
            for raw_url, raw_grade in relevance_raw.items():
                url = comparison_url(raw_url)
                if not url:
                    raise EvaluationError(
                        f"query {query_id} has invalid relevant URL: {raw_url!r}"
                    )
                try:
                    grade = float(raw_grade)
                except (TypeError, ValueError) as exc:
                    raise EvaluationError(
                        f"query {query_id} has invalid relevance grade for {url}"
                    ) from exc
                if not math.isfinite(grade) or grade <= 0:
                    raise EvaluationError(
                        f"query {query_id} relevance grades must be finite and positive"
                    )
                relevance[url] = grade
        else:
            raise EvaluationError(
                f"query {query_id} must contain relevance as an array or object"
            )
        if not relevance:
            raise EvaluationError(f"query {query_id} has no relevant documents")
        queries.append(QuerySpec(query_id, question, relevance))
    return tuple(queries)


def load_backend_rankings(
    path: Path,
    queries: Sequence[QuerySpec],
) -> dict[str, list[tuple[float, str]]]:
    """Load document rankings exported from the deployed backend.

    Accepted forms:

        {"queries": [{"id": "q1", "results": [{"url": "...", "score": 0.9}]}]}

    or:

        {"q1": [{"url": "...", "score": 0.9}], "q2": ["https://..."]}
    """

    data = safe_read_json(path)
    valid_ids = {query.query_id for query in queries}
    rows_by_id: dict[str, Any]

    if isinstance(data, Mapping) and isinstance(data.get("queries"), list):
        rows_by_id = {}
        for row in data["queries"]:
            if not isinstance(row, Mapping):
                raise EvaluationError("backend ranking query rows must be objects")
            query_id = str(row.get("id") or row.get("query_id") or "").strip()
            if not query_id:
                raise EvaluationError("backend ranking row is missing a query id")
            if query_id in rows_by_id:
                raise EvaluationError(
                    f"duplicate backend ranking query id: {query_id}"
                )
            rows_by_id[query_id] = row.get("results") or row.get("documents") or []
    elif isinstance(data, Mapping):
        rows_by_id = dict(data)
    else:
        raise EvaluationError(
            "backend rankings must be an object or {'queries': [...]} object"
        )

    unknown = sorted(set(rows_by_id) - valid_ids)
    if unknown:
        raise EvaluationError(
            "backend rankings contain unknown query ids: " + ", ".join(unknown)
        )
    missing = sorted(valid_ids - set(rows_by_id))
    if missing:
        raise EvaluationError(
            "backend rankings are missing query ids: " + ", ".join(missing)
        )

    output: dict[str, list[tuple[float, str]]] = {}
    for query_id in sorted(valid_ids):
        raw_results = rows_by_id[query_id]
        if not isinstance(raw_results, list):
            raise EvaluationError(
                f"backend results for {query_id} must be an array"
            )
        if len(raw_results) > 100_000:
            raise EvaluationError(
                f"backend results for {query_id} exceed 100,000 entries"
            )
        seen: set[str] = set()
        parsed: list[tuple[float, str]] = []
        for rank, raw in enumerate(raw_results, start=1):
            if isinstance(raw, str):
                url = comparison_url(raw)
                score = 1.0 / rank
            elif isinstance(raw, Mapping):
                url = comparison_url(
                    raw.get("url")
                    or raw.get("document_url")
                    or raw.get("source_url")
                )
                raw_score = raw.get("score")
                if raw_score is None:
                    score = 1.0 / rank
                else:
                    try:
                        score = float(raw_score)
                    except (TypeError, ValueError) as exc:
                        raise EvaluationError(
                            f"invalid backend score for {query_id} rank {rank}"
                        ) from exc
                    if not math.isfinite(score):
                        raise EvaluationError(
                            f"non-finite backend score for {query_id} rank {rank}"
                        )
            else:
                raise EvaluationError(
                    f"invalid backend result for {query_id} rank {rank}"
                )
            if not url:
                raise EvaluationError(
                    f"invalid backend URL for {query_id} rank {rank}"
                )
            if url in seen:
                continue
            seen.add(url)
            parsed.append((score, url))
        output[query_id] = parsed
    return output


def add_backend_strategy(
    evaluation: EvaluationResult,
    *,
    rankings: Mapping[str, Sequence[tuple[float, str]]],
    queries: Sequence[QuerySpec],
    chunks: Sequence[ChunkRecord],
    cutoffs: Sequence[int],
    top_results: int,
) -> None:
    alias_map = build_alias_map(chunks)
    first_chunk_by_url: dict[str, ChunkRecord] = {}
    for chunk in chunks:
        first_chunk_by_url.setdefault(chunk.url, chunk)

    rows: list[StrategyResult] = []
    for query in queries:
        relevance, missing_relevant = resolve_relevance(query, alias_map)
        raw_ranking = rankings.get(query.query_id)
        if raw_ranking is None:
            raise EvaluationError(
                f"backend rankings are missing query {query.query_id}"
            )

        deduped: list[tuple[float, str]] = []
        seen_documents: set[str] = set()
        for score, raw_url in raw_ranking:
            canonical = comparison_url(raw_url)
            document_url = alias_map.get(canonical, canonical)
            if document_url in seen_documents:
                continue
            seen_documents.add(document_url)
            deduped.append((float(score), document_url))

        ranked_urls = [url for _score, url in deduped]
        documents: list[dict[str, Any]] = []
        for rank, (score, url) in enumerate(deduped[:top_results], start=1):
            chunk = first_chunk_by_url.get(url)
            documents.append(
                {
                    "rank": rank,
                    "score": round(score, 9),
                    "url": url,
                    "title": chunk.title if chunk else "",
                    "best_chunk_id": chunk.chunk_id if chunk else None,
                    "best_chunk_index": chunk.chunk_index if chunk else None,
                    "relevance_grade": relevance.get(url, 0.0),
                    "excerpt": (
                        re.sub(r"\s+", " ", chunk.text)[:500]
                        if chunk
                        else ""
                    ),
                }
            )
        rows.append(
            StrategyResult(
                query_id=query.query_id,
                question=query.question,
                strategy="backend",
                relevance=dict(relevance),
                missing_relevant=missing_relevant,
                ranked_documents=documents,
                ranked_chunks=[],
                metrics=metric_values(ranked_urls, relevance, cutoffs),
            )
        )
    evaluation.strategies["backend"] = rows


async def fetch_live_documents(
    *,
    config: str,
    urls: Sequence[str],
    verbose: bool,
) -> tuple[list[DocumentRecord], list[dict[str, Any]], str | None]:
    """Fetch documents through the production crawler, respecting robots and pacing."""

    if str(PROJECT_ROOT) not in sys.path:
        sys.path.insert(0, str(PROJECT_ROOT))
    if str(SCRIPTS_DIR) not in sys.path:
        sys.path.insert(0, str(SCRIPTS_DIR))
    try:
        import crawler as c
    except Exception as exc:
        raise EvaluationError(
            f"could not import production crawler for live mode: {exc}"
        ) from exc

    crawler_args = c.CliArgs(
        limit=0,
        clean=False,
        config=config,
        project_root=str(PROJECT_ROOT),
        resume=False,
        dry_run=True,
        log_level="INFO",
        require_complete=True,
    )
    settings = c.load_settings(crawler_args, PROJECT_ROOT / "scripts" / "crawler.py")
    policy = c.UrlPolicy(settings)
    failures: list[dict[str, Any]] = []
    documents: list[DocumentRecord] = []
    lock = asyncio.Lock()
    fetch_semaphore = asyncio.Semaphore(min(4, max(1, settings.concurrency)))

    session_headers = {"User-Agent": settings.user_agent}
    async with c.AsyncSession(
        impersonate=settings.impersonate,
        max_clients=max(8, settings.concurrency),
        headers=session_headers,
        trust_env=settings.trust_env,
    ) as crawl_session:
        host_safety = c.HostSafetyCache()
        raw_http = c.RawHttpClient(
            settings, policy, host_safety, crawl_session
        )
        robots = c.RobotsPolicy(settings, policy, raw_http)
        pacer = c.HostPacer(settings.min_host_delay)
        renderer = c.BrowserRenderer(
            enabled=settings.render_enabled,
            policy=policy,
            is_safe_url=host_safety.is_safe,
            user_agent=settings.user_agent,
            timeout_seconds=settings.render_timeout,
            settle_milliseconds=settings.render_settle_ms,
            concurrency=settings.render_concurrency,
            max_pages=settings.render_max_pages,
        )
        vision = c.GeminiVisionClient(settings)
        if settings.render_enabled and not renderer.available:
            await vision.aclose()
            raise EvaluationError(
                "live-refetch mode requires Playwright because rendering is enabled"
            )

        async def fetch_one(source_url: str) -> None:
            canonical_source = policy.canonicalize(source_url)
            if not canonical_source or not policy.is_crawl_candidate(canonical_source):
                async with lock:
                    failures.append(
                        {"url": source_url, "reason": "URL rejected by production policy"}
                    )
                return
            try:
                allowed, robots_delay = await robots.allowed(canonical_source)
                if not allowed:
                    async with lock:
                        failures.append(
                            {"url": source_url, "reason": "robots.txt denied retrieval"}
                        )
                    return
                await pacer.wait(canonical_source, robots_delay)
                async with fetch_semaphore:
                    attempt = await c.fetch_and_extract_once(
                        canonical_source,
                        settings,
                        policy,
                        raw_http,
                        vision,
                        renderer,
                    )
            except asyncio.CancelledError:
                raise
            except Exception as exc:
                async with lock:
                    failures.append(
                        {
                            "url": source_url,
                            "reason": f"{type(exc).__name__}: {exc}",
                        }
                    )
                return

            if attempt.document is None:
                reason = (
                    attempt.failure.reason
                    if attempt.failure is not None
                    else "no extracted document"
                )
                async with lock:
                    failures.append({"url": source_url, "reason": reason})
                return
            document = attempt.document
            record = DocumentRecord(
                url=comparison_url(document.url),
                title=normalize_title(document.title),
                markdown=document.markdown,
                word_count=document.word_count,
                source_url=comparison_url(source_url),
                aliases=(comparison_url(source_url),),
            )
            async with lock:
                documents.append(record)
                if verbose:
                    print(
                        f"OK   {record.word_count:6d}w "
                        f"{record.source_url} -> {record.url}"
                    )

        try:
            await asyncio.gather(*(fetch_one(url) for url in urls))
        finally:
            await asyncio.gather(
                renderer.close(),
                vision.aclose(),
                return_exceptions=True,
            )

    documents.sort(key=lambda item: item.source_url or item.url)
    api_key = (
        os.environ.get("GEMINI_API_KEY")
        or os.environ.get("GEMINI_API_KEY_1")
        or os.environ.get("GEMINI_API_KEY_2")
        or os.environ.get("GOOGLE_GENERATIVE_AI_API_KEY")
    )
    return documents, failures, api_key


def snapshot_documents(
    path: Path,
    documents: Sequence[DocumentRecord],
    failures: Sequence[Mapping[str, Any]],
) -> None:
    payload = {
        "schema_version": 2,
        "created_at": utc_now_iso(),
        "mode": "live_refetch_proxy",
        "documents": [
            {
                "url": item.url,
                "source_url": item.source_url,
                "aliases": list(item.aliases),
                "title": item.title,
                "markdown": item.markdown,
                "word_count": item.word_count,
            }
            for item in documents
        ],
        "fetch_failures": list(failures),
    }
    atomic_write_json(path, payload)


def load_snapshot(
    path: Path,
    *,
    max_chunk: int,
    overlap: int,
) -> CorpusLoadResult:
    data = safe_read_json(path)
    if not isinstance(data, Mapping):
        raise EvaluationError("snapshot root must be an object")
    raw_documents = data.get("documents")
    if not isinstance(raw_documents, list):
        raise EvaluationError("snapshot does not contain a documents array")
    documents = [
        _document_from_mapping(raw)
        for raw in raw_documents
        if isinstance(raw, Mapping)
    ]
    failures = data.get("fetch_failures") or []
    if not isinstance(failures, list):
        failures = []
    return CorpusLoadResult(
        chunks=chunks_from_documents(
            documents, max_chunk=max_chunk, overlap=overlap
        ),
        source_mode=f"live_snapshot_proxy:{path}",
        exact_backend_chunks=False,
        warnings=(
            "Live-refetch proxy mode does not verify the exact chunks stored in Convex.",
            "Local fallback chunking is not proof of TypeScript backend boundary parity.",
        ),
        fetch_failures=tuple(
            item for item in failures if isinstance(item, Mapping)
        ),
    )


async def obtain_corpus(args: argparse.Namespace) -> CorpusLoadResult:
    if args.corpus_json is not None:
        return load_corpus_json(
            args.corpus_json,
            max_chunk=args.max_chunk,
            overlap=args.overlap,
        )

    snapshot_path = args.snapshot_json
    if snapshot_path.exists() and not args.refresh_corpus:
        return load_snapshot(
            snapshot_path,
            max_chunk=args.max_chunk,
            overlap=args.overlap,
        )

    documents, failures, _api_key = await fetch_live_documents(
        config=args.config,
        urls=PUSHED_URLS,
        verbose=args.verbose,
    )
    snapshot_documents(snapshot_path, documents, failures)
    return CorpusLoadResult(
        chunks=chunks_from_documents(
            documents,
            max_chunk=args.max_chunk,
            overlap=args.overlap,
        ),
        source_mode="live_refetch_proxy",
        exact_backend_chunks=False,
        warnings=(
            "The corpus was re-fetched from live websites rather than exported from Convex.",
            "Local fallback chunking is not proof of backend chunking parity.",
        ),
        fetch_failures=tuple(failures),
    )


def build_alias_map(chunks: Sequence[ChunkRecord]) -> dict[str, str]:
    alias_to_document: dict[str, str] = {}
    for chunk in chunks:
        candidates = [chunk.url, *(chunk.aliases or ())]
        if chunk.source_url:
            candidates.append(chunk.source_url)
        for candidate in candidates:
            key = comparison_url(candidate)
            if not key:
                continue
            existing = alias_to_document.get(key)
            if existing is not None and existing != chunk.url:
                raise EvaluationError(
                    f"URL alias {key} maps to multiple corpus documents: "
                    f"{existing} and {chunk.url}"
                )
            alias_to_document[key] = chunk.url
    return alias_to_document


def resolve_relevance(
    query: QuerySpec,
    alias_map: Mapping[str, str],
) -> tuple[dict[str, float], list[str]]:
    relevance: dict[str, float] = {}
    missing: list[str] = []
    for raw_url, grade in query.relevance.items():
        canonical = comparison_url(raw_url)
        document_url = alias_map.get(canonical)
        if document_url is None:
            missing.append(canonical)
            document_url = canonical
        relevance[document_url] = max(relevance.get(document_url, 0.0), grade)
    return relevance, sorted(set(missing))


def tokenize(text: str) -> list[str]:
    normalized = unicodedata.normalize("NFKC", text).casefold()
    return [token for token in TOKEN_RE.findall(normalized) if token]


class BM25Index:
    def __init__(
        self,
        chunks: Sequence[ChunkRecord],
        *,
        k1: float = 1.5,
        b: float = 0.75,
    ):
        self.chunks = chunks
        self.k1 = k1
        self.b = b
        self.tokens = [tokenize(chunk.text) for chunk in chunks]
        self.lengths = [len(tokens) for tokens in self.tokens]
        self.average_length = (
            statistics.fmean(self.lengths) if self.lengths else 0.0
        )
        self.term_frequencies = [Counter(tokens) for tokens in self.tokens]
        document_frequency: Counter[str] = Counter()
        for frequencies in self.term_frequencies:
            document_frequency.update(frequencies.keys())
        count = max(1, len(chunks))
        self.idf = {
            term: math.log(1.0 + (count - frequency + 0.5) / (frequency + 0.5))
            for term, frequency in document_frequency.items()
        }

    def score(self, query: str) -> list[float]:
        query_terms = Counter(tokenize(query))
        scores: list[float] = []
        for length, frequencies in zip(self.lengths, self.term_frequencies):
            score = 0.0
            norm = (
                1.0 - self.b
                + self.b * (length / self.average_length)
                if self.average_length > 0
                else 1.0
            )
            for term, query_count in query_terms.items():
                frequency = frequencies.get(term, 0)
                if frequency <= 0:
                    continue
                denominator = frequency + self.k1 * norm
                score += (
                    self.idf.get(term, 0.0)
                    * ((frequency * (self.k1 + 1.0)) / denominator)
                    * query_count
                )
            scores.append(score)
        return scores


def rank_chunks(
    chunks: Sequence[ChunkRecord],
    scores: Sequence[float],
) -> list[tuple[float, int]]:
    if len(chunks) != len(scores):
        raise EvaluationError("chunk and score counts do not match")
    return sorted(
        ((float(score), index) for index, score in enumerate(scores)),
        key=lambda item: (-item[0], chunks[item[1]].url, chunks[item[1]].chunk_id),
    )


def collapse_documents(
    chunks: Sequence[ChunkRecord],
    ranked_chunks: Sequence[tuple[float, int]],
) -> list[tuple[float, str, int]]:
    best: dict[str, tuple[float, int]] = {}
    for score, index in ranked_chunks:
        url = chunks[index].url
        previous = best.get(url)
        if previous is None or score > previous[0]:
            best[url] = (score, index)
    return sorted(
        ((score, url, index) for url, (score, index) in best.items()),
        key=lambda item: (-item[0], item[1]),
    )


def reciprocal_rank_fusion(
    dense_documents: Sequence[tuple[float, str, int]],
    bm25_documents: Sequence[tuple[float, str, int]],
    *,
    rrf_k: int,
) -> list[tuple[float, str, int]]:
    scores: defaultdict[str, float] = defaultdict(float)
    representative: dict[str, int] = {}
    for ranking in (dense_documents, bm25_documents):
        for rank, (_score, url, index) in enumerate(ranking, start=1):
            scores[url] += 1.0 / (rrf_k + rank)
            representative.setdefault(url, index)
    return sorted(
        (
            (score, url, representative[url])
            for url, score in scores.items()
        ),
        key=lambda item: (-item[0], item[1]),
    )


def metric_values(
    ranked_urls: Sequence[str],
    relevance: Mapping[str, float],
    cutoffs: Sequence[int],
) -> dict[str, float]:
    relevant_binary = {url for url, grade in relevance.items() if grade > 0}
    total_relevant = len(relevant_binary)
    if total_relevant == 0:
        raise EvaluationError("metric calculation requires at least one relevant document")

    output: dict[str, float] = {}
    first_relevant_rank = next(
        (
            rank
            for rank, url in enumerate(ranked_urls, start=1)
            if url in relevant_binary
        ),
        None,
    )
    output["reciprocal_rank_full"] = (
        1.0 / first_relevant_rank if first_relevant_rank else 0.0
    )

    for cutoff in cutoffs:
        top = list(ranked_urls[:cutoff])
        hits = [url for url in top if url in relevant_binary]
        output[f"precision@{cutoff}"] = len(hits) / max(1, len(top))
        output[f"recall@{cutoff}"] = len(set(hits)) / total_relevant
        output[f"hit_rate@{cutoff}"] = 1.0 if hits else 0.0

        first = next(
            (
                rank
                for rank, url in enumerate(top, start=1)
                if url in relevant_binary
            ),
            None,
        )
        output[f"mrr@{cutoff}"] = 1.0 / first if first else 0.0

        precision_sum = 0.0
        seen_relevant: set[str] = set()
        for rank, url in enumerate(top, start=1):
            if url in relevant_binary and url not in seen_relevant:
                seen_relevant.add(url)
                precision_sum += len(seen_relevant) / rank
        output[f"map@{cutoff}"] = precision_sum / min(total_relevant, cutoff)

        dcg = 0.0
        for rank, url in enumerate(top, start=1):
            grade = relevance.get(url, 0.0)
            dcg += (2.0**grade - 1.0) / math.log2(rank + 1.0)
        ideal_grades = sorted(relevance.values(), reverse=True)[:cutoff]
        idcg = math.fsum(
            (2.0**grade - 1.0) / math.log2(rank + 1.0)
            for rank, grade in enumerate(ideal_grades, start=1)
        )
        output[f"ndcg@{cutoff}"] = dcg / idcg if idcg > 0 else 0.0
    return output


def serialize_document_ranking(
    ranking: Sequence[tuple[float, str, int]],
    chunks: Sequence[ChunkRecord],
    relevance: Mapping[str, float],
    limit: int,
) -> list[dict[str, Any]]:
    output: list[dict[str, Any]] = []
    for rank, (score, url, index) in enumerate(ranking[:limit], start=1):
        chunk = chunks[index]
        output.append(
            {
                "rank": rank,
                "score": round(float(score), 9),
                "url": url,
                "title": chunk.title,
                "best_chunk_id": chunk.chunk_id,
                "best_chunk_index": chunk.chunk_index,
                "relevance_grade": relevance.get(url, 0.0),
                "excerpt": re.sub(r"\s+", " ", chunk.text)[:500],
            }
        )
    return output


def serialize_chunk_ranking(
    ranking: Sequence[tuple[float, int]],
    chunks: Sequence[ChunkRecord],
    relevance: Mapping[str, float],
    limit: int,
) -> list[dict[str, Any]]:
    output: list[dict[str, Any]] = []
    for rank, (score, index) in enumerate(ranking[:limit], start=1):
        chunk = chunks[index]
        output.append(
            {
                "rank": rank,
                "score": round(float(score), 9),
                "chunk_id": chunk.chunk_id,
                "chunk_index": chunk.chunk_index,
                "url": chunk.url,
                "title": chunk.title,
                "relevance_grade": relevance.get(chunk.url, 0.0),
                "excerpt": re.sub(r"\s+", " ", chunk.text)[:500],
            }
        )
    return output


def bootstrap_interval(
    values: Sequence[float],
    *,
    samples: int,
    seed: int,
) -> tuple[float, float]:
    if not values:
        return (0.0, 0.0)
    if len(values) == 1 or samples <= 0:
        value = float(values[0])
        return (value, value)
    rng = random.Random(seed)
    means: list[float] = []
    count = len(values)
    for _ in range(samples):
        sample = [values[rng.randrange(count)] for _ in range(count)]
        means.append(statistics.fmean(sample))
    means.sort()
    lower_index = max(0, int(samples * 0.025) - 1)
    upper_index = min(samples - 1, int(samples * 0.975))
    return (means[lower_index], means[upper_index])


def paired_bootstrap_difference(
    left: Sequence[float],
    right: Sequence[float],
    *,
    samples: int,
    seed: int,
) -> dict[str, Any]:
    """Estimate right-minus-left improvement with paired query resampling."""

    if len(left) != len(right) or not left:
        raise EvaluationError("paired bootstrap requires equal non-empty samples")
    differences = [float(b) - float(a) for a, b in zip(left, right)]
    observed = statistics.fmean(differences)
    if len(differences) == 1 or samples <= 0:
        return {
            "mean_difference": observed,
            "ci95": [observed, observed],
            "probability_improvement": 1.0 if observed > 0 else 0.0,
        }

    rng = random.Random(seed)
    means: list[float] = []
    count = len(differences)
    improvements = 0
    for _ in range(samples):
        sampled = [
            differences[rng.randrange(count)]
            for _ in range(count)
        ]
        mean = statistics.fmean(sampled)
        means.append(mean)
        if mean > 0:
            improvements += 1
    means.sort()
    lower_index = max(0, int(samples * 0.025) - 1)
    upper_index = min(samples - 1, int(samples * 0.975))
    return {
        "mean_difference": observed,
        "ci95": [means[lower_index], means[upper_index]],
        "probability_improvement": improvements / samples,
    }


def finalize_aggregates(
    result: EvaluationResult,
    *,
    bootstrap_samples: int,
    seed: int,
) -> None:
    result.aggregate.clear()
    result.confidence_intervals.clear()
    result.paired_comparisons.clear()

    for strategy, rows in result.strategies.items():
        if not rows:
            continue
        metric_names = sorted(
            {name for row in rows for name in row.metrics}
        )
        result.aggregate[strategy] = {
            name: statistics.fmean(row.metrics[name] for row in rows)
            for name in metric_names
        }
        intervals: dict[str, tuple[float, float]] = {}
        for name in metric_names:
            values = [row.metrics[name] for row in rows]
            intervals[name] = bootstrap_interval(
                values,
                samples=bootstrap_samples,
                seed=seed + sum(ord(char) for char in strategy + name),
            )
        result.confidence_intervals[strategy] = intervals

    comparisons = (
        ("dense", "bm25"),
        ("dense", "hybrid"),
        ("bm25", "hybrid"),
        ("dense", "backend"),
        ("hybrid", "backend"),
    )
    key_metrics = ("recall@5", "mrr@5", "ndcg@5", "map@5")
    for left_name, right_name in comparisons:
        left_rows = result.strategies.get(left_name)
        right_rows = result.strategies.get(right_name)
        if not left_rows or not right_rows:
            continue
        left_by_id = {row.query_id: row for row in left_rows}
        right_by_id = {row.query_id: row for row in right_rows}
        shared_ids = sorted(set(left_by_id) & set(right_by_id))
        if not shared_ids:
            continue
        label = f"{right_name}_minus_{left_name}"
        result.paired_comparisons[label] = {}
        for metric in key_metrics:
            left_values = [
                left_by_id[query_id].metrics.get(metric, 0.0)
                for query_id in shared_ids
            ]
            right_values = [
                right_by_id[query_id].metrics.get(metric, 0.0)
                for query_id in shared_ids
            ]
            result.paired_comparisons[label][metric] = paired_bootstrap_difference(
                left_values,
                right_values,
                samples=bootstrap_samples,
                seed=seed
                + sum(ord(char) for char in label + metric),
            )


async def evaluate(
    *,
    chunks: Sequence[ChunkRecord],
    queries: Sequence[QuerySpec],
    embedding_client: GeminiEmbeddingClient,
    cutoffs: Sequence[int],
    rrf_k: int,
    bootstrap_samples: int,
    seed: int,
    top_results: int,
    retrieval_task: str,
) -> EvaluationResult:
    alias_map = build_alias_map(chunks)
    document_inputs = [
        EmbedInput("document", chunk.text, chunk.title)
        for chunk in chunks
    ]
    chunk_vectors = await embedding_client.embed(document_inputs)
    query_vectors = await embedding_client.embed(
        [
            EmbedInput(
                "query",
                query.question,
                task=retrieval_task.replace("-", " "),
            )
            for query in queries
        ]
    )
    bm25 = BM25Index(chunks)
    result = EvaluationResult(
        strategies={"dense": [], "bm25": [], "hybrid": []}
    )

    for query, query_vector in zip(queries, query_vectors):
        relevance, missing = resolve_relevance(query, alias_map)

        dense_scores = [cosine(query_vector, vector) for vector in chunk_vectors]
        dense_chunk_ranking = rank_chunks(chunks, dense_scores)
        dense_document_ranking = collapse_documents(chunks, dense_chunk_ranking)

        bm25_scores = bm25.score(query.question)
        bm25_chunk_ranking = rank_chunks(chunks, bm25_scores)
        bm25_document_ranking = collapse_documents(chunks, bm25_chunk_ranking)

        hybrid_document_ranking = reciprocal_rank_fusion(
            dense_document_ranking,
            bm25_document_ranking,
            rrf_k=rrf_k,
        )
        dense_by_url = {
            url: (score, index)
            for score, url, index in dense_document_ranking
        }
        hybrid_chunk_ranking = sorted(
            (
                (
                    next(
                        score
                        for score, candidate_url, _ in hybrid_document_ranking
                        if candidate_url == url
                    ),
                    index,
                )
                for url, (_dense_score, index) in dense_by_url.items()
            ),
            key=lambda item: (-item[0], chunks[item[1]].url),
        )

        rankings = {
            "dense": (dense_document_ranking, dense_chunk_ranking),
            "bm25": (bm25_document_ranking, bm25_chunk_ranking),
            "hybrid": (hybrid_document_ranking, hybrid_chunk_ranking),
        }
        for strategy, (document_ranking, chunk_ranking) in rankings.items():
            ranked_urls = [url for _score, url, _index in document_ranking]
            metrics = metric_values(ranked_urls, relevance, cutoffs)
            result.strategies[strategy].append(
                StrategyResult(
                    query_id=query.query_id,
                    question=query.question,
                    strategy=strategy,
                    relevance=dict(relevance),
                    missing_relevant=missing,
                    ranked_documents=serialize_document_ranking(
                        document_ranking,
                        chunks,
                        relevance,
                        top_results,
                    ),
                    ranked_chunks=serialize_chunk_ranking(
                        chunk_ranking,
                        chunks,
                        relevance,
                        top_results,
                    ),
                    metrics=metrics,
                )
            )

    finalize_aggregates(
        result,
        bootstrap_samples=bootstrap_samples,
        seed=seed,
    )
    return result


def git_metadata() -> dict[str, Any]:
    def run(*args: str) -> str | None:
        try:
            completed = subprocess.run(
                ["git", *args],
                cwd=PROJECT_ROOT,
                check=True,
                stdout=subprocess.PIPE,
                stderr=subprocess.DEVNULL,
                text=True,
                timeout=10,
            )
        except (OSError, subprocess.SubprocessError):
            return None
        return completed.stdout.strip()

    return {
        "commit": run("rev-parse", "HEAD"),
        "branch": run("rev-parse", "--abbrev-ref", "HEAD"),
        "dirty": bool(run("status", "--porcelain")),
    }


def package_versions() -> dict[str, str | None]:
    packages = (
        "httpx",
        "curl-cffi",
        "google-genai",
        "protego",
        "idna",
        "pymupdf",
        "pymupdf4llm",
        "playwright",
    )
    output: dict[str, str | None] = {}
    for name in packages:
        try:
            output[name] = importlib.metadata.version(name)
        except importlib.metadata.PackageNotFoundError:
            output[name] = None
    return output


def corpus_hash(chunks: Sequence[ChunkRecord]) -> str:
    payload = [
        {
            "chunk_id": chunk.chunk_id,
            "url": chunk.url,
            "title": chunk.title,
            "text_hash": chunk.content_hash,
            "chunk_index": chunk.chunk_index,
        }
        for chunk in sorted(chunks, key=lambda item: (item.url, item.chunk_index, item.chunk_id))
    ]
    return hashlib.sha256(canonical_json_bytes(payload)).hexdigest()


def query_hash(queries: Sequence[QuerySpec]) -> str:
    payload = [
        {
            "id": query.query_id,
            "question": query.question,
            "relevance": dict(sorted(query.relevance.items())),
        }
        for query in queries
    ]
    return hashlib.sha256(canonical_json_bytes(payload)).hexdigest()


def strategy_to_json(rows: Sequence[StrategyResult]) -> list[dict[str, Any]]:
    return [
        {
            "query_id": row.query_id,
            "question": row.question,
            "strategy": row.strategy,
            "relevance": row.relevance,
            "missing_relevant": row.missing_relevant,
            "metrics": row.metrics,
            "top_documents": row.ranked_documents,
            "top_chunks": row.ranked_chunks,
        }
        for row in rows
    ]


def write_csv_artifacts(
    output_dir: Path,
    evaluation: EvaluationResult,
) -> None:
    metrics_path = output_dir / "stage-e-query-metrics.csv"
    ranking_path = output_dir / "stage-e-rankings.csv"
    metric_names = sorted(
        {
            metric
            for rows in evaluation.strategies.values()
            for row in rows
            for metric in row.metrics
        }
    )
    with tempfile.NamedTemporaryFile(
        mode="w",
        encoding="utf-8",
        newline="",
        delete=False,
        dir=output_dir,
        prefix=".stage-e-query-metrics.",
        suffix=".tmp",
    ) as handle:
        writer = csv.DictWriter(
            handle,
            fieldnames=(
                "strategy",
                "query_id",
                "question",
                "missing_relevant",
                *metric_names,
            ),
        )
        writer.writeheader()
        for strategy, rows in evaluation.strategies.items():
            for row in rows:
                writer.writerow(
                    {
                        "strategy": strategy,
                        "query_id": row.query_id,
                        "question": row.question,
                        "missing_relevant": " | ".join(row.missing_relevant),
                        **row.metrics,
                    }
                )
        temp_metrics = Path(handle.name)
    os.replace(temp_metrics, metrics_path)

    with tempfile.NamedTemporaryFile(
        mode="w",
        encoding="utf-8",
        newline="",
        delete=False,
        dir=output_dir,
        prefix=".stage-e-rankings.",
        suffix=".tmp",
    ) as handle:
        writer = csv.DictWriter(
            handle,
            fieldnames=(
                "strategy",
                "query_id",
                "rank",
                "score",
                "url",
                "title",
                "relevance_grade",
                "best_chunk_id",
                "excerpt",
            ),
        )
        writer.writeheader()
        for strategy, rows in evaluation.strategies.items():
            for row in rows:
                for item in row.ranked_documents:
                    writer.writerow(
                        {
                            "strategy": strategy,
                            "query_id": row.query_id,
                            **{
                                key: item.get(key)
                                for key in (
                                    "rank",
                                    "score",
                                    "url",
                                    "title",
                                    "relevance_grade",
                                    "best_chunk_id",
                                    "excerpt",
                                )
                            },
                        }
                    )
        temp_rankings = Path(handle.name)
    os.replace(temp_rankings, ranking_path)


def markdown_report(
    *,
    metadata: Mapping[str, Any],
    corpus: CorpusLoadResult,
    chunks: Sequence[ChunkRecord],
    queries: Sequence[QuerySpec],
    evaluation: EvaluationResult,
    warnings: Sequence[str],
) -> str:
    lines = [
        "# Stage E Retrieval Evaluation",
        "",
        f"- Generated: `{metadata['generated_at']}`",
        f"- Corpus mode: `{corpus.source_mode}`",
        f"- Exact backend chunks: `{corpus.exact_backend_chunks}`",
        f"- Documents: `{len({chunk.url for chunk in chunks})}`",
        f"- Chunks: `{len(chunks)}`",
        f"- Queries: `{len(queries)}`",
        f"- Embedding model: `{metadata['embedding']['model']}`",
        f"- Dimensions: `{metadata['embedding']['dimensions']}`",
        f"- Corpus hash: `{metadata['corpus_hash']}`",
        f"- Query-label hash: `{metadata['query_hash']}`",
        "",
    ]
    if warnings:
        lines.extend(["## Warnings", ""])
        lines.extend(f"- {warning}" for warning in warnings)
        lines.append("")

    lines.extend(
        [
            "## Aggregate metrics",
            "",
            "| Strategy | Recall@5 | Precision@5 | MRR@5 | MAP@5 | nDCG@5 | Hit@5 |",
            "|---|---:|---:|---:|---:|---:|---:|",
        ]
    )
    strategy_order = [
        strategy
        for strategy in ("dense", "bm25", "hybrid", "backend")
        if strategy in evaluation.aggregate
    ]
    for strategy in strategy_order:
        metrics = evaluation.aggregate[strategy]
        lines.append(
            "| {strategy} | {recall:.3f} | {precision:.3f} | {mrr:.3f} | "
            "{map_value:.3f} | {ndcg:.3f} | {hit:.3f} |".format(
                strategy=strategy,
                recall=metrics.get("recall@5", 0.0),
                precision=metrics.get("precision@5", 0.0),
                mrr=metrics.get("mrr@5", 0.0),
                map_value=metrics.get("map@5", 0.0),
                ndcg=metrics.get("ndcg@5", 0.0),
                hit=metrics.get("hit_rate@5", 0.0),
            )
        )
    lines.append("")

    if evaluation.paired_comparisons:
        lines.extend(["## Paired bootstrap comparisons", ""])
        for comparison, metrics in evaluation.paired_comparisons.items():
            lines.append(f"### {comparison}")
            lines.append("")
            for metric, values in metrics.items():
                ci = values["ci95"]
                lines.append(
                    f"- {metric}: mean difference "
                    f"`{values['mean_difference']:.3f}`, "
                    f"95% CI `[{ci[0]:.3f}, {ci[1]:.3f}]`, "
                    f"P(improvement) `{values['probability_improvement']:.3f}`"
                )
            lines.append("")

    for strategy in strategy_order:
        lines.extend([f"## {strategy.title()} query results", ""])
        for row in evaluation.strategies[strategy]:
            metrics = row.metrics
            lines.append(
                f"### {row.query_id}: {row.question}"
            )
            lines.append("")
            lines.append(
                "- Recall@5: `{:.3f}`; MRR@5: `{:.3f}`; nDCG@5: `{:.3f}`".format(
                    metrics.get("recall@5", 0.0),
                    metrics.get("mrr@5", 0.0),
                    metrics.get("ndcg@5", 0.0),
                )
            )
            if row.missing_relevant:
                lines.append(
                    "- Missing gold documents: "
                    + ", ".join(f"`{url}`" for url in row.missing_relevant)
                )
            lines.append("- Top documents:")
            for item in row.ranked_documents[:5]:
                lines.append(
                    f"  {item['rank']}. `{item['url']}` "
                    f"(score={item['score']:.6f}, relevance={item['relevance_grade']})"
                )
            lines.append("")
    return "\n".join(lines).rstrip() + "\n"


def quality_gate_failures(
    args: argparse.Namespace,
    evaluation: EvaluationResult,
) -> list[str]:
    metrics = evaluation.aggregate[args.gate_strategy]
    checks = (
        ("recall@5", args.min_recall_at_5),
        ("mrr@5", args.min_mrr_at_5),
        ("ndcg@5", args.min_ndcg_at_5),
    )
    failures = []
    for metric, threshold in checks:
        if threshold is not None and metrics.get(metric, 0.0) < threshold:
            failures.append(
                f"{args.gate_strategy} {metric}={metrics.get(metric, 0.0):.3f} "
                f"is below required {threshold:.3f}"
            )
    return failures


def resolve_api_key() -> str | None:
    return (
        os.environ.get("GEMINI_API_KEY")
        or os.environ.get("GEMINI_API_KEY_1")
        or os.environ.get("GEMINI_API_KEY_2")
        or os.environ.get("GOOGLE_GENERATIVE_AI_API_KEY")
    )


async def async_main(args: argparse.Namespace) -> int:
    try:
        from dotenv import load_dotenv
    except ImportError:
        load_dotenv = None
    if load_dotenv is not None:
        load_dotenv(PROJECT_ROOT / ".env.local", override=False)

    started = time.monotonic()
    corpus = await obtain_corpus(args)
    queries = load_queries(args.queries_json)

    if args.require_backend_chunks and not corpus.exact_backend_chunks:
        raise EvaluationError(
            "--require-backend-chunks was set, but the corpus is live-refetched "
            "or contains locally reconstructed chunks"
        )
    if not corpus.chunks:
        raise EvaluationError("the evaluation corpus is empty")

    corpus_documents = {chunk.url for chunk in corpus.chunks}
    expected_aliases = {comparison_url(url) for url in PUSHED_URLS}
    alias_map = build_alias_map(corpus.chunks)
    missing_expected = sorted(
        url for url in expected_aliases if url not in alias_map
    )
    if missing_expected and not args.allow_partial:
        raise EvaluationError(
            f"{len(missing_expected)} Stage D document(s) are absent from the corpus: "
            + ", ".join(missing_expected[:10])
        )

    cache = EmbeddingCache(
        args.cache,
        enabled=not args.no_cache,
        dimensions=args.dimensions,
    )
    try:
        async with GeminiEmbeddingClient(
            api_key=resolve_api_key(),
            model=args.model,
            dimensions=args.dimensions,
            batch_size=args.batch_size,
            batch_bytes=args.batch_bytes,
            concurrency=args.embedding_concurrency,
            max_retries=args.max_retries,
            cache=cache,
            offline=args.offline,
            verbose=args.verbose,
        ) as embedding_client:
            evaluation = await evaluate(
                chunks=corpus.chunks,
                queries=queries,
                embedding_client=embedding_client,
                cutoffs=args.cutoffs,
                rrf_k=args.rrf_k,
                bootstrap_samples=args.bootstrap_samples,
                seed=args.seed,
                top_results=args.top_results,
                retrieval_task=args.retrieval_task,
            )
            if args.backend_rankings_json is not None:
                backend_rankings = load_backend_rankings(
                    args.backend_rankings_json,
                    queries,
                )
                add_backend_strategy(
                    evaluation,
                    rankings=backend_rankings,
                    queries=queries,
                    chunks=corpus.chunks,
                    cutoffs=args.cutoffs,
                    top_results=args.top_results,
                )
                finalize_aggregates(
                    evaluation,
                    bootstrap_samples=args.bootstrap_samples,
                    seed=args.seed,
                )
    finally:
        cache.close()

    all_missing_gold = sorted(
        {
            url
            for rows in evaluation.strategies.values()
            for row in rows
            for url in row.missing_relevant
        }
    )
    warnings = list(corpus.warnings)
    warnings.append(
        "The six built-in relevance sets preserve the supplied labels but require "
        "domain-expert review before they are used as production acceptance criteria."
    )
    warnings.append(
        "Six queries provide weak statistical power; paired bootstrap intervals "
        "are reported, but the query set should be expanded before release gating."
    )
    warnings.append(
        "This script simulates retrieval locally. To validate the deployed Convex "
        "index and search function, also evaluate rankings returned by the live backend."
    )
    if missing_expected:
        warnings.append(
            f"{len(missing_expected)} expected Stage D document(s) are missing."
        )
    if all_missing_gold:
        warnings.append(
            f"{len(all_missing_gold)} labeled relevant document(s) are absent from the corpus."
        )
    if not corpus.exact_backend_chunks:
        warnings.append(
            "Scores are proxy scores until the evaluator is run on exported Convex chunks."
        )

    metadata = {
        "schema_version": 2,
        "generated_at": utc_now_iso(),
        "duration_seconds": round(time.monotonic() - started, 3),
        "project_root": str(PROJECT_ROOT),
        "python": sys.version,
        "git": git_metadata(),
        "packages": package_versions(),
        "embedding": {
            "model": args.model,
            "dimensions": args.dimensions,
            "input_format": {
                "retrieval_task": args.retrieval_task,
                "query": (
                    "task: "
                    + args.retrieval_task.replace("-", " ")
                    + " | query: {content}"
                ),
                "document": "title: {title} | text: {content}",
            },
            "auto_truncate": False,
            "similarity": "explicit L2-normalized cosine",
        },
        "chunking": {
            "exact_backend_chunks": corpus.exact_backend_chunks,
            "fallback_max_chars": args.max_chunk,
            "fallback_overlap_chars": args.overlap,
        },
        "cutoffs": list(args.cutoffs),
        "rrf_k": args.rrf_k,
        "bootstrap_samples": args.bootstrap_samples,
        "backend_rankings_json": (
            str(args.backend_rankings_json)
            if args.backend_rankings_json is not None
            else None
        ),
        "random_seed": args.seed,
        "corpus_hash": corpus_hash(corpus.chunks),
        "query_hash": query_hash(queries),
        "script_hash": sha256_text(Path(__file__).read_text(encoding="utf-8")),
    }

    report = {
        "metadata": metadata,
        "corpus": {
            "source_mode": corpus.source_mode,
            "exact_backend_chunks": corpus.exact_backend_chunks,
            "documents": len(corpus_documents),
            "chunks": len(corpus.chunks),
            "missing_expected_stage_d_documents": missing_expected,
            "fetch_failures": list(corpus.fetch_failures),
        },
        "queries": len(queries),
        "warnings": warnings,
        "aggregate": evaluation.aggregate,
        "confidence_intervals_95": {
            strategy: {
                metric: [round(bounds[0], 6), round(bounds[1], 6)]
                for metric, bounds in intervals.items()
            }
            for strategy, intervals in evaluation.confidence_intervals.items()
        },
        "paired_bootstrap_comparisons": evaluation.paired_comparisons,
        "results": {
            strategy: strategy_to_json(rows)
            for strategy, rows in evaluation.strategies.items()
        },
    }

    args.output_dir.mkdir(parents=True, exist_ok=True)
    json_path = args.output_dir / "stage-e-retrieval.json"
    markdown_path = args.output_dir / "stage-e-retrieval.md"
    atomic_write_json(json_path, report)
    atomic_write_bytes(
        markdown_path,
        markdown_report(
            metadata=metadata,
            corpus=corpus,
            chunks=corpus.chunks,
            queries=queries,
            evaluation=evaluation,
            warnings=warnings,
        ).encode("utf-8"),
    )
    write_csv_artifacts(args.output_dir, evaluation)

    for strategy in (
        strategy
        for strategy in ("dense", "bm25", "hybrid", "backend")
        if strategy in evaluation.aggregate
    ):
        aggregate = evaluation.aggregate[strategy]
        print(
            f"{strategy:6s} "
            f"Recall@5={aggregate.get('recall@5', 0.0):.3f} "
            f"MRR@5={aggregate.get('mrr@5', 0.0):.3f} "
            f"nDCG@5={aggregate.get('ndcg@5', 0.0):.3f}"
        )
    print(f"documents={len(corpus_documents)} chunks={len(corpus.chunks)}")
    print(f"JSON: {json_path}")
    print(f"Markdown: {markdown_path}")

    if args.gate_strategy not in evaluation.aggregate:
        raise EvaluationError(
            f"--gate-strategy {args.gate_strategy} was requested, but that "
            "strategy was not evaluated"
        )
    gate_failures = quality_gate_failures(args, evaluation)
    if gate_failures:
        for failure in gate_failures:
            print(f"QUALITY GATE FAILED: {failure}", file=sys.stderr)
        return 3
    if (missing_expected or all_missing_gold) and not args.allow_partial:
        return 2
    return 0


def main(argv: Sequence[str] | None = None) -> int:
    args = parse_args(argv)
    try:
        return asyncio.run(async_main(args))
    except KeyboardInterrupt:
        print("evaluation interrupted", file=sys.stderr)
        return 130
    except EvaluationError as exc:
        print(f"EVALUATION ERROR: {exc}", file=sys.stderr)
        return 2
    except Exception as exc:
        print(
            f"UNEXPECTED ERROR: {type(exc).__name__}: {exc}",
            file=sys.stderr,
        )
        return 1


if __name__ == "__main__":
    raise SystemExit(main())