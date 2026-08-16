# Resource-Safety: Local Development, Kill Switch, and Incident Response

Canonical operator/agent reference for the August 2026 resource-safety remediation.
`AGENTS.md` and `CLAUDE.md` point here rather than duplicating this content.

## 1. What happened, briefly

On 2026-08-15 the user authorized one production-equivalent crawl into a freshly
created Convex Cloud deployment (`rugged-bird-156`) to build a corpus for
retrieval-baseline work. The crawl itself was authorized and correctly scoped, but
nothing bounded its downstream consequences: `scripts/crawler.py --limit 0`
(exhaustive, the pre-remediation default) has no wall-clock cap, and every page it
pushed to `/ingest` immediately queued embedding work with no check on how deep
that queue already was. The embedding consumer is deliberately throttled to
Gemini's free tier (`maxParallelism: 3`), so the producer outran it for hours,
inflating into a ~17,000-row `pendingChunkText` backlog. Full trace:
`docs/rag-store-evaluation/fresh-corpus-crawl-2026-08/pre-crawl-evidence.json`.

The mechanisms below close the specific gaps that let one authorized action have
an unbounded blast radius. They do not change what operations require
authorization - see `CLAUDE.md`'s pointer to this document for that policy.

## 2. Local-first development

**Default assumption for any AI agent or developer working in this repo: your
Convex target should be local, not `rugged-bird-156` or any other cloud
deployment**, unless you have separately confirmed cloud access is authorized for
the specific operation you're about to run.

### How to actually run local Convex

Convex's self-hosted backend (see `get-convex/convex-backend`'s docs, verified
2026-08) serves the deployment API on `http://127.0.0.1:3210` and HTTP Actions
(what `CONVEX_SITE_URL` points at) on `http://127.0.0.1:3211`:

```bash
# one-time: download docker-compose.yml from get-convex/convex-backend's
# self-hosted/ directory, then:
docker compose up
docker compose exec backend ./generate_admin_key.sh
```

Then point this project at it. **Do not overwrite your existing `.env.local`
blindly** - it currently contains real secrets alongside the cloud target. The
safe pattern:

```bash
CONVEX_SELF_HOSTED_URL='http://127.0.0.1:3210'
CONVEX_SELF_HOSTED_ADMIN_KEY='<from generate_admin_key.sh>'
CONVEX_SITE_URL='http://127.0.0.1:3211'
NEXT_PUBLIC_CONVEX_URL='http://127.0.0.1:3210'
```

### Why `.env.local` is the thing to change, and how to keep cloud access separate

`.env.local` is auto-loaded by both Next.js and the Convex CLI - that's exactly
why it's dangerous to have it default to a cloud deployment. The safe separation:

- **`.env.local`** → local development only. This is what every ordinary
  `pnpm dev`, `npx convex dev`, `pytest`, or agent-run script picks up
  automatically, with no special action.
- **A file that is NOT auto-loaded by anything** (e.g. `.env.cloud-dev.local` -
  matching the `.env*.local` gitignore pattern already in this repo, so it can
  never be accidentally committed) → holds cloud credentials, and is only ever
  used by explicitly sourcing it for one authorized operation:
  ```bash
  set -a; source .env.cloud-dev.local; set +a
  # ...run the one specific authorized command...
  ```
  Never `source` this file in a shell profile, CI default, or anything that
  makes it apply automatically.

This repository does not currently ship a `.env.cloud-dev.local` - creating one
is a deliberate, one-time action for whoever needs authorized cloud access next,
not something this remediation does automatically.

### How this connects to the code-level guards

