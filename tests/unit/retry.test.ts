import { describe, expect, test, vi } from "vitest";
import { isAuthRefreshRace, retryWithBackoff } from "../../src/lib/retry";

describe("retryWithBackoff", () => {
  test("resolves immediately on success", async () => {
    const fn = vi.fn().mockResolvedValue("success");
    const result = await retryWithBackoff(fn);
    expect(result).toBe("success");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  test("retries on failure up to maxRetries, then throws", async () => {
    // retryWithBackoff only retries TRANSIENT errors (timeout/network/etc.).
    // A bare Error("fail") would be treated as permanent and not retried.
    const fn = vi.fn().mockRejectedValue(new Error("Request timeout"));
    await expect(retryWithBackoff(fn, { maxRetries: 2, baseDelayMs: 1 })).rejects.toThrow(
      "Request timeout",
    );
    expect(fn).toHaveBeenCalledTimes(3); // Initial call + 2 retries
  });

  test("resolves if a retry succeeds", async () => {
    let calls = 0;
    const fn = vi.fn().mockImplementation(async () => {
      calls++;
      if (calls < 2) throw new Error("Request timeout"); // transient → retried
      return "success";
    });
    const result = await retryWithBackoff(fn, { maxRetries: 2, baseDelayMs: 1 });
    expect(result).toBe("success");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  test("does not retry permanent errors", async () => {
    // Validation/business-rule errors (no transient signal) must fail fast.
    const fn = vi.fn().mockRejectedValue(new Error("Validation failed"));
    await expect(retryWithBackoff(fn, { maxRetries: 2, baseDelayMs: 1 })).rejects.toThrow(
      "Validation failed",
    );
    expect(fn).toHaveBeenCalledTimes(1); // not retried
  });
});

/**
 * Regression cover for the production failure of 2026-09-19 09:49:23: the assistant's
 * reply streamed to the user, then messages:insert was rejected with "Authentication
 * required" from a Clerk token-refresh race and the answer was never stored. The thread
 * kept the question with no answer, so the next turn's condenseQuestionAction resolved
 * the follow-up against a hole.
 */
describe("isAuthRefreshRace", () => {
  test("matches the auth-race rejection, however the ConvexError surfaces it", () => {
    expect(isAuthRefreshRace(new Error("Authentication required"))).toBe(true);
    // Convex puts a ConvexError's payload on .data rather than in .message.
    expect(
      isAuthRefreshRace(Object.assign(new Error("x"), { data: "Authentication required" })),
    ).toBe(true);
    expect(isAuthRefreshRace("Authentication required")).toBe(true);
  });

  test("does not match other authorization failures, which are genuinely permanent", () => {
    expect(isAuthRefreshRace(new Error("Not authorized to write to this thread"))).toBe(false);
    expect(isAuthRefreshRace(new Error("User account is deactivated"))).toBe(false);
  });

  test("does not match network errors - retrying those could duplicate the reply", () => {
    // messages:insert appends and is NOT idempotent. A thrown ConvexError means the
    // mutation rolled back, but a dropped acknowledgement does not, so network failures
    // must stay out of this predicate even though isTransientError would retry them.
    expect(isAuthRefreshRace(new Error("fetch failed"))).toBe(false);
    expect(isAuthRefreshRace(new Error("socket hang up"))).toBe(false);
  });
});

describe("assistant message save policy", () => {
  test("retries the auth race and eventually persists the reply", async () => {
    const insert = vi
      .fn()
      .mockRejectedValueOnce(new Error("Authentication required"))
      .mockResolvedValue("message_id");

    const result = await retryWithBackoff(insert, {
      maxRetries: 3,
      baseDelayMs: 1,
      shouldRetry: isAuthRefreshRace,
    });

    expect(result).toBe("message_id");
    expect(insert).toHaveBeenCalledTimes(2);
  });

  test("gives up immediately on a network error rather than risking a double insert", async () => {
    const insert = vi.fn().mockRejectedValue(new Error("fetch failed"));

    await expect(
      retryWithBackoff(insert, { maxRetries: 3, baseDelayMs: 1, shouldRetry: isAuthRefreshRace }),
    ).rejects.toThrow("fetch failed");
    expect(insert).toHaveBeenCalledTimes(1);
  });
});
