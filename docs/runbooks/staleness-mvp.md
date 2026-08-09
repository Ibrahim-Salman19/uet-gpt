# Staleness MVP Runbook & Operational Standard

This runbook specifies the operational execution, deployment pause/unpause protocols, provider compatibility gates, and pilot validation sequence for the Staleness MVP.

---

## 1. Cron Schedule & Execution Architecture

To prevent reporting stale or incomplete state, the daily cron order is strictly sequenced:

| Time (UTC) | Job Name | Action | Execution Model |
| :--- | :--- | :--- | :--- |
| **03:30** | `staleness-flag-expired` | `internal.crawl.staleness.flagExpiredDocuments` | Bounded cursor sweep (100 docs/batch) with `ctx.scheduler.runAfter` continuation |
| **04:00** | `staleness-check` | `internal.observability.staleness.checkStaleness` | Metrics aggregation, partial sweep detection, and `appSettings` persistence |

### Observability Data Contract

The observability output persisted in `observability_staleness_summary` MUST expose:

```json
{
  "totalDocuments": 1250,
  "staleDocuments": 140,
  "stalePercentage": 11.2,
  "lastSweepStartedAt": 1785209400000,
  "lastSweepCompletedAt": 1785209700000,
  "sweepComplete": true,
  "documentsExamined": 1250,
  "documentsFlagged": 42,
  "documentsCleared": 0,
  "cursorRemaining": false,
  "errors": 0,
  "checkedAt": 1785211200000
}
```

If `sweepComplete` is `false` when `staleness-check` runs at 04:00 UTC, the system logs a `PARTIAL SWEEP` warning and the admin dashboard explicitly displays partial state.

---

## 2. Resumable Sweep Model

The age flagger sweep (`flagExpiredDocuments`) processes documents in paginated batches (`SWEEP_BATCH_SIZE = 100`) using `.paginate({ numItems: 100, cursor })`:

1. Initiated at 03:30 UTC without a cursor.
2. Evaluates each row against `classifyFreshness` from `convex/shared/freshnessPolicy.ts`.
3. If more rows remain (`!pageResult.isDone`), schedules the next batch immediately with `ctx.scheduler.runAfter(0, internal.crawl.staleness.flagExpiredDocuments, { cursor, sweepId, cumulative })`.
4. Idempotent: already-flagged rows increment `alreadyStale` without redundant writes.
5. Supports `dryRun: true` for pre-mutation safety audits.

---

## 3. Freshness & Risk Policy Specification

All thresholds and risk rules live in `convex/shared/freshnessPolicy.ts`:

* **High Tier (14 days)**: Admissions, fees, merit lists, entry tests, schedules.
* **Medium Tier (60 days)**: Department details, faculty lists, course programs.
* **Low Tier (180 days)**: History, about pages, evergreen policies.
* **Score Penalty**: `DEFAULT_STALE_SCORE_MULTIPLIER = 0.3` (Ablation grid: `[0, 0.1, 0.3, 0.5, 1.0]`).
* **Candidate Overfetch**: `STALE_OVERFETCH_FACTOR = 3`, `MIN_CANDIDATES = 30`, `MAX_CANDIDATES = 256`.
* **State Precedence**:
  `stale | failed | pending | processing | pending_embed` -> Hard Excluded
  `active | indexed` -> Eligible -> Fresh / Aged Decay -> Risk Check -> Ranking

### High-Impact Query Abstention

Queries classified as `high` risk (fees, deadlines, merit, entry test, eligibility) abstain when ONLY aged or unknown-freshness evidence is available (`shouldAbstainOnStaleOnly === true`), directing the user to official UET Taxila sources rather than serving stale figures.

---

## 4. Rollback Asset Management (adamant-stork-623)

To preserve `adamant-stork-623` as a reversible rollback target without altering its deployed code:

### Deployment Pause Rationale
Using Convex's deployment pause control:
* Preserves all deployment data and vectors.
* Stops function execution and bandwidth billing.
* Skips scheduled crons without deleting job definitions.

### Pre-Pause Checklist
1. Record Deployment Identifier: `adamant-stork-623`.
2. Record Commit SHA / Release tag.
3. Export current usage snapshot and database row counts.
4. Record environment variable key names (never secrets).
5. Verify backup export reference.

### Post-Pause Verification
1. Confirm test function call returns `DeploymentPausedError`.
2. Confirm database I/O and function execution metrics remain completely flat.
3. Update rollback manifest in `ROLLBACK.md`.

### Unpause Runbook
1. Inspect queued `_scheduled_functions` and purge obsolete jobs.
2. Confirm API credentials (Gemini / Groq) are active.
3. Conduct one read-only smoke retrieval query.
4. Re-route traffic only after health checks pass.

---

## 5. Ingestion Provider Compatibility Gate

Before initiating the crawl pilot:

1. Audit codebase for deprecated model references (`gemini-2.0-flash`, legacy Groq models).
2. Verify production Gemini API key type.
3. Test end-to-end ingestion pipeline: `fetch` -> `extract` -> `contextualize` -> `embed` -> `persist` -> `retrieve`.
4. Confirm crawl job completion is NOT recorded if downstream contextualization or embedding fails.

---

## 6. 8–10 Document Lifecycle Pilot

The pilot validates end-to-end freshness across 5 document classes:

| Class | Sample Count | Target Document Types | Purpose |
| :--- | :--- | :--- | :--- |
| **High Tier** | 2 | Admissions, Fee Structure HTML | Time-sensitive pricing & deadline validation |
| **Medium Tier** | 2 | Electrical Dept, Faculty Directory | Contact & program descriptions |
| **Low Tier** | 2 | History, About UET | Evergreen baseline |
| **PDF / Table** | 1 | Prospectus Table PDF | Extraction & page-level chunking cost |
| **Fixtures** | 2 | Changed content + Explicit stale control | Supersession, recrawl clearing & hard-exclusion |

### Bandwidth & Cost Model Reserves

Budget calculations use observed P95 I/O per document class with mandatory reserves:

* **Ordinary HTML**: Observed P95 I/O + **30% uncertainty reserve**.
* **PDFs / OCR**: Observed P95 I/O + **50% uncertainty reserve**.
* **Safety Gate**: Reject batch if total monthly projected I/O exceeds **75% of available plan quota** or if any single document operation exceeds **5 MB I/O**.
