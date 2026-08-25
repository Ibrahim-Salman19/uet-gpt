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
} from "../../convex/knowledgeStore/types";

// ────────────────────────────────────────────────────────────────────────────
// A complete, in-process KnowledgeStore used purely as a test double: to run
// the shared contract suite (knowledgeStoreContract.ts) against
// CompositeKnowledgeStore without needing live Pinecone or Convex, and to give
// CompositeKnowledgeStore's own ordering tests two genuinely independent
// backends to compose (mirroring the real Pinecone+Convex split) rather than
// one store playing both roles.
//
// upsertDocument deliberately contains NO `await` before it commits its
// read-generation/write-generation critical section. The contract suite's
// concurrency test races two upsertDocument calls via Promise.all and asserts
// they are never assigned the same generation; JS async functions run
// synchronously up to their first `await`, so keeping this section
// await-free is what makes that guarantee hold without any extra locking.
// ────────────────────────────────────────────────────────────────────────────

interface DocRecord {
  documentId: string;
  canonicalUrl: string;
  generation: number;
  contentHash: string;
  indexingFingerprint: string;
}

interface ChunkRecord extends KnowledgeChunk {
  category: string;
  embedding: Float32Array;
}

export class InMemoryKnowledgeStore implements KnowledgeStore {
  private docsByUrl = new Map<string, DocRecord>();
  private docsById = new Map<string, DocRecord>();
  private chunks = new Map<string, ChunkRecord>(); // key: `${documentId}:${chunkKey}`
  private nextDocId = 1;

  async upsertDocument(_ctx: unknown, doc: KnowledgeDocumentInput): Promise<UpsertDocumentResult> {
    const existing = this.docsByUrl.get(doc.canonicalUrl);
    if (existing) {
      const unchanged =
        existing.contentHash === doc.contentHash &&
        existing.indexingFingerprint === doc.indexingFingerprint;
      if (unchanged) {
        return { documentId: existing.documentId, generation: existing.generation, fastPathEligible: true };
      }
      const updated: DocRecord = {
        ...existing,
        generation: existing.generation + 1,
        contentHash: doc.contentHash,
        indexingFingerprint: doc.indexingFingerprint,
      };
      this.docsByUrl.set(doc.canonicalUrl, updated);
      this.docsById.set(updated.documentId, updated);
      return { documentId: updated.documentId, generation: updated.generation, fastPathEligible: false };
    }
    const documentId = `doc-${this.nextDocId++}`;
    const record: DocRecord = {
      documentId,
      canonicalUrl: doc.canonicalUrl,
      generation: 1,
      contentHash: doc.contentHash,
      indexingFingerprint: doc.indexingFingerprint,
    };
    this.docsByUrl.set(doc.canonicalUrl, record);
    this.docsById.set(documentId, record);
    return { documentId, generation: 1, fastPathEligible: false };
  }

  async upsertChunks(
    _ctx: unknown,
    documentId: string,
    generation: number,
    category: string,
    chunkInputs: KnowledgeChunkInput[],
  ): Promise<void> {
    for (const input of chunkInputs) {
      const key = `${documentId}:${input.chunkKey}`;
      this.chunks.set(key, {
        chunkKey: input.chunkKey,
        documentId,
        ordinalWithinHeading: input.ordinalWithinHeading,
        headingPath: input.headingPath,
        text: input.text,
        parentText: input.parentText ?? null,
        contextualizedText: input.contextualizedText ?? null,
        ingestionGeneration: generation,
        category,
        embedding: input.embedding,
      });
    }
  }

  async commitGeneration(
    _ctx: unknown,
    documentId: string,
    generation: number,
  ): Promise<CommitGenerationResult> {
    let deleted = 0;
    for (const [key, chunk] of this.chunks) {
      if (chunk.documentId === documentId && chunk.ingestionGeneration < generation) {
        this.chunks.delete(key);
        deleted++;
      }
    }
    return { deletedStaleChunks: deleted };
  }

