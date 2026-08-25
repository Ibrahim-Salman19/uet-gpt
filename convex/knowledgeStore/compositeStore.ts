import type { ActionCtx } from "../_generated/server";
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

// ────────────────────────────────────────────────────────────────────────────
// Composite store: one KnowledgeStore facade over a DENSE backend and a
// LEXICAL backend.
//
// Why this exists. `KnowledgeStore` declares both `denseSearch` and
// `lexicalSearch`, which holds for Convex and Turso — each owns both channels.
// Pinecone serverless owns only dense: it has no BM25, and the migration
// mandate excludes its sparse API. So a PineconeAdapter cannot honestly
// implement `lexicalSearch`.
//
// The three ways out were: delegate lexical back into Convex from inside the
// Pinecone adapter; compose two stores explicitly; or throw. Throwing was
// rejected outright — `convex/embeddings/search.ts` fuses three channels with
// RRF, and a lexical channel that throws (or silently returns nothing) would
// degrade retrieval to dense-only while every log line still looked healthy.
// That is precisely the class of invisible regression this migration has been
// trying to eliminate. Hiding the delegation inside the Pinecone adapter was
// rejected because it makes an object named "Pinecone" secretly depend on
// Convex — the topology stops being legible at the call site.
//
// This states the real architecture in the type system instead: dense and
// lexical are different systems, and that fact is visible where they are
// composed rather than buried one layer down.
//
// WRITE ORDERING IS LOAD-BEARING. `upsertDocument` resolves `documentId`, and
// Convex is what assigns it (`documents.by_url` lookup-then-insert). So the
// lexical/Convex side is always written FIRST and its returned `documentId`
// is propagated to the dense side. Reversing this would force the dense
// backend to invent an identity that Convex would then contradict.
// ────────────────────────────────────────────────────────────────────────────

export class CompositeKnowledgeStore implements KnowledgeStore {
  constructor(
    /** Owns vectors + denseSearch (e.g. Pinecone). */
    private readonly dense: KnowledgeStore,
    /** Owns canonical text, document identity, and lexicalSearch (Convex). */
    private readonly lexical: KnowledgeStore,
  ) {}

  /**
   * Lexical/Convex first — it is the identity authority. `fastPathEligible` is
   * taken from the lexical side because that is where contentHash and
   * indexingFingerprint actually live; the dense side is told the same
   * generation so both agree on which round is being written.
   */
  async upsertDocument(
    ctx: ActionCtx,
    doc: KnowledgeDocumentInput,
  ): Promise<UpsertDocumentResult> {
    const result = await this.lexical.upsertDocument(ctx, doc);
    await this.dense.upsertDocument(ctx, doc);
    return result;
  }

  /**
   * Both backends receive every chunk: the lexical side needs the text to
   * index, the dense side needs the vector. Neither deletes here — generation
   * cutover happens only in commitGeneration — so a failure partway through
   * leaves uncommitted chunks that the next commit cleans up, which is the
   * same crash-safety property the single-backend adapters rely on.
   *
   * Dense is written first here (unlike upsertDocument) deliberately: if the
   * dense write fails we abort before the lexical index advertises text whose
   * vector does not exist, which would otherwise let lexical hits reference
   * chunks dense search can never return.
   */
  async upsertChunks(
    ctx: ActionCtx,
    documentId: string,
    generation: number,
    category: string,
    chunks: KnowledgeChunkInput[],
  ): Promise<void> {
    await this.dense.upsertChunks(ctx, documentId, generation, category, chunks);
    await this.lexical.upsertChunks(ctx, documentId, generation, category, chunks);
  }

  /**
   * The safety-critical operation, and the one place divergence would be worst:
   * a generation committed in one backend but not the other means the two
   * channels disagree about what is authoritative.
   *
   * Dense commits first. If the lexical commit then fails, the dense side has
   * dropped stale vectors while the lexical side still serves stale text —
   * degraded but *detectable*, and self-healing because commitGeneration is
   * idempotent: re-running re-queries for `ingestionGeneration < generation`
   * and finishes the job. The reverse order would leave stale VECTORS live
   * after the text was cut over, which is the harder failure to notice.
   *
   * The error is deliberately re-thrown rather than swallowed: a half-committed
   * generation must be visible to the caller, not logged and forgotten.
   */
  async commitGeneration(
    ctx: ActionCtx,
    documentId: string,
    generation: number,
  ): Promise<CommitGenerationResult> {
    const denseResult = await this.dense.commitGeneration(ctx, documentId, generation);
    const lexicalResult = await this.lexical.commitGeneration(ctx, documentId, generation);
    // Report the larger count: the two backends legitimately hold different
    // numbers of stale records (a chunk can exist in one and not the other
    // mid-round), and under-reporting deletions would mask a real divergence.
    return {
      deletedStaleChunks: Math.max(
        denseResult.deletedStaleChunks,
        lexicalResult.deletedStaleChunks,
      ),
    };
  }

