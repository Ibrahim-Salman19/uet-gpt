# UETGPT Full-Stack RAG Verification Report

**Date:** 2026-08-02
**Status:** Investigation complete; fixes applied to source (deploy blocked)
**Scope:** Stages A–H audit of the UET Taxila crawl → RAG ingestion → retrieval pipeline

---

## Executive Summary

The pipeline successfully **crawled and ingested 992 documents** from `web.uettaxila.edu.pk`, but **no retrieval ever occurred in production**. Diagnostic investigation identified three root causes:

1. **Silent embedding-failure bug** — hard-failing chunks were dropped without a DLQ record, permanently stranding documents in `processing` status, which is excluded from retrieval.
2. **No code path exercised search** — zero `Search Queries` were ever executed (Convex dashboard: `0 / 3000 Query-GB`), so even successfully indexed docs were never retrieved.
3. **Storage quota exhaustion** — triple-stored chunk text blew through the 512 MB free-tier limit (795 MB used), making the dataset unserveable and blocking re-crawl.

All three are **in progress or fixed in source** but not deployed (Convex CLI auth unavailable: `401 MissingAccessToken` on `npx convex deploy`).

---

## 2. Stage F Crawl Numbers (production run)

Log: `audit/stage-f-full-crawl.log` (10h24m, interrupted gracefully at 12:00 UTC).

| Metric | Value |
|---|---|
| URLs attempted | 1396 |
| Fetched (HTTP 200) | 1126 |
| **Pushed (ingested)** | **992** |
| Skipped (robots/filter) | 121 |
| Failed | 283 |
| Dead-lettered | 16 |
| Duration | 10h 24m |
| Queue rate | ~26.9 s/url |

Backend ledger: `crawl_runs=6`, `crawl_urls=4111`, `crawl_discoveries=40327`, `crawl_events=13059`.

---

## 3. Root Causes

### RC1 — Silent Embedding Failures Strand Docs in `processing`

