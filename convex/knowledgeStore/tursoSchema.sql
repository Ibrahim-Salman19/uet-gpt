-- Turso/libSQL knowledge-store schema. Verified empirically against a local
-- libSQL file database (scripts/turso-capability-check.mjs, 12/12 checks
-- passed) — local file mode uses the same engine/SQL dialect as Turso Cloud,
-- so this DDL is real-execution-tested, not just docs-derived. Cloud-specific
-- behavior (HTTP batch() semantics, network latency) still needs a real
-- Cloud database — see the open questions in the migration report.
--
-- Deliberately ships with NO vector index. Which DiskANN configuration (or
-- none, i.e. exact cosine scan) to use in production is a benchmark output
-- (recall@k / latency / storage tradeoff), not a default to bake in here —
-- see tursoIndexVariants.sql for the candidate CREATE INDEX statements the
-- benchmark task applies to disposable copies of this schema.

CREATE TABLE IF NOT EXISTS documents (
  document_id TEXT PRIMARY KEY,
  canonical_url TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  indexing_fingerprint TEXT NOT NULL,
  category TEXT NOT NULL,
  ingestion_generation INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- Convex's documents.by_url is a non-unique index; production correctness
-- there relies on Convex's own transactional lookup-then-insert (OCC), which
-- has no libSQL equivalent. UNIQUE here is load-bearing, not decorative —
-- see the ingestion forensics finding this schema is built from.

CREATE TABLE IF NOT EXISTS chunk_parents (
  parent_id INTEGER PRIMARY KEY AUTOINCREMENT,
  document_id TEXT NOT NULL REFERENCES documents(document_id),
  content_hash TEXT NOT NULL,
  parent_text TEXT NOT NULL,
  UNIQUE (document_id, content_hash)
);

CREATE TABLE IF NOT EXISTS chunks (
  -- Globally unique by construction (sha256 over chunkingVersion|documentUrl
  -- |headingPath|ordinal — see convex/crawl/chunkKey.ts computeChunkKey,
  -- reused verbatim by both adapters). A single-column TEXT primary key here
  -- is possible specifically because the hash already bakes in document
  -- scope; Convex's own crawledChunks table can't do this the same way only
  -- because chunkKey was added after the table already existed with an _id
  -- primary key, not because global-uniqueness is untrue there too.
  chunk_key TEXT PRIMARY KEY,
  document_id TEXT NOT NULL REFERENCES documents(document_id),
  ingestion_generation INTEGER NOT NULL,
  ordinal_within_heading INTEGER NOT NULL,
  heading_path TEXT NOT NULL, -- JSON-encoded string[] (libSQL has no native array type)
  chunk_text TEXT NOT NULL,
  embedding F32_BLOB(768) NOT NULL,
  parent_id INTEGER REFERENCES chunk_parents(parent_id),
  contextualized_text TEXT,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_chunks_document_id ON chunks(document_id);
CREATE INDEX IF NOT EXISTS idx_chunks_document_generation ON chunks(document_id, ingestion_generation);

-- Standalone FTS5 (not external-content), matching the migration brief's
-- explicit "correctness over clever storage optimization" preference:
-- github.com/tursodatabase/libsql issue #1811 (open, unresolved as of the
-- research pass this schema is based on) reports the TS client crashing on
-- FTS5 inserts in some configuration. Local-file testing here did NOT
-- reproduce it (12/12 checks passed, including FTS5 insert via both
-- execute() and batch()), but local file mode uses the native-binding
-- transport, not Cloud's HTTP transport where the issue was filed — treat as
-- provisionally clear, re-verify against a real Cloud database before
-- relying on it. chunk_key/document_id/heading_path are carried as UNINDEXED
-- columns so lexical search needs no join back to `chunks` at all (mirrors
-- crawledChunks.search_text needing no join either, since chunk_key etc. are
-- already columns on that same row).
CREATE VIRTUAL TABLE IF NOT EXISTS chunks_fts USING fts5(
  chunk_text,
  chunk_key UNINDEXED,
  document_id UNINDEXED,
  heading_path UNINDEXED
);
