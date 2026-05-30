# Progress Log

---
run_id: 2026-05-30-07
timestamp_utc: 2026-05-30T06:51:00Z
task: "TASK-S04+B04+S01: Domain allowlist + decay floor + PDF metadata sanitization"
files_modified:
  - convex/crawl/webhook.ts
  - convex/embeddings/search.ts
  - scripts/ingest_pdf.py
  - TODO.md
  - .agent/state.md
eval_before: {recall_at_5: N/A, fragment_hit: N/A}
eval_after:  {recall_at_5: N/A, fragment_hit: N/A}
delta:       {recall_at_5: 0.0, fragment_hit: 0.0}
git_commits: [pending]
assumptions: |
  Eval harness skipped — live Convex not connected (exit code 1 = infra skip, not regression).
  All 3 tasks are pure security/correctness fixes; they do not change retrieval logic, so recall delta is expected to be ~0 until live.
  B01+B02 were already implemented; confirmed by code inspection.
issues_discovered: |
  TASK-S02 (rate limiter) is next; no Convex rate-limiter module exists yet.
  TASK-E01 (maxChunkSize) is blocked behind nothing — ready to implement next session.


---
run_id: 2026-05-30-05
timestamp_utc: 2026-05-30T05:00:00Z
task: "TASK-000: Initial Setup"
files_modified: []
eval_before: {recall_at_5: 0.0, fragment_hit: 0.0}
eval_after:  {recall_at_5: 0.0, fragment_hit: 0.0}
delta:       {recall_at_5: 0.0, fragment_hit: 0.0}
git_commits: []
assumptions: "Initial bootstrap of RAG pipeline cron job"
issues_discovered: "none"

---
run_id: 2026-05-30-01
timestamp_utc: 2026-05-30T01:00:00Z
task: "INFRA: Cron reliability & eval quality hardening (9-gap audit)"
files_modified:
  - scripts/run_agent.sh
  - scripts/eval/run_eval.py
  - scripts/eval/golden_set.jsonl
  - CRONJOB.md
  - .agent/state.md
eval_before: {recall_at_5: 0.0, fragment_hit: 0.0}
eval_after:  {recall_at_5: 0.0, fragment_hit: 0.0}
delta:       {recall_at_5: 0.0, fragment_hit: 0.0}
git_commits: []
assumptions: |
  Eval harness not yet connected to live Convex. Metrics will be real on next run.
  expected_url uses substring match on uettaxila.edu.pk — will work once data is indexed.
issues_discovered: |
  9 bugs fixed: A1-A8 in run_agent.sh, B1-B5 in CRONJOB.md, C1-C5 in run_eval.py, D1-D3 in golden_set.jsonl.
  See implementation_plan.md for full audit table.
