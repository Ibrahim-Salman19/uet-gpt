# Evaluation

> Implemented evaluation harness. Authoritative detail in `architecture.md` §13.

## Metrics

- **Retrieval:** Recall@K (`recall_at_5` is the primary regression metric), `fragment_hit_rate`, MRR
- **Generation:** Faithfulness, relevance, completeness
- **Latency:** P50/P95 time-to-first-token, total response time
- **Cache:** Hit rate, similarity threshold tuning (threshold `0.92`, `convex/constants.ts`)

## Harness (implemented)

- **Golden set:** `scripts/eval/golden_set.jsonl` - 50 QA pairs across categories
  (admissions, fees, exams, departments, etc.).
- **Runner:** `scripts/eval/run_eval.py` - computes `recall_at_5` and `fragment_hit_rate`.
- **Convex eval action:** `convex/eval.ts:evaluateSearch` - runs `rag.search()` and hydrates chunk results.

## Open Items

- [ ] Add per-stage ablation benchmarks (with/without HyDE, with/without RRF)
- [ ] Wire the eval runner into CI for automated regression gating
- [ ] Define production quality gates beyond the recall regression check

See `architecture.md` §13 for exit codes and the regression-gate contract.
