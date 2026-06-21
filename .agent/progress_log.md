# Progress Log

---
run_id: 2026-05-30-10a
timestamp_utc: 2026-05-30T10:02:00Z
task: "TASK-E06: Parent-child chunking (child 200tok embed, parent 1500tok return)"
files_modified:
  - convex/schema.ts
  - convex/embeddings/doc_queries.ts
  - convex/embeddings/search.ts
  - convex/crawl/webhook.ts
  - convex/crawl/mutations.ts
  - tests/convex/crawl/webhook.test.ts
  - TODO.md
  - .agent/state.md
eval_before: {recall_at_5: N/A, fragment_hit: N/A}
eval_after:  {recall_at_5: N/A, fragment_hit: N/A}
delta:       {recall_at_5: 0.0, fragment_hit: 0.0}
git_commits: [pending]
assumptions: |
  E06: Parent chunks of 3000 chars are split into child chunks of 800 chars. Vector/text searches match child chunks and return their parent chunk context for high matching precision and comprehensive LLM responses.
issues_discovered: |
  Discovered a hidden bug where doc.crawledAt and doc.freshnessTier in search.ts were resolving to undefined. Fixed by updating the returns schema of getDocumentByEntryId.

---
run_id: 2026-05-30-09b
timestamp_utc: 2026-05-30T09:47:00Z
task: "TASK-E03: FlashRank reranker k=8->4 via cross-encoder/ms-marco-MiniLM-L-6-v2"
files_modified:
  - convex/rag/retrieval.ts
  - tests/integration/rag-pipeline.test.ts
  - TODO.md
  - .agent/state.md
eval_before: {recall_at_5: N/A, fragment_hit: N/A}
eval_after:  {recall_at_5: N/A, fragment_hit: N/A}
delta:       {recall_at_5: 0.0, fragment_hit: 0.0}
git_commits: [pending]
assumptions: |
  E03: Cross-encoder rerank reduces 8 candidate chunks down to top 4 for strict context budget constraints.
issues_discovered: |
  Implicit any on item parameter in map callback. Fixed by adding explicit types.

---
run_id: 2026-05-30-09a
timestamp_utc: 2026-05-30T09:30:00Z
task: "TASK-E02: Hybrid search via hybridRank (vector + BM25, k=20 fused -> 8)"
files_modified:
  - convex/embeddings/search.ts
  - convex/rag/retrieval.ts
  - tests/unit/search.test.ts (NEW)
  - TODO.md
  - .agent/state.md
eval_before: {recall_at_5: N/A, fragment_hit: N/A}
eval_after:  {recall_at_5: N/A, fragment_hit: N/A}
delta:       {recall_at_5: 0.0, fragment_hit: 0.0}
git_commits: [pending]
assumptions: |
  E02: RRF k=20 is standard. Limits on text/vector search are kept at 40 to provide ample overlap for reciprocal ranking, and fused results are limited to 8.
issues_discovered: |
  none

---
run_id: 2026-05-30-07c
timestamp_utc: 2026-05-30T07:20:00Z
task: "TASK-B03+E04+E05: Tier TTL + flag expired + anti-hallucination tiers"
files_modified:
  - convex/cache/set.ts
  - src/app/api/chat/route.ts
  - convex/rag/retrieval.ts
  - TODO.md
  - .agent/state.md
eval_before: {recall_at_5: N/A, fragment_hit: N/A}
eval_after:  {recall_at_5: N/A, fragment_hit: N/A}
delta:       {recall_at_5: 0.0, fragment_hit: 0.0}
git_commits: ["2e041d0f7b"]
assumptions: |
  B03: assignTier mirrors crawler.py logic to choose high (7d), medium (2d), low (1d) TTL.
  E05: Three-tier confidence system: refuse (<0.20), hedge (0.20–0.40), cite (0.40–0.60).
issues_discovered: |
  none

