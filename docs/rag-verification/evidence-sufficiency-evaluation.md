# Evidence Sufficiency & Gating Evaluation

**Date:** July 29, 2026  

---

## Decision Matrix Verification

- **High-Current Queries without Fresh Primary Evidence:** Deterministically output `abstain` with reason code `HIGH_CURRENT_NO_FRESH_PRIMARY_SOURCE`.
- **High-Current Queries with Fresh Primary Evidence:** Output `answer` with reason code `APPROVED_FOR_GENERATION`.
- **Aged-Only Evidence on General Queries:** Output `answer_with_as_of` qualification.
- **Historical Queries:** Output `historical_answer`.
- **Unresolved Conflicts:** Output `abstain` with reason code `TEMPORAL_CONFLICT_UNRESOLVED`.
- **Empty Evidence:** Output `refuse` with reason code `NO_ELIGIBLE_EVIDENCE`.
