import { ConsistencyLevelEnum, type MilvusClient, type MutationResult } from "@zilliz/milvus2-sdk-node";
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
import { DEFAULT_CHUNKS_COLLECTION, DEFAULT_DOCUMENTS_COLLECTION, PLACEHOLDER_VECTOR } from "./zillizSchema";

// Zilliz/Milvus implementation of the KnowledgeStore contract (see
// zillizSchema.ts for the collection shapes this operates against).
//
// Every read here sets consistency_level: Strong explicitly, and that is
// the ONLY mechanism relied on for read-your-writes correctness. No manual
// flush, no client-side rate limiting, no sleeps - confirmed sufficient via
// a minimal, isolated, no-flush reproduction (upsert -> Strong query,
// upsert-over-same-key -> Strong query sees the update, delete -> Strong
// query confirms absence, Strong search with ignore_growing:false) that
// passed every step immediately. Zilliz Cloud's own docs are explicit that
// manual flush is the wrong tool here (docs.zilliz.com/docs/limits: "You
// are not advised to perform flush operations manually. Zilliz Cloud
// clusters handle it gracefully for you").
//
// Every write here checks the mutation result's err_index/status and
// throws if the server rejected any row, rather than trusting that
// upsert()/delete() resolving without a thrown JS exception means the write
// actually happened. This is not defensive boilerplate - it is fixing the
// exact gap that made a real bug nearly undiagnosable: the shared contract
// test suite's embedding() helper used to default to an 8-dimensional
// vector, and Zilliz's chunks collection requires exactly 768. Milvus
// rejected every such row with error_code "IllegalArgument" ("the
// length(8) of float data should divide the dim(768)") - server-confirmed,
// not a guess - but the previous version of this method never inspected
// the response, so the call "succeeded," the row was never written, and
// every later read of that chunk correctly reported "not found." That
// looked exactly like an eventual-consistency race and burned a great deal
// of investigation time chasing consistency_level, flush, and rate-limit
// theories before the actual cause surfaced. A thrown error here would have
// pointed straight at the real problem immediately.
//
// KNOWN LIMITATION, load-bearing enough to state up front: Milvus's upsert
// is purely primary-key-based (confirmed against the installed SDK's own
// docs - no WHERE-clause/conditional-write primitive exists, no
// transactions, no row locking). tursoAdapter.ts and convexAdapter.ts both
// rely on a real compare-and-swap ("UPDATE ... WHERE ingestion_generation =
// ?" / a serializable Convex mutation) to guarantee two concurrent
// re-ingestions of the same document can never be assigned the same
// generation number. Milvus has no equivalent primitive, so upsertDocument
// here is necessarily best-effort: read current state, compute the next
// generation, upsert. A genuine concurrent race (two callers reading the
// same starting generation before either writes) CAN both "win" here in a
// way that is structurally impossible on the other two backends. This is
// not a bug to silently paper over - it is reported honestly in the
// concurrency contract test's result rather than hidden, per the migration
// brief's evidence-over-narrative standard.

