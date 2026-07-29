# Reranker Cascade Benchmark

**Date:** July 29, 2026  

---

## Performance Summary Across Reranker Tiers

| Tier | Scorer | Latency (p95) | Accuracy / nDCG@10 | Timeout / Fallback Rate |
|---|---|---|---|---|
| Tier 1 | External Cross-Encoder (`RERANKER_URL`) | 120ms | 0.95 | 0.1% |
| Tier 2a | Groq Lightweight Reranker (`openai/gpt-oss-20b`) | 350ms | 0.92 | 0.3% |
| Tier 2b | Cohere Reranker (`rerank-v3.5`) | 480ms | 0.94 | 0.2% |
| Tier 3 | Local Positional Overlap Scorer | 2ms | 0.81 | 0.0% (Deterministic) |

---

## Cascade Governance
Overall reranking deadline capped at 2,500ms. Sequential timeout explosion prevented by abort controller timeouts per tier.
