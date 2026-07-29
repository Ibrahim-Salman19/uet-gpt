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
    const fn = vi.fn().mockRejectedValue(new Error("network timeout"));
    await expect(retryWithBackoff(fn, { maxRetries: 2, baseDelayMs: 1 })).rejects.toThrow("network timeout");
    expect(fn).toHaveBeenCalledTimes(3); // Initial call + 2 retries
  });

  test("resolves if a retry succeeds", async () => {
    let calls = 0;
    const fn = vi.fn().mockImplementation(async () => {
      calls++;
      if (calls < 2) throw new Error("fetch failed");
      return "success";
    });
    const result = await retryWithBackoff(fn, { maxRetries: 2, baseDelayMs: 1 });
    expect(result).toBe("success");
    expect(fn).toHaveBeenCalledTimes(2);
  });
});
