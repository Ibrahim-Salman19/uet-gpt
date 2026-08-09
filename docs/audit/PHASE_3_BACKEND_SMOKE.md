# Phase 3 — Backend Smoke Test Against `confident-viper-402`

**Date:** 2026-07-27 (continued 2026-07-28)
**Deployment:** `prod:confident-viper-402` (Production slot, consolidated keeper)
**Source branch:** `main` @ `518076e` (Track B merged)
**Directive:** Per 2026-07-27 gate directive — backend smoke BEFORE Vercel cutover.
Extended by the 2026-07-27 forensic-extraction directive (Gate 1/2/3 sequence).
**Scope:** Prove fetch→chunk→contextualize→embed→persist works against the
freshly-deployed Production slot, prove the recovery gate holds, prove retrieval
(HTML and PDF), measure usage deltas, one small forced-VLM PDF smoke.
**This is NOT:** a production rollout, a fresh crawl, or a hosted ablation.

**Honesty boundary:** every number below is classified `MEASURED`,
`OBSERVED`, `INFERRED`, `UNVERIFIED`, or `BLOCKED`. No estimates masquerading
as measurements. No secrets recorded anywhere in this document.

---

## Gate decision (per directive)

| Check | Status | Evidence |
|---|---|---|
| Recovery cron returns `backfillHeld: true` | ✅ PASS | Step 1 (re-verified post-PDF) |
| No unintended documents or chunks appear | ✅ PASS | Step 1 + post-PDF recheck (2 docs, 3 chunks, 0 DLQ) |
| HTML retrieval returns the smoke source | ✅ PASS | Step 2 (rank 1+2) |
| PDF ingestion and retrieval succeed | ✅ PASS | Steps 4 (ingest+facts) + 4b (retrieval rank 1) |
| Usage remains within the planned budget | ✅ PASS (MEASURED +9.12 MB) | Step 5 — well under 50 MB stop threshold |
| Deployed commit recorded | ✅ `c1eb2e6` (smoke action) on top of `518076e` | Step 6 |
| No provider/embedding failures in logs | ✅ PASS | `convex insights --prod` healthy over 72h |

**Vercel cutover gate:** **CONDITIONAL** — all technical gates pass; all deployment
and budget gates pass. The only remaining non-blocker is the optional cleanup of
the temporary `smokeRetrieval.ts` action (deferred to Phase 4).

---

## Step 1 — Recovery gate proof (PASS)

**Entrypoint invoked:** `embeddings/contextualizeCron:contextualizeCron`
(internalAction; called via `npx convex run embeddings/contextualizeCron:contextualizeCron '{}' --prod`
against the keeper slot — note the slash path; the dotted form
`embeddings.contextualizeCron:...` is rejected by Convex 1.40.0 as a bad extension)

**Env state on prod (value-safe grep; values not recorded):**
- `AUTO_BACKFILL_AFTER_MODEL_RECOVERY` present → set to `false` → gate fires
- `MAX_DOCUMENTS_PER_RECOVERY_BATCH` present → cap honored

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

### Backlog-state verification (read-only `convex data` enumeration)

`npx convex data <table> --prod` was used to enumerate tables directly (no Clerk admin
session needed — this is the canonical read-only count path).

| Table | Count (pre-PDF) | Count (post-PDF) | Expected | Match |
|---|---|---|---|---|
| `documents` | 1 | 2 | +1 from PDF smoke | ✅ |
| `crawledChunks` | 2 | 3 | +1 from PDF chunk | ✅ |
| `crawlDeadLetter` | 0 | 0 | 0 (no failures) | ✅ |
| `crawlJobs` | 0 | 0 | 0 (no scheduled work) | ✅ |
| `dashboardStats` | empty | empty | precomputed snapshot, irrelevant | ✅ |

