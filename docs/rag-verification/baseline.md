# UETGPT RAG Pipeline Verification Baseline

**Verification Date:** July 29, 2026  
**Git Branch:** `agent/2026-07-29-full-rag-verification`  
**Node Version:** >= 22.0.0  
**pnpm Version:** 11.1.3  
**Convex SDK Version:** 1.40.0  
**Framework:** Next.js 16.2.6, React 19.2.4  

---

## System Configuration Summary

- **Embedding Model:** `gemini-embedding-2` (768 dimensions, MRL normalized)
- **Primary Generator:** Groq `openai/gpt-oss-20b` / `openai/gpt-oss-120b`
- **Fallback Generator:** `gemini-3.5-flash-lite`
- **Reranker Chain:** `RERANKER_URL` (external cross-encoder) -> Cohere `rerank-v3.5` / `rerank-v4.0-fast` -> Local positional overlap
- **Vector Search Index:** `semanticCache.by_queryEmbedding` (dimensions: 768)

---

## Baseline Execution Status

- **Typecheck (`pnpm typecheck`):** PASS (0 errors)
- **Test Suite (`pnpm vitest run`):** 14 test files passed, 85 tests passed (0 failures)
- **Schema Validation:** 20 Convex tables, 1 vector index (768-dim), 2 full-text search indexes

---

## Frozen Query Baseline Samples

1. `"What is the current admission fee for UET Taxila?"`
   - Intent: `admissions`
   - Risk Class: `high_current`
   - Temporal Intent: `current`
2. `"When is the entry test date for Fall 2026?"`
   - Intent: `admissions`
   - Risk Class: `high_current`
   - Temporal Intent: `current`
3. `"What are the hostel fee details?"`
   - Intent: `campus_life`
   - Risk Class: `medium_current`
   - Temporal Intent: `current`
