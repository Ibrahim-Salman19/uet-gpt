# Track C — Groq Deadline Protection: Design & Diagnostic Record

**Branch:** `agent/2026-07-26-track-c-groq` (from snapshot commit `8c68db3`)
**Date:** 2026-07-26
**Deadline:** Groq shuts down `llama-3.3-70b-versatile` + `llama-3.1-8b-instant`
on **2026-08-16** (confirmed via Groq deprecations doc + user primary confirmation).
**Today:** 2026-07-26 — **21 days remaining**.

---

## 1. Deprecation facts (authoritative source: console.groq.com/docs/deprecations)

| Model | Shutdown | Official replacement |
|---|---|---|
| `llama-3.3-70b-versatile` | 2026-08-16 | `openai/gpt-oss-120b` or `qwen/qwen3.6-27b` |
| `llama-3.1-8b-instant` | 2026-08-16 | `openai/gpt-oss-20b` |
| `qwen/qwen3-32b` | 2026-07-17 (past) | `openai/gpt-oss-120b` |

Both dying Llama models are **alive today** (probed HTTP 200 on text/stream/json),
but will break on Aug 16.

---

## 2. Critical diagnostic finding: the 400s were a schema-format bug, NOT a model-capability defect

### Initial probe (json_object + naive json_schema) — MISLEADING
First qualification attempt used `response_format:{type:"json_object"}` and a
json_schema WITHOUT `additionalProperties:false`. Result: gpt-oss-20b/120b and
qwen3.6-27b all returned HTTP 400. **This falsely suggested the models lacked
structured output.**

### Diagnostic Test 1 — RAW strict schema (documented format)
Bypassed SDK/Zod/Convex. Sent the exact documented format:
`required: [...all fields...]` + `additionalProperties: false` on every object.

| Model | HTTP | Result |
|---|---|---|
| `openai/gpt-oss-20b` | **200** | `{"intent":"admissions","confidence":0.9}` ✅ |
| `openai/gpt-oss-120b` | **200** | `{"intent":"admissions","confidence":0.99}` ✅ |

**Conclusion: both gpt-oss models support strict JSON Schema.** The earlier 400s
were caused by (a) `json_object` mode exhausting the gpt-oss reasoning budget,
and (b) missing `additionalProperties:false`. This validates the operator
directive: "the HTTP 400 results do not prove the models lack structured output."

### Diagnostic Test 2 — AI SDK path (the real production integration)
Versions: `ai@6.0.198`, `@ai-sdk/groq@3.0.39`, `@ai-sdk/google@3.0.80`, `zod@4.4.3`.
Tested `generateObject` with the **exact production zod schemas** (made `.strict()`)
against 3 models × 4 schemas = **12 combinations**:

| Schema (production site) | gpt-oss-20b | gpt-oss-120b | gemini-3.5-flash-lite |
|---|---|---|---|
| intent (`routing.ts`) | ✅ 634ms | ✅ 804ms | ✅ 1430ms |
| crag (`crag.ts`) | ✅ 945ms | ✅ 789ms | ✅ 699ms |
| faithfulness (`faithfulness.ts`) | ✅ 525ms | ✅ 975ms | ✅ 690ms |
| rerank (`groqRerank.ts`) | ✅ 438ms | ✅ 741ms | ✅ 707ms |

**All 12 PASS.** Gemini 3.5-flash-lite is a tested cross-provider structured-output
fallback for every schema. The faithfulness judge correctly caught an unsupported
claim ("includes lab fees") with score 0.5 — proving schema-constrained judgment
quality, not just syntax.

---

## 3. Site inventory (8 backend `llama-3.1-8b` + frontend)

