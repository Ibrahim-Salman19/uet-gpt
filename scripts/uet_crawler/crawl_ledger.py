"""Durable crawl inventory, provenance, and coverage reporting.

This module is intentionally independent from the crawler's queue implementation.
The in-memory frontier remains the fast execution path; this SQLite ledger is the
source of truth for every URL discovered during a run and the terminal outcome of
that URL.

Design goals
------------
* Never silently lose a discovered URL.
* Preserve all discovery provenance, not only the first parent link.
* Make retries and interrupted workers observable.
* Fail closed when a run is truncated or unresolved work remains.
* Keep the asyncio event loop responsive while SQLite performs disk I/O.
* Produce atomic JSON and CSV reports suitable for CI acceptance gates.

The public ``CrawlLedger`` API matches the calls made by ``scripts/crawler.py``.
Python 3.10+ is supported and no third-party database package is required.
"""

from __future__ import annotations

import asyncio
import csv
import json
import os
import sqlite3
import threading
import time
import uuid
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Callable, Iterable, Mapping, Sequence, TypeVar


SCHEMA_VERSION = 2

# States that prove a discovered URL has reached a stable outcome for graph
# coverage. A terminal HTTP failure (for example 404/410), robots exclusion, or
# unsupported binary is still a resolved URL: it remains visible in reports but
# does not keep the frontier perpetually incomplete.
TERMINAL_STATES = frozenset(
    {
        "ingested",
        "dry_run_ready",
        "skipped_short",
        "skipped_duplicate",
        "skipped_robots",
        "skipped_unsupported",
        "failed_fetch_terminal",
        # A fetch that succeeded but whose content failed extraction (e.g. a
        # PdfExtractionQualityError, or a page with no extractable content)
        # is always recorded with retryable=False, dlq_eligible=False (see
        # crawler.py's extraction-failure branches) - retrying the fetch
        # cannot change the outcome, so this is as final as skipped_unsupported.
        "failed_extract",
    }
)

# These states represent content that was successfully available to the RAG
# pipeline, or deliberately omitted because the same content was already stored.
CONTENT_SUCCESS_STATES = frozenset(
    {
        "ingested",
        "dry_run_ready",
        "skipped_short",
        "skipped_duplicate",
    }
)

ACTIVE_STATES = frozenset({"discovered", "fetching"})

# Known states are documented here for diagnostics. Unknown future states are
# treated as incomplete by default, which is the safest behavior for a coverage
# gate.
KNOWN_STATES = frozenset(
    set(TERMINAL_STATES)
    | set(ACTIVE_STATES)
    | {
        "failed_fetch_retryable",
        "failed_push",
        "skipped_depth",
    }
)

_T = TypeVar("_T")


@dataclass(frozen=True)
class LedgerSummary:
    """Aggregated state of one crawl run."""

    total_urls: int
    state_counts: dict[str, int]
    incomplete_urls: int
    content_success_urls: int
    content_gap_urls: int
    unknown_state_urls: int

    @property
    def complete_by_state(self) -> bool:
        return self.incomplete_urls == 0

    def as_dict(self) -> dict[str, Any]:
        return {
            "totalUrls": self.total_urls,
            "stateCounts": dict(self.state_counts),
            "incompleteUrls": self.incomplete_urls,
            "contentSuccessUrls": self.content_success_urls,
            "contentGapUrls": self.content_gap_urls,
            "unknownStateUrls": self.unknown_state_urls,
            "completeByState": self.complete_by_state,
        }


