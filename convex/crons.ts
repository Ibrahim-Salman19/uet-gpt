import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Run the daily web crawl at midnight UTC
crons.daily(
  "daily-uet-webcrawl",
  { hourUTC: 0, minuteUTC: 0 },
  internal.crawl.workflow.kickoffDailyCrawl,
);

// Daily cleanup for expired cache items (semantic queries/webhook logs)
crons.daily(
  "daily-cleanup-expired-cache",
  { hourUTC: 1, minuteUTC: 0 },
  internal.crawl.tasks.cleanupExpiredCache,
  {},
);

// Second daily cleanup pass for cache entries missed by cleanupExpiredCache
crons.daily(
  "daily-cleanup-expired-v2",
  { hourUTC: 13, minuteUTC: 0 },
  internal.cache.internal_queries.cleanupExpired,
  { limit: 100 },
);

// Retry dead letter queue every 4 hours
crons.interval("retry-dead-letter", { hours: 4 }, internal.crawl.mutations.retryDeadLetterQueue, {
  limit: 100,
});

// Every 30 minutes: detect crawl jobs stuck in "running" state for >2 hours
// Prevents Crawl4AI container crashes from permanently blocking daily crawls.
crons.interval("fail-stuck-crawl-jobs", { minutes: 30 }, internal.crawl.workflow.failStuckJobs);

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
);

export default crons;
