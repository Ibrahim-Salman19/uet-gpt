import { describe, test, expect, vi } from "vitest";
import { retryWithBackoff } from "../../src/lib/retry";

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
