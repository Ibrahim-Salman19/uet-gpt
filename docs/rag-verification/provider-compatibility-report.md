# Provider Compatibility & Contract Audit Report

**Date:** July 29, 2026  
**Auditor:** Principal RAG Architect & SRE Lead  

---

## 1. Gemini Embedding 2 Contract Audit
- **Model ID:** `gemini-embedding-2`
- **Output Dimensionality:** Fixed 768 (MRL normalized)
- **`task_type` Audit:** Confirmed `task_type` parameter is NOT sent to API (compatible with Google July 2026 specs).
- **Prefix Instructions:** Query prefix `"Represent this university-information question for retrieving passages that answer it:"` and Document prefix `"Represent this official university source passage for retrieval by questions it can answer:"` established.
- **Runtime Assertions:** `assertEmbeddingDimension` and `assertFiniteVector` added to `convex/embeddings/generate.ts`.

---

## 2. Gemini Generation Request Audit
- **Model IDs:** `gemini-3.5-flash-lite`, `gemini-3.1-flash-lite`.
- **Sampling Parameters Audit:** Sampling params (`temperature`, `top_p`, `top_k`) removed from production pathways per July 21, 2026 Gemini deprecation guidelines.
- **Model Aliases:** Deprecated `latest` aliases avoided in production configs.

---

## 3. Groq Route Audit
- **Supported Active Models:** `openai/gpt-oss-20b` (primary classifier & CRAG judge), `openai/gpt-oss-120b` (large generator).
- **Shutdown Model Search:** Checked for `llama-3.1-8b-instant`, `llama-3.3-70b-versatile`, `qwen/qwen3-32b`, `meta-llama/llama-4-scout-17b-16e-instruct` across all code paths. Zero references found in active routes.
- **Strict Structured Outputs:** Non-streaming calls (`generateObject`) used for classification and CRAG; streaming responses kept unconstrained by strict JSON schemas.

---

## 4. Cohere Reranker Audit
- **Active Fallback Model:** `rerank-v3.5` (updated in `CASCADE_CONFIG.cohereModel`).
- **Reranker Timeout:** 5,000 ms strict deadline enforced per tier.
- **Fallback Chain:** External Cross-Encoder -> Groq lightweight reranker -> Cohere `rerank-v3.5` -> Local positional overlap.
