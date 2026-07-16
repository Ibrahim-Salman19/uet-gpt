# TODO.md - Live Task Queue
<!-- Maintained by the autonomous agent (CRONJOB.md protocol). -->

## P1 - Security (from THREAT_MODEL.md §5, docs/security.md)

### TASK-S01 - Upstash rate limiter fail policy
- **Priority:** P1 [SECURITY]
- **Status:** OPEN
- **Acceptance:** Fail-closed or fail-open policy defined in architecture.md §7.3; tested under simulated Redis outage.
- **Scope:** `src/lib/rate-limit.ts`, `architecture.md`

### TASK-S02 - Webhook secret rotation procedure
- **Priority:** P1 [SECURITY]
- **Status:** OPEN
- **Acceptance:** Documented rotation procedure for `CLERK_WEBHOOK_SECRET`, `CRAWL_WEBHOOK_SECRET`, `INTERNAL_API_SECRET` including steps, verification, rollback.
- **Scope:** `docs/security.md`, `architecture.md`

### TASK-S03 - Strengthen prompt-injection defenses
- **Priority:** P1 [SECURITY]
- **Status:** OPEN
- **Acceptance:** Output validation / content provenance tagging in RAG pipeline; LLM01 upgraded from Partial to Implemented in THREAT_MODEL.md.
- **Scope:** `convex/rag/prompts.ts`, `convex/rag/retrieval.ts`

### TASK-S04 - Harden crawler SSRF controls
- **Priority:** P1 [SECURITY]
- **Status:** OPEN
- **Acceptance:** Crawler enforces resolved-host allowlist before fetch; LLM08 upgraded from Partial to Implemented in THREAT_MODEL.md.
- **Scope:** `scripts/crawler.py`, `scripts/crawl_config.json`

---

<!-- Agent: append new tasks below. Mark [DONE: YYYY-MM-DD] or [BLOCKED: reason]. -->
<!-- Never delete tasks - archive them. -->
