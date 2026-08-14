import { DataType, FunctionType, MetricType, type MilvusClient } from "@zilliz/milvus2-sdk-node";
import { EMBEDDING_DIMENSION } from "../embeddings/dimension";

// Zilliz/Milvus schema for the KnowledgeStore contract (see zillizAdapter.ts).
// Verified empirically against a real free-tier Zilliz Cloud cluster before
// being relied on here - every field/function/index shape below is
// exercised by the adapter's contract tests, not just docs-derived.
//
// Two structural differences from tursoSchema.sql, both forced by Milvus's
// data model rather than chosen for their own sake:
//
// 1. No JOINs. tursoSchema.sql dedupes parent text into a separate
//    chunk_parents table keyed by (document_id, content_hash) and joins it
//    back in on read. Milvus has no join primitive, so parent_text and
//    contextualized_text are stored directly on each chunk row instead -
//    denormalized/duplicated across children sharing one parent, trading
//    some storage for avoiding a second round-trip on every read. Empty
//    string is the "no parent" sentinel (Milvus VarChar upsert semantics
//    make a real NULL awkward to round-trip consistently across insert vs
//    upsert vs query), not null/undefined.
//
// 2. Every Milvus collection MUST declare a primary key AND at least one
//    vector field - confirmed directly against the installed SDK's own
//    docs (milvus-io/milvus-docs: "you must define a schema that includes
//    at least one primary key field and one vector field"), not assumed.
//    DOCUMENTS has no real vector data of its own (it is pure metadata,
//    mirroring documents in both other adapters), so it carries a
//    2-dimensional placeholder vector that is written once at insert time
//    and never searched, purely to satisfy this constraint.
//
// Both collections are created with consistency_level: "Strong" - Milvus's
// documented default is "Bounded" staleness (docs.zilliz.com/docs -
// milvus-docs/reference/tune_consistency: "Bounded being the default level
// of consistency"), which does NOT guarantee a query/search immediately
// after a write observes that write. This was caught empirically, not
// assumed: the first contract-suite run against a real cluster failed 6 of
// 10 tests, every one of them a read-immediately-after-write pattern (e.g.
// commitGeneration's own stale-chunk query not seeing the just-upserted
// row), while the two other adapters' equivalent operations are always
// strongly consistent. "Strong" trades search/query latency for the
// read-your-writes guarantee the KnowledgeStore contract otherwise assumes
// - a real, deliberate cost worth measuring explicitly in the benchmark's
// latency numbers, not a free correctness fix.
//
// Collection names are parameterized (not hardcoded) so the contract-test
// suite can run against disposable *_test collections without sharing
// state with - or burning free-tier collection quota alongside - the real
// benchmark corpus's collections. Free tier caps at 5 collections total;
// documents+chunks (real) + documents_test+chunks_test (contract suite) is 4.
export const DEFAULT_DOCUMENTS_COLLECTION = "knowledge_documents";
export const DEFAULT_CHUNKS_COLLECTION = "knowledge_chunks";

const PLACEHOLDER_VECTOR_DIM = 2;
export const PLACEHOLDER_VECTOR = [0, 0];

export async function ensureZillizSchema(
  client: MilvusClient,
  documentsCollection: string = DEFAULT_DOCUMENTS_COLLECTION,
  chunksCollection: string = DEFAULT_CHUNKS_COLLECTION,
): Promise<void> {
  const hasDocuments = await client.hasCollection({ collection_name: documentsCollection });
  if (!hasDocuments.value) {
    await client.createCollection({
      collection_name: documentsCollection,
      consistency_level: "Strong",
      fields: [
        { name: "document_id", data_type: DataType.VarChar, is_primary_key: true, max_length: 64 },
        { name: "canonical_url", data_type: DataType.VarChar, max_length: 2048 },
        { name: "title", data_type: DataType.VarChar, max_length: 1024 },
        { name: "content_hash", data_type: DataType.VarChar, max_length: 128 },
        { name: "indexing_fingerprint", data_type: DataType.VarChar, max_length: 128 },
        { name: "category", data_type: DataType.VarChar, max_length: 128 },
        { name: "ingestion_generation", data_type: DataType.Int64 },
        { name: "created_at", data_type: DataType.Int64 },
        { name: "updated_at", data_type: DataType.Int64 },
        // Never searched - see the module doc comment above.
        { name: "placeholder_vector", data_type: DataType.FloatVector, dim: PLACEHOLDER_VECTOR_DIM },
      ],
      index_params: [
        { field_name: "placeholder_vector", index_type: "AUTOINDEX", metric_type: MetricType.L2 },
      ],
    });
  }
  await client.loadCollectionSync({ collection_name: documentsCollection });

  const hasChunks = await client.hasCollection({ collection_name: chunksCollection });
  if (!hasChunks.value) {
    await client.createCollection({
      collection_name: chunksCollection,
      consistency_level: "Strong",
      fields: [
        { name: "chunk_key", data_type: DataType.VarChar, is_primary_key: true, max_length: 128 },
        { name: "document_id", data_type: DataType.VarChar, max_length: 64 },
        { name: "ingestion_generation", data_type: DataType.Int64 },
        { name: "ordinal_within_heading", data_type: DataType.Int64 },
        { name: "heading_path", data_type: DataType.VarChar, max_length: 2048 }, // JSON-encoded string[]
        {
          name: "chunk_text",
          data_type: DataType.VarChar,
          max_length: 65535,
          enable_analyzer: true, // required for the BM25 function below to tokenize it
        },
        { name: "embedding", data_type: DataType.FloatVector, dim: EMBEDDING_DIMENSION },
        { name: "sparse_text", data_type: DataType.SparseFloatVector }, // BM25-function-derived, never written directly
        { name: "parent_text", data_type: DataType.VarChar, max_length: 16384 }, // "" sentinel for none
        { name: "contextualized_text", data_type: DataType.VarChar, max_length: 16384 }, // "" sentinel for none
        { name: "category", data_type: DataType.VarChar, max_length: 128 },
        { name: "created_at", data_type: DataType.Int64 },
      ],
      functions: [
        {
          name: "chunk_text_bm25",
          type: FunctionType.BM25,
          input_field_names: ["chunk_text"],
          output_field_names: ["sparse_text"],
          params: {},
        },
      ],
      index_params: [
        { field_name: "embedding", index_type: "AUTOINDEX", metric_type: MetricType.COSINE },
        { field_name: "sparse_text", index_type: "SPARSE_INVERTED_INDEX", metric_type: MetricType.BM25 },
      ],
    });
  }
  await client.loadCollectionSync({ collection_name: chunksCollection });
}
