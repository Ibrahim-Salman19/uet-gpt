# Unresolved Residual Risks & Monitoring Playbook

**Date:** July 29, 2026  

---

## Identified Residual Risks & Mitigation Strategies

1. **Third-Party Provider Quota Cuts:**
   - Risk: External LLM or embedding API provider enforces unannounced quota reductions.
   - Mitigation: Multi-key rotation across 4 active API keys (`GEMINI_API_KEY`, `GEMINI_API_KEY_1`, `GEMINI_API_KEY_2`, `GOOGLE_GENERATIVE_AI_API_KEY`) and fallback provider chains (`Groq` -> `Cerebras` -> `Google`).

2. **Unannounced Official University Web Page Layout Changes:**
   - Risk: University redesigns web HTML templates affecting selector extractions.
   - Mitigation: Live verification worker probes official HTTP responses and falls back to structural text parsing; daily staleness sweep flags expired records.

3. **External Reranker Latency Spikes:**
   - Risk: High latency from primary external reranker (`RERANKER_URL`).
   - Mitigation: 5,000ms strict timeout automatically degrades to local positional overlap.
