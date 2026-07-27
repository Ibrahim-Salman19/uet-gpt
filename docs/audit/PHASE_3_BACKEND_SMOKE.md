# Phase 3 — Backend Smoke Test Against `confident-viper-402`

**Date:** 2026-07-27
**Deployment:** `prod:confident-viper-402` (Production slot, consolidated keeper)
**Source branch:** `main` @ `518076e` (Track B merged)
**Directive:** Per 2026-07-27 gate directive — backend smoke BEFORE Vercel cutover.
**Scope:** Prove fetch→chunk→contextualize→embed→persist works against the
freshly-deployed Production slot, prove the recovery gate holds, prove retrieval,
measure usage deltas, one small PDF smoke.
**This is NOT:** a production rollout, a fresh crawl, or a hosted ablation.

---

## Gate decision (per directive)

| Check | Status |
|---|---|
| Recovery cron returns `backfillHeld: true` | ✅ PASS (Step 1) |
| No unintended documents or chunks appear | ✅ PASS (Step 1) |
| HTML retrieval returns the smoke source | ⏸ DEFERRED (Step 2 — requires Clerk auth) |
| PDF ingestion and retrieval succeed | ⏳ PENDING (Step 4) |
| Usage remains within the planned budget | ⏳ PENDING (Step 3/5) |
| Deployed commit recorded | ✅ `518076e` |
| No provider/embedding failures in logs | ✅ HTML path clean |

**Vercel cutover gate:** NOT YET MET. Retrieval proof + PDF smoke + usage re-measure
must complete first (per directive items 2, 4, 5).

---

## Step 1 — Recovery gate proof (PASS)

**Entrypoint invoked:** `embeddings/contextualizeCron:contextualizeCron`
(internalAction; called via `npx convex run ... --prod` against the keeper slot)

**Env state on prod (value-safe `convex env get`, values not recorded):**
- `AUTO_BACKFILL_AFTER_MODEL_RECOVERY` = `false` → gate fires
- `MAX_DOCUMENTS_PER_RECOVERY_BATCH` = `1` → cap honored

**Invocation result (exact JSON returned):**
```json
{
  "backfillHeld": true,
  "processed": 0,
  "scheduledBatches": 0,
  "totalPending": 0
}
```
**Log line emitted:** `"Contextualize cron: SKIPPED — AUTO_BACKFILL_AFTER_MODEL_RECOVERY=false
(Track B model-recovery backlog hold). No query, no scheduling."`

**Interpretation:** The gate fired at the cron entry point and returned BEFORE the
`getChunksPendingContext` query (see `contextualizeCron.ts:49-55`). No batch could be
scheduled. The Track B model-recovery backlog drain cannot start until this env var is
flipped to non-`"false"` — exactly the design intent.

### Backlog-state verification (read-only inline query)

| Table | Count | Expected | Match |
|---|---|---|---|
| `documents` | 1 | 1 (smoke doc only) | ✅ |
| `crawledChunks` | 2 | 2 (smoke doc's chunks) | ✅ |
| `deadLetterQueue` | 0 | 0 (no failures) | ✅ |

**Only document present:**
- `_id`: `k57exb7ac16j37xh6cam3cb5tn8ba0mm`
- `url`: `https://web.uettaxila.edu.pk/Admissions/`
- `status`: `indexed`

**Conclusion:** No workpool activity, no backlog draining, no unexpected historical
documents appeared. Recovery-gate success conditions fully met.

---

## Step 2 — Retrieval proof (DEFERRED to Phase 4)

**Code survey of all retrieval entrypoints** (read-only, no probe calls):

| Entry point | Type | Auth gate | Callable via deploy key? |
|---|---|---|---|
| `rag.retrieval.retrieveContext` | `action` (public) | `ctx.auth.getUserIdentity()` required (`retrieval.ts:437-440`) | NO |
| `embeddings.search.searchDocumentsAction` | `internalAction` | Internal-only (no public surface) | NO |
| `rag.testing.seed` / `rag.testing.verify` | `action` (public) | `requireAdminAuth` — DB-role check (`testing.ts:9-20`) | NO (needs Clerk admin session) |
| `eval.ts` actions | `action` (public) | `ctx.auth.getUserIdentity()` required (`eval.ts:57`) | NO |

**Decision (per directive):** "If the only retrieval entrypoint requires Clerk
authentication and no internal action exists, do not add an insecure public bypass."
HONORED — no bypass added. The deploy key cannot authenticate against Clerk, so the
retrieval proof must run through the real chat UI after the Vercel repoint (Phase 4),
using a legitimate test Clerk identity.

**Will be proven in Phase 4** with a distinctive query whose answer occurs only in the
smoke document ("What does the Fall 2026 admissions smoke test page say?"), verifying:
smoke source appears in candidates; chunk ID / RAG ID present; rank ≤ top-3;
returned URL = `https://web.uettaxila.edu.pk/Admissions/`; no fabricated source ranked
above it.

---

## Step 3 — Usage baseline (PARTIAL — needs user read)

Convex CLI 1.40.0 does not expose `deployment usage` as a subcommand; usage numbers
must be read from the dashboard. Last user-reported values (pre-HTML-smoke, 2026-07-27):

| Metric | Value | Limit | % |
|---|---|---|---|
| Function Calls | 75K | 1M | 7.5% |
| Database I/O | 346.94MB | 1GB | 33.9% |
| Database Storage | 155.12MB | 512MB | 30.3% |
| Data Egress | 233.83MB | 1GB | 22.8% |
| Resets | 1 August 2026 | — | — |

**HTML-smoke delta:** UNMEASURABLE — no before-number was recorded immediately before
the HTML ingest (the 346.94MB reading predates it). Per directive: "If it was not
recorded, state that the HTML-test delta is unmeasurable rather than estimating it."
HONORED — no estimate provided.

**Next reading required** immediately before the PDF smoke (Step 4) to establish the
PDF baseline. Then a third reading after the PDF smoke to compute the PDF delta.

---

## HTML smoke — recap (already verified in prior session)

**Endpoint:** POST `https://confident-viper-402.convex.site/ingest`
**Payload:** `url=https://web.uettaxila.edu.pk/Admissions/`, hand-authored markdown
about Fall 2026 admissions (smoke-test marker present in text), `crawlSessionId=
smoke-test-20260727`, `sourceType=html`, `freshnessTier=high`.
**Result:** HTTP 200 in 1.42s, `action="inserted"`.
**Document:** `_id=k57exb7ac16j37xh6cam3cb5tn8ba0mm`, `status=indexed`,
`chunkCount=2`, `chunksEmbedded=2`, `chunksFailed=0`,
`embeddingModel=gemini-embedding-2`, `freshnessTier=high`.
**Chunks:** both have `ragId` populated; `contextualizedText` populated by
Track B (`gemini-3.5-flash-lite`) — Track B contextualization path confirmed working
end-to-end against the keeper slot.

---

## Step 4 — PDF smoke (PENDING)

Will run after the user provides a fresh usage reading (Step 3 baseline) and confirms
a small representative UET PDF URL. Will verify: `sourceType=pdf`, correct document
URL, page count, **model = `gemini-3.6-flash`** (Track B VLM path), important
numbers preserved exactly, chunks have RAG IDs, zero failed chunks, document reaches
`indexed`.

---

## Step 5 — PDF usage delta (PENDING)

Compute PDF-test deltas. Stop-all-ingestion rule if delta is unexpectedly large.

---

## Step 6 — Evidence report (this document)

Living document; updated as Steps 4–5 complete. No API keys, deploy keys,
authentication tokens, or complete environment-variable values recorded.