class CrawlLedger:
    """Single-process asynchronous facade around a WAL-mode SQLite ledger.

    SQLite operations run in a worker thread and are serialized. This avoids
    blocking the crawler's event loop while also preventing concurrent use of a
    single SQLite connection. Cancellation is handled carefully: an operation
    already executing in the worker thread is allowed to finish before the lock
    is released, so another coroutine can never race the same connection.
    """

    def __init__(
        self,
        ledger_file: str | os.PathLike[str] | Path | None = None,
        session_id: str | None = None,
    ) -> None:
        if ledger_file is None:
            raise ValueError("ledger_file is required")
        if not session_id or not str(session_id).strip():
            raise ValueError("session_id must be a non-empty string")

        self.path = Path(ledger_file)
        self.run_id = str(session_id).strip()
        self.path.parent.mkdir(parents=True, exist_ok=True)

        self._connection = sqlite3.connect(
            str(self.path),
            timeout=30.0,
            isolation_level=None,
            check_same_thread=False,
        )
        self._connection.row_factory = sqlite3.Row
        self._async_lock = asyncio.Lock()
        self._thread_lock = threading.RLock()
        self._closed = False
        self._initialize()

    # ------------------------------------------------------------------
    # Connection and schema lifecycle
    # ------------------------------------------------------------------

    def _initialize(self) -> None:
        """Configure SQLite and create/migrate the schema atomically."""

        with self._thread_lock:
            connection = self._connection
            # WAL permits readers while this crawler records writes. FULL is
            # chosen because the ledger is a recovery/coverage artifact: losing
            # the last committed URLs during a power failure is worse than a
            # modest write-throughput cost.
            connection.execute("PRAGMA journal_mode=WAL")
            connection.execute("PRAGMA synchronous=FULL")
            connection.execute("PRAGMA foreign_keys=ON")
            connection.execute("PRAGMA busy_timeout=30000")
            connection.execute("PRAGMA wal_autocheckpoint=1000")

            connection.execute("BEGIN IMMEDIATE")
            try:
                connection.executescript(
                    """
                    CREATE TABLE IF NOT EXISTS crawl_runs (
                        run_id TEXT PRIMARY KEY,
                        started_at REAL NOT NULL,
                        updated_at REAL NOT NULL,
                        finished_at REAL,
                        exhaustive INTEGER NOT NULL DEFAULT 0,
                        frontier_exhausted INTEGER NOT NULL DEFAULT 0,
                        cap_reached INTEGER NOT NULL DEFAULT 0,
                        coverage_complete INTEGER NOT NULL DEFAULT 0,
                        metadata_json TEXT NOT NULL DEFAULT '{}'
                    );

                    CREATE TABLE IF NOT EXISTS crawl_urls (
                        run_id TEXT NOT NULL,
                        url TEXT NOT NULL,
                        min_depth INTEGER NOT NULL,
                        discovered_at REAL NOT NULL,
                        updated_at REAL NOT NULL,
                        started_at REAL,
                        finished_at REAL,
                        discovered_from TEXT,
                        discovery_source TEXT NOT NULL,
                        discovered_count INTEGER NOT NULL DEFAULT 1,
                        state TEXT NOT NULL,
                        attempts INTEGER NOT NULL DEFAULT 0,
                        http_status INTEGER NOT NULL DEFAULT 0,
                        final_url TEXT,
                        title TEXT,
                        word_count INTEGER NOT NULL DEFAULT 0,
                        content_hash TEXT,
                        error TEXT,
                        PRIMARY KEY (run_id, url),
                        FOREIGN KEY (run_id) REFERENCES crawl_runs(run_id)
                            ON DELETE CASCADE
                    );

                    CREATE TABLE IF NOT EXISTS crawl_discoveries (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        run_id TEXT NOT NULL,
                        url TEXT NOT NULL,
                        depth INTEGER NOT NULL,
                        parent_url TEXT NOT NULL DEFAULT '',
                        source TEXT NOT NULL,
                        discovered_at REAL NOT NULL,
                        UNIQUE (run_id, url, depth, parent_url, source),
                        FOREIGN KEY (run_id, url) REFERENCES crawl_urls(run_id, url)
                            ON DELETE CASCADE
                    );

                    CREATE TABLE IF NOT EXISTS crawl_events (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        run_id TEXT NOT NULL,
                        url TEXT NOT NULL,
                        event_type TEXT NOT NULL,
                        state TEXT,
                        created_at REAL NOT NULL,
                        details_json TEXT NOT NULL DEFAULT '{}',
                        FOREIGN KEY (run_id, url) REFERENCES crawl_urls(run_id, url)
                            ON DELETE CASCADE
                    );

                    CREATE INDEX IF NOT EXISTS idx_crawl_urls_run_state
                        ON crawl_urls(run_id, state);
                    CREATE INDEX IF NOT EXISTS idx_crawl_urls_run_depth
                        ON crawl_urls(run_id, min_depth, url);
                    CREATE INDEX IF NOT EXISTS idx_crawl_urls_run_updated
                        ON crawl_urls(run_id, updated_at);
                    CREATE INDEX IF NOT EXISTS idx_discoveries_run_url
                        ON crawl_discoveries(run_id, url);
                    CREATE INDEX IF NOT EXISTS idx_events_run_url_created
                        ON crawl_events(run_id, url, created_at);
                    """
                )

                # Migrate the earlier ledger shape without deleting a user's
                # existing crawl history.
                self._ensure_column(
                    "crawl_runs", "updated_at", "REAL NOT NULL DEFAULT 0"
                )
                self._ensure_column("crawl_urls", "started_at", "REAL")
                self._ensure_column("crawl_urls", "finished_at", "REAL")
                self._ensure_column(
                    "crawl_urls", "discovered_count", "INTEGER NOT NULL DEFAULT 1"
                )
                connection.execute(f"PRAGMA user_version={SCHEMA_VERSION}")
                connection.commit()
            except BaseException:
                connection.rollback()
                raise

    def _ensure_column(self, table: str, column: str, declaration: str) -> None:
        columns = {
            str(row["name"])
            for row in self._connection.execute(f"PRAGMA table_info({table})")
        }
        if column not in columns:
            self._connection.execute(
                f"ALTER TABLE {table} ADD COLUMN {column} {declaration}"
            )

    def _assert_open(self) -> None:
        if self._closed:
            raise RuntimeError("crawl ledger is already closed")

    async def _call(self, operation: Callable[[], _T]) -> _T:
        """Run one serialized SQLite operation without blocking the event loop."""

        async with self._async_lock:
            self._assert_open()

            def guarded() -> _T:
                with self._thread_lock:
                    self._assert_open()
                    return operation()

            task = asyncio.create_task(asyncio.to_thread(guarded))
            try:
                return await asyncio.shield(task)
            except asyncio.CancelledError:
                # ``to_thread`` work cannot be forcefully cancelled. Wait for it
                # to finish before releasing the connection lock, then propagate
                # cancellation to the caller.
                try:
                    await task
                finally:
                    raise

    def _transaction(self, operation: Callable[[sqlite3.Connection], _T]) -> _T:
        connection = self._connection
        connection.execute("BEGIN IMMEDIATE")
        try:
            result = operation(connection)
            connection.commit()
            return result
        except BaseException:
            connection.rollback()
            raise

    @staticmethod
    def _json_dumps(value: Mapping[str, Any] | Sequence[Any] | None) -> str:
        return json.dumps(
            value if value is not None else {},
            ensure_ascii=False,
            sort_keys=True,
            separators=(",", ":"),
            default=str,
        )

    @staticmethod
    def _json_object(raw: Any) -> dict[str, Any]:
        if not raw:
            return {}
        try:
            value = json.loads(str(raw))
        except (json.JSONDecodeError, TypeError, ValueError):
            return {}
        return value if isinstance(value, dict) else {}

    def _ensure_run_row(self, connection: sqlite3.Connection, now: float) -> None:
        connection.execute(
            """
            INSERT INTO crawl_runs(
                run_id, started_at, updated_at, exhaustive, metadata_json
            ) VALUES (?, ?, ?, 0, '{}')
            ON CONFLICT(run_id) DO UPDATE SET updated_at=excluded.updated_at
            """,
            (self.run_id, now, now),
        )

    def _ensure_url_row(
        self,
        connection: sqlite3.Connection,
        url: str,
        now: float,
        *,
        source: str = "implicit",
    ) -> None:
        self._ensure_run_row(connection, now)
        connection.execute(
            """
            INSERT INTO crawl_urls(
                run_id, url, min_depth, discovered_at, updated_at,
                discovery_source, state
            ) VALUES (?, ?, 0, ?, ?, ?, 'discovered')
            ON CONFLICT(run_id, url) DO NOTHING
            """,
            (self.run_id, url, now, now, source),
        )

    # ------------------------------------------------------------------
    # Public write API
    # ------------------------------------------------------------------

    async def begin_run(
        self,
        *,
        exhaustive: bool,
        metadata: Mapping[str, Any] | None = None,
    ) -> None:
        """Create or resume the current run without erasing prior URL state."""

        supplied = dict(metadata or {})

        def operation(connection: sqlite3.Connection) -> None:
            now = time.time()

            def body(conn: sqlite3.Connection) -> None:
                current = conn.execute(
                    "SELECT metadata_json FROM crawl_runs WHERE run_id=?",
                    (self.run_id,),
                ).fetchone()
                merged = self._json_object(
                    current["metadata_json"] if current is not None else None
                )
                merged.update(supplied)
                conn.execute(
                    """
                    INSERT INTO crawl_runs(
                        run_id, started_at, updated_at, exhaustive,
                        frontier_exhausted, cap_reached, coverage_complete,
                        metadata_json
                    ) VALUES (?, ?, ?, ?, 0, 0, 0, ?)
                    ON CONFLICT(run_id) DO UPDATE SET
                        updated_at=excluded.updated_at,
                        finished_at=NULL,
                        exhaustive=excluded.exhaustive,
                        frontier_exhausted=0,
                        cap_reached=0,
                        coverage_complete=0,
                        metadata_json=excluded.metadata_json
                    """,
                    (
                        self.run_id,
                        now,
                        now,
                        1 if exhaustive else 0,
                        self._json_dumps(merged),
                    ),
                )

            self._transaction(body)

        await self._call(lambda: operation(self._connection))

    async def discover(
        self,
        url: str,
        depth: int,
        *,
        discovered_from: str | None,
        discovery_source: str,
    ) -> None:
        await self.discover_many(
            [(url, depth, discovered_from, discovery_source)]
        )

    async def discover_many(
        self,
        rows: Iterable[tuple[str, int, str | None, str]],
    ) -> None:
        """Persist URL inventory and every unique discovery edge in one commit."""

        materialized: list[tuple[str, int, str, str]] = []
        for raw_url, raw_depth, raw_parent, raw_source in rows:
            url = str(raw_url).strip()
            if not url:
                continue
            try:
                depth = max(0, int(raw_depth))
            except (TypeError, ValueError):
                depth = 0
            parent = str(raw_parent).strip() if raw_parent else ""
            source = str(raw_source).strip() or "unknown"
            materialized.append((url, depth, parent, source))

        if not materialized:
            return

        # Eliminate duplicate edge rows inside this batch while retaining every
        # distinct parent/source path that led to a URL.
        unique_edges = list(dict.fromkeys(materialized))

        def operation(connection: sqlite3.Connection) -> None:
            now = time.time()

            def body(conn: sqlite3.Connection) -> None:
                self._ensure_run_row(conn, now)
                conn.executemany(
                    """
                    INSERT INTO crawl_urls(
                        run_id, url, min_depth, discovered_at, updated_at,
                        discovered_from, discovery_source, discovered_count, state
                    ) VALUES (?, ?, ?, ?, ?, NULLIF(?, ''), ?, 1, 'discovered')
                    ON CONFLICT(run_id, url) DO UPDATE SET
                        min_depth=MIN(crawl_urls.min_depth, excluded.min_depth),
                        updated_at=excluded.updated_at,
                        discovered_count=crawl_urls.discovered_count + 1,
                        discovered_from=COALESCE(
                            crawl_urls.discovered_from,
                            excluded.discovered_from
                        )
                    """,
                    [
                        (
                            self.run_id,
                            url,
                            depth,
                            now,
                            now,
                            parent,
                            source,
                        )
                        for url, depth, parent, source in unique_edges
                    ],
                )
                conn.executemany(
                    """
                    INSERT OR IGNORE INTO crawl_discoveries(
                        run_id, url, depth, parent_url, source, discovered_at
                    ) VALUES (?, ?, ?, ?, ?, ?)
                    """,
                    [
                        (self.run_id, url, depth, parent, source, now)
                        for url, depth, parent, source in unique_edges
                    ],
                )

            self._transaction(body)

        await self._call(lambda: operation(self._connection))

    async def mark_started(self, url: str) -> None:
        url = str(url).strip()
        if not url:
            raise ValueError("url must be non-empty")

        def operation(connection: sqlite3.Connection) -> None:
            now = time.time()

            def body(conn: sqlite3.Connection) -> None:
                self._ensure_url_row(conn, url, now, source="implicit-start")
                conn.execute(
                    """
                    UPDATE crawl_urls
                    SET state='fetching',
                        attempts=attempts + 1,
                        started_at=COALESCE(started_at, ?),
                        finished_at=NULL,
                        updated_at=?,
                        http_status=0,
                        error=NULL
                    WHERE run_id=? AND url=?
                    """,
                    (now, now, self.run_id, url),
                )
                conn.execute(
                    """
                    INSERT INTO crawl_events(
                        run_id, url, event_type, state, created_at, details_json
                    ) VALUES (?, ?, 'started', 'fetching', ?, '{}')
                    """,
                    (self.run_id, url, now),
                )

            self._transaction(body)

        await self._call(lambda: operation(self._connection))

    async def mark_result(
        self,
        url: str,
        state: str,
        *,
        http_status: int | None = None,
        final_url: str | None = None,
        title: str | None = None,
        word_count: int | None = None,
        content_hash: str | None = None,
        error: str | None = None,
    ) -> None:
        """Record the latest URL state without erasing omitted prior fields."""

        url = str(url).strip()
        state = str(state).strip()
        if not url:
            raise ValueError("url must be non-empty")
        if not state:
            raise ValueError("state must be non-empty")
        if len(state) > 100:
            raise ValueError("state is unexpectedly long")

        status_value = None if http_status is None else int(http_status)
        words_value = None if word_count is None else max(0, int(word_count))
        final_value = str(final_url).strip() if final_url else None
        title_value = str(title).strip()[:2000] if title else None
        hash_value = str(content_hash).strip() if content_hash else None
        error_value = str(error).strip()[:20_000] if error else None
        is_terminal = state in TERMINAL_STATES
        clear_error = state in CONTENT_SUCCESS_STATES or state == "fetching"

        details = {
            "httpStatus": status_value,
            "finalUrl": final_value,
            "wordCount": words_value,
            "contentHash": hash_value,
            "error": error_value,
        }

        def operation(connection: sqlite3.Connection) -> None:
            now = time.time()

            def body(conn: sqlite3.Connection) -> None:
                self._ensure_url_row(conn, url, now, source="implicit-result")
                conn.execute(
                    """
                    UPDATE crawl_urls
                    SET state=?,
                        http_status=COALESCE(?, http_status),
                        final_url=COALESCE(?, final_url),
                        title=COALESCE(?, title),
                        word_count=COALESCE(?, word_count),
                        content_hash=COALESCE(?, content_hash),
                        error=CASE
                            WHEN ? = 1 THEN NULL
                            WHEN ? IS NOT NULL THEN ?
                            ELSE error
                        END,
                        finished_at=CASE WHEN ? = 1 THEN ? ELSE NULL END,
                        updated_at=?
                    WHERE run_id=? AND url=?
                    """,
                    (
                        state,
                        status_value,
                        final_value,
                        title_value,
                        words_value,
                        hash_value,
                        1 if clear_error else 0,
                        error_value,
                        error_value,
                        1 if is_terminal else 0,
                        now,
                        now,
                        self.run_id,
                        url,
                    ),
                )
                conn.execute(
                    """
                    INSERT INTO crawl_events(
                        run_id, url, event_type, state, created_at, details_json
                    ) VALUES (?, ?, 'result', ?, ?, ?)
                    """,
                    (
                        self.run_id,
                        url,
                        state,
                        now,
                        self._json_dumps(details),
                    ),
                )

            self._transaction(body)

        await self._call(lambda: operation(self._connection))

    async def mark_result_if_not_terminal(self, url: str, state: str, *, error: str) -> None:
        """Like mark_result, but a no-op if the URL already reached a
        terminal state this run.

        A URL can be independently discovered as a link on several different
        pages after it was already itself successfully processed (e.g. every
        seed page's nav menu linking back to the same handful of seed URLs,
        or a deep page linking back to the site root). Both non-scheduling
        outcomes that call this - "frontier cap reached" and "exceeds
        maxDepth" - are bulk, best-effort bookkeeping applied to every
        co-discovered link without checking each one's individual history;
        an unconditional mark_result there would silently demote an
        already-ingested/dry-run-ready/skipped URL back to an incomplete
        state, making the ledger's own state column an unreliable success
        count for any run that doesn't end via frontier exhaustion.
        """

        url = str(url).strip()
        state = str(state).strip()
        if not url:
            raise ValueError("url must be non-empty")
        if not state:
            raise ValueError("state must be non-empty")
        error_value = str(error).strip()[:20_000]

        def operation(connection: sqlite3.Connection) -> None:
            now = time.time()

            def body(conn: sqlite3.Connection) -> None:
                self._ensure_url_row(conn, url, now, source="implicit-result")
                placeholders = ",".join("?" * len(TERMINAL_STATES))
                conn.execute(
                    f"""
                    UPDATE crawl_urls
                    SET state=?, error=?, updated_at=?
                    WHERE run_id=? AND url=? AND state NOT IN ({placeholders})
                    """,
                    (state, error_value, now, self.run_id, url, *TERMINAL_STATES),
                )

            self._transaction(body)

        await self._call(lambda: operation(self._connection))

    # Compatibility with the original stub. New crawler code should use the
    # explicit async methods above.
    def record_visit(self, url: str, status: str) -> None:
        url = str(url).strip()
        state = str(status).strip() or "unknown"
        if not url:
            return
        with self._thread_lock:
            self._assert_open()
            now = time.time()

            def body(conn: sqlite3.Connection) -> None:
                self._ensure_url_row(conn, url, now, source="record-visit")
                conn.execute(
                    """
                    UPDATE crawl_urls
                    SET state=?, updated_at=?,
                        finished_at=CASE WHEN ? = 1 THEN ? ELSE NULL END
                    WHERE run_id=? AND url=?
                    """,
                    (
                        state,
                        now,
                        1 if state in TERMINAL_STATES else 0,
                        now,
                        self.run_id,
                        url,
                    ),
                )

            self._transaction(body)

    # ------------------------------------------------------------------
    # Summary and completion semantics
    # ------------------------------------------------------------------

    def _summary_sync(self) -> LedgerSummary:
        rows = self._connection.execute(
            """
            SELECT state, COUNT(*) AS count
            FROM crawl_urls
            WHERE run_id=?
            GROUP BY state
            ORDER BY state
            """,
            (self.run_id,),
        ).fetchall()
        state_counts = {str(row["state"]): int(row["count"]) for row in rows}
        total = sum(state_counts.values())
        incomplete = sum(
            count
            for state, count in state_counts.items()
            if state not in TERMINAL_STATES
        )
        content_success = sum(
            state_counts.get(state, 0) for state in CONTENT_SUCCESS_STATES
        )
        unknown = sum(
            count for state, count in state_counts.items() if state not in KNOWN_STATES
        )
        return LedgerSummary(
            total_urls=total,
            state_counts=state_counts,
            incomplete_urls=incomplete,
            content_success_urls=content_success,
            content_gap_urls=max(0, total - content_success),
            unknown_state_urls=unknown,
        )

    async def summary(self) -> LedgerSummary:
        return await self._call(self._summary_sync)

    async def finish_run(
        self,
        *,
        frontier_exhausted: bool,
        cap_reached: bool,
        metadata: Mapping[str, Any] | None = None,
    ) -> bool:
        """Finalize the run and return its fail-closed coverage verdict."""

        supplied = dict(metadata or {})

        def operation(connection: sqlite3.Connection) -> bool:
            now = time.time()

            def body(conn: sqlite3.Connection) -> bool:
                self._ensure_run_row(conn, now)
                summary = self._summary_sync()
                current = conn.execute(
                    """
                    SELECT exhaustive, metadata_json
                    FROM crawl_runs WHERE run_id=?
                    """,
                    (self.run_id,),
                ).fetchone()
                exhaustive = bool(current and int(current["exhaustive"]))

                complete = bool(
                    exhaustive
                    and bool(frontier_exhausted)
                    and not bool(cap_reached)
                    and summary.complete_by_state
                )

                merged = self._json_object(
                    current["metadata_json"] if current is not None else None
                )
                merged.update(supplied)
                merged["ledgerSummary"] = summary.as_dict()
                merged["coverageDecision"] = {
                    "exhaustiveConfigured": exhaustive,
                    "frontierExhausted": bool(frontier_exhausted),
                    "capReached": bool(cap_reached),
                    "completeByState": summary.complete_by_state,
                    "coverageComplete": complete,
                }

                conn.execute(
                    """
                    UPDATE crawl_runs
                    SET updated_at=?,
                        finished_at=?,
                        frontier_exhausted=?,
                        cap_reached=?,
                        coverage_complete=?,
                        metadata_json=?
                    WHERE run_id=?
                    """,
                    (
                        now,
                        now,
                        1 if frontier_exhausted else 0,
                        1 if cap_reached else 0,
                        1 if complete else 0,
                        self._json_dumps(merged),
                        self.run_id,
                    ),
                )
                return complete

            return self._transaction(body)

        return await self._call(lambda: operation(self._connection))

    # ------------------------------------------------------------------
    # Atomic reports
    # ------------------------------------------------------------------

    @staticmethod
    def _atomic_write_text(path: Path, text: str) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        temporary = path.with_name(
            f".{path.name}.{os.getpid()}.{uuid.uuid4().hex}.tmp"
        )
        try:
            with temporary.open("w", encoding="utf-8", newline="\n") as handle:
                handle.write(text)
                handle.flush()
                os.fsync(handle.fileno())
            os.replace(temporary, path)
            # Best-effort directory sync makes the rename durable on POSIX.
            if os.name == "posix":
                directory_fd = os.open(str(path.parent), os.O_RDONLY)
                try:
                    os.fsync(directory_fd)
                finally:
                    os.close(directory_fd)
        finally:
            try:
                temporary.unlink(missing_ok=True)
            except OSError:
                pass

    @classmethod
    def _atomic_write_csv(
        cls,
        path: Path,
        fieldnames: Sequence[str],
        rows: Sequence[Mapping[str, Any]],
    ) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        temporary = path.with_name(
            f".{path.name}.{os.getpid()}.{uuid.uuid4().hex}.tmp"
        )
        try:
            with temporary.open("w", encoding="utf-8", newline="") as handle:
                writer = csv.DictWriter(
                    handle,
                    fieldnames=list(fieldnames),
                    extrasaction="ignore",
                )
                writer.writeheader()
                for row in rows:
                    writer.writerow({name: row.get(name) for name in fieldnames})
                handle.flush()
                os.fsync(handle.fileno())
            os.replace(temporary, path)
            if os.name == "posix":
                directory_fd = os.open(str(path.parent), os.O_RDONLY)
                try:
                    os.fsync(directory_fd)
                finally:
                    os.close(directory_fd)
        finally:
            try:
                temporary.unlink(missing_ok=True)
            except OSError:
                pass

    async def write_reports(self, json_path: Path, csv_path: Path) -> None:
        json_path = Path(json_path)
        csv_path = Path(csv_path)

        def operation() -> None:
            run_row = self._connection.execute(
                "SELECT * FROM crawl_runs WHERE run_id=?", (self.run_id,)
            ).fetchone()
            url_rows = self._connection.execute(
                """
                SELECT url, min_depth, discovery_source, discovered_from,
                       discovered_count, state, attempts, http_status, final_url,
                       title, word_count, content_hash, error, discovered_at,
                       started_at, finished_at, updated_at
                FROM crawl_urls
                WHERE run_id=?
                ORDER BY min_depth, url
                """,
                (self.run_id,),
            ).fetchall()
            discovery_rows = self._connection.execute(
                """
                SELECT url, depth, parent_url, source, discovered_at
                FROM crawl_discoveries
                WHERE run_id=?
                ORDER BY url, depth, parent_url, source
                """,
                (self.run_id,),
            ).fetchall()
            summary = self._summary_sync()

            run_payload: dict[str, Any]
            if run_row is None:
                run_payload = {"run_id": self.run_id}
            else:
                run_payload = dict(run_row)
            run_payload["metadata"] = self._json_object(
                run_payload.pop("metadata_json", None)
            )
            run_payload["exhaustive"] = bool(run_payload.get("exhaustive", 0))
            run_payload["frontier_exhausted"] = bool(
                run_payload.get("frontier_exhausted", 0)
            )
            run_payload["cap_reached"] = bool(run_payload.get("cap_reached", 0))
            run_payload["coverage_complete"] = bool(
                run_payload.get("coverage_complete", 0)
            )

            payload = {
                "schemaVersion": SCHEMA_VERSION,
                "generatedAt": time.time(),
                "run": run_payload,
                "summary": summary.as_dict(),
                "urls": [dict(row) for row in url_rows],
                "discoveries": [dict(row) for row in discovery_rows],
            }
            self._atomic_write_text(
                json_path,
                json.dumps(
                    payload,
                    ensure_ascii=False,
                    indent=2,
                    sort_keys=False,
                    default=str,
                )
                + "\n",
            )

            fieldnames = [
                "url",
                "min_depth",
                "discovery_source",
                "discovered_from",
                "discovered_count",
                "state",
                "attempts",
                "http_status",
                "final_url",
                "title",
                "word_count",
                "content_hash",
                "error",
                "discovered_at",
                "started_at",
                "finished_at",
                "updated_at",
            ]
            self._atomic_write_csv(
                csv_path,
                fieldnames,
                [dict(row) for row in url_rows],
            )

        await self._call(operation)

    # ------------------------------------------------------------------
    # Shutdown
    # ------------------------------------------------------------------

    async def close(self) -> None:
        async with self._async_lock:
            if self._closed:
                return

            def operation() -> None:
                with self._thread_lock:
                    if self._closed:
                        return
                    try:
                        self._connection.execute("PRAGMA optimize")
                        self._connection.execute("PRAGMA wal_checkpoint(TRUNCATE)")
                    except sqlite3.DatabaseError:
                        # Closing the connection still safely releases resources;
                        # a future opener can checkpoint the persistent WAL.
                        pass
                    finally:
                        self._connection.close()
                        self._closed = True

            task = asyncio.create_task(asyncio.to_thread(operation))
            try:
                await asyncio.shield(task)
            except asyncio.CancelledError:
                try:
                    await task
                finally:
                    raise