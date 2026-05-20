# Evaluation

## Metrics

- **Retrieval:** Recall@K, Precision@K, MRR
- **Generation:** Faithfulness, relevance, completeness
- **Latency:** P50/P95 time-to-first-token, total response time
- **Cache:** Hit rate, similarity threshold tuning

## Evaluation Methods

- Human review of sample queries (50+ test cases)
- Automated comparison against golden answers
- Ablation studies (with/without HyDE, with/without RRF)

## TODO

- [ ] Create evaluation dataset (QA pairs for UET domain)
- [ ] Build automated eval runner (Convex action or script)
- [ ] Set up CI pipeline for regression testing
- [ ] Define quality gates for production deployment
