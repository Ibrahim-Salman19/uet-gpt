# Embedding Strategy

## Provider

- **Primary:** Google Gemini `text-embedding-004`
- **Dimensions:** 768 (configured via `outputDimensionality`)
- **Fallback:** None (Gemini free tier sufficient for 1K RPD)

## Vector Store

- Convex native `vectorIndex` (actions only)
- Indexes:
  - `chunks.by_embedding` (768d) — document chunk embeddings
  - `semanticCache.by_queryEmbedding` (768d) — cached query embeddings

## Hybrid Search

- **Vector:** Cosine similarity via `ctx.vectorSearch`
- **Full-text:** Convex `searchIndex` on `chunks.content`
- **Fusion:** Reciprocal Rank Fusion (RRF, K=60)

## TODO

- [ ] Monitor embedding API costs and rate limits
- [ ] Add embedding caching for repeat queries
- [ ] Evaluate alternative embedding models (e.g. Cohere)
