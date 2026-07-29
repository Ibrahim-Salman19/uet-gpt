# Semantic Cache Evaluation & Stampede Audit

**Date:** July 29, 2026  

---

## 1. Cache Key Completeness
Keys incorporate normalized query text, language, intent, risk class, policy versions, and corpus generation.

---

## 2. Invalidation Invariants
- `assertCacheEntryCompatible` enforces policy matching, expiry timestamps, and source eligibility.
- Invalidation triggered whenever an underlying document is marked `superseded` or `stale`.
- Stampede protection verified: single lock producer per cache miss key.
