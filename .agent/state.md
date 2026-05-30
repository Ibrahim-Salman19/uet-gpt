last_updated: 2026-05-30 06:50 UTC

last_run:
  task_id: "TASK-S04+B04+S01"
  task_name: "Domain allowlist + decay floor + PDF metadata sanitization"
  status: completed
  eval_recall_at_5: N/A (eval requires live Convex — exit 1 expected)
  eval_fragment_hit: N/A

  changes:
    - "convex/crawl/webhook.ts: TASK-S04 — added server-side domain allowlist (uettaxila.edu.pk only) to /ingest endpoint before any DB write"
    - "convex/embeddings/search.ts: TASK-B04 — added Math.max(0.20, decay) floor to prevent old docs scoring zero"
    - "scripts/ingest_pdf.py: TASK-S01 — added sanitize_metadata() with injection blocklist (7 patterns) + null byte stripping applied to title field"
    - "TODO.md: marked TASK-000, B01, B02, S04, B04, S01 as DONE"

  gate_results:
    gate_1_typescript: PASS (0 errors, npx tsc --noEmit)
    gate_2_python: PASS (py_compile on ingest_pdf.py + crawler.py)
    gate_3_unit_tests: PASS (260/260 tests, 32 test files)
    gate_4_eval: SKIPPED (live Convex not connected, exit 1 = infra skip)
    gate_5_category_eval: SKIPPED (same reason)

next_task:
  id: "TASK-S02"
  name: "Convex rate-limiter (10msg/min/user, 100k tokens/min global)"
  reason: "Highest remaining unblocked P1 security task"
  files_in_scope:
    - "convex/messages.ts or convex/users/rateLimiter.ts (new)"
    - "convex/http.ts"

system_health:
  last_compilation: OK
  stale_documents: 0
  dlq_size: 0
  eval_harness: READY
  golden_set_pairs: 50
  golden_set_categories: 10
  unit_tests: 260/260 PASS

known_assumptions:
  - "TASK-S04: pdf:// virtual URLs bypass domain check intentionally — these are local PDF ingests"
  - "TASK-B04: decay floor 0.20 is conservative — adjust if fresh-content queries degrade"
  - "TASK-S01: injection blocklist covers top-7 patterns — extend _INJECTION_PATTERNS list as new jailbreaks emerge"
  - "TASK-B01/B02: confirmed already implemented in search.ts:104 (k=60) and constants.ts (0.92)"
