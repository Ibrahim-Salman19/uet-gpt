# Failure Injection & Chaos Testing Report

**Date:** July 29, 2026  

---

## Simulated Failure Scenarios & System Response

1. **Embedding API Rate Limit (HTTP 429):**
   - System response: Key rotation across `GEMINI_API_KEY`, `GEMINI_API_KEY_1`, `GEMINI_API_KEY_2`. Capped exponential backoff with jitter activated. Zero pipeline dropouts.

2. **Reranker Timeout (> 5,000ms):**
   - System response: Reranker tier automatically degrades to Tier 2 (Groq) or Tier 3 (Positional overlap). System remains responsive within budget.

3. **Missing Metadata Post Vector Search:**
   - System response: Re-fetched candidate returned `null` -> Candidate dropped silently from fusion list without crashing action execution.

4. **Groq Primary Model Outage (HTTP 503):**
   - System response: Fallback chain automatically switches to `gemini-3.5-flash-lite`.
