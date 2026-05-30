import { describe, expect, it, vi, beforeEach } from "vitest";

describe("rate-limit", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  it("returns null when UPSTASH_REDIS_REST_URL is missing", async () => {
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
    const { checkChatRateLimit } = await import("../../src/lib/rate-limit");
    const result = await checkChatRateLimit("test_user");
    expect(result).toBeNull();
  });

  it("returns null when UPSTASH_REDIS_REST_TOKEN is missing", async () => {
    process.env.UPSTASH_REDIS_REST_URL = "https://test.upstash.io";
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
    const { checkChatRateLimit } = await import("../../src/lib/rate-limit");
    const result = await checkChatRateLimit("test_user");
    expect(result).toBeNull();
  });

  it("returns null for unconfigured rate limiter (graceful fallback)", async () => {
    delete process.env.UPSTASH_REDIS_REST_URL;
    const { checkChatRateLimit } = await import("../../src/lib/rate-limit");
    const result = await checkChatRateLimit("test_user_42", "user");
    expect(result).toBeNull();
  });

  it("applies correct role-based tier for admin", async () => {
    process.env.UPSTASH_REDIS_REST_URL = "https://test.upstash.io";
    process.env.UPSTASH_REDIS_REST_TOKEN = "test_token";
    vi.mock("@upstash/ratelimit", () => ({
      Ratelimit: vi.fn(() => ({
        limit: vi.fn().mockResolvedValue({
          success: true,
          limit: 200,
          remaining: 199,
          reset: Date.now() + 3600000,
          pending: Promise.resolve(),
        }),
      })),
    }));
    vi.mock("@upstash/redis", () => ({
      Redis: vi.fn(() => ({})),
    }));
    const { checkChatRateLimit } = await import("../../src/lib/rate-limit");
    const result = await checkChatRateLimit("admin_1", "admin");
    expect(result).not.toBeNull();
    expect(result!.limit).toBe(200);
  });

  it("applies correct role-based tier for anonymous", async () => {
    process.env.UPSTASH_REDIS_REST_URL = "https://test.upstash.io";
    process.env.UPSTASH_REDIS_REST_TOKEN = "test_token";
    vi.mock("@upstash/ratelimit", () => ({
      Ratelimit: vi.fn(() => ({
        limit: vi.fn().mockResolvedValue({
          success: true,
          limit: 10,
          remaining: 9,
          reset: Date.now() + 3600000,
          pending: Promise.resolve(),
        }),
      })),
    }));
    vi.mock("@upstash/redis", () => ({
      Redis: vi.fn(() => ({})),
    }));
    const { checkChatRateLimit } = await import("../../src/lib/rate-limit");
    const result = await checkChatRateLimit("anon_1", "anonymous");
    expect(result).not.toBeNull();
    expect(result!.limit).toBe(10);
  });

  it("applies default user tier when no role specified", async () => {
    process.env.UPSTASH_REDIS_REST_URL = "https://test.upstash.io";
    process.env.UPSTASH_REDIS_REST_TOKEN = "test_token";
    vi.mock("@upstash/ratelimit", () => ({
      Ratelimit: vi.fn(() => ({
        limit: vi.fn().mockResolvedValue({
          success: true,
          limit: 50,
          remaining: 49,
          reset: Date.now() + 3600000,
          pending: Promise.resolve(),
        }),
      })),
    }));
    vi.mock("@upstash/redis", () => ({
      Redis: vi.fn(() => ({})),
    }));
    const { checkChatRateLimit } = await import("../../src/lib/rate-limit");
    const result = await checkChatRateLimit("user_1");
    expect(result).not.toBeNull();
    expect(result!.limit).toBe(50);
  });
});