  async deleteDocument(_ctx: unknown, documentId: string): Promise<DeleteDocumentResult> {
    let deleted = 0;
    for (const [key, chunk] of this.chunks) {
      if (chunk.documentId === documentId) {
        this.chunks.delete(key);
        deleted++;
      }
    }
    return { deletedChunks: deleted };
  }

  async denseSearch(
    _ctx: unknown,
    queryEmbedding: Float32Array,
    opts: DenseSearchOptions,
  ): Promise<SearchResult[]> {
    const candidates = [...this.chunks.values()].filter(
      (c) => !opts.filter?.category || c.category === opts.filter.category,
    );
    const scored = candidates.map((c) => ({ chunk: c, score: cosine(queryEmbedding, c.embedding) }));
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, opts.topK).map(({ chunk, score }) => toSearchResult(chunk, score));
  }

  async lexicalSearch(
    _ctx: unknown,
    queryText: string,
    opts: LexicalSearchOptions,
  ): Promise<SearchResult[]> {
    // ALL query tokens must be present (AND semantics), not "any overlap".
    // Caught by the shared contract test's concurrent-re-ingestion case: with
    // OR-style any-overlap scoring, searching "original content" after that
    // text had been fully overwritten to "round B content" still matched -
    // both share the single token "content", so a one-word overlap alone was
    // enough to return the chunk. That's not how the real backends this
    // fixture stands in for behave: Convex's search index
    // (convex/knowledgeStore/convexQueries.ts, withSearchIndex(...).search())
    // and SQLite FTS5's default MATCH both require every query term to be
    // present. AND semantics is what the contract test was actually written
    // and validated against - not a stricter choice made here in isolation.
    //
    // Still structurally cannot throw on FTS operator characters (the other
    // thing this same contract test checks): this is token-set membership on
    // our own tokenizer, never a raw FTS query string handed to a real engine.
    const queryTokens = tokenize(queryText);
    if (queryTokens.length === 0) return [];
    const scored: Array<{ chunk: ChunkRecord; score: number }> = [];
    for (const chunk of this.chunks.values()) {
      const chunkTokens = new Set(tokenize(chunk.text));
      if (queryTokens.every((t) => chunkTokens.has(t))) {
        scored.push({ chunk, score: queryTokens.length });
      }
    }
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, opts.topK).map(({ chunk, score }) => toSearchResult(chunk, score));
  }

  async getChunks(
    _ctx: unknown,
    refs: Array<{ documentId: string; chunkKey: string }>,
  ): Promise<KnowledgeChunk[]> {
    const out: KnowledgeChunk[] = [];
    for (const ref of refs) {
      const c = this.chunks.get(`${ref.documentId}:${ref.chunkKey}`);
      if (c) out.push(toKnowledgeChunk(c));
    }
    return out;
  }

  async health(): Promise<HealthResult> {
    return { ok: true, latencyMs: 0 };
  }

  async stats(): Promise<KnowledgeStoreStats> {
    return { documentCount: this.docsById.size, chunkCount: this.chunks.size };
  }

  async verifyIntegrity(): Promise<IntegrityReport> {
    // Correct-by-construction test double: this store cannot itself become
    // corrupt, so it always reports clean. Detecting real corruption is the
    // production adapters' own responsibility and is out of scope for a
    // fixture whose only job is to exercise CompositeKnowledgeStore's logic.
    return { duplicateChunkKeys: 0, crossDocumentChunkKeyCollisions: 0, orphanChunks: 0 };
  }
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

function cosine(a: Float32Array, b: Float32Array): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

function toKnowledgeChunk(c: ChunkRecord): KnowledgeChunk {
  const { category: _category, embedding: _embedding, ...rest } = c;
  return rest;
}

function toSearchResult(c: ChunkRecord, score: number): SearchResult {
  return {
    chunkKey: c.chunkKey,
    documentId: c.documentId,
    score,
    headingPath: c.headingPath,
    text: c.text,
    parentText: c.parentText,
    contextualizedText: c.contextualizedText,
  };
}
