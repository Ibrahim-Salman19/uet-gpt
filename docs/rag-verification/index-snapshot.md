# Convex Index Snapshot

**Snapshot Date:** July 29, 2026

## Vector Index

- **Table:** `semanticCache`
- **Name:** `by_queryEmbedding`
- **Vector Field:** `queryEmbedding`
- **Dimensions:** 768
- **Distance Metric:** Cosine similarity

## Full-Text Search Indexes

1. **Table:** `documents`
   - **Name:** `search_title`
   - **Search Field:** `title`

2. **Table:** `crawledChunks`
   - **Name:** `search_text`
   - **Search Field:** `text`

3. **Table:** `faqs`
   - **Name:** `search_question`
   - **Search Field:** `question`

## Core Index Summary

- `documents`: `by_url`, `by_entryId`, `by_category`, `by_status`, `by_status_and_category`, `by_crawledAt`, `by_session`, `by_tier_and_crawled`, `by_contentHash`, `by_source_category`, `by_personType`, `by_status_and_isStale`, `by_lifecycleStatus`, `by_freshnessState`
- `crawledChunks`: `by_documentId`, `by_documentId_and_contentHash`, `by_ragId`, `by_contextualizedText`
- `structuredFacts`: `by_type_and_subject`, `by_session`, `by_freshnessState`
- `sourceRegistry`: `by_sourceId`, `by_canonicalHost`
- `agentReleases`: `by_releaseId`, `by_status`, `by_gitCommit`
- `traceSpans`: `by_traceId`, `by_name`, `by_reasonCode`
