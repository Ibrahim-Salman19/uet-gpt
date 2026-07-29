# Hybrid Fusion and Overfetch Evaluation

**Date:** July 29, 2026  

---

## 1. Reciprocal Rank Fusion (RRF) & Weighting
- Channel RRF scores combined with authority, freshness, and applicability multipliers.
- Duplicate chunk candidates deduplicated across dense and lexical channels without double-counting corroboration.

---

## 2. Overfetch Calibration
- Convex vector search limit: max 256 candidates.
- Candidate hydration re-evaluates `status`, `lifecycleStatus`, and `securityStatus`.
- Overfetch factor (2.5x requested `topK`) ensures that filtered out invalid/stale candidates do not starve final top-K output.