function escapeFilterString(value: string): string {
  // Milvus filter expressions are a small expression language, not
  // parameterized SQL - string literals need their own quotes/backslashes
  // escaped before being interpolated into a filter string.
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

/** See the module doc comment for why this exists - a Milvus upsert/delete
 * call resolving without throwing does NOT mean every row was accepted. */
function assertMutationOk(result: MutationResult, context: string): void {
  const errorCode = result.status?.error_code;
  if (errorCode && errorCode !== "Success") {
    throw new Error(`Zilliz ${context} failed: ${errorCode} - ${result.status?.reason ?? "(no reason given)"}`);
  }
  if (result.err_index && result.err_index.length > 0) {
    throw new Error(
      `Zilliz ${context}: ${result.err_index.length} row(s) rejected (err_index=${JSON.stringify(result.err_index)}) - ${result.status?.reason ?? "(no reason given)"}`,
    );
  }
}

type ChunkRow = {
  chunk_key: string;
  document_id: string;
  ordinal_within_heading: number;
  heading_path: string;
  chunk_text: string;
  parent_text: string;
  contextualized_text: string;
  ingestion_generation: number;
};

function parseHeadingPath(json: string): string[] {
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

function rowToChunk(row: ChunkRow): KnowledgeChunk {
  return {
    chunkKey: row.chunk_key,
    documentId: row.document_id,
    ordinalWithinHeading: Number(row.ordinal_within_heading),
    headingPath: parseHeadingPath(row.heading_path),
    text: row.chunk_text,
    parentText: row.parent_text === "" ? null : row.parent_text,
    contextualizedText: row.contextualized_text === "" ? null : row.contextualized_text,
    ingestionGeneration: Number(row.ingestion_generation),
  };
}

const CHUNK_OUTPUT_FIELDS = [
  "chunk_key",
  "document_id",
  "ordinal_within_heading",
  "heading_path",
  "chunk_text",
  "parent_text",
  "contextualized_text",
  "ingestion_generation",
];

export function createZillizKnowledgeStore(
  client: MilvusClient,
  documentsCollection: string = DEFAULT_DOCUMENTS_COLLECTION,
  chunksCollection: string = DEFAULT_CHUNKS_COLLECTION,
): KnowledgeStore {
  async function upsertDocument(
    _ctx: unknown,
    doc: KnowledgeDocumentInput,
  ): Promise<UpsertDocumentResult> {
    const now = Date.now();
    const existing = await client.query({
      collection_name: documentsCollection,
      filter: `canonical_url == "${escapeFilterString(doc.canonicalUrl)}"`,
      output_fields: ["document_id", "ingestion_generation", "content_hash", "indexing_fingerprint"],
      limit: 1,
      consistency_level: ConsistencyLevelEnum.Strong,
    });

    if (existing.data.length > 0) {
      const row = existing.data[0]!;
      const documentId = row.document_id as string;
      const generation = Number(row.ingestion_generation);
      if (row.content_hash === doc.contentHash && row.indexing_fingerprint === doc.indexingFingerprint) {
        return { documentId, generation, fastPathEligible: true };
      }
      const newGeneration = generation + 1;
      // Best-effort, not a real CAS - see the module doc comment.
      const updateRes = await client.upsert({
        collection_name: documentsCollection,
        data: [
          {
            document_id: documentId,
            canonical_url: doc.canonicalUrl,
            title: doc.title,
            content_hash: doc.contentHash,
            indexing_fingerprint: doc.indexingFingerprint,
            category: doc.category,
            ingestion_generation: newGeneration,
            created_at: now,
            updated_at: now,
            placeholder_vector: PLACEHOLDER_VECTOR,
          },
        ],
      });
      assertMutationOk(updateRes, "upsertDocument (update)");
      return { documentId, generation: newGeneration, fastPathEligible: false };
    }

    // Best-effort, not a real CAS - two concurrent first-inserts for the
    // same canonical_url can both reach here and both insert, producing two
    // document rows for one URL. See the module doc comment.
    const documentId = crypto.randomUUID();
    const insertRes = await client.upsert({
      collection_name: documentsCollection,
      data: [
        {
          document_id: documentId,
          canonical_url: doc.canonicalUrl,
          title: doc.title,
          content_hash: doc.contentHash,
          indexing_fingerprint: doc.indexingFingerprint,
          category: doc.category,
          ingestion_generation: 1,
          created_at: now,
          updated_at: now,
          placeholder_vector: PLACEHOLDER_VECTOR,
        },
      ],
    });
    assertMutationOk(insertRes, "upsertDocument (insert)");
    return { documentId, generation: 1, fastPathEligible: false };
  }

  async function upsertChunks(
    _ctx: unknown,
    documentId: string,
    generation: number,
    category: string,
    chunks: KnowledgeChunkInput[],
  ): Promise<void> {
    if (chunks.length === 0) return;
    const now = Date.now();
    const res = await client.upsert({
      collection_name: chunksCollection,
      data: chunks.map((chunk) => ({
        chunk_key: chunk.chunkKey,
        document_id: documentId,
        ingestion_generation: generation,
        ordinal_within_heading: chunk.ordinalWithinHeading,
        heading_path: JSON.stringify(chunk.headingPath),
        chunk_text: chunk.text,
        embedding: Array.from(chunk.embedding),
        parent_text: chunk.parentText ?? "",
        contextualized_text: chunk.contextualizedText ?? "",
        category,
        created_at: now,
      })),
    });
    assertMutationOk(res, "upsertChunks");
  }

  async function commitGeneration(
    _ctx: unknown,
    documentId: string,
    generation: number,
  ): Promise<CommitGenerationResult> {
    const current = await client.query({
      collection_name: documentsCollection,
      filter: `document_id == "${escapeFilterString(documentId)}"`,
      // Every column, not just ingestion_generation - the upsert below
      // spreads this row back in full. A previous version of this method
      // only fetched ingestion_generation, so the "advance the document's
      // generation" upsert silently wrote a row missing its own primary key
      // and every other required field on every call - caught by tracing
      // real execution against a live cluster, not by typecheck (Milvus's
      // upsert() takes a loosely-typed row object, so a partial row
      // typechecks fine).
      output_fields: [
        "document_id",
        "canonical_url",
        "title",
        "content_hash",
        "indexing_fingerprint",
        "category",
        "ingestion_generation",
        "created_at",
      ],
      limit: 1,
      consistency_level: ConsistencyLevelEnum.Strong,
    });
    const currentGeneration = Number(current.data[0]?.ingestion_generation ?? 0);
    const effectiveGeneration = Math.max(generation, currentGeneration);

    const stale = await client.query({
      collection_name: chunksCollection,
      filter: `document_id == "${escapeFilterString(documentId)}" && ingestion_generation < ${effectiveGeneration}`,
      output_fields: ["chunk_key"],
      limit: 16384,
      consistency_level: ConsistencyLevelEnum.Strong,
    });
    const staleKeys = stale.data.map((r) => r.chunk_key as string);
    if (staleKeys.length > 0) {
      const deleteRes = await client.delete({ collection_name: chunksCollection, ids: staleKeys });
      assertMutationOk(deleteRes, "commitGeneration (delete stale chunks)");
    }

    const docRow = current.data[0];
    if (docRow) {
      const upsertRes = await client.upsert({
        collection_name: documentsCollection,
        data: [{ ...docRow, ingestion_generation: effectiveGeneration, updated_at: Date.now(), placeholder_vector: PLACEHOLDER_VECTOR }],
      });
      assertMutationOk(upsertRes, "commitGeneration (advance document generation)");
    }
    return { deletedStaleChunks: staleKeys.length };
  }

  async function deleteDocument(_ctx: unknown, documentId: string): Promise<DeleteDocumentResult> {
    const all = await client.query({
      collection_name: chunksCollection,
      filter: `document_id == "${escapeFilterString(documentId)}"`,
      output_fields: ["chunk_key"],
      limit: 16384,
      consistency_level: ConsistencyLevelEnum.Strong,
    });
    const keys = all.data.map((r) => r.chunk_key as string);
    if (keys.length > 0) {
      const deleteChunksRes = await client.delete({ collection_name: chunksCollection, ids: keys });
      assertMutationOk(deleteChunksRes, "deleteDocument (delete chunks)");
    }
    const deleteDocRes = await client.delete({ collection_name: documentsCollection, ids: [documentId] });
    assertMutationOk(deleteDocRes, "deleteDocument (delete document)");
    return { deletedChunks: keys.length };
  }

  async function denseSearch(
    _ctx: unknown,
    queryEmbedding: Float32Array,
    opts: DenseSearchOptions,
  ): Promise<SearchResult[]> {
    const res = await client.search({
      collection_name: chunksCollection,
      data: [Array.from(queryEmbedding)],
      anns_field: "embedding",
      limit: opts.topK,
      filter: opts.filter?.category
        ? `category == "${escapeFilterString(opts.filter.category)}"`
        : undefined,
      output_fields: CHUNK_OUTPUT_FIELDS,
      consistency_level: ConsistencyLevelEnum.Strong,
      // Explicit, not left to the SDK/server default - a search that
      // silently skipped not-yet-sealed ("growing") segment data would
      // reproduce the exact "can't find what I just wrote" symptom this
      // adapter was debugged against, for a completely different reason
      // than consistency level.
      ignore_growing: false,
    });
    const rows = (res.results as unknown as (ChunkRow & { score: number })[]) ?? [];
    return rows.map((row) => {
      const chunk = rowToChunk(row);
      return {
        chunkKey: chunk.chunkKey,
        documentId: chunk.documentId,
        score: row.score,
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
    const res = await client.search({
      collection_name: chunksCollection,
      data: [queryText],
      anns_field: "sparse_text",
      limit: opts.topK,
      output_fields: CHUNK_OUTPUT_FIELDS,
      consistency_level: ConsistencyLevelEnum.Strong,
      ignore_growing: false,
    });
    const rows = (res.results as unknown as (ChunkRow & { score: number })[]) ?? [];
    return rows.map((row) => {
      const chunk = rowToChunk(row);
      return {
        chunkKey: chunk.chunkKey,
        documentId: chunk.documentId,
        score: row.score,
        headingPath: chunk.headingPath,
        text: chunk.text,
        parentText: chunk.parentText,
        contextualizedText: chunk.contextualizedText,
      };
    });
  }

  async function getChunks(
    _ctx: unknown,
    refs: Array<{ documentId: string; chunkKey: string }>,
  ): Promise<KnowledgeChunk[]> {
    if (refs.length === 0) return [];
    const ids = refs.map((r) => r.chunkKey);
    const res = await client.query({
      collection_name: chunksCollection,
      filter: `chunk_key in [${ids.map((id) => `"${escapeFilterString(id)}"`).join(",")}]`,
      output_fields: CHUNK_OUTPUT_FIELDS,
      limit: ids.length,
      consistency_level: ConsistencyLevelEnum.Strong,
    });
    return (res.data as ChunkRow[]).map(rowToChunk);
  }

  async function health(_ctx: unknown): Promise<HealthResult> {
    const start = Date.now();
    try {
      await client.listCollections();
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
      client.count({ collection_name: documentsCollection }),
      client.count({ collection_name: chunksCollection }),
    ]);
    return {
      documentCount: Number(docCount.data),
      chunkCount: Number(chunkCount.data),
    };
  }

  async function verifyIntegrity(_ctx: unknown): Promise<IntegrityReport> {
    // duplicateChunkKeys is structurally 0: chunk_key is the collection's
    // primary key, so a second upsert with the same key replaces the row
    // rather than creating a duplicate. crossDocumentChunkKeyCollisions is
    // structurally 0 for the identical reason documented in
    // tursoAdapter.ts: chunk_key's hash bakes in documentUrl, making a real
    // collision cryptographically impossible by construction, not something
    // this method verifies at runtime.
    //
    // orphanChunks: best-effort, O(distinct document_ids) rather than O(1) -
    // Milvus has no foreign-key constraint and no cheap anti-join, so this
    // pulls every distinct document_id referenced by chunks and checks each
    // against the documents collection individually. Fine at this
    // project's scale (low hundreds of documents), not something to run on
    // a hot path.
    const chunkDocIds = await client.query({
      collection_name: chunksCollection,
      filter: "",
      output_fields: ["document_id"],
      limit: 16384,
      consistency_level: ConsistencyLevelEnum.Strong,
    });
    const distinctDocIds = [...new Set(chunkDocIds.data.map((r) => r.document_id as string))];
    const orphanDocIdSet = new Set<string>();
    for (const docId of distinctDocIds) {
      const found = await client.query({
        collection_name: documentsCollection,
        filter: `document_id == "${escapeFilterString(docId)}"`,
        output_fields: ["document_id"],
        limit: 1,
        consistency_level: ConsistencyLevelEnum.Strong,
      });
      if (found.data.length === 0) orphanDocIdSet.add(docId);
    }
    const orphanChunks = chunkDocIds.data.filter((r) =>
      orphanDocIdSet.has(r.document_id as string),
    ).length;

    return {
      duplicateChunkKeys: 0,
      crossDocumentChunkKeyCollisions: 0,
      orphanChunks,
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
