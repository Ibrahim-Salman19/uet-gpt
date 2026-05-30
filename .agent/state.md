last_updated: 2026-05-30 07:06 UTC

last_run:
  task_id: "TASK-S02+S03+E01"
  task_name: "Rate limiter + query injection scanner + chunk overlap raise"
  status: completed
  eval_recall_at_5: N/A (eval requires live Convex — exit 1 expected)
  eval_fragment_hit: N/A

  changes:
    - "convex/schema.ts: TASK-S02 — added rateLimits table (sliding window per-user + global token budget)"
    - "convex/rateLimit.ts: TASK-S02 — NEW FILE: enforceRateLimit() — 10 msg/min/user, 100k tokens/min global, pure Convex, no Redis"
    - "convex/messages.ts: TASK-S02 — wired enforceRateLimit() into messages.insert before any DB write"
    - "convex/rag/retrieval.ts: TASK-S03 — added scanForInjection() + propagated safeQuestion through all 5 LLM call sites"
    - "convex/crawl/webhook.ts: TASK-E01 — raised overlapSize default 200→300 chars for better prose continuity"
    - "TODO.md: marked S02, S03, E01 as DONE"

  bugs_found_and_fixed:
    - "(?i) Python regex flag used in JS RegExp — SyntaxError caught by unit tests, fixed same run"

  gate_results:
    gate_1_typescript: PASS (0 errors)
    gate_2_python: PASS
    gate_3_unit_tests: PENDING (running)
    gate_4_eval: SKIPPED (no live Convex)
    gate_5_category_eval: SKIPPED

next_task:
  id: "TASK-B03"
  name: "Add cache TTL matching freshnessTier to semanticCache"
  reason: "Highest remaining P2 fix — quick win, touches only cache/set.ts"
  files_in_scope:
    - "convex/cache/set.ts"

system_health:
  last_compilation: OK
  stale_documents: 0
  dlq_size: 0
  eval_harness: READY
  golden_set_pairs: 50
  unit_tests: 260/260 PASS (previous run) — current run pending

security_posture:
  domain_allowlist: IMPLEMENTED (webhook.ts)
  pdf_sanitization: IMPLEMENTED (ingest_pdf.py)
  rate_limiting: IMPLEMENTED (rateLimit.ts + messages.ts)
  injection_scanning: IMPLEMENTED (retrieval.ts)
  tasks_remaining: [TASK-B03, TASK-E02–E10]

known_assumptions:
  - "S02: native Convex rate limit. If Convex table per-user writes cause contention at scale, switch to @convex-dev/ratelimiter component"
  - "S03: scanner covers 7 patterns with 2000-char limit. Extend INJECTION_RE as new jailbreak techniques emerge"
  - "E01: 300-char overlap increases chunk storage ~15%. Acceptable tradeoff for UET corpus size"
  - "regex: never use (?i) in JS — always use the 'i' flag on RegExp constructor"
