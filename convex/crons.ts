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

// Daily cleanup for expired cache items (semantic queries/webhook logs)
crons.daily(
  "daily-cleanup-expired-cache",
  { hourUTC: 1, minuteUTC: 0 },
  internal.crawl.tasks.cleanupExpiredCache,
  {},
);

// Retry dead letter queue every 4 hours
crons.interval("retry-dead-letter", { hours: 4 }, internal.crawl.mutations.retryDeadLetterQueue, {
  limit: 100,
});

// Every 2 hours: detect crawl jobs stuck in "running" state for >2 hours (reduced from 30min)
crons.interval("fail-stuck-crawl-jobs", { hours: 2 }, internal.crawl.workflow.failStuckJobs);

// Weekly cleanup of old abandoned DLQ entries and completed/failed/cancelled crawl jobs
crons.weekly(
  "cleanup-old-records",
  { dayOfWeek: "sunday", hourUTC: 2, minuteUTC: 0 },
  internal.crawl.jobs.cleanupOldRecords,
  { limit: 100 },
);

// Run weekly thread cleanup
crons.weekly(
  "purge-old-archived-threads",
  { dayOfWeek: "sunday", hourUTC: 3, minuteUTC: 0 },
  internal.threads.purgeOldArchived,
  {}
);

// Hourly cleanup for stale rate limit tracking
crons.interval(
  "clear-stale-rate-limits",
  { hours: 1 },
  internal.rateLimit.clearStaleRateLimits,
);

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

export default crons;
