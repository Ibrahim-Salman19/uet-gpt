# Embedding Strategy

> **Authoritative source:** see [`docs/audit/ARCHITECTURE.md`](audit/ARCHITECTURE.md) (the
> "Discovery → Answer pipeline" diagram covers the RAG/cache/dimension flow this page
> summarizes) — corrected 2026-09-10: the previous link to a root-level `architecture.md` with
> §5/§6.6/§11 numbering was dead (no such file, and no such numbering, exists in the repo).
> `docs/audit/ARCHITECTURE.md` is itself a dated 2026-07-26 snapshot, not a live doc — see its
> own 2026-09-10 note for what's since drifted. This page summarizes the *implemented* pipeline;
> do not hand-duplicate drift-prone numbers - defer to `docs/audit/ARCHITECTURE.md` and the code
> (`convex/rag/instance.ts`, `convex/schema.ts`, `convex/constants.ts`). The code is the source
> of truth for what's actually live — docs describe intent and should be re-verified against real
> callers, not trusted at face value; see the correction section in
> `docs/rag-verification/final-production-verdict.md` for an example of where this drifted.

> **Correction (2026-09-13):** everything below this point describes the **semantic-cache**
> embedding path accurately and unconditionally (confirmed: Gemini `gemini-embedding-2` @ 768-d,
> used for cached query embeddings regardless of backend). It does **not** currently describe the
> **corpus dense-retrieval** path: a live check of the production Convex deployment's env store
> confirmed `KNOWLEDGE_STORE_BACKEND=pinecone`, with `CLOUDFLARE_ACCOUNT_ID`/
> `CLOUDFLARE_API_TOKEN`/`PINECONE_API_KEY` all present and configured. Corpus retrieval in
> production therefore runs in a separate, non-768-d Cloudflare-embedding vector space, not the
> Gemini/Convex-native path this page's "Vector Store" section describes. See
> `docs/SHIP.md`'s Step 4 correction note and `docs/rag-store-evaluation/INDEPENDENT_REVIEW.md`'s
> correction note for the same finding.
>
> **Contextual retrieval coverage (2026-09-14):** a read-only sample of production `crawledChunks`
> found `contextualizedText` on 70 of the newest 1,000 rows and on 0 of the oldest 1,000. The
> Pinecone dense vectors were embedded from raw chunk `text`. So the `search_contextualized_text`
> BM25 channel (added 2026-09-13) is wired and correct, but it currently reaches only a small
> minority of the corpus. Don't treat it as an effective contextual-retrieval channel until
> coverage rises.

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
