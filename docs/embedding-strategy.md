# Embedding Strategy

> **Authoritative source:** see [`architecture.md`](../architecture.md) §5 (RAG pipeline)
> and §6.6 / §11 (cache + dimensions). This page summarizes the *implemented*
> pipeline; do not hand-duplicate drift-prone numbers - defer to architecture.md
> and the code (`convex/rag/instance.ts`, `convex/schema.ts`, `convex/constants.ts`).

## Provider

- **Primary model:** Google Gemini `gemini-embedding-2`
  (configured in `convex/rag/instance.ts` as the resilient embedding model).
- **Dimensions:** **768** (`embeddingDimension: 768` in `convex/rag/instance.ts`;
  matched by the `vectorIndex("by_queryEmbedding", { dimensions: 768 })` in
  `convex/schema.ts`). This is the single most load-bearing constant in the RAG
  system - changing it requires a full re-embed and is treated as forbidden.
- **Resilience:** multi-key rotation across the configured Gemini API keys plus
  fallback handling, with 3× retry and exponential backoff + jitter
  (`convex/embeddings/generate.ts`). Batch API used for ≥2 texts.
- **Key rotation order:** `GEMINI_API_KEY` → `GEMINI_API_KEY_1` → `GEMINI_API_KEY_2` → `GOOGLE_GENERATIVE_AI_API_KEY`. First success wins; all fail → `ConvexError`. No cross-provider fallback (would break vector space compatibility).
- **Batch threshold:** `BATCH_THRESHOLD = 2` - texts below this use the single-call API; at or above use the batch API (50% discount).

## Vector Store

- Convex native `vectorIndex` (queried from actions only).
- Indexes:
  - RAG document/chunk embeddings are managed by the `@convex-dev/rag`
    component (indexed into the `crawledChunks` flow); see architecture.md §5/§6.
  - `semanticCache.by_queryEmbedding` (768d) - cached query embeddings
    (`convex/schema.ts`).

## Retrieval & Hybrid Search

- **Vector:** cosine similarity via `ctx.vectorSearch` / the RAG component.
- **Full-text:** Convex `searchIndex` over chunk content.
- **Fusion:** Reciprocal Rank Fusion (RRF). See architecture.md §5 and
  `convex/rag/retrieval.ts` for the live constants.

## Notes

- Embedding caching for repeat queries is implemented via the `semanticCache`
  table with tiered TTLs (see architecture.md §6.6 / §11), not a flat 24h TTL.
- Cost / rate-limit monitoring and alternative-model evaluation remain open
  operational concerns; track them in the issue tracker rather than as code TODOs
  here.
