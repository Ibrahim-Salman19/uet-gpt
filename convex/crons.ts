import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// DISABLED: Crawl4AI Docker not deployed — localhost:11235 unreachable from Convex cloud.
// Re-enable when CRAWL4AI_URL is set to a publicly accessible endpoint.
// crons.weekly(
//   "weekly-uet-webcrawl",
//   { dayOfWeek: "sunday", hourUTC: 0, minuteUTC: 0 },
//   internal.crawl.workflow.kickoffDailyCrawl,
// );

// Cleanup for expired cache items (semantic queries/webhook logs). Runs every
// 12h (was daily) with a 500-row batch (was 100) so expired rows don't outpace
// deletion — semanticCache stores full responses + 768-dim embeddings per row,
// making it the primary storage consumer that must stay bounded.
crons.interval(
  "cleanup-expired-cache",
  { hours: 12 },
  internal.crawl.tasks.cleanupExpiredCache,
  { limit: 500 },
);

// Retry dead letter queue every 4 hours
crons.interval("retry-dead-letter", { hours: 4 }, internal.crawl.mutations.retryDeadLetterQueue, {
  limit: 100,
});

// Reset DLQ entries stuck in "processing" state (worker crash recovery)
// Runs every 30 minutes — entries stuck for >30min are reset to "pending_retry"
crons.interval(
  "reset-stuck-dlq-entries",
  { minutes: 30 },
  internal.crawl.mutations.resetStuckDLQEntries,
  {},
);

// Every 2 hours: detect crawl jobs stuck in "running" state for >2 hours (reduced from 30min)
crons.interval("fail-stuck-crawl-jobs", { hours: 2 }, internal.crawl.workflow.failStuckJobs);

// Weekly cleanup of old abandoned DLQ entries and completed/failed/cancelled crawl jobs.
// WS-3: cleanupOldRecords now also purges resolved (indexed) DLQ rows and stale
// pending/processing rows that were never previously cleaned — the primary DLQ
// storage-growth fix.
crons.weekly(
  "cleanup-old-records",
  { dayOfWeek: "sunday", hourUTC: 2, minuteUTC: 0 },
  internal.crawl.jobs.cleanupOldRecords,
  { limit: 200 },
);

// WS-3: weekly orphan-chunk compaction — removes crawledChunks + their RAG
// vectors whose parent document no longer exists (cascade from chunkParents).
// Defensive against legacy orphans from the now-closed TOCTOU window.
crons.weekly(
  "compact-orphaned-chunks",
  { dayOfWeek: "sunday", hourUTC: 2, minuteUTC: 30 },
  internal.crawl.jobs.compactOrphans,
  { limit: 200 },
);

// WS-3: weekly trim of dead chunkText payloads from resolved/abandoned DLQ rows.
// Keeps the failure audit trail (reason/status/timestamps) but reclaims the
// duplicated chunk body storage.
crons.weekly(
  "trim-dlq-payloads",
  { dayOfWeek: "sunday", hourUTC: 2, minuteUTC: 45 },
  internal.crawl.jobs.trimDlqPayloads,
  { limit: 200 },
);

// Run weekly thread cleanup
crons.weekly(
  "purge-old-archived-threads",
  { dayOfWeek: "sunday", hourUTC: 3, minuteUTC: 0 },
  internal.threads.purgeOldArchived,
  {},
);

// Hourly cleanup for stale rate limit tracking
crons.interval("clear-stale-rate-limits", { hours: 1 }, internal.rateLimit.clearStaleRateLimits);

// Phase 2: Contextual retrieval — daily backfill of raw chunks via Gemini Flash free tier
// Runs at 3:00 UTC, after daily crawl completes at 0:00 UTC, before staleness check at 4:00 UTC
// Processes up to 10 chunks/day (reduced from 50 to save bandwidth & respect 250 RPD free tier)
crons.daily(
  "daily-contextualize-chunks",
  { hourUTC: 3, minuteUTC: 0 },
  internal.embeddings.contextualizeCron.contextualizeCron,
);

// Phase 5: Observability — check document staleness daily
crons.daily(
  "staleness-check",
  { hourUTC: 4, minuteUTC: 0 },
  internal.observability.staleness.checkStaleness,
);

// STATS-001: Pre-compute dashboard statistics hourly.
// Was every 5 min (288 runs/day) and full-scanned five whole tables — including
// the embedding-heavy semanticCache — which was the dominant DB-bandwidth driver
// (cost scaled O(cacheRows × embeddingSize) × 288/day). An admin count dashboard
// does not need 5-minute freshness; computeDashboardStats additionally re-counts
// the heavy semanticCache only ~4×/day. See convex/admin/stats.ts.
crons.interval("compute-dashboard-stats", { hours: 1 }, internal.admin.stats.computeDashboardStats);

export default crons;
