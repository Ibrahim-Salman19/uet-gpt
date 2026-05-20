# RAG Pipeline

## Stages

1. **Intent Classification** — Is the query on-topic (UET)?
2. **Query Rewriting** — Expand/refine the query for better retrieval
3. **HyDE** — Generate hypothetical document to improve embedding similarity
4. **Embedding** — Convert query → vector (Gemini API)
5. **Semantic Cache** — Check for exact/similar previous queries
6. **Hybrid Search** — Vector search + full-text search → RRF fusion
7. **Context Assembly** — Sandwich strategy (high relevance → medium → low)
8. **LLM Generation** — Stream response via fallback models (Groq → Cerebras → Gemini)
9. **Cache Update** — Store response in semantic cache

## Fallback Chain

| Priority | Provider | Model | Use Case |
|---|---|---|---|
| 1 | Groq | Llama 4 Scout | Primary RAG |
| 2 | Cerebras | Llama 3.3 70B | Speed fallback |
| 3 | Groq | Llama 3.1 8B | Fast fallback |
| 4 | Gemini | 1.5 Flash | Reliable fallback |

## TODO

- [ ] Add evaluation benchmarks for each pipeline stage
- [ ] Implement streaming progress indicators in UI
- [ ] Add retry logic for embedding generation failures
