# RAG Pipeline

> Implemented pipeline overview. Authoritative detail (stage internals, prompts,
> tuning constants) lives in `architecture.md` §5–§6. Keep this in sync with
> `convex/rag/` and `src/lib/llm-models.ts`.

## Stages

1. **Intent Classification** — Is the query on-topic (UET)?
2. **Query Rewriting** — Expand/refine the query for better retrieval
3. **HyDE** — Generate hypothetical document to improve embedding similarity
4. **Embedding** — Convert query → vector via the resilient Gemini embedding model
   (`gemini-embedding-2`, 768-d; multi-key rotation with 3x retry + exponential backoff)
5. **Semantic Cache** — Check for exact/similar previous queries (cosine threshold)
6. **Hybrid Search** — Vector search + full-text (BM25) → RRF fusion (k=60) + freshness decay + FAQ boost
7. **Context Assembly** — Sandwich strategy (high relevance → medium → low)
8. **LLM Generation** — Stream response via the fallback chain (Groq → Cerebras → Groq → Gemini)
9. **Cache Update** — Store response in the semantic cache (tiered TTL)

## Fallback Chain

Source of truth: `src/lib/llm-models.ts` (`LLM_FALLBACK_CHAIN`). Model IDs:

| Priority | Provider | Model ID | Use Case |
|---|---|---|---|
| 1 | Groq | `meta-llama/llama-4-scout-17b-16e-instruct` | Primary RAG |
| 2 | Cerebras | `gpt-oss-120b` | Speed fallback |
| 3 | Groq | `llama-3.1-8b-instant` | Fast fallback |
| 4 | Google Gemini | `gemini-2.5-flash` | Reliable fallback |

See `architecture.md` §5.2 for the full orchestration and selection logic.
