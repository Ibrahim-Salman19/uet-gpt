import { Workpool } from "@convex-dev/workpool";
import { components } from "../_generated/api";

export const embeddingPool = new Workpool(components.embeddingWorkpool, {
  // Gemini Free Tier safe limit: 15 RPM = 1 request per 4 seconds
  // Setting parallelism to 3 limits throughput gracefully.
  maxParallelism: 3,
  retryActionsByDefault: true,
  defaultRetryBehavior: {
    maxAttempts: 5,
    initialBackoffMs: 4000, // 4s initial backoff to let RPM cool down
    base: 2, // Exponential backoff: 4s -> 8s -> 16s -> 32s -> 64s
  },
  logLevel: "INFO",
});

export const crawlPool = new Workpool(components.crawlWorkpool, {
  // Crawl4AI Docker concurrency throttle
  maxParallelism: 3,
  retryActionsByDefault: true,
  defaultRetryBehavior: {
    maxAttempts: 3,
    initialBackoffMs: 5 * 60 * 1000, // 5 minutes
    base: 3, // Exponential: 5m -> 15m -> 45m
  },
});