**Location:** `convex/crawl/mutations.ts` → `routeChunkResult` (formerly `convex/crawl/actions.ts`'s embedSingleChunk / MQG `onComplete` handler).

On hard failure (Workpool retries exhausted, `result.kind === "failed"`, `returnValue === null`), the `else if (url && documentId)` branch in `routeChunkResult` could never fire because both values came only from `returnValue`, which is `null`. The failure was **silently swallowed**:

- No `crawlDeadLetter` row created.
- No `documents` failure transition.
- Document remained in `processing`.

`convex/shared/freshnessPolicy.ts` lists only `active`/`indexed` as retrieval-eligible, so `processing` docs are **invisible to search**. Embedding failures therefore appear to "complete" but never produce retrievable data. This is the closest in-tree explanation for "no retrieval" during the earlier Stage D/E tests.

**Fix (applied to source, not deployed):**
- Extend the workpool `context` to carry `documentId` + `url` at all three enqueue sites (`enqueueNewChunks`, DLQ retry, `enqueueDocumentChunks`).
- `routeChunkResult` now derives `url`/`documentId` from context (not only `returnValue`), so hard failures with `returnValue === null` still route to `handleEmbeddingFailure` → documented failure accounting.
- `onChunkEmbedded` arg validator extended: `{ jobId, url?, documentId? }`.

### Bug2 — No Search Code Path in Production

**Evidence:** `Search Queries = 0 Query-GB` on the Convex dashboard.

Backend search exists (`convex/embeddings/search.ts` → `searchDocumentsAction`; full-text via `crawledChunks.search_text`), but it's only reachable through the chat pipeline's `(classifyQueryRisk/shouldAbstain...)` guarded path in `convex/rag/retrieval.ts`. Nothing in the 992-doc crawl triggered it. `convex/rag/smokeRetrieval.ts` exists but is not invoked by any cron/frontend.

**Remaining:** add an automated retrieval smoke test (scheduled or on-deploy) so the pipeline is exercised end-to-end after any crawl, not only when a user chats.

### Bug3 — Storage Bloat from Triple-Stored Text

Backend RAG schema triple-stored the same chunk text:

- `crawledChunks.parentText` (copied onto every child chunk)
- `crawledChunks.contextualizedText`
- `crawledChunks.text` + RAG component `chunks(embedding, searchableText)` rows

Convex usage at stop-of-crawl (free tier):

| Resource | Used | Limit |
|---|---|---|
| Database Storage | 795.35 MB | 512 MB |
| Database I/O | 1.98 GB | 1 GB |
| Data Egress | 4.43 GB | 1 GB |
| Function Calls | 380 K | 1 M |
| Action Compute | 13 GB-h | 20 GB-h |
| Search Queries | **0** | 3000 GB |

**Recommendation:** keep parent text single (parent-centric `chunkParents`, drop per-child `parentText` copies) — Contextual Retrieval guidance; decide store only the contextualized prefix + vector, not full parent duplicates.

---

## 4. Stage E Retrieval Weak Model (local prep only)

Because the new reproducible evaluator (`scripts/stage_e_retrieval_eval.py`) requires the **corpus export** (added `convex/crawl/exportCorpus.ts` GET `/api/export/corpus`) to run against backend chunks — and deploys are blocked — Stage E reference numbers remain from the earlier proxy run (16 docs / 42 chunks, `audit/stage-e-retrieval.json`): **AVG Recall@5 = 0.535, MRR@5 = 0.575**. These are superseded by the new evaluator design (real Gemini embeddings, backend chunking parity, MRR/MAP/nDCG at cutoffs 1/3/5/10, `chunk_markdown_fallback`).

---

## 5. Fixes Applied vs. Not Applied (blocked)

| Action | State |
|---|---|
| Route chunk-result failure → DLQ (the defect fix) | Applied, not deployed |
| Corpus export endpoint `/api/export/corpus` | Written, not deployed (generated API + HTTP route pending codegen) |
| Search smoke harness | Not implemented |
| Storage dedup / parent single-source | Not implemented (schema change = re-embed, blocked) |
| Rerun Stage E against backend | Blocked on deploy |

---

## 6. Open Risk Register

| Risk | Severity | Mitigation |
|---|---|---|
| CVEX deploy unauth (401) | High — all fixes and eval pending | `npx convex login`, re-deploy |
| Free-tier storage 155% over | High | parent-source dedup + ingest new crawl |
| No periodic search health check | Medium | scheduled smoke retrieval |
| Embedding retries non-exponential (4/8/16/32/64s) | Low | feedback loop fine |
| Gemini 429 tail-level (sparse queue) | Low | already has exponential backoff |

---

## 7. Conclusions

- Crawl/invest is operator: 992 docs ingested = the biggest single truth.
- Retrieval never ran: two independent + confirmed causes (silent embeds + zero search path).
- Fixes are prepared but **deploys blocked on Convex credentials**; unblocking unblocks full res of both.
- Storage quapping is the physical blocker to further ingestion.

**Recommended next action:** user runs `npx convex login`, then `npx convex dev`/`deploy` to ship the DLQ routing fix + export endpoint; then rerun `scripts/stage_e_retrieval_eval.py` against the corpus export; then apply storage dedup.

---

## 8. Full File Virtual Map

| File | Role |
|---|---|
| `convex/crawl/mutations.ts` | ingestion chains, DLQ, failure routing (fixed) |
| `convex/crawl/exportCorpus.ts` | corpus export endpoint (new, un-deployed) |
| `convex/http.ts` | route registration for `/api/export/corpus` |
| `convex/embeddings/search.ts` | `searchDocumentsAction` (backend retrieval) |
| `convex/rag/retrieval.ts` | chat-path retrieval guards |
| `scripts/stage_e_retrieval_eval.py` | reproducible retrieval evaluator |
| `audit/stage-f-full-crawl.log` | full production crawl log (10.4h) |
| `audit/stage-e-retrieval.json` | prior proxy eval numbers |