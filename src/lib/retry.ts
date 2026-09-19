/**
 * Decide whether an error is worth retrying. By default we only retry
 * TRANSIENT failures (network/timeout/connection resets, and Convex
 * optimistic-concurrency conflicts) and bail immediately on permanent ones
 * such as validation, authorization, or business-rule (ConvexError) failures -
 * retrying those just wastes backoff time and, for non-idempotent work, risks
 * double-applying side effects.
 *
 * Callers may override this via the `shouldRetry` option.
 *
 * NOTE: the operations this is used for (user sync, message save) must be
 * idempotent (upserts) so a retry after a partial success is safe.
 */
function isTransientError(error: unknown): boolean {
  // Convex business/validation/authorization failures are surfaced as
  // ConvexError and are NOT transient - do not retry them.
  if (error instanceof Error && error.name === "ConvexError") return false;

  const message = error instanceof Error ? error.message : typeof error === "string" ? error : "";
  const lower = message.toLowerCase();

  // Optimistic concurrency control / write conflicts are safe to retry.
  if (lower.includes("optimistic concurrency") || lower.includes("write conflict")) {
    return true;
  }

  // Common transient network/timeout signals.
  return (
    lower.includes("timeout") ||
    lower.includes("timed out") ||
    lower.includes("etimedout") ||
    lower.includes("econnreset") ||
    lower.includes("econnrefused") ||
    lower.includes("enotfound") ||
    lower.includes("eai_again") ||
    lower.includes("network") ||
    lower.includes("fetch failed") ||
    lower.includes("socket hang up")
  );
}

/**
 * A message write rejected with "Authentication required" is a token-refresh race, not a
 * real authorization failure, and is the one ConvexError worth retrying.
 *
 * ConvexProviderWithClerk re-mints the Clerk session token periodically; a mutation issued
 * in that gap reaches the server with no identity and requireAuth (convex/auth.ts:78)
 * rejects it. Observed in production 2026-09-19 09:49:23 on a session whose *user* message
 * had inserted successfully moments earlier - the user was signed in throughout, and only
 * the assistant save landed in the gap.
 *
 * Safe to retry even though messages:insert is not idempotent: requireAuth runs before any
 * write, and a Convex mutation that throws rolls back, so nothing was stored and a retry
 * cannot duplicate the message. Note this is deliberately NARROWER than isTransientError -
 * it does not retry network errors, where the mutation may have committed and only the
 * acknowledgement was lost, which retrying could turn into a duplicate reply.
 */
export function isAuthRefreshRace(error: unknown): boolean {
  const data = (error as { data?: unknown } | null)?.data;
  const parts = [
    error instanceof Error ? error.message : typeof error === "string" ? error : "",
    typeof data === "string" ? data : "",
  ];
  return parts.join(" ").includes("Authentication required");
}

/**
 * Retry an async function with exponential backoff.
 * Used for critical mutations that must eventually succeed (user sync, message save).
 *
 * Only transient errors are retried by default (see {@link isTransientError});
 * permanent failures are re-thrown immediately. Override with `shouldRetry`.
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: {
    maxRetries?: number;
    baseDelayMs?: number;
    maxDelayMs?: number;
    onRetry?: (attempt: number, error: unknown) => void;
    /** Predicate deciding if an error is retryable. Defaults to transient-only. */
    shouldRetry?: (error: unknown) => boolean;
  } = {},
): Promise<T> {
  const {
    maxRetries = 3,
    baseDelayMs = 1000,
    maxDelayMs = 10000,
    onRetry,
    shouldRetry = isTransientError,
  } = options;

  let lastError: unknown;
  for (let i = 0; i <= maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      // Bail immediately on permanent (non-retryable) errors.
      if (!shouldRetry(error)) throw error;
      if (i === maxRetries) break;
      const delay = Math.min(baseDelayMs * 2 ** i, maxDelayMs);
      const jitter = delay * (0.5 + Math.random() * 0.5); // Add jitter to prevent thundering herd
      onRetry?.(i + 1, error);
      await new Promise((r) => setTimeout(r, jitter));
    }
  }
  throw lastError;
}
