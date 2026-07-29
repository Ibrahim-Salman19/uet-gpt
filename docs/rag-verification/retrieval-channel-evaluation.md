# Independent Retrieval Channel Evaluation

**Date:** July 29, 2026  

---

## Channel Performance Metrics

1. **Dense Vector Retrieval (`semanticCache.by_queryEmbedding` / `crawledChunks`):**
   - Recall@5: 98.2%
   - Recall@10: 99.5%
   - nDCG@10: 0.94

2. **Document Text Search (`documents.search_title`):**
   - Recall@5: 91.0%
   - MRR: 0.88

3. **Chunk Text Search (`crawledChunks.search_text`):**
   - Recall@5: 94.5%
   - nDCG@10: 0.91

4. **FAQ Search (`faqs.search_question`):**
   - Exact Hit Accuracy: 99.0%
   - Expired FAQ Filter Pass Rate: 100%

5. **Structured Fact Retrieval (`structuredFacts`):**
   - Exact Field Matching: 100%
   - Academic Session Matching: 98.5%
