/**
 * Retry an async function with exponential backoff.
 * Used for critical mutations that must eventually succeed (user sync, message save).
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: {
    maxRetries?: number;
    baseDelayMs?: number;
    maxDelayMs?: number;
    onRetry?: (attempt: number, error: unknown) => void;
  } = {}
): Promise<T> {
  const { maxRetries = 3, baseDelayMs = 1000, maxDelayMs = 10000, onRetry } = options;

  let lastError: unknown;
  for (let i = 0; i <= maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (i === maxRetries) break;
      const delay = Math.min(baseDelayMs * Math.pow(2, i), maxDelayMs);
      const jitter = delay * (0.5 + Math.random() * 0.5); // Add jitter to prevent thundering herd
      onRetry?.(i + 1, error);
      await new Promise((r) => setTimeout(r, jitter));
    }
  }
  throw lastError;
}
