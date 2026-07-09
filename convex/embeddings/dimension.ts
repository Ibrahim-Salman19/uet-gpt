/**
 * Single source of truth for the embedding vector dimension.
 *
 * INVARIANT (AGENTS.md): changing `embeddingDimension` corrupts the live vector
 * index and requires a full ($$$) re-embed. Do NOT change this value without a
 * coordinated re-embed of every crawledChunks vector AND the semanticCache
 * vector index (convex/schema.ts).
 *
 * The value 768 is fixed by the embedding model `gemini-embedding-2` (MRL
 * supports 768/1536/3072; we use 768). It MUST match:
 *   - the `outputDimensionality` sent to the Gemini API (embeddings/generate.ts)
 *   - the runtime dimensionality assert on query embeddings (embeddings/generate.ts)
 *   - the `dimensions` of `semanticCache.by_queryEmbedding` (schema.ts)
 *   - the @convex-dev/rag component's internal table dimension
 *
 * `schema.ts` declares a numeric literal for its vectorIndex because schema
 * definitions are static; a vitest (see dimension.test.ts) asserts this constant
 * stays 768 and that the two sites agree.
 */
export const EMBEDDING_DIMENSION = 768 as const;
