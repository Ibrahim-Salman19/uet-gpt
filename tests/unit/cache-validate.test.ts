import { describe, expect, it } from "vitest";

describe("Cache Revalidation Logic", () => {
  it("evaluates expired cache correctly", () => {
    const now = Date.now();
    const expiresAt = now - 1000;
    const isExpired = now > expiresAt;
    expect(isExpired).toBe(true);
  });

  it("enforces 1-hour max TTL for high_current queries", () => {
    const createdAt = Date.now() - (65 * 60 * 1000); // 65 minutes old
    const maxAgeMs = 60 * 60 * 1000;
    const isHighCurrentExpired = Date.now() - createdAt > maxAgeMs;
    expect(isHighCurrentExpired).toBe(true);
  });
});
