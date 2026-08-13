import type { Client } from "@libsql/client";
import type {
  CommitGenerationResult,
  DeleteDocumentResult,
  DenseSearchOptions,
  HealthResult,
  IntegrityReport,
  KnowledgeChunk,
  KnowledgeChunkInput,
  KnowledgeDocumentInput,
  KnowledgeStore,
  KnowledgeStoreStats,
  LexicalSearchOptions,
  SearchResult,
  UpsertDocumentResult,
} from "./types";

// Turso/libSQL implementation of the KnowledgeStore contract (see
// tursoSchema.sql for the DDL this operates against, and
// scripts/turso-capability-check.mjs for the empirical verification each SQL
// pattern used here was checked against before being relied on).
//
// Every method's ctx parameter is unused: this adapter's calls are plain
// HTTPS/libsql-protocol to Turso, not Convex — the parameter only exists so
// call sites are identical regardless of which adapter is active (see
// types.ts).

const SQLITE_CONSTRAINT = "SQLITE_CONSTRAINT";
const UPSERT_CHUNKS_BATCH_SIZE = 50;

async function sha256Hex(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function vectorLiteral(embedding: Float32Array): string {
  return `[${Array.from(embedding).join(",")}]`;
}

function parseHeadingPath(json: unknown): string[] {
  if (typeof json !== "string") return [];
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

/**
 * Turns free-text user input into safe FTS5 MATCH syntax: split into
 * alphanumeric tokens, double-quote each as a phrase literal (doubling any
 * internal quotes), join with spaces (implicit AND between phrases). This
 * denies raw FTS5 operator access (OR, NOT, NEAR, the wildcard operator,
 * column filters, leading minus) rather than passing user text straight into
 * MATCH — see migration brief §27.
 */
function sanitizeFtsQuery(raw: string): string {
  const tokens = raw.match(/[\p{L}\p{N}]+/gu) ?? [];
  if (tokens.length === 0) return '""'; // matches nothing, never a syntax error
  return tokens.map((t) => `"${t.replace(/"/g, '""')}"`).join(" ");
}

type ChunkRow = {
  chunk_key: string;
  document_id: string;
  ordinal_within_heading: number | bigint;
  heading_path: unknown;
  chunk_text: string;
  parent_text: string | null;
  contextualized_text: string | null;
  ingestion_generation: number | bigint;
};

function rowToChunk(row: ChunkRow): KnowledgeChunk {
  return {
    chunkKey: row.chunk_key,
    documentId: row.document_id,
    ordinalWithinHeading: Number(row.ordinal_within_heading),
    headingPath: parseHeadingPath(row.heading_path),
    text: row.chunk_text,
    parentText: row.parent_text,
    contextualizedText: row.contextualized_text,
    ingestionGeneration: Number(row.ingestion_generation),
  };
}

export function createTursoKnowledgeStore(client: Client): KnowledgeStore {
  async function upsertDocument(
    _ctx: unknown,
    doc: KnowledgeDocumentInput,
  ): Promise<UpsertDocumentResult> {
    const now = Date.now();
    const existing = await client.execute({
      sql: "SELECT document_id, ingestion_generation, content_hash, indexing_fingerprint FROM documents WHERE canonical_url = ?",
      args: [doc.canonicalUrl],
    });

    if (existing.rows.length > 0) {
      const row = existing.rows[0]!;
      const documentId = row.document_id as string;
      const generation = Number(row.ingestion_generation);
      if (
        row.content_hash === doc.contentHash &&
        row.indexing_fingerprint === doc.indexingFingerprint
      ) {
        return { documentId, generation, fastPathEligible: true };
      }
      // Compare-and-swap on ingestion_generation, not a blind UPDATE: without
      // the "AND ingestion_generation = ?" condition, two concurrent
      // re-ingestions of the same changed document could both read
      // generation N here, both compute newGeneration = N+1, and both
      // "win" - producing two different chunk rounds tagged with the SAME
      // generation number, which the generation-fencing in
      // commitGeneration/upsertChunks has no way to tell apart (unlike
      // Convex, where the equivalent read-then-write happens inside one
      // serializable mutation and this race can't occur - see
      // convex/crawl/mutations.ts). A 0-row update means we lost the race;
      // the retry re-reads the winner's now-committed state and either takes
      // the fast path (if the winner wrote the same content) or computes a
      // fresh, correct generation on top of it.
      const newGeneration = generation + 1;
      const updateResult = await client.execute({
        sql: "UPDATE documents SET title=?, content_hash=?, indexing_fingerprint=?, category=?, ingestion_generation=?, updated_at=? WHERE document_id=? AND ingestion_generation=?",
        args: [
          doc.title,
          doc.contentHash,
          doc.indexingFingerprint,
          doc.category,
          newGeneration,
          now,
          documentId,
          generation,
        ],
      });
      if (updateResult.rowsAffected === 0) {
        return upsertDocument(_ctx, doc);
      }
      return { documentId, generation: newGeneration, fastPathEligible: false };
    }

    // Concurrent first-insert race (two callers both see "not found"): the
    // UNIQUE(canonical_url) constraint (verified empirically to surface as a
    // catchable SQLITE_CONSTRAINT error, not silently ignored) means exactly
    // one insert wins; the loser retries once as an update, which is always
    // correct because by the time it retries the winner's row is committed
    // and visible.
    const documentId = crypto.randomUUID();
    try {
      await client.execute({
        sql: "INSERT INTO documents (document_id, canonical_url, title, content_hash, indexing_fingerprint, category, ingestion_generation, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)",
        args: [
          documentId,
          doc.canonicalUrl,
          doc.title,
          doc.contentHash,
          doc.indexingFingerprint,
          doc.category,
          now,
          now,
        ],
      });
      return { documentId, generation: 1, fastPathEligible: false };
    } catch (err) {
      const code = (err as { code?: string } | undefined)?.code;
      if (code !== SQLITE_CONSTRAINT) throw err;
      return upsertDocument(_ctx, doc);
    }
  }

  async function upsertChunks(
    _ctx: unknown,
    documentId: string,
    generation: number,
    _category: string,
    chunks: KnowledgeChunkInput[],
  ): Promise<void> {
    // Parent upserts need their RETURNING value as input to the chunk insert
    // that follows, so they run as individually-awaited statements before
    // the batched chunk writes (batch() has no intra-batch value passing).
    const parentIds = new Map<string, number>(); // chunkKey -> parent_id
    for (const chunk of chunks) {
      if (chunk.parentText === undefined) continue;
      const parentContentHash = await sha256Hex(chunk.parentText);
      const res = await client.execute({
        sql: `INSERT INTO chunk_parents (document_id, content_hash, parent_text) VALUES (?, ?, ?)
              ON CONFLICT(document_id, content_hash) DO UPDATE SET parent_text = excluded.parent_text
              RETURNING parent_id`,
        args: [documentId, parentContentHash, chunk.parentText],
      });
      parentIds.set(chunk.chunkKey, Number(res.rows[0]!.parent_id));
    }

    for (let i = 0; i < chunks.length; i += UPSERT_CHUNKS_BATCH_SIZE) {
      const batch = chunks.slice(i, i + UPSERT_CHUNKS_BATCH_SIZE);
      const now = Date.now();
      const statements = batch.flatMap((chunk) => {
        const headingPathJson = JSON.stringify(chunk.headingPath);
        const parentId = parentIds.get(chunk.chunkKey) ?? null;
        return [
          {
            sql: `INSERT INTO chunks (chunk_key, document_id, ingestion_generation, ordinal_within_heading, heading_path, chunk_text, embedding, parent_id, contextualized_text, created_at)
                  VALUES (?, ?, ?, ?, ?, ?, vector32(?), ?, ?, ?)
                  ON CONFLICT(chunk_key) DO UPDATE SET
                    document_id = excluded.document_id,
                    ingestion_generation = excluded.ingestion_generation,
                    ordinal_within_heading = excluded.ordinal_within_heading,
                    heading_path = excluded.heading_path,
                    chunk_text = excluded.chunk_text,
                    embedding = excluded.embedding,
                    parent_id = excluded.parent_id,
                    contextualized_text = excluded.contextualized_text`,
            args: [
              chunk.chunkKey,
              documentId,
              generation,
              chunk.ordinalWithinHeading,
              headingPathJson,
              chunk.text,
              vectorLiteral(chunk.embedding),
              parentId,
              chunk.contextualizedText ?? null,
              now,
            ],
          },
          // FTS5 has no ON CONFLICT/UPSERT — emulate via delete-then-insert,
          // both inside the same batch as the chunks write, all-or-nothing.
          { sql: "DELETE FROM chunks_fts WHERE chunk_key = ?", args: [chunk.chunkKey] },
          {
            sql: "INSERT INTO chunks_fts (chunk_text, chunk_key, document_id, heading_path) VALUES (?, ?, ?, ?)",
            args: [chunk.text, chunk.chunkKey, documentId, headingPathJson],
          },
        ];
      });
      await client.batch(statements, "write");
    }
  }

  async function commitGeneration(
    _ctx: unknown,
    documentId: string,
    generation: number,
  ): Promise<CommitGenerationResult> {
    // effectiveGeneration guards against a concurrent racing round: if a
    // different concurrent re-ingestion of this same document already
    // advanced ingestion_generation past what THIS call was targeting
    // (possible after upsertDocument's CAS retry resolves such a race),
    // blindly setting ingestion_generation to our own `generation` would
    // regress the pointer AND permanently strand our own now-stale chunks -
    // nothing else would ever clean them up until this document's next real
    // recrawl, and they'd stay fully searchable in the meantime. Reading the
    // current value fresh and taking the max means whichever
    // commitGeneration call runs LAST - regardless of which round "started"
    // first - always converges to the most-advanced state and sweeps
    // everything below it, including the loser's own orphaned chunks.
    const current = await client.execute({
      sql: "SELECT ingestion_generation FROM documents WHERE document_id = ?",
      args: [documentId],
    });
    const currentGeneration = Number(current.rows[0]?.ingestion_generation ?? 0);
    const effectiveGeneration = Math.max(generation, currentGeneration);

    const stale = await client.execute({
      sql: "SELECT chunk_key FROM chunks WHERE document_id = ? AND ingestion_generation < ?",
      args: [documentId, effectiveGeneration],
    });
    const staleKeys = stale.rows.map((r) => r.chunk_key as string);

    if (staleKeys.length === 0) {
      await client.execute({
        sql: "UPDATE documents SET ingestion_generation = ?, updated_at = ? WHERE document_id = ? AND ingestion_generation < ?",
        args: [effectiveGeneration, Date.now(), documentId, effectiveGeneration],
      });
      return { deletedStaleChunks: 0 };
    }

    const placeholders = staleKeys.map(() => "?").join(",");
    await client.batch(
      [
        { sql: `DELETE FROM chunks_fts WHERE chunk_key IN (${placeholders})`, args: staleKeys },
        { sql: `DELETE FROM chunks WHERE chunk_key IN (${placeholders})`, args: staleKeys },
        {
          sql: "UPDATE documents SET ingestion_generation = ?, updated_at = ? WHERE document_id = ? AND ingestion_generation < ?",
          args: [effectiveGeneration, Date.now(), documentId, effectiveGeneration],
        },
      ],
      "write",
    );
    return { deletedStaleChunks: staleKeys.length };
  }

  async function deleteDocument(
    _ctx: unknown,
    documentId: string,
  ): Promise<DeleteDocumentResult> {
    const all = await client.execute({
      sql: "SELECT chunk_key FROM chunks WHERE document_id = ?",
      args: [documentId],
    });
    const keys = all.rows.map((r) => r.chunk_key as string);

    const statements: { sql: string; args: (string | number)[] }[] = [];
    if (keys.length > 0) {
      const placeholders = keys.map(() => "?").join(",");
      statements.push({ sql: `DELETE FROM chunks_fts WHERE chunk_key IN (${placeholders})`, args: keys });
      statements.push({ sql: `DELETE FROM chunks WHERE chunk_key IN (${placeholders})`, args: keys });
    }
    statements.push({ sql: "DELETE FROM chunk_parents WHERE document_id = ?", args: [documentId] });
    statements.push({ sql: "DELETE FROM documents WHERE document_id = ?", args: [documentId] });
    await client.batch(statements, "write");
    return { deletedChunks: keys.length };
  }

  async function denseSearch(
    _ctx: unknown,
    queryEmbedding: Float32Array,
    opts: DenseSearchOptions,
  ): Promise<SearchResult[]> {
    // Exact cosine scan — no vector index in tursoSchema.sql by design (see
    // its header comment). ANN-indexed search is a separate, explicitly
    // benchmarked code path added for the dense-ANN-benchmark task, not
    // silently substituted here.
    const categoryFilter = opts.filter?.category
      ? "JOIN documents d ON d.document_id = c.document_id AND d.category = ?"
      : "";
    const args: (string | number)[] = [vectorLiteral(queryEmbedding)];
    if (opts.filter?.category) args.push(opts.filter.category);
    args.push(opts.topK);

    const res = await client.execute({
      sql: `SELECT c.chunk_key, c.document_id, c.ordinal_within_heading, c.heading_path, c.chunk_text,
                   cp.parent_text, c.contextualized_text, c.ingestion_generation,
                   vector_distance_cos(c.embedding, vector32(?)) AS dist
            FROM chunks c
            LEFT JOIN chunk_parents cp ON cp.parent_id = c.parent_id
            ${categoryFilter}
            ORDER BY dist ASC
            LIMIT ?`,
      args,
    });

    return res.rows.map((row) => {
      const chunk = rowToChunk(row as unknown as ChunkRow);
      return {
        chunkKey: chunk.chunkKey,
        documentId: chunk.documentId,
        score: Number(row.dist), // cosine DISTANCE (lower=better) - not a "higher is better" score; see SearchResult doc comment
        headingPath: chunk.headingPath,
        text: chunk.text,
        parentText: chunk.parentText,
        contextualizedText: chunk.contextualizedText,
      };
    });
  }

  async function lexicalSearch(
    _ctx: unknown,
    queryText: string,
    opts: LexicalSearchOptions,
  ): Promise<SearchResult[]> {
    const res = await client.execute({
      sql: `SELECT chunk_key, document_id, heading_path, chunk_text, bm25(chunks_fts) AS score
            FROM chunks_fts
            WHERE chunks_fts MATCH ?
            ORDER BY score
            LIMIT ?`,
      args: [sanitizeFtsQuery(queryText), opts.topK],
    });
    return res.rows.map((row) => ({
      chunkKey: row.chunk_key as string,
      documentId: row.document_id as string,
      score: Number(row.score), // FTS5 bm25(): lower (more negative) = better match
      headingPath: parseHeadingPath(row.heading_path),
      text: row.chunk_text as string,
      // FTS5 rows carry only what's declared as columns (chunk_text +
      // UNINDEXED chunk_key/document_id/heading_path) - parent/contextualized
      // text is not duplicated into the FTS table, so it's not available
      // without a follow-up getChunks call, same as today's Convex
      // chunkTextSearch (see convex/embeddings/chunkTextSearch.ts).
      parentText: null,
      contextualizedText: null,
    }));
  }

  async function getChunks(
    _ctx: unknown,
    refs: Array<{ documentId: string; chunkKey: string }>,
  ): Promise<KnowledgeChunk[]> {
    if (refs.length === 0) return [];
    const placeholders = refs.map(() => "?").join(",");
    const res = await client.execute({
      sql: `SELECT c.chunk_key, c.document_id, c.ordinal_within_heading, c.heading_path, c.chunk_text,
                   cp.parent_text, c.contextualized_text, c.ingestion_generation
            FROM chunks c
            LEFT JOIN chunk_parents cp ON cp.parent_id = c.parent_id
            WHERE c.chunk_key IN (${placeholders})`,
      args: refs.map((r) => r.chunkKey),
    });
    return res.rows.map((row) => rowToChunk(row as unknown as ChunkRow));
  }

  async function health(_ctx: unknown): Promise<HealthResult> {
    const start = Date.now();
    try {
      await client.execute("SELECT 1");
      return { ok: true, latencyMs: Date.now() - start };
    } catch (err) {
      return {
        ok: false,
        latencyMs: Date.now() - start,
        detail: err instanceof Error ? err.message : String(err),
      };
    }
  }

  async function stats(_ctx: unknown): Promise<KnowledgeStoreStats> {
    const [docCount, chunkCount] = await Promise.all([
      client.execute("SELECT count(*) AS c FROM documents"),
      client.execute("SELECT count(*) AS c FROM chunks"),
    ]);
    return {
      documentCount: Number(docCount.rows[0]!.c),
      chunkCount: Number(chunkCount.rows[0]!.c),
    };
  }

  async function verifyIntegrity(_ctx: unknown): Promise<IntegrityReport> {
    // duplicateChunkKeys is structurally 0: chunk_key is the PRIMARY KEY, so
    // a real duplicate is impossible (a second insert with the same key is
    // an upsert, not a second row) - included as a real column-count-vs-
    // distinct-count check anyway rather than hardcoding 0, in case this
    // method is ever pointed at a database that predates this constraint.
    const [dup, orphanParent, orphanChunkFts] = await Promise.all([
      client.execute(
        "SELECT count(*) - count(DISTINCT chunk_key) AS c FROM chunks",
      ),
      client.execute(
        "SELECT count(*) AS c FROM chunks WHERE parent_id IS NOT NULL AND parent_id NOT IN (SELECT parent_id FROM chunk_parents)",
      ),
      client.execute(
        "SELECT count(*) AS c FROM chunks c WHERE NOT EXISTS (SELECT 1 FROM chunks_fts f WHERE f.chunk_key = c.chunk_key)",
      ),
    ]);
    return {
      duplicateChunkKeys: Number(dup.rows[0]!.c),
      // Cross-document collisions are structurally impossible (chunk_key's
      // hash includes documentUrl - see computeChunkKey) and there is only
      // one physical chunks table (unlike Convex's app-table vs opaque
      // RAG-component split), so there's no separate namespace to drift out
      // of sync with - this number is always 0 for this backend by
      // construction, not by a runtime check.
      crossDocumentChunkKeyCollisions: 0,
      orphanChunks: Number(orphanParent.rows[0]!.c) + Number(orphanChunkFts.rows[0]!.c),
    };
  }

  return {
    upsertDocument,
    upsertChunks,
    commitGeneration,
    deleteDocument,
    denseSearch,
    lexicalSearch,
    getChunks,
    health,
    stats,
    verifyIntegrity,
  };
}
