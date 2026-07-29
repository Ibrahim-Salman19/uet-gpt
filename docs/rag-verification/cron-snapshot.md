# Convex Cron Schedule Snapshot

**Snapshot Date:** July 29, 2026

## Active Cron Jobs

1. **`cleanup-expired-cache`** (Interval: every 12 hours)
   - Handler: `internal.crawl.tasks.cleanupExpiredCache`
   - Limit: 500 rows

2. **`retry-dead-letter`** (Interval: every 4 hours)
   - Handler: `internal.crawl.mutations.retryDeadLetterQueue`
   - Limit: 100 rows

3. **`reset-stuck-dlq-entries`** (Interval: every 30 minutes)
   - Handler: `internal.crawl.mutations.resetStuckDLQEntries`

4. **`fail-stuck-crawl-jobs`** (Interval: every 2 hours)
   - Handler: `internal.crawl.workflow.failStuckJobs`

5. **`cleanup-old-records`** (Weekly: Sunday 02:00 UTC)
   - Handler: `internal.crawl.jobs.cleanupOldRecords`

6. **`compact-orphaned-chunks`** (Weekly: Sunday 02:30 UTC)
   - Handler: `internal.crawl.jobs.compactOrphans`

7. **`trim-dlq-payloads`** (Weekly: Sunday 02:45 UTC)
   - Handler: `internal.crawl.jobs.trimDlqPayloads`

8. **`purge-old-archived-threads`** (Weekly: Sunday 03:00 UTC)
   - Handler: `internal.threads.purgeOldArchived`

9. **`clear-stale-rate-limits`** (Interval: every 1 hour)
   - Handler: `internal.rateLimit.clearStaleRateLimits`

10. **`daily-contextualize-chunks`** (Daily: 03:00 UTC)
    - Handler: `internal.embeddings.contextualizeCron.contextualizeCron`

11. **`staleness-flag-expired`** (Daily: 03:30 UTC)
    - Handler: `internal.crawl.staleness.flagExpiredDocuments`

12. **`staleness-check`** (Daily: 04:00 UTC)
    - Handler: `internal.observability.staleness.checkStaleness`

13. **`compute-dashboard-stats`** (Interval: every 1 hour)
    - Handler: `internal.admin.stats.computeDashboardStats`