### Backend structured sites (4) — use `generateObject` + zod
| Site | Task | New primary | Fallback | Safe default |
|---|---|---|---|---|
| `routing.ts:42` | intent classify | **deterministic rules →** gpt-oss-20b strict | gemini-3.5-flash-lite strict | `UNKNOWN`/`general` |
| `crag.ts:61` | chunk relevance judge | **retrieval heuristics →** gpt-oss-20b strict | gemini-3.5-flash-lite strict | AMBIGUOUS (fail-open) |
| `faithfulness.ts:55` | answer grounding | **deterministic checks →** gemini-3.6-flash/gpt-oss-120b strict | cross-provider | `UNVERIFIED` |
| `groqRerank.ts:33` | rerank scoring | **REMOVE** (use dedicated reranker cascade) | Cohere → Tier-1 RRF | positional |

### Backend free-text sites (4) — use `generateText`
| Site | Task | New model |
|---|---|---|
| `routing.ts:72` | query rewrite (incl. Roman Urdu→English) | gpt-oss-20b |
| `routing.ts:104` | HyDE fallback (when no Gemini key) | gpt-oss-20b |
| `multiVector.ts:18` | alternate phrasings | gpt-oss-20b |
| `eval/runEval.ts:63` | relevance judge (manual JSON.parse) | gpt-oss-20b |

### Frontend answer-gen (Track C, lower priority)
| Site | Current | New |
|---|---|---|
| `src/lib/llm-models.ts:20` | `llama-3.3-70b-versatile` (primary) | gpt-oss-120b (primary) |
| `src/lib/llm-models.ts:21` | `llama-3.1-8b-instant` (secondary) | gpt-oss-20b (secondary) |
| `src/lib/chat/models.ts:28,29` | MODEL_MAPPING keys | update ids |
| `src/app/admin/.../settings/page.tsx` | defaults + dropdown | update |
| tests | hardcoded model ids | update |

### Dangling bug (separate)
`llama-4-scout` UI preference key in `main-shell.tsx`/`preferences-provider.tsx`/
`use-user-data.ts` — NOT in MODEL_MAPPING (silent no-op). Replace with a valid key.

---

## 4. Existing infrastructure leverage

The reranker cascade (`convex/reranking/cascade.ts`) already has:
- Tier 1: word-overlap + positional (deterministic, zero API)
- Tier 2: RERANKER_URL cross-encoder
- Tier 2b: `groqRerank` ← **REMOVE this** (the generative-JSON site)
- Tier 3: Cohere
- Final: Tier 1 combined

Removing `groqRerank` from the cascade (Tier 2b) deletes one structured-output
site entirely with **zero capability loss** — Cohere + Tier-1 RRF remain.

---

## 5. Implementation plan (ordered)

1. **Shared provider helper** (`convex/rag/modelRegistry.ts`): Groq primary →
   Gemini fallback for structured + free-text, with strict-schema enforcement.
2. **Schema fixes**: add `.strict()` to the 4 production zod schemas so they
   emit `additionalProperties:false` (the fix that resolved the 400s).
3. **Intent classifier**: add deterministic keyword rules (fee/merit/prospectus
   → admissions; datesheet/result → examinations; etc.) before the LLM call.
4. **CRAG + faithfulness**: swap model to gpt-oss-20b / 120b, add Gemini fallback.
5. **Reranker**: remove `groqRerank` from cascade Tier 2b (keep the action file
   but unwire it; or delete if unused elsewhere).
6. **Free-text sites**: migrate to gpt-oss-20b.
7. **Frontend answer-gen**: update `llm-models.ts` + `models.ts` + settings + tests.
8. **Schema-compat tests**: one test per production schema + startup capability probe.
9. **Fix dangling `llama-4-scout`** UI key.

## 6. Privacy constraint (from operator directive)
Gemini free-tier data may be used to improve Google products. Route ONLY public
UET documents + redacted eval data through Gemini fallback; never route sensitive
student queries (names/CNIC/emails/phones) through free-tier Gemini without an
approved privacy policy. For the structured-judge sites this is acceptable
(chunks are public web content); flag it in code comments.

## 7. NOT in scope for Track C
- No deploy, no Convex push, no `main` commit (branch only).
- No re-embed (embedding model untouched).
- Production rollout NO-GO until Phase 7 canary passes.
