# Conflict Detection & Classification Evaluation

**Date:** July 29, 2026  

---

## Conflict Handling Results

1. **Currency Normalization:** `"PKR 5,000"` == `"Rs. 5000"` (Normalized value: `5000`).
2. **Date Normalization:** `"31 July 2026"` == `"2026-07-31"`.
3. **Percentage Normalization:** `"80%"` == `"0.80"`.
4. **Session Differences:** `"Fall 2025"` vs `"Fall 2026"` categorized as `SESSION_DIFFERENCE` (Non-critical).
5. **Critical Contradictions:** Differing fee amounts for the same session categorized as `UNRESOLVED_CRITICAL_CONFLICT` (Critical -> Abstain).
