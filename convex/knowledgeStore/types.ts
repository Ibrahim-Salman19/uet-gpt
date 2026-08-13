import type { ActionCtx } from "../_generated/server";

// ────────────────────────────────────────────────────────────────────────────
// Vendor-neutral knowledge-store boundary.
//
// Scope: this interface owns exactly the content that is rebuildable from the
// crawler — canonical document identity, chunk text, embeddings, and parent
// text. It deliberately does NOT own crawl status (pending/processing/failed),
// crawl sessions, freshness classification, lifecycle status
// (active/superseded/withdrawn/quarantined), or citation formatting. Those stay
// in Convex's own `documents` table and existing orchestration
// (convex/embeddings/search.ts, convex/rag/retrieval.ts, convex/reranking/*)
// UNCHANGED, joined by `documentId`, regardless of which KnowledgeStore backend
// is active. Convex remains "application state"; the KnowledgeStore is the
// "canonical rebuildable knowledge state" (see migration brief §31). This is
// why `denseSearch`/`lexicalSearch` return bare chunk hits with no
// status/freshness fields: the caller already does that hydration and scoring
// today via a separate `documentId` lookup (batchFetchDocMeta), and continues
// to do so unchanged against whichever backend is configured.
//
// Every method takes `ctx: ActionCtx` first, mirroring the existing
// `rag.search(ctx, ...)` / `rag.add(ctx, ...)` convention from
// @convex-dev/rag (see convex/rag/instance.ts) so call sites keep the same
// shape no matter which adapter is behind them. The Convex adapter uses ctx to
// call back into Convex (ctx.runQuery/ctx.runMutation, the rag component
// instance); the Turso adapter ignores it (its calls are plain HTTPS to Turso
// Cloud) but keeps the parameter for interface uniformity.
// ────────────────────────────────────────────────────────────────────────────

export type FreshnessTier = "high" | "medium" | "low";

/**
 * A document as the corpus cares about it — not the full Convex `documents`
 * row. No `documentId` here: for a brand-new document one doesn't exist yet
 * (Convex assigns `_id` on first insert; a URL-keyed lookup-or-create is the
 * only way to know it). `canonicalUrl` is the real stable identity pre-insert
 * — matches today's `documents.by_url` lookup-then-insert pattern.
 * `upsertDocument` resolves/assigns `documentId` and returns it; the caller
 * uses that returned id for every subsequent call in the same round.
 *
 * `category` mirrors the one filterValue current production actually
 * filters on (`rag.add(..., filterValues: [{name: "category", ...}])`,
 * convex/crawl/actions.ts). "source" is also a configured RAG filterName
 * (rag/instance.ts) and, unlike category, nothing ever filters by it - but
 * it is NOT optional to omit: @convex-dev/rag's validateAddFilterValues
 * requires every configured filterName present on every add() call
 * regardless of whether a caller uses it for filtering later, confirmed by
 * executing upsertChunks against a real deployment ("Filter name source is
 * not valid" until fixed). canonicalUrl already carries enough information
 * to derive source (the URL host, same convention upsertDocumentRow uses),
 * so the Convex adapter recovers it internally from the stored document row
 * (convexQueries.ts getDocumentSource) rather than adding a redundant field
 * here - this is a Convex-RAG-component implementation detail, not part of
 * the vendor-neutral contract, and the Turso adapter has no equivalent
 * requirement.
 */
export interface KnowledgeDocumentInput {
  canonicalUrl: string;
  title: string;
  contentHash: string;
  indexingFingerprint: string;
  category: string;
}

/**
 * `chunkKey` must already be `computeChunkKey`-derived
 * (sha256(chunkingVersion|documentUrl|headingPath|ordinal) — see
 * convex/crawl/chunkKey.ts) by the caller: document-scoped and
 * position-stable, not content-stable. The store trusts it as given rather
 * than re-deriving it, so both backends key off the exact same identity.
 *
 * `text` is the canonical stored/indexed text — chunking-time-prefixed
 * ("Document Title: …\nURL Path: …\n[Context: …]\n\n" + body), matching
 * today's `crawledChunks.text` exactly. It does NOT include the ephemeral
 * "Section: <headingPath>\n\n" prefix that convex/crawl/actions.ts
 * `embedSingleChunk` prepends only for the embedding-model call — that
 * prefix is never persisted anywhere today and this store does not persist
 * it either. `embedding` is a fully-computed vector handed in by the caller
 * (still produced by Gemini via Convex, unchanged); the store never computes
 * or re-derives embeddings itself.
 */
export interface KnowledgeChunkInput {
  chunkKey: string;
  ordinalWithinHeading: number;
  headingPath: string[];
  text: string;
  embedding: Float32Array;
  parentText?: string;
  contextualizedText?: string;
}

export interface KnowledgeChunk {
  chunkKey: string;
  documentId: string;
  ordinalWithinHeading: number;
  headingPath: string[];
  text: string;
  parentText: string | null;
  contextualizedText: string | null;
  ingestionGeneration: number;
}