  async deleteDocument(ctx: ActionCtx, documentId: string): Promise<DeleteDocumentResult> {
    const denseResult = await this.dense.deleteDocument(ctx, documentId);
    const lexicalResult = await this.lexical.deleteDocument(ctx, documentId);
    return {
      deletedChunks: Math.max(denseResult.deletedChunks, lexicalResult.deletedChunks),
    };
  }

  denseSearch(
    ctx: ActionCtx,
    queryEmbedding: Float32Array,
    opts: DenseSearchOptions,
  ): Promise<SearchResult[]> {
    return this.dense.denseSearch(ctx, queryEmbedding, opts);
  }

  lexicalSearch(
    ctx: ActionCtx,
    queryText: string,
    opts: LexicalSearchOptions,
  ): Promise<SearchResult[]> {
    return this.lexical.lexicalSearch(ctx, queryText, opts);
  }

  /**
   * Served from the lexical/Convex side: it holds the canonical chunk text,
   * parentText and contextualizedText. Pinecone would only return whatever was
   * duplicated into vector metadata, which is a copy rather than the source of
   * truth — and metadata size limits make storing full parent text there a bad
   * idea anyway.
   */
  getChunks(
    ctx: ActionCtx,
    refs: Array<{ documentId: string; chunkKey: string }>,
  ): Promise<KnowledgeChunk[]> {
    return this.lexical.getChunks(ctx, refs);
  }

  /** Unhealthy if EITHER side is: retrieval needs both channels to be honest. */
  async health(ctx: ActionCtx): Promise<HealthResult> {
    const started = Date.now();
    const [denseHealth, lexicalHealth] = await Promise.all([
      this.dense.health(ctx),
      this.lexical.health(ctx),
    ]);
    const ok = denseHealth.ok && lexicalHealth.ok;
    return {
      ok,
      latencyMs: Date.now() - started,
      detail: ok
        ? `dense ${denseHealth.latencyMs}ms, lexical ${lexicalHealth.latencyMs}ms`
        : `dense ${denseHealth.ok ? "ok" : `FAIL(${denseHealth.detail ?? "?"})`}, ` +
          `lexical ${lexicalHealth.ok ? "ok" : `FAIL(${lexicalHealth.detail ?? "?"})`}`,
    };
  }

  /**
   * Chunk counts SHOULD agree across backends; when they do not, that gap is
   * the single most useful signal this store can surface, so the larger count
   * is reported and the discrepancy is not averaged away.
   */
  async stats(ctx: ActionCtx): Promise<KnowledgeStoreStats> {
    const [denseStats, lexicalStats] = await Promise.all([
      this.dense.stats(ctx),
      this.lexical.stats(ctx),
    ]);
    return {
      documentCount: Math.max(denseStats.documentCount, lexicalStats.documentCount),
      chunkCount: Math.max(denseStats.chunkCount, lexicalStats.chunkCount),
      storageBytes:
        denseStats.storageBytes !== undefined || lexicalStats.storageBytes !== undefined
          ? (denseStats.storageBytes ?? 0) + (lexicalStats.storageBytes ?? 0)
          : undefined,
    };
  }

  /** Integrity problems from either backend are summed — none are hidden. */
  async verifyIntegrity(ctx: ActionCtx): Promise<IntegrityReport> {
    const [denseReport, lexicalReport] = await Promise.all([
      this.dense.verifyIntegrity(ctx),
      this.lexical.verifyIntegrity(ctx),
    ]);
    return {
      duplicateChunkKeys:
        denseReport.duplicateChunkKeys + lexicalReport.duplicateChunkKeys,
      crossDocumentChunkKeyCollisions:
        denseReport.crossDocumentChunkKeyCollisions +
        lexicalReport.crossDocumentChunkKeyCollisions,
      orphanChunks: denseReport.orphanChunks + lexicalReport.orphanChunks,
    };
  }
}
