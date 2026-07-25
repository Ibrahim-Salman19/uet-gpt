import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@upstash/ratelimit", () => {
  // slidingWindow must return a non-null, non-undefined value to satisfy the try/catch
  // in createRatelimit in rate-limit.ts
  const slidingWindowSpy = vi.fn().mockReturnValue({ kind: "sliding", limit: 50, window: 3600 });

  // Ratelimit must be a proper class (not just vi.fn()) to be safely used with `new`.
  // Vitest warns and may cause the constructor to return undefined otherwise.
  class RatelimitMock {
    private limitValue: number;
    constructor(config: any) {
      // Determine limit by prefix for role-based tier testing
      const prefix: string = config?.prefix ?? "";
      if (prefix.includes("admin")) {
        this.limitValue = 200;
      } else if (prefix.includes("anonymous")) {
        this.limitValue = 10;
      } else {
        this.limitValue = 50;
      }
    }
    async limit(_identifier: string) {
      return {
        success: true,
        limit: this.limitValue,
        remaining: this.limitValue - 1,
        reset: Date.now() + 3_600_000,
        pending: Promise.resolve(),
      };
    }
  }
  (RatelimitMock as any).slidingWindow = slidingWindowSpy;
  return { Ratelimit: RatelimitMock };
});

vi.mock("@upstash/redis", () => ({
  Redis: class {},
}));

describe("rate-limit", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  // checkChatRateLimit is intentionally FAIL-OPEN: when Redis is unconfigured
  // (missing URL/token) it lets the request through with a synthetic allowance
  // rather than blocking users — availability over throttling. Only
  // checkAdminActionRateLimit fails closed. See src/lib/rate-limit.ts:94-103.
  it("allows requests when UPSTASH_REDIS_REST_URL is missing (fail-open)", async () => {
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
    const { checkChatRateLimit } = await import("../../src/lib/rate-limit");
    const result = await checkChatRateLimit("test_user");
    expect(result).not.toBeNull();
    expect(result!.success).toBe(true);
    expect(result!.limit).toBe(100);
    expect(result!.remaining).toBe(100);
  });

  it("allows requests when UPSTASH_REDIS_REST_TOKEN is missing (fail-open)", async () => {
    process.env.UPSTASH_REDIS_REST_URL = "https://test.upstash.io";
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
    const { checkChatRateLimit } = await import("../../src/lib/rate-limit");
    const result = await checkChatRateLimit("test_user");
    expect(result).not.toBeNull();
    expect(result!.success).toBe(true);
    expect(result!.limit).toBe(100);
    expect(result!.remaining).toBe(100);
  });

  it("allows requests for unconfigured chat rate limiter (fail-open for availability)", async () => {
    delete process.env.UPSTASH_REDIS_REST_URL;
    const { checkChatRateLimit } = await import("../../src/lib/rate-limit");
    const result = await checkChatRateLimit("test_user_42", "user");
    expect(result).not.toBeNull();
    expect(result!.success).toBe(true);
    expect(result!.limit).toBe(100);
    expect(result!.remaining).toBe(100);
  });

  it("applies correct role-based tier for admin", async () => {
    process.env.UPSTASH_REDIS_REST_URL = "https://test.upstash.io";
    process.env.UPSTASH_REDIS_REST_TOKEN = "test_token";
    
    const { checkChatRateLimit } = await import("../../src/lib/rate-limit");
    const result = await checkChatRateLimit("admin_1", "admin");
    expect(result).not.toBeNull();
    expect(result!.limit).toBe(200);
  });

  it("applies correct role-based tier for anonymous", async () => {
    process.env.UPSTASH_REDIS_REST_URL = "https://test.upstash.io";
    process.env.UPSTASH_REDIS_REST_TOKEN = "test_token";
    
    const { checkChatRateLimit } = await import("../../src/lib/rate-limit");
    const result = await checkChatRateLimit("anon_1", "anonymous");
    expect(result).not.toBeNull();
    expect(result!.limit).toBe(10);
  });

  it("applies default user tier when no role specified", async () => {
    process.env.UPSTASH_REDIS_REST_URL = "https://test.upstash.io";
    process.env.UPSTASH_REDIS_REST_TOKEN = "test_token";
    
    const { checkChatRateLimit } = await import("../../src/lib/rate-limit");
    const result = await checkChatRateLimit("user_1");
    expect(result).not.toBeNull();
    expect(result!.limit).toBe(50);
  });
});
