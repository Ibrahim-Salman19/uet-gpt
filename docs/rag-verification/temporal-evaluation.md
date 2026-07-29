# Temporal Governance & Staleness Evaluation

**Date:** July 29, 2026  

---

## 1. Status Precedence Enforcement
1. Security exclusion
2. Ingestion eligibility
3. Lifecycle exclusion (`superseded`, `withdrawn`, `quarantined`)
4. Temporal classification (`fresh`, `aged`, `unknown`)
5. Query applicability (`current`, `historical`, `session_specific`)
6. Source authority (`official_primary` > `official_secondary` > `official_archive`)
7. Semantic relevance

---

## 2. Staleness Sweep Verification
- `staleness-flag-expired` runs daily at 03:30 UTC.
- Bounded sweep batching (100 docs per step) prevents cron overlap timeout.
- Unresolved stale queries for `high_current` intent abstain deterministically rather than generating outdated information.
