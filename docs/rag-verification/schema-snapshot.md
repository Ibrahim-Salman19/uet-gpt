# Convex Schema Snapshot

**Snapshot Date:** July 29, 2026

## Defined Tables

1. `users` - Clerk authentication identity, roles, and preferences.
2. `feedback` - User feedback (thumbsUp/thumbsDown) linked to message IDs.
3. `crawlJobs` - Crawl configurations, statistics, and status tracking.
4. `semanticCache` - Hybrid vector + metadata semantic caching (vectorIndex `by_queryEmbedding`: 768 dims).
5. `adminAuditLog` - Transactional audit logs for system operations.
6. `documents` - Core metadata, status, lifecycle state, freshness state, applicability, and session.
7. `processedWebhooks` - Idempotency deduplication for external webhooks.
8. `crawlDeadLetter` - Failed crawl jobs and payload DLQ for retry.
9. `crawledChunks` - Text chunks, RAG IDs, parent links, heading hierarchy, contextualized text, search index.
10. `chunkParents` - Normalized parent text storage for contextual chunking.
11. `crawlStats` - Global crawl statistics aggregator.
12. `faqs` - Official FAQs with expiration timestamps and search index.
13. `appSettings` - System configuration key-value storage.
14. `rateLimits` - User sliding window and global token rate limiting.
15. `evalResults` - RAG offline evaluation execution metrics.
16. `dashboardStats` - Admin dashboard global statistics.
17. `sourceRegistry` - Canonical source hosts, path restrictions, and authority tiers.
18. `structuredFacts` - Extracted facts (fees, deadlines, merit, eligibility) with temporal bounds.
19. `evaluationSuites` - Versioned evaluation suite definitions.
20. `agentReleases` - Production agent release manifests and promotion history.
21. `traceSpans` - Distributed telemetry trace spans and reason codes.