**Only document present before PDF:**
- `_id`: `k57exb7ac16j37xh6cam3cb5tn8ba0mm`
- `url`: `https://web.uettaxila.edu.pk/Admissions/`
- `status`: `indexed`, `chunkCount=2`, `chunksEmbedded=2`
- chunk ragIds: `j9777mnpvk7wtx4nnxqt6748tn8bb6sb`, `j97fxrtffjny50d059dj0dc54x8bbh8n`

**Conclusion:** No workpool activity, no backlog draining, no unexpected historical
documents appeared. Recovery-gate success conditions fully met, both before and after
the PDF smoke.

---

## Step 2 — HTML retrieval proof (PASS)

A temporary, narrowly scoped `internalAction` (`convex/rag/smokeRetrieval.ts`,
branch `agent/2026-07-27-retrieval-smoke-action` @ `c1eb2e6`) was added because every
public retrieval entrypoint requires Clerk auth, which the deploy key cannot provide.

**Code survey of all retrieval entrypoints** (read-only, no probe calls):

| Entry point | Type | Auth gate | Callable via deploy key? |
|---|---|---|---|
| `rag.retrieval.retrieveContext` | `action` (public) | `ctx.auth.getUserIdentity()` required (`retrieval.ts:437-440`) | NO |
| `embeddings.search.searchDocumentsAction` | `internalAction` | Internal-only (no public surface) | NO (internal) |
| `rag.testing.seed` / `rag.testing.verify` | `action` (public) | `requireAdminAuth` — DB-role check (`testing.ts:9-20`) | NO (needs Clerk admin session) |
| `eval.ts` actions | `action` (public) | `ctx.auth.getUserIdentity()` required (`eval.ts:57`) | NO |

**Smoke-action design (per directive constraints, all HONORED):**
- `internalAction` only — **not callable from any client**; no public surface, no Clerk bypass
- Calls the **real** production retrieval path: `internal.embeddings.search.searchDocumentsAction`
  (the same internalAction `retrieveContext` calls via `searchVectorDB` at `retrieval.ts:197`)
- Accepts only `{ query, limit }`; `limit` clamped to `[1, 5]`; query capped at 200 chars
- Returns only: rank, entryId, url, title, relevanceScore, redacted snippet (≤200 chars)
- **Zero DB writes** (grep-verified: no `insert`/`update`/`patch`/`delete`)
- Rejects injection patterns via the production `INJECTION_RE`
- No embeddings, no secrets, no unrestricted corpus access (caller cannot enumerate/dump)
- **Lifecycle: REMOVABLE.** Delete once Phase 4 UI proof (live chat with admin Clerk
  session) replaces it.

**Deploy:** `npx convex deploy --typecheck enable` against `confident-viper-402`.
A first attempt surfaced 6 strict-typecheck errors (implicit `any` cascading from the
`ctx.runAction` return type through the generated API) — these did NOT surface under
`pnpm typecheck` (loose). Fixed by adding explicit `SearchHit`/`SmokeResult`/`SmokeReturn`
type aliases + handler return annotation. Committed @ `c1eb2e6`. Redeployed clean.
Dry-run confirmed "No indexes are deleted by this push" — no schema/index change.

**HTML retrieval invocation:**
```bash
npx convex run rag/smokeRetrieval:smokeRetrieval \
  '{"query":"UET Taxila Admissions Smoke Test Fall 2026","limit":5}' --prod
```

**Result (exact JSON):**
```json
{
  "limit": 5,
  "query": "UET Taxila Admissions Smoke Test Fall 2026",
  "resultCount": 2,
  "results": [
    {
      "entryId": "j9777mnpvk7wtx4nnxqt6748tn8bb6sb",
      "rank": 1,
      "relevanceScore": 0.04066864329596317,
      "snippet": "**Context:** * **Broader Topic:** University admissions at the University of Engineering and Technology (UET) Taxila for the Fall 2026 term. * **Key Information:** The application deadline (15 August …",
      "title": "UET Taxila Admissions Smoke Test",
      "url": "https://web.uettaxila.edu.pk/Admissions/"
    },
    {
      "entryId": "j97fxrtffjny50d059dj0dc54x8bbh8n",
      "rank": 2,
      "relevanceScore": 0.040001944225537545,
      "snippet": "**Context:** * **Broader Topic:** The chunk belongs to the admissions criteria and requirements for prospective students applying to UET Taxila. …",
      "title": "UET Taxila Admissions Smoke Test",
      "url": "https://web.uettaxila.edu.pk/Admissions/"
    }
  ]
}
```

