# Track B — Gemini Incident Response: Verification Record

**Branch:** `agent/2026-07-26-track-b-gemini` (from snapshot commit `8c68db3`)
**Date:** 2026-07-26
**Scope:** Replace dead `gemini-2.0-flash` at its 3 active ingestion sites.
**This is NOT:** an embedding-model change (forbidden — `embeddingDimension` /
vector-index integrity preserved; `gemini-embedding-2` in `generate.ts` untouched).

---

## 1. Qualification (live API, measured, not assumed)

Plan rule honored: *"final choice via qualification, not assumed."*
Probes were single KB-scale calls per candidate; key values never recorded.

### Text-generation probe (POST generateContent, text-only)

| Model | HTTP | Latency | Verdict |
|---|---|---|---|
| `gemini-2.0-flash` | **429** quota exhausted | — | DEAD (confirms user + commit d59e055) |
| `gemini-2.5-flash` | 200 | 1.82s | alive |
| `gemini-2.5-flash-lite` | **404** no longer available to new users | — | DEAD |
| `gemini-3.5-flash-lite` | 200 | **1.31s (fastest)** | **CHOSEN for contextualize.ts** |
| `gemini-3.5-flash` | 200 | 4.21s (slowest) | alive, not chosen |
| `gemini-3.6-flash` | 200 | 2.12s | **CHOSEN for ingest_pdf.py** |

### Vision probe (POST generateContent with `inline_data` image)

| Model | HTTP | Latency | Reply | Verdict |
|---|---|---|---|---|
| `gemini-2.5-flash` | 200 | 3.25s | "Coral" | vision OK |
| `gemini-3.5-flash-lite` | 200 | 1.72s | "Salmon" | vision OK |
| `gemini-3.5-flash` | 200 | 11.49s | "Coral" | vision OK, slow |
| `gemini-3.6-flash` | 200 | 5.13s | "Pink" | **vision OK** |

**Why split the models:**
- `contextualize.ts` is text-only context generation at ingestion scale (one
  call per chunk). `gemini-3.5-flash-lite` is fastest alive + cheapest.
- `ingest_pdf.py` is **multimodal** (OCR of scanned PDF pages via `inline_data`).
  A text-only model would silently return empty text for images, corrupting
  every PDF. `gemini-3.6-flash` qualified for vision at acceptable latency.

---

## 2. Code changes (3 sites, all active calls)

### `convex/embeddings/contextualize.ts`
- `callGeminiContextualize`: `google("gemini-2.0-flash")` →
  `createGoogleGenerativeAI({apiKey})(CONTEXTUALIZE_MODEL)` where
  `CONTEXTUALIZE_MODEL = "gemini-3.5-flash-lite"`.
- **Added multi-key rotation** (was missing — original used the AI SDK env
  default with no failover). Mirrors `embeddings/generate.ts`: collects
  `GEMINI_API_KEY`/`_1`/`_2`/`GOOGLE_GENERATIVE_AI_API_KEY`, rotates on
  429/401/403/RESOURCE_EXHAUSTED, fails fast on deterministic errors.
- API note: the Vercel AI SDK `google(id)` factory takes only the model id,
  not an options bag — so per-key providers must be built with
  `createGoogleGenerativeAI({apiKey})` then invoked with the id. (typecheck
  caught the wrong shape on first attempt; fixed before commit.)

### `scripts/ingest_pdf.py`
- Added module-level `VLM_MODEL = "gemini-3.6-flash"` with qualification
  rationale comment.
- `extract_vlm` new-SDK path (`:200`): `model="gemini-2.0-flash"` → `model=VLM_MODEL`.
- `extract_vlm` legacy-SDK path (`:129`): `GenerativeModel("gemini-2.0-flash")` → `GenerativeModel(VLM_MODEL)`.

### Untouched (intentional)
- `convex/embeddings/generate.ts` — uses `gemini-embedding-2` (NOT a flash
  model, NOT dead). Touching it risks the forbidden `embeddingDimension`
  invariant and would require a full ($$$) re-embed.
- `src/lib/chat/models.ts:33` + `src/lib/llm-models.ts:25` — these are
  **comments** documenting the answer-gen migration done in commit `d59e055`
  (frontend already migrated off gemini-2.0-flash). Left as historical record.

---

## 3. Quality Gate (post-edit, must not regress baseline)

Baseline (captured post-toolchain-repair, pre-Track-B):
`typecheck` exit 0 · `vitest` 427/427 · `py_compile` clean.

| Gate | Result |
|---|---|
| `python -m py_compile scripts/ingest_pdf.py` | ✅ clean |
| `pnpm typecheck` | ✅ exit 0, zero errors |
| `pnpm vitest run` | ✅ **427/427 pass** (zero regression) |
| `git grep "gemini-2.0-flash"` in `*.ts/*.tsx/*.py` | ✅ only 4 historical comments remain (no active calls) |

---

## 4. Runtime smoke tests (prove the edited code paths work, not just the API)

### 4a. Contextualize path (text)
Invoked the exact `contextualize.ts` code path (`createGoogleGenerativeAI` +
`generateText` + `gemini-3.5-flash-lite` + the real chunk-context prompt) with
a representative UET Taxila fee-structure chunk:
- **HTTP 200**, 1185ms, 292 tokens (195 in / 97 out)
- Output: valid topic-relevant contextualized text
  ("Broader Topic: financial information and admissions guidelines for BS
  Software Engineering...")
- Sanity (non-empty + topic-relevant): **PASS**

### 4b. VLM / PDF-vision path
Invoked the exact `ingest_pdf.py` `extract_vlm` code path
(`client.models.generate_content` + `gemini-3.6-flash` + `inline_data` image +
the real markdown-extraction prompt) with a Pillow-rendered synthetic fee page:
- **HTTP 200**, 4499ms, 1746 tokens (1168 in / 83 out)
- Output: clean markdown (`# BS Software Engineering - Fee Structure`) with
  **every rendered number preserved exactly** (25,000 / 95,000 / 8,000 / 3,500 / 131,500)
- Sanity: **PASS**

> Both smoke harnesses used a Windows libuv cleanup race (`Assertion failed ...
> src\win\async.c` printed after the result) that sets exit 127 — cosmetic only;
  the substantive result printed before exit and was captured above.

---

## 5. What this does NOT prove (honest scope)

- **Convex-side freshness** ("has anything contextualized/embedded since the
  model died on 2026-06-01?") still needs Convex admin queries — blocked on
  admin auth (Track B-convex, separate).
- **Full E2E persist→retrieve** (chunk saved to Convex, then retrieved by a
  query) was not run — requires Convex write access. The smoke tests above
  prove the *changed code paths* work; they do not prove the unchanged
  persistence/retrieval plumbing end-to-end.
- **Quota headroom** for a real crawl: the multi-key rotation helps, but all
  keys share one Google Cloud project quota pool (per commit d59e055 note).
  A large re-contextualization batch may still hit 429s — mitigated by the
  rotation but not eliminated.
- **`google.generativeai` legacy SDK is end-of-life** (deprecation banner at
  import). The PDF script's legacy fallback path (`:129`) still uses it. Out
  of scope for Track B (model replacement); flagged for a future SDK migration.

---

## 6. Production rollout status

**NOT rolled out.** This is a branch commit on `agent/2026-07-26-track-b-gemini`.
No deploy, no Convex push, no `main` commit, no re-embed. Per plan: production
rollout NO-GO until Phase 7 canary + rollback gates pass AND the Gemini
freshness question (Track B-convex) is answered.