`scripts/uet_crawler/target_guard.py`'s `assert_local_convex_target()` (used by
`crawler.py` and `ingest_pdf.py`) positively verifies the resolved
`CONVEX_SITE_URL` is a loopback address before proceeding - it does not infer
"local" from a name, and does not default to local when the target is
unknown/malformed. If `.env.local` is set up per the above, these scripts work
against local Convex with zero extra flags. Targeting cloud requires the
explicit `--cloud-execution-authorization <phrase>` flag for that one invocation
(see the module's docstring for the exact phrase) - never a persistent setting.

Tests do not need special handling to avoid inheriting `rugged-bird-156`: none of
the vitest suites make real network calls (see `tests/setup.ts` and the mocking
conventions throughout `tests/convex/`), and `FAKE_EMBEDDINGS_FOR_LOCAL_TEST=1`
bypasses the real Gemini call path entirely where relevant
(`convex/embeddings/generate.ts`).

## 3. The kill switch: what it is and what it is not

Two independent mechanisms, both durable (server-side state, not process memory):

1. **`bulkOperationsControl`** (`convex/crawl/bulkOperationsControl.ts`) - a
   single DB row. When `enabled: false`, every producer-side call site refuses
   to do expensive work: crawl scheduling (`trigger.ts`, `workflow.ts`),
   embedding enqueue (`mutations.ts`'s `assertEmbeddingBacklogHasRoom`), the
   external Gemini call itself (`actions.ts`'s `embedSingleChunk`), and DLQ
   retry re-enqueue (`mutations.ts`'s `retryDeadLetterQueue`).
2. **Workpool `maxParallelism`** - set to `0` on both `embeddingPool` and
   `crawlPool` via `components.<pool>.config.update`, which stops workers from
   *starting* any new attempt (including already-pending ones), independent of
   the kill switch above.

**Neither alone is sufficient** (this is exactly why the August incident
happened): disabling the producer without stopping workers leaves already-queued
work running; stopping workers without disabling the producer leaves the queue
free to keep growing. `emergencyStopBulkOperations` (below) does both, plus
cancels pending work.

## 4. Incident response sequence

Admin-gated action: `convex/crawl/emergencyStop.ts`'s `emergencyStopBulkOperations`.

```
1. STOP PRODUCERS
     -> bulkOperationsControl.enabled = false
        (every enqueue/schedule/retry call site checks this)
2. STOP WORKERS FROM STARTING NEW WORK
     -> embeddingPool + crawlPool maxParallelism = 0 (durable, not in-memory)
3. CANCEL PENDING WORK
     -> cancelAll() on both pools. Self-paginating (the component
        reschedules itself internally - see @convex-dev/workpool's
        component/lib.js), so one call drains the whole queue regardless
        of depth. Only affects PENDING work.
4. VERIFY RUNNING WORK FINISHES
     -> anything already RUNNING when cancelAll() was called is allowed
        to complete, but will NOT retry afterward. This is not instant -
        emergencyStopBulkOperations's return value says so explicitly
        rather than claiming everything stopped.
5. MARK APPLICATION STATE
     -> the existing bounded/paginated/audited convex/emergencyStop.ts
        driver flips in-flight documents/crawlJobs to failed/cancelled
        so the UI reflects reality.
6. OBSERVE
     -> watch for pending/running counts reaching zero (see section 5
        below for what's cheap to check). Do not assume "instant."
7. DO NOT RESUME YET
     -> resuming before the queue is actually drained lets whatever
        caused the incident recur immediately.
8. ONLY THEN: resumeBulkOperations (a deliberately separate action, not
   a side effect of anything else) - restores maxParallelism to the
   configured normal values and re-enables the producer.
```

**Deployment pause is not equivalent to the above and must not be used as a
substitute.** Convex's own documented behavior: a paused deployment still queues
scheduled work, which can execute when the deployment is resumed. Pausing stops
new *incoming requests*, not already-scheduled server-side work - exactly the
"stopping the local process didn't stop the server" failure mode from the
original incident, just at a different layer. If deployment pause is used at all
during a live incident, treat it as a stopgap on top of the sequence above, never
in place of it.

## 5. Cheap observability (don't scan 17,000 rows to check status)

- `embeddingPool.status(ctx, id)` / Workpool's own dashboard for per-job state.
- `crawlStats` table (`convex/schema.ts`) - maintained running counters for
  document counts, not a scan.
- `bulkOperationsControl` - one row, one query, tells you the kill-switch state.
- For `pendingChunkText` specifically: do not `.collect()` it to count rows. The
  bounded backpressure check in `mutations.ts` (`assertEmbeddingBacklogHasRoom`)
  already demonstrates the pattern - `.take(ceiling + 1)`, cost independent of
  table size. Use the same approach for any future ad-hoc check rather than a
  full scan.
- `gcOrphanedPendingChunkText` (admin-facing, `reconciliation.ts`) with
  `dryRun: true` (the default) gives a bounded, paginated read of how many rows
  are stale without deleting anything - useful during an incident to gauge
  backlog size without a `npx convex data` full-table dump.

## 6. Known gap: the Convex CLI itself is not covered by `target_guard.py`

Discovered while verifying this very remediation: `npx convex codegen --typecheck
disable` - despite the flag name, and despite this repo's own CI comment
claiming it runs "OFFLINE" - still contacts whatever deployment `.env.local`
resolves to (via `CONVEX_DEPLOY_KEY`'s self-declared target) to read schema/
function-shape information. Convex's own docs confirm codegen "does not affect
the code running on your deployment" (no deploy/execution occurs), so the actual
exposure is a metadata read, not a bulk operation - but it is still cloud
contact that happened silently, by default, with no local-target verification,
purely because `.env.local` had live cloud credentials sitting in it. CI never
hits this because fork PRs have no deployment credentials at all to resolve.

`scripts/uet_crawler/target_guard.py`'s `assert_local_convex_target()` only
covers the two Python scripts it was built for (section 2.4 above) - it does
**not** wrap `npx convex codegen`/`dev`/`deploy`/`run`/`data` invocations
themselves. Until a CLI-level guard exists, treat every `npx convex <command>`
invocation as a `CLOUD_READ` at minimum (per the self-reporting classification
in `CLAUDE.md`) and verify `.env.local`'s target before running one, the same
way you would before running the crawler. A wrapper script that checks
`assert_local_convex_target(os.environ["CONVEX_SITE_URL"])`-equivalent logic
before shelling out to the real `npx convex` binary would close this gap
properly; it was not built as part of this remediation because it was outside
the originally scoped file list, not because it's low-value.

## 7. What NOT to do

- Do not run `npx convex data <table> --limit 20000` or similar against cloud to
  "just check" a count. Use the bounded mechanisms above.
- Do not treat cleanup (deleting partial/bad data) as part of incident
  containment. Stop the resource drain first; cleanup is a separate, separately
  authorized, separately budgeted operation.
- Do not resume bulk operations "to see if it's fixed now." Verify pending/
  running counts are actually zero and stable first.
- Do not create another Convex deployment to route around a quota or incident.
  Local Convex exists for exactly this class of problem.
