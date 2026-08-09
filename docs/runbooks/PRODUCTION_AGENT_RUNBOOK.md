# UETGPT Production Agent Operational Runbook

**Target System:** UETGPT  
**Architecture Class:** Bounded agentic RAG workflow with deterministic evidence control  
**Last Verified:** July 29, 2026  
**Status:** PRODUCTION READY  

---

## 1. Executive Overview

UETGPT is implemented as a **code-defined, read-only, temporally governed, evaluation-driven RAG agent** with limited tool autonomy and server-enforced evidence control. 

It strictly avoids unrestricted ReAct loops or unconstrained web searches in favor of a deterministic workflow graph.

---

## 2. Hard Operational Policy (`UETGPT_EXECUTION_POLICY`)

Defined in `convex/agent/policy.ts`:

* **Mode**: `read_only_grounded_qa` (0 write tools)
* **Model Turn Limit**: Max 3 turns
* **Tool Call Limit**: Max 5 calls
* **Query Variants**: Max 3 variants
* **Retrieval Limit**: Max 256 vector candidates (rehydrated & revalidated), max 12 context items
* **Request Limits**: Max 2,000 characters
* **Context Budget**: Max 24,000 tokens
* **Deadlines**: 
  * Overall: 12,000 ms
  * Reranking: 2,500 ms
  * Live Verification: 4,000 ms

---

## 3. Workflow Graph & State Engine

```text
Received ──▶ Security Checked ──▶ Classified ──▶ Cache Checked ──▶ Evidence Evaluated
                                                                             │
                      ┌──────────────────────────────────────────────────────┴──────────────────────────────────────────────────────┐
                      ▼                                                                                                             ▼
             [Decision: Abstain / Refuse]                                                                                  [Decision: Answer]
                      │                                                                                                             │
                      ▼                                                                                                             ▼
             State: "abstained" / "refused"                                                                                Generation Allowed
             Reason Code logged to traceSpans                                                                                      │
             Returns early (No LLM generation)                                                                                      ▼
                                                                                                                           State: "completed"
```

---

## 4. Security Gateway & Isolation Controls

1. **Layer A Injection Protection**: `convex/security/requestGuard.ts` strips null bytes/control characters and scans deterministic regex patterns for system prompt overrides, developer mode simulations, and script injection.
2. **SSRF Host Allowlist**: `convex/verification/officialSourceVerifier.ts` restricts fetch calls to `*.uet.edu.pk` and `*.uettaxila.edu.pk`, enforces `redirect: "manual"` to prevent HTTP 3xx redirect bypasses, and sets a 4-second timeout.
3. **Untrusted Context Wrapping**: `convex/generation/context.ts` HTML-entity encodes all evidence fields (`id`, `title`, `url`, `authority`, `content`) to prevent XML tag breakout (`</UNTRUSTED_SOURCE_CONTENT>`).

---

## 5. Temporal Knowledge & Governance

1. **Separated State Dimensions** in `documents` (`convex/schema.ts`):
   * `lifecycleStatus`: `active` | `superseded` | `withdrawn` | `explicitly_stale` | `quarantined` | `deleted`
   * `freshnessState`: `fresh` | `aged` | `unknown`
   * `applicability`: `current` | `historical` | `session_specific` | `expired` | `timeless` | `unknown`
2. **Freshness Sweeps**: `convex/governance/freshnessSweep.ts` evaluates documents against priority TTLs:
   * High Priority: 14 days
   * Medium Priority: 60 days
   * Low Priority: 180 days
3. **Cache Hit Revalidation**: `convex/cache/validate.ts` invalidates cache entries when source documents are updated/superseded or when `high_current` query hits exceed 1 hour.

---

## 6. Evaluation System & Release Promotion

1. **Evaluation Metrics**: `convex/evaluation/metrics.ts` computes:
   * `Recall@K`: Overlap with ground truth documents
   * `MRR`: Reciprocal rank of first ground truth match
   * `CitationCorrectness`: Ratio of approved official URLs
   * `GroundednessScore`: $1.0 - \text{unsupportedClaimRate}$
2. **Promotion Pipeline** (`convex/evaluation/promotion.ts`):
   ```text
   candidate ──▶ preview ──▶ canary ──▶ production
   ```
   Requires explicit offline, preview, and canary evaluation sign-offs (`approvedBy`, `approvedAt`).

---

## 7. Operational Reason Code Reference

Every trace span in `traceSpans` logs low-cardinality reason codes for troubleshooting:

| Reason Code | Meaning | Action / Troubleshooting |
| :--- | :--- | :--- |
| `HIGH_CURRENT_NO_FRESH_PRIMARY_SOURCE` | High-risk query missing fresh primary evidence | Trigger crawl or run live verification |
| `TEMPORAL_CONFLICT_UNRESOLVED` | Conflicting metadata detected across active sources | Inspect source versions & resolve conflict |
| `NO_ELIGIBLE_EVIDENCE` | Zero matching evidence items found | Check query classification & index coverage |
| `PROMPT_INJECTION_DETECTED` | Request blocked by security gateway | Review security log in `traceSpans` |
| `LIVE_VERIFICATION_HOST_DENIED` | URL rejected by SSRF host allowlist | Ensure target URL belongs to official host |
| `CACHE_REVALIDATION_EXPIRED` | Cache entry invalidated by source update or TTL | System automatically fetches fresh evidence |

---

## 8. Verification & Test Commands

Run the full verification suite before any deployment:

```bash
# Typecheck
pnpm typecheck

# Execute Unit Test Suite
pnpm vitest run tests/unit/evidence-gate.test.ts \
                tests/unit/official-verifier.test.ts \
                tests/unit/cache-validate.test.ts \
                tests/unit/phase3-routing-security.test.ts \
                tests/unit/phase4-metrics-observability.test.ts \
                tests/unit/agent-execute.test.ts
```
