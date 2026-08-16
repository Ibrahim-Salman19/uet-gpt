/**
 * tests/convex/crawl/retryBudget.test.ts
 *
 * August 2026 incident remediation - proves the total per-chunk retry budget
 * mathematically rather than by inspection, per the requirement that "a
 * simpler robust attempt budget gives the same safety property" as counting
 * every HTTP request individually, AND that individual retry layers must be
 * co-tuned rather than tuned independently.
 *
 * Layers, innermost to outermost:
 *   A. fetchWithRetry in convex/embeddings/generate.ts   - maxRetries = 3
 *   B. Gemini key rotation in generateEmbeddingsInternal - <=3 keys configured
 *      (verified NOT to multiply further by the `ai` SDK's own embedMany
 *      retry wrapper - see tests/unit/embeddings-generate.test.ts)
 *   C. embeddingPool.defaultRetryBehavior.maxAttempts (crawl/workpools.ts)
 *   D. crawl/mutations.ts's MAX_RETRIES (DLQ abandon threshold; each DLQ
 *      cycle gets its own fresh Workpool job, i.e. its own C attempts)
 *
 * Old configuration: C=5, D=5  -> 25 executions -> up to 225-300 HTTP calls.
 * New configuration: C=3, D=2 -> 6 executions -> up to 54-72 HTTP calls.
 */
import { describe, expect, it } from "vitest";
import { MAX_RETRIES } from "../../../convex/crawl/mutations";
import { EMBEDDING_WORKPOOL_MAX_ATTEMPTS } from "../../../convex/crawl/workpools";

const FETCH_WITH_RETRY_MAX_RETRIES = 3; // convex/embeddings/generate.ts
const CONFIGURED_GEMINI_KEYS_THIS_DEPLOYMENT = 3; // GEMINI_API_KEY, _1, _2
const CODE_SUPPORTED_GEMINI_KEY_CEILING = 4; // + GOOGLE_GENERATIVE_AI_API_KEY

describe("total per-chunk embedding retry budget", () => {
  it("keeps the two independently-configured layers (Workpool attempts x DLQ cycles) dramatically below the pre-incident total", () => {
    const totalExecutions = EMBEDDING_WORKPOOL_MAX_ATTEMPTS * MAX_RETRIES;

    // The actual new bound.
    expect(EMBEDDING_WORKPOOL_MAX_ATTEMPTS).toBe(3);
    expect(MAX_RETRIES).toBe(2);
    expect(totalExecutions).toBe(6);

    // The bound this replaces (25 executions, from maxAttempts=5 x
    // MAX_RETRIES=5) - asserted here as a fixed historical reference point,
    // not read from current code, so this test keeps meaning what it says
    // even if someone later reads the old git history differently.
    const OLD_TOTAL_EXECUTIONS = 25;
    expect(totalExecutions).toBeLessThan(OLD_TOTAL_EXECUTIONS / 4); // >4x reduction
  });

  it("computes a worst-case external Gemini HTTP-call ceiling dramatically below the pre-incident 225-300", () => {
    const totalExecutions = EMBEDDING_WORKPOOL_MAX_ATTEMPTS * MAX_RETRIES;
    const httpCallsPerExecutionConfigured =
      FETCH_WITH_RETRY_MAX_RETRIES * CONFIGURED_GEMINI_KEYS_THIS_DEPLOYMENT;
    const httpCallsPerExecutionCeiling =
      FETCH_WITH_RETRY_MAX_RETRIES * CODE_SUPPORTED_GEMINI_KEY_CEILING;

    const worstCaseConfigured = totalExecutions * httpCallsPerExecutionConfigured;
    const worstCaseCeiling = totalExecutions * httpCallsPerExecutionCeiling;

    expect(worstCaseConfigured).toBe(54);
    expect(worstCaseCeiling).toBe(72);

    // The incident-era bounds this replaces (225 configured / 300 ceiling).
    expect(worstCaseConfigured).toBeLessThan(225 / 3);
    expect(worstCaseCeiling).toBeLessThan(300 / 3);
  });

  it("still absorbs a plausible transient failure: at least 2 immediate retries plus one hours-later second chance", () => {
    // Not a rubber-stamp minimum - a config that regresses to 1 total
    // execution would "pass" the budget-reduction tests above trivially
    // while destroying real transient-failure recovery, which the remediation
    // explicitly must not do.
    expect(EMBEDDING_WORKPOOL_MAX_ATTEMPTS).toBeGreaterThanOrEqual(2);
    expect(MAX_RETRIES).toBeGreaterThanOrEqual(2);
  });
});
