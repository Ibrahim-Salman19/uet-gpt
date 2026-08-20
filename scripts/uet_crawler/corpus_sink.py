"""Local, content-addressed corpus sink: fetch once, parse many times.

Writes every successfully fetched raw source and every extracted, quality-
passed document to local disk, independent of whether the crawl also pushes
to Convex. This is the seam that lets the crawler build a local corpus
without touching any database, local or cloud - Convex ingestion (via
ConvexClient.push) and local corpus construction are separate, independent
consumers of the same extracted document, per the "crawler correctness and
database hosting are now separate systems" principle this exists to serve.

Layout, all under one root directory::

    <root>/raw/<sha256[:2]>/<sha256>   - raw fetched bytes, written once per
                                          unique content (content-addressed;
                                          a byte-identical refetch is a no-op)
    <root>/raw-manifest.jsonl          - one record per successful fetch,
                                          appended, never rewritten
    <root>/documents.jsonl             - one record per extracted document
                                          that passed local quality/dedup
                                          checks, appended, never rewritten

Both JSONL files are append-only: a crash loses at most the last unflushed
line, never corrupts prior entries, and re-running the crawler with
--no-resume simply appends further lines (no read-modify-write of existing
state), so this needs no separate transaction/locking scheme beyond
serializing concurrent appends within this process.
"""

from __future__ import annotations

import hashlib
import json
import time
from dataclasses import asdict, dataclass
from pathlib import Path
from threading import Lock


@dataclass(frozen=True, slots=True)
class RawArtifactRecord:
    sha256: str
    canonical_url: str
    final_url: str
    http_status: int
    content_type: str
    fetched_at: str
    byte_count: int
    etag: str | None
    last_modified: str | None
    raw_path: str


class FilesystemCorpusSink:
    """Content-addressed raw cache plus an append-only normalized-document log.

    All public methods are synchronous (plain blocking file I/O) - callers in
    async code should invoke them via ``asyncio.to_thread``, matching this
    codebase's existing convention for other blocking work (e.g.
    ``extract_pdf_sync``). A single ``Lock`` serializes appends across
    threads; writes are small (a JSON line, or a raw artifact written once
    per unique SHA-256), so contention is not a practical concern at pilot or
    single-crawl scale.
    """

    def __init__(self, root: Path):
        self.root = root
        self.raw_dir = root / "raw"
        self.raw_dir.mkdir(parents=True, exist_ok=True)
        self._raw_manifest_path = root / "raw-manifest.jsonl"
        self._documents_path = root / "documents.jsonl"
        self._lock = Lock()

    def write_raw(
        self,
        body: bytes,
        *,
        canonical_url: str,
        final_url: str,
        http_status: int,
        content_type: str,
        etag: str | None,
        last_modified: str | None,
    ) -> RawArtifactRecord:
        """Persist a successfully fetched response body. Idempotent by content."""

        sha256 = hashlib.sha256(body).hexdigest()
        shard_dir = self.raw_dir / sha256[:2]
        raw_path = shard_dir / sha256
        if not raw_path.exists():
            shard_dir.mkdir(parents=True, exist_ok=True)
            tmp_path = raw_path.with_suffix(".tmp")
            tmp_path.write_bytes(body)
            tmp_path.replace(raw_path)

        record = RawArtifactRecord(
            sha256=sha256,
            canonical_url=canonical_url,
            final_url=final_url,
            http_status=http_status,
            content_type=content_type,
            fetched_at=_utc_now_iso(),
            byte_count=len(body),
            etag=etag,
            last_modified=last_modified,
            raw_path=str(raw_path.relative_to(self.root)),
        )
        self._append_jsonl(self._raw_manifest_path, asdict(record))
        return record

    def write_document(self, record: dict) -> None:
        """Append one normalized-document record. Caller supplies the full record."""

        self._append_jsonl(self._documents_path, record)

    def _append_jsonl(self, path: Path, record: dict) -> None:
        line = json.dumps(record, ensure_ascii=False, sort_keys=True) + "\n"
        with self._lock, path.open("a", encoding="utf-8") as handle:
            handle.write(line)


def _utc_now_iso() -> str:
    return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())


def document_id_for_url(canonical_url: str) -> str:
    """Deterministic local document identity: sha256 of the canonical URL.

    The Convex /ingest payload has no analogous explicit document ID (Convex
    derives its own server-side identity), so there is no existing canonical
    scheme this must match - this is scoped to the local filesystem corpus
    only, and only needs to be stable and collision-resistant for that.
    """

    return hashlib.sha256(canonical_url.encode("utf-8")).hexdigest()