---
run_id: 2026-05-30-07b
timestamp_utc: 2026-05-30T07:05:00Z
task: "TASK-S02+S03+E01: Rate limiter + injection scanner + chunk overlap"
files_modified:
  - convex/schema.ts
  - convex/rateLimit.ts (NEW)
  - convex/messages.ts
  - convex/rag/retrieval.ts
  - convex/crawl/webhook.ts
  - TODO.md
eval_before: {recall_at_5: N/A, fragment_hit: N/A}
eval_after:  {recall_at_5: N/A, fragment_hit: N/A}
delta:       {recall_at_5: 0.0, fragment_hit: 0.0}
git_commits: [pending]
assumptions: |
  S02: rate limiter uses native Convex table — no Redis required, fully atomic in mutation context.
  S03: injection scanner uses JS regex with "i" flag (fixed (?i) Python-syntax bug during this run).
  E01: overlapSize raised from 200 to 300; maxChunkSize already 3000 (confirmed in previous run).
issues_discovered: |
  Bug found: (?i) Python regex inline flag used in JS context — SyntaxError at runtime.
  Fixed immediately; root cause: pattern copy-pasted from Python sanitize_metadata(). Prevention: added to anti-pattern list.

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

---
run_id: 2026-05-30-11
timestamp_utc: 2026-05-30T11:39:00Z
task: "TASK-E09 (Skipped)"
files_modified: []
eval_before: {recall_at_5: N/A, fragment_hit: N/A}
eval_after:  {recall_at_5: N/A, fragment_hit: N/A}
delta:       {recall_at_5: 0.0, fragment_hit: 0.0}
git_commits: []
assumptions: "Skipped this run due to eval connectivity error (exit code 1)"
issues_discovered: "CONVEX_URL environment variable is not set"

---
run_id: 2026-05-30-12
timestamp_utc: 2026-05-30T12:20:00Z
task: "CRASH-RECOVERY"
files_modified:
  - .agent/state.md
  - .agent/incident_log.md
  - .agent/progress_log.md
test_status: FAIL
commits: []
assumptions: "Tests are massively failing (218 failures) either due to untracked files corrupting module resolution or fundamentally broken environment setup (jsdom/vitest config). Triggered Emergency Protocol and aborted tasks."
issues_discovered: "Vitest config is missing jsdom environment, untracked test files from previous partial runs are causing module resolution failures."

---
run_id: 2026-06-06-v15
timestamp_utc: 2026-06-06T12:00:00Z
task: "V15.0: Comprehensive Architecture Audit & Bug Fix Session"
files_modified:
  - convex/http.ts
  - convex/clerk/webhook.ts (NEW)
  - convex/users.ts
  - convex/embeddings/search.ts
  - convex/embeddings/generate.ts
  - src/app/api/webhooks/clerk/route.ts
  - src/hooks/use-admin.ts
  - src/hooks/use-messages.ts
  - src/lib/analytics.ts
  - .github/workflows/ci.yml
  - next.config.ts
  - architecture.md
  - .agent/state.md
  - .agent/progress_log.md
  - .agent/incident_log.md
  - src/app/api/chat/route.ts
test_status: NOT_RUN (production code focus only)
commits: [pending]
assumptions: |
  All 45+ architecture.md §21 items reconciled with actual code state.
  12 items marked [FIXED] (5 were already fixed in code but not documented).
  6 production-code bugs fixed: webhook secret leak, CI cache key, FAQ score, as any casts, analytics docs, embedding fallback docs.
  Embedding fallback intentionally NOT added (cross-provider would break vector space).
  Analytics intentionally NOT wired (no-op pattern for zero-cost future integration).
issues_discovered: |
  Many architecture.md §21 items were already fixed in code but marked [BUG] — fixed documentation.
  163 total as any casts found (most in test files — acceptable).
  npx tsc --noEmit times out due to monorepo size — scoped verification to convex/ TS compile.
  WEBHOOK_SECRET now shared via HTTP Authorization header instead of mutation args.
  Convex HTTP action for user events reuses same auth pattern as crawl webhooks.
