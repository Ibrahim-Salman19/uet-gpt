# RAG Subsystem Ownership & Classification Matrix

| Component File | Category | Lead Owner | Security Status |
|---|---|---|---|
| `convex/embeddings/generate.ts` | `EMBEDDING` | Embedding Team | Approved |
| `convex/embeddings/dimension.ts` | `EMBEDDING` | Embedding Team | Approved |
| `convex/embeddings/contextualize.ts` | `EMBEDDING` | Embedding Team | Approved |
| `convex/embeddings/search.ts` | `VECTOR_RETRIEVAL` | Retrieval Team | Approved |
| `convex/rag/routing.ts` | `ROUTING` | RAG Core | Approved |
| `convex/rag/context.ts` | `CONTEXT_BUILDING` | RAG Core | Approved |
| `convex/rag/crag.ts` | `CRAG` | RAG Core | Approved |
| `convex/rag/faithfulness.ts` | `EVIDENCE_GATE` | RAG Core | Approved |
| `convex/rag/prompts.ts` | `GENERATION` | RAG Core | Approved |
| `convex/rag/constants.ts` | `ROUTING` | RAG Core | Approved |
| `convex/rag/retrieval.ts` | `HYBRID_RETRIEVAL` | Retrieval Team | Approved |
| `convex/reranking/rerank.ts` | `RERANKING` | Retrieval Team | Approved |
| `convex/reranking/cascade.ts` | `RERANKING` | Retrieval Team | Approved |
| `convex/cache/validate.ts` | `CACHE` | Cache Team | Approved |
| `convex/crawl/staleness.ts` | `TEMPORAL_GOVERNANCE` | Governance Team | Approved |
| `convex/crawl/mutations.ts` | `INGESTION` | Ingestion Team | Approved |
| `convex/schema.ts` | `SCHEMA` | Backend Lead | Approved |
| `convex/crons.ts` | `SCHEDULING` | SRE Team | Approved |
