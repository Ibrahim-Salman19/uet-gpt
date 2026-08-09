# Track C — 0B-E Emergency Groq Model Substitutions: Verification Record

**Date:** 2026-07-28
**Scope:** Replace deprecated Groq models (`llama-3.1-8b-instant` and `llama-3.3-70b-versatile`) reaching EOL on August 16, 2026 across all backend RAG, reranking, routing, and UI settings paths.

---

## 1. Model Substitutions Map

| Component / File | Original Model ID | Replacement Model ID | Provider |
|---|---|---|---|
| `convex/rag/constants.ts` (CRAG & Faithfulness) | `llama-3.1-8b-instant` | `openai/gpt-oss-20b` | Groq |
| `convex/cache/multiVector.ts` | `llama-3.1-8b-instant` | `openai/gpt-oss-20b` | Groq |
| `convex/reranking/groqRerank.ts` | `llama-3.1-8b-instant` | `openai/gpt-oss-20b` | Groq |
| `convex/rag/routing.ts` (Classification & Rewrite) | `llama-3.1-8b-instant` | `openai/gpt-oss-20b` | Groq |
| `convex/eval/constants.ts` | `llama-3.1-8b-instant` | `openai/gpt-oss-20b` | Groq |
| `src/lib/chat/models.ts` (`MODEL_MAPPING`) | `llama-3.3-70b-versatile`, `llama-3.1-8b-instant` | `openai/gpt-oss-120b`, `openai/gpt-oss-20b` | Groq |
| `src/lib/llm-models.ts` (`LLM_FALLBACK_CHAIN`) | `llama-3.3-70b-versatile`, `llama-3.1-8b-instant` | `openai/gpt-oss-120b`, `openai/gpt-oss-20b` | Groq |
| `src/app/admin/(admin-shell)/settings/page.tsx` | `llama-3.3-70b-versatile`, `llama-3.1-8b-instant` | `openai/gpt-oss-120b`, `openai/gpt-oss-20b` | Groq |

---

## 2. Verification Summary

* TypeScript `tsc --noEmit`: **0 errors** (exit code 0).
* Vitest Unit Test Suite: **Passed**.
* Active Calls Check: Zero active references to `llama-3.1-8b-instant` or `llama-3.3-70b-versatile` remain in execution paths.
