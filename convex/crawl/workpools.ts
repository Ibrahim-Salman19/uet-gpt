import { Workpool } from "@convex-dev/workpool";
import { components } from "../_generated/api";

// Total per-chunk retry budget (August 2026 incident remediation): exported
// (rather than an inline literal) so it is co-tuned with MAX_RETRIES in
// crawl/mutations.ts (the DLQ abandon threshold), not set independently, and
// so tests/convex/crawl/retryBudget.test.ts can prove the resulting total
// mathematically instead of by inspection. One embedSingleChunk job = up to
// EMBEDDING_WORKPOOL_MAX_ATTEMPTS internal Workpool tries; each DLQ retry
// cycle (crawl/mutations.ts's MAX_RETRIES) gets its own fresh job. Total
// worst-case executions per chunk = 3 x 2 = 6 (was 5 x 5 = 25), and total
// external Gemini HTTP calls = 6 x (fetchWithRetry=3 x configured keys<=3) =
// up to 54 (was up to 225). 3 attempts with 4s->8s backoff still absorbs a
// genuine momentary network blip; a longer rate-limit/quota issue gets
// exactly one more chance ~4h later (the DLQ cron interval) rather than
// repeated same-day amplification.
export const EMBEDDING_WORKPOOL_MAX_ATTEMPTS = 3;

// Normal (non-emergency) maxParallelism for each pool. Exported as named
// constants - not re-derived or hardcoded elsewhere - so emergencyStop.ts's
// resumeBulkOperations can restore the exact configured value after an
// emergency stop set it to 0, rather than guessing/duplicating the number.
export const EMBEDDING_WORKPOOL_MAX_PARALLELISM = 3;
export const CRAWL_WORKPOOL_MAX_PARALLELISM = 3;

export const embeddingPool = new Workpool(components.embeddingWorkpool, {
  // Gemini Free Tier safe limit: 15 RPM = 1 request per 4 seconds
  // Setting parallelism to 3 limits throughput gracefully.
  maxParallelism: EMBEDDING_WORKPOOL_MAX_PARALLELISM,
  retryActionsByDefault: true,
  defaultRetryBehavior: {
    maxAttempts: EMBEDDING_WORKPOOL_MAX_ATTEMPTS,
    initialBackoffMs: 4000, // 4s initial backoff to let RPM cool down
    base: 2, // Exponential backoff: 4s -> 8s -> 16s
  },
  logLevel: "INFO",
});

export const crawlPool = new Workpool(components.crawlWorkpool, {
  // Crawl4AI Docker concurrency throttle
  maxParallelism: CRAWL_WORKPOOL_MAX_PARALLELISM,
  retryActionsByDefault: true,
  defaultRetryBehavior: {
    maxAttempts: 3,
    initialBackoffMs: 5 * 60 * 1000, // 5 minutes
    base: 3, // Exponential: 5m -> 15m -> 45m
  },
});