export interface SearchResult {
  chunkKey: string;
  documentId: string;
  /** Channel-native relevance score. RRF only needs rank order (1/(k+rank)),
   * so this exists for tie-breaking/display, not cross-channel comparison —
   * same as today's rag.search()/searchIndex() results. */
  score: number;
  headingPath: string[];
  text: string;
  parentText: string | null;
  contextualizedText: string | null;
}

export interface UpsertDocumentResult {
  /** Backend-resolved identity for this canonicalUrl — pass to every other method for this document. */
  documentId: string;
  generation: number;
  /**
   * True when contentHash AND indexingFingerprint both matched the existing
   * row — mirrors today's unchanged-document fast path
   * (convex/crawl/mutations.ts). The caller should skip chunk
   * writes/embedding entirely when true, exactly as it does today.
   */
  fastPathEligible: boolean;
}

export interface CommitGenerationResult {
  deletedStaleChunks: number;
}

export interface DeleteDocumentResult {
  deletedChunks: number;
}

export interface HealthResult {
  ok: boolean;
  latencyMs: number;
  detail?: string;
}

export interface KnowledgeStoreStats {
  documentCount: number;
  chunkCount: number;
  storageBytes?: number;
}

export interface IntegrityReport {
  duplicateChunkKeys: number;
  crossDocumentChunkKeyCollisions: number;
  orphanChunks: number;
}

export interface DenseSearchOptions {
  topK: number;
  filter?: { category?: string };
}

export interface LexicalSearchOptions {
  topK: number;
}

export interface KnowledgeStore {
  /**
   * Registers/updates a document's content identity. Does not write chunks.
   * Callers use `fastPathEligible` in the result to decide whether to call
   * `upsertChunks`/`commitGeneration` at all for this round.
   */
  upsertDocument(ctx: ActionCtx, doc: KnowledgeDocumentInput): Promise<UpsertDocumentResult>;

  /**
   * Idempotent upsert by chunkKey, tagged with `generation`. Never deletes.
   * Safe to call multiple times / in multiple batches for one document round
   * (e.g. to stay under a single Turso batch() request-size limit) — the
   * cutover to the new generation only happens in `commitGeneration`.
   */
  upsertChunks(
    ctx: ActionCtx,
    documentId: string,
    generation: number,
    category: string,
    chunks: KnowledgeChunkInput[],
  ): Promise<void>;

  /**
   * The one safety-critical operation: deletes this document's chunks whose
   * ingestionGeneration < generation and advances the document's committed
   * generation. Stands in for commit 185cf26's onRagEntryComplete
   * generation-fencing, adapted to backends with no long-lived interactive
   * transaction. Turso: one batch() call, genuinely atomic. Convex: a
   * synchronous, fully-awaited sequence from action context using
   * `rag.delete` (not `rag.deleteAsync`) precisely because deleteAsync's
   * deferred component-side deletion is the documented cause of the orphan
   * window reconciliation.ts exists to clean up (see
   * convex/crawl/mutations.ts diffAndDeleteStaleChunks) — reusing that same
   * async pattern here would reintroduce the exact risk this method exists
   * to close. Not one atomic DB transaction, but crash-safe either way: a
   * re-run re-queries for ingestionGeneration < generation, which still
   * correctly identifies anything not yet deleted.
   */
  commitGeneration(
    ctx: ActionCtx,
    documentId: string,
    generation: number,
  ): Promise<CommitGenerationResult>;

  deleteDocument(ctx: ActionCtx, documentId: string): Promise<DeleteDocumentResult>;

  denseSearch(
    ctx: ActionCtx,
    queryEmbedding: Float32Array,
    opts: DenseSearchOptions,
  ): Promise<SearchResult[]>;

  lexicalSearch(ctx: ActionCtx, queryText: string, opts: LexicalSearchOptions): Promise<SearchResult[]>;

  /**
   * Hydration lookup — mirrors today's batchFetchDocMeta usage pattern.
   * Takes (documentId, chunkKey) pairs rather than bare chunkKeys: chunkKey
   * is globally unique by construction (the hash includes documentUrl), but
   * today's Convex schema only indexes it compound
   * (by_documentId_and_chunkKey — see convex/schema.ts). Every caller already
   * has documentId on hand from the SearchResult that produced the chunkKey,
   * so requiring it here avoids adding a new Convex index just for this
   * adapter, at zero cost to the Turso side (which can use chunkKey alone as
   * its primary key and ignore documentId, or keep it as a defense-in-depth
   * check).
   */
  getChunks(
    ctx: ActionCtx,
    refs: Array<{ documentId: string; chunkKey: string }>,
  ): Promise<KnowledgeChunk[]>;

  health(ctx: ActionCtx): Promise<HealthResult>;
  stats(ctx: ActionCtx): Promise<KnowledgeStoreStats>;
  verifyIntegrity(ctx: ActionCtx): Promise<IntegrityReport>;
}