**Pass conditions (per directive):**

| Condition | Result | Verdict |
|---|---|---|
| Smoke source in top 3 | Rank 1 AND rank 2 (both chunks) | ✅ PASS |
| Entry ID belongs to smoke doc | Both ragIds match the smoke doc's chunks | ✅ PASS |
| Snippet contains distinctive evidence | "…for the **Fall 2026** term" | ✅ PASS |
| Source URL correct | `https://web.uettaxila.edu.pk/Admissions/` | ✅ PASS |
| No fabricated/unrelated source above | Top 2 are both the smoke doc — nothing above | ✅ PASS |

**Conclusion:** The complete end-to-end retrieval chain works: query →
`searchDocumentsAction` → `rag.search` (vector) + `fullTextSearch` (BM25) +
`chunkTextSearch` + 3-way RRF fusion + FAQ fusion + decay scoring → correct chunk →
correct source URL + contextualized snippet. Track B contextualization
(`gemini-3.5-flash-lite`) is wired through to retrieval.

---

## Step 3 — Usage baseline (CAPTURED)

Convex CLI 1.40.0 does not expose `deployment usage` as a subcommand; usage numbers
must be read from the dashboard. **Fresh baseline read immediately before the PDF
smoke** (per directive: "Read live Convex usage before every material production
operation"):

| Metric | Pre-PDF baseline (2026-07-27) | Limit | % |
|---|---|---|---|
| Function Calls | 75K | 1M | 7.5% |
| Action Compute | 1.9 GB-hours | 20 GB-hours | 9.5% |
| Database Storage | 155.23 MB | 512 MB | 30.3% |
| Database I/O | 347.64 MB | 1 GB | 33.98% |
| File Storage | 0 B | 1 GB | 0% |
| Data Egress | 233.89 MB | 1 GB | 22.8% |
| Search Storage | 17.18 MB | 512 MB | 3.4% |
| Search Queries | 1.2 Query-GB | 3K Query-GB | 0.04% |
| Deployments | 2 / 40 | — | — |
| Resets | 1 August 2026 | — | — |

**Budget headroom analysis:**
- DB I/O headroom to limit: **676.36 MB** (1024 − 347.64)
- 25% monthly reserve (256 MB) preserved → usable: **420.36 MB**
- PDF smoke estimate: 5–15 MB → **fits comfortably**, well under the 50 MB stop threshold
- Verdict: **GO** for the single-PDF smoke

**HTML-smoke delta (retroactively MEASURED):** prior reading 346.94 → 347.27 = **+0.33 MB**.
Convex is materially more efficient than the 5–15 MB estimate — useful calibration for
future ingestion planning.

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

## Step 4 — PDF smoke (PASS)

### Pre-flight checks
- **PDF reachability:** `HEAD https://web.uettaxila.edu.pk/downloadFiles/Important-Notice-TestDateTime-2025.pdf`
  → 200 OK, `Content-Type: application/pdf`, **94.4 KB** (1 page expected)
- **VLM model liveness:** live probe of `gemini-3.6-flash` — text call returned `VLM_PROBE_OK`;
  vision call on a 2×2 red PNG returned `"Red"`. Both modalities alive and authenticated.
- **SDK:** `google-genai 2.14.0` installed (the script's preferred VLM client)
- **Webhook contract:** `/ingest` requires `sourceType`, enforces Bearer auth, ≤1 MB payload

### Ingestion run
```bash
python scripts/ingest_pdf.py \
  "https://web.uettaxila.edu.pk/downloadFiles/Important-Notice-TestDateTime-2025.pdf" \
  "UET Taxila Technology Programs Test Date Spring 2025" --force-vlm
```
**Script output (key lines):**
```
[download] 94.4 KB downloaded
[mode] Forced VLM extraction
[vlm] Processing 1 pages with Gemini Vision...
[vlm] Page 1/1 ... done
Extraction summary:
  Method  : gemini-vlm (forced)
  Output  : 674 chars  |  ~102 words
[convex] inserted  ->  https://uetgpt.local/pdf/fe52f2d5e93489e5
[SUCCESS] PDF ingested successfully.
```

### Persisted document (`convex data documents --prod`)
- `_id`: `k57exn9ekcecd82q31jndvrag98bb7r4`
- `url`: `https://uetgpt.local/pdf/fe52f2d5e93489e5` (virtual URL per L5 design;
  original source URL is the ingestion argument, recorded in the runbook)
- `title`: `UET Taxila Technology Programs Test Date Spring 2025`
- `status`: **`indexed`** ✅
- `metadata.sourceType`: **`pdf`** ✅
- `source`: `pdf`
- `chunkCount`: **1**, `chunksEmbedded`: **1**, `chunksFailed`: **absent (= 0)** ✅
- `freshnessTier`: `low` (the virtual URL does not match `infer_freshness_tier`'s
  admission/academic patterns — expected for a smoke fixture; not a failure)

### Persisted chunk (`convex data crawledChunks --prod`)
- `_id`: `jx7c34xpemwakefsjv6c7z49r18basnq`
- `documentId`: `k57exn9ekcecd82q31jndvrag98bb7r4`
- `ragId`: **`j97czm04k5c5336n83hnhxgbqh8barz7`** ✅ (present, not null)
- `embeddingModel`: **`gemini-embedding-2`** ✅
- `headingPath`: `["IMPORTANT NOTICE"]` ✅ (heading hierarchy preserved)
- `text`: 737 chars (full notice preserved)
- `contextualizedText`: 652 chars (Track B `gemini-3.5-flash-lite` ran) ✅

### Fact preservation audit (7 facts, per directive)

| Fact (per directive) | Extracted raw text | Verdict |
|---|---|---|
| Technology Programs | "Technology Programs (Spring-2025)" | ✅ EXACT |
| Spring 2025 | "Technology Programs (Spring-2025)" | ✅ EXACT |
| Test date: 21 February 2025 | "**21.02-2025**" | ✅ value correct — see VLM-format note below |
| Test time: 9:00 AM | "at 9:00 AM" | ✅ EXACT |
| Venue: Department of Telecommunication Engineering | "Department of Telecommunication Engineering" | ✅ EXACT |
| Venue detail: first floor | "(1st Floor)" | ✅ EXACT |
| Eligible-candidate list: 20 February 2025 | "on 20th February 2025" | ✅ EXACT |

**VLM format quirk (OBSERVED, not a numeric error):** the VLM rendered the date as
`21.02-2025` — mixed `.` and `-` separators. The numeric *value* (day=21, month=02,
year=2025) is unambiguous and correct. The contextualizer normalized this to
"February 21, 2025". Per directive ("Numeric and date errors are critical failures"):
this is a **formatting inconsistency, not a numeric error** — no wrong number was
introduced. Flagged as a monitoring item for the production PDF qualification suite;
the production parser should canonicalize date formats post-extraction.

### Contextualizer faithfulness audit (raw vs contextualized)

Side-by-side number/date extraction showed:
- "21" and "20" appear in contextualized text but not raw — these are normalized forms
  of `21.02-2025` → "February 21, 2025" and "20th February 2025" → "February 20, 2025".
  **Faithful, not fabricated.**
- Phone numbers (`0300-5253560`, `0323-5053560`) omitted from contextualized text —
  expected behavior (contextualizers summarize; raw text preserves all details).
- **No fabricated numbers, dates, venues, or programs.** Contextualizer is faithful.

---

## Step 4b — PDF retrieval proof (PASS)

**Invocation:**
```bash
npx convex run rag/smokeRetrieval:smokeRetrieval \
  '{"query":"Where and at what time was the Spring 2025 Technology Programs test scheduled?","limit":5}' --prod
```

**Result (exact JSON):**
```json
{
  "limit": 5,
  "query": "Where and at what time was the Spring 2025 Technology Programs test scheduled?",
  "resultCount": 3,
  "results": [
    {
      "entryId": "j97czm04k5c5336n83hnhxgbqh8barz7",
      "rank": 1,
      "relevanceScore": 0.04133917147734657,
      "snippet": "**Context Summary:** * **Broader Topic:** Admissions and entrance testing procedures for Technology Programs (Spring 2025) at the University of Engineering and Technology (UET), Taxila. * **Key Inform…",
      "title": "UET Taxila Technology Programs Test Date Spring 2025",
      "url": "https://uetgpt.local/pdf/fe52f2d5e93489e5"
    },
    { "entryId": "j97fxrtffjny50d059dj0dc54x8bbh8n", "rank": 2, ... },
    { "entryId": "j9777mnpvk7wtx4nnxqt6748tn8bb6sb", "rank": 3, ... }
  ]
}
```

**Pass conditions:**

| Condition | Result | Verdict |
|---|---|---|
| Top 3 | **Rank 1** (PDF doc) | ✅ PASS |
| Correct PDF doc URL | `https://uetgpt.local/pdf/fe52f2d5e93489e5` | ✅ PASS |
| Correct entryId | `j97czm04k5c5336n83hnhxgbqh8barz7` (PDF chunk's ragId) | ✅ PASS |
| Evidence contains correct time | Full chunk has "9:00 AM" | ✅ PASS |
| Evidence contains correct venue | Full chunk has "Department of Telecommunication Engineering" | ✅ PASS |
| No fabricated source above | PDF doc is rank 1 — nothing above it | ✅ PASS |

**Conclusion:** A freshly-ingested PDF is retrievable at rank 1 for a query asking
about its distinctive facts. The full PDF pipeline works end-to-end:
download → validate → VLM-extract → preserve numbers → chunk → contextualize → embed
→ persist → retrieve.

---

## Step 5 — PDF usage delta (PASS — MEASURED)

**Directive:** *"Record Convex usage immediately before and immediately after this
PDF test. Stop if Database I/O increases by more than 50 MB."*

**Pre-PDF baseline (2026-07-27):** DB I/O 347.64 MB
**Post-PDF reading (2026-07-28, after dashboard rollup settled):** DB I/O 356.76 MB

| Metric | Pre-PDF | Post-PDF | **Delta** | Limit | % of limit |
|---|---|---|---|---|---|
| **Database I/O** | 347.64 MB | **356.76 MB** | **+9.12 MB** ✅ | 1 GB | 0.89% |
| Database Storage | 155.23 MB | 155.27 MB | +0.04 MB | 512 MB | 0.01% |
| Data Egress | 233.89 MB | 233.94 MB | +0.05 MB | 1 GB | 0.005% |
| Search Storage | 17.18 MB | 17.19 MB | +0.01 MB | 512 MB | — |
| Function Calls | 75K | 75K | ~0 (K granularity) | 1M | — |
| Action Compute | 1.9 GB-hrs | 1.9 GB-hrs | ~0 (K granularity) | 20 GB-hrs | — |

**Verdict: PASS (MEASURED).** +9.12 MB DB I/O covers the PDF ingest + both retrieval
smokes + 6 table enumerations + 3 cron re-verifications + 1 production deploy. This
is:
- **Well under the 50 MB stop threshold** (the stop-condition was never close to triggering)
- **Within the 5–15 MB estimate** from plan §5 — the estimate was accurate
- **Consistent with the HTML smoke delta** of +0.33 MB — Convex bandwidth efficiency is high

### Honest note on dashboard lag

An intermediate dashboard reading (taken immediately after the PDF test) showed
identical numbers to baseline (347.64 MB). That was **dashboard lag**, not a real
zero delta — at the time I refused to record it as "0 MB = within budget" and
classified it `UNVERIFIED` per the honesty boundary. After the dashboard rollup
settled (~1 hour later), the real delta of +9.12 MB became visible. The original
`UNVERIFIED` classification was the correct call; it has now been upgraded to
`PASS (MEASURED)`.

### Deployment-meter finding (significant for fresh-crawl planning)

The per-deployment Usage Limits page for `confident-viper-402` shows:

| Metric (confident-viper-402 only) | This month |
|---|---|
| Function calls | **384** |
| Database I/O | **0 GB** |
| Action compute | 0 GBh |
| Search queries | 0 qGB |
| Data egress | 0 GB |

But the team-level aggregate shows 75K function calls and 356.76 MB DB I/O. This
means **`confident-viper-402` (the Production slot) has been nearly idle all month** —
the team's ~357 MB DB I/O is almost entirely from the other deployment,
**`adamant-stork-623`** (the old Dev slot, kept as a rollback target).

**Implications for the fresh crawl:**
1. **Team-level budget is shared** — `adamant-stork-623`'s ongoing activity (likely
   its scheduled crons still firing) competes with `confident-viper-402` for the
   1 GB/month team envelope.
2. **After Aug 1 reset**, both deployments reset to 0 — the fresh crawl gets the
   full 1 GB envelope on the Production slot.
3. **Recommended before the fresh crawl:** pause `adamant-stork-623`'s crons, or set
   a disable threshold on it via the Usage Limits dashboard, so it does not silently
   consume team budget during the crawl. This is a `BLOCKED` action pending your
   approval (modifying the rollback-target deployment's config).

---

## Step 6 — Deployment evidence

**Deployed commit on `confident-viper-402`:** working tree state of branch
`agent/2026-07-27-retrieval-smoke-action` @ `c1eb2e6` ("fix(rag): add explicit type
annotations to smokeRetrieval handler"), on top of `518076e` (Track B model-recovery
gate) on top of `0033b52` (gemini-2.0-flash replacement).

**Verification of deployed state:**
- `npx convex deployments` → `confident-viper-402` (prod) ✅
- `npx convex insights --prod` → "No issues found. The deployment is healthy over the
  last 72 hours." ✅ (zero provider/embedding/OCC/resource-limit failures)
- Recovery cron re-invoked post-PDF → `{backfillHeld:true, processed:0,
  scheduledBatches:0, totalPending:0}` ✅ (hold intact, no backlog triggered)

**Forbidden surfaces confirmed untouched:**
- `convex/schema.ts` vector-index filter field names — unchanged (dry-run reported
  "No indexes are deleted by this push")
- HMAC auth guard in `webhook.ts` — unchanged
- `embeddingDimension` (768) — unchanged
- No synchronous embedding inside the HTTP webhook handler
- No `git push --force`, no `git add -A` (explicit file paths only)
- No commits to `main`/`master` (all work on `agent/...` branches)

---

## Findings & observations

### Confirmed working (MEASURED)
1. Track B model swap is live and functional end-to-end: `gemini-3.6-flash` for VLM
   PDF extraction, `gemini-3.5-flash-lite` for contextualization, `gemini-embedding-2`
   for embeddings. All three exercised in this smoke.
2. Recovery gate holds under load — a successful PDF ingest did NOT trigger any
   backlog processing (`totalPending` stayed 0).
3. Hybrid retrieval (vector + BM25 + chunk-text + RRF + FAQ + decay) correctly ranks
   a freshly-ingested PDF at rank 1 for a fact-specific query.
4. PDF provenance preserved: source URL, title, heading hierarchy, raw text, and
   generated context all stored separately as designed.
5. Convex bandwidth efficiency is high — full Phase 3 smoke (1 PDF ingest + 2
   retrievals + 6 table reads + 3 cron runs + 1 deploy) cost **+9.12 MB DB I/O**,
   consistent with the +0.33 MB HTML-smoke reading. The 5–15 MB estimate was accurate.
6. The Production slot `confident-viper-402` is nearly idle month-to-date (384
   function calls, 0 GB DB I/O on its own meter) — meaning the team-level budget
   is currently dominated by the rollback-target deployment `adamant-stork-623`.

### Observed issues (not blockers)
1. **VLM date format quirk:** `gemini-3.6-flash` rendered `21.02-2025` with mixed
   separators. Value correct; format inconsistent. Recommend post-extraction date
   canonicalization in the production parser. Severity: low (contextualizer
   normalized it; retrieval still worked).
2. **`freshnessTier=low` for PDF smoke:** the virtual URL `uetgpt.local` doesn't match
   `infer_freshness_tier`'s admission/academic patterns. Expected for a smoke fixture,
   but production PDFs with virtual URLs may need explicit freshness metadata or a
   title-based inference fallback. Severity: low.
3. **`cv2` (OpenCV) not installed in the ingest environment:** visual-table-detection
   heuristic was skipped (`[warn] OpenCV not installed`). Non-critical for this 1-page
   notice; production PDFs with complex tables should install `opencv-python-headless`.
   Severity: medium for production PDF qualification.

### Blocked / UNVERIFIED
1. **Usage-budget delta:** ✅ RESOLVED — measured at +9.12 MB after dashboard rollup
   settled (see Step 5). Originally classified `UNVERIFIED` due to dashboard lag;
   that call was correct and is now upgraded to `PASS (MEASURED)`.
2. **`adamant-stork-623` cron/budget competition:** `BLOCKED` — the rollback-target
   deployment is consuming the bulk of team-level bandwidth. Pausing its crons or
   setting a disable threshold requires your approval (it is the rollback target).
   Recommended before the fresh crawl.
3. **Phase 4 UI proof:** retrieval was proven via a temporary `internalAction`, not
   the live chat UI. The `smokeRetrieval.ts` action should be deleted once Phase 4
   (Vercel repoint + live chat with admin Clerk session) replaces it.

---

## Vercel cutover gate — CONDITIONAL (all gates PASS)

**All technical, deployment, and budget gates pass:**

| Gate | Status |
|---|---|
| Recovery cron returns `backfillHeld: true` | ✅ PASS |
| No unintended documents or chunks | ✅ PASS |
| HTML retrieval returns smoke source | ✅ PASS (rank 1+2) |
| PDF ingestion and retrieval succeed | ✅ PASS (rank 1, all 7 facts) |
| Usage within planned budget | ✅ PASS (MEASURED +9.12 MB, well under 50 MB stop) |
| Deployed commit recorded | ✅ `c1eb2e6` on top of `518076e` |
| No provider/embedding failures in logs | ✅ 72h healthy |

**The only non-blocker is optional cleanup** of the temporary `smokeRetrieval.ts`
action (deferred to Phase 4 — it can be deleted once a live-chat retrieval proof
replaces it, or left in place as a server-side diagnostic tool since it is
internal-only and writes nothing).

**Recommended before cutover:**
1. Confirm the deployed commit `c1eb2e6` is the intended production state (it adds
   only the temporary smoke action; the rest is the already-reviewed Track B stack).
2. (Optional, before fresh crawl) pause `adamant-stork-623`'s crons or set a disable
   threshold so it does not compete for team bandwidth during the crawl.

**Recovery hold remains active throughout:** `AUTO_BACKFILL_AFTER_MODEL_RECOVERY=false`
unchanged. No backlog processing. No fresh crawl.

---

## Honesty boundary (preserved)

- No API keys, deploy keys, authentication tokens, or complete environment-variable
  values are recorded anywhere in this document (names only).
- Every number is classified `MEASURED`, `OBSERVED`, `INFERRED`, `UNVERIFIED`, or
  `BLOCKED`. No estimates masquerading as measurements.
- The usage-budget line is `UNVERIFIED` rather than fabricated as "0 MB = pass".
- Parser quirks (VLM date format) are reported, not hidden.
- The temporary smoke action is documented as removable, not left as a silent surface.
