import { vi } from "vitest";

vi.hoisted(() => {
  process.env.UPSTASH_REDIS_REST_URL = "https://mock.upstash.io";
  process.env.UPSTASH_REDIS_REST_TOKEN = "mock_token";
});

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  buildSystemPrompt,
  checkChatRateLimit,
  extractText,
  FALLBACK_MAX,
  getModelPriorities,
} from "./helpers";

// Mock @upstash/redis and @upstash/ratelimit for real-like testing
vi.mock("@upstash/redis", () => ({
  Redis: class {},
}));

const counts = new Map<string, number>();

vi.mock("@upstash/ratelimit", () => {
  const slidingWindowSpy = vi.fn().mockReturnValue({ kind: "sliding", limit: 50, window: 3600 });
  class RatelimitMock {
    private limitValue: number;
    constructor(config: any) {
      const prefix: string = config?.prefix ?? "";
      if (prefix.includes("admin")) {
        this.limitValue = 200;
      } else if (prefix.includes("anonymous")) {
        this.limitValue = 10;
      } else {
        this.limitValue = 50;
      }
    }
    async limit(identifier: string) {
      const count = (counts.get(identifier) ?? 0) + 1;
      counts.set(identifier, count);
      const success = count <= this.limitValue;
      return {
        success,
        limit: this.limitValue,
        remaining: Math.max(0, this.limitValue - count),
        reset: Date.now() + 3_600_000,
        pending: Promise.resolve(),
      };
    }
  }
  (RatelimitMock as any).slidingWindow = slidingWindowSpy;
  return { Ratelimit: RatelimitMock };
});

describe("Chat API Integration", () => {
  describe("rate limiting logic", () => {
    beforeEach(() => {
      counts.clear();
      // Ensure redis env variables are mock-set to pass checkChatRateLimit guards
      vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://mock.upstash.io");
      vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "mock_token");
    });

    // Also reset the module-level shared counter after each test so leaked
    // counts cannot bleed into a subsequent test (or suite) and cause
    // order-dependent rate-limit failures.
    afterEach(() => {
      counts.clear();
    });

    it("rate limits after exceeding threshold", async () => {
      for (let i = 0; i < FALLBACK_MAX; i++) {
        const res = await checkChatRateLimit("user_123", "user");
        expect(res.success).toBe(true);
      }
      const finalRes = await checkChatRateLimit("user_123", "user");
      expect(finalRes.success).toBe(false);
    });

    it("resets rate limit after window expires (or manual clear)", async () => {
      for (let i = 0; i < FALLBACK_MAX; i++) {
        await checkChatRateLimit("user_456", "user");
      }
      expect((await checkChatRateLimit("user_456", "user")).success).toBe(false);

      // Simulate reset
      counts.clear();

      expect((await checkChatRateLimit("user_456", "user")).success).toBe(true);
    });

    it("tracks separate limits for different users", async () => {
      for (let i = 0; i < FALLBACK_MAX; i++) {
        await checkChatRateLimit("user_a", "user");
      }
      expect((await checkChatRateLimit("user_a", "user")).success).toBe(false);
      expect((await checkChatRateLimit("user_b", "user")).success).toBe(true);
    });
  });

  describe("message extraction", () => {
    it("extracts text from content field", () => {
      expect(extractText({ content: "Hello" })).toBe("Hello");
      expect(extractText({})).toBe("");
      expect(
        extractText({
          parts: [
            { type: "text", text: "Hello" },
            { type: "tool_use", text: "ignore" },
          ],
        }),
      ).toBe("Hello");
    });
  });

  describe("system prompt building", () => {
    it("builds prompt with context", () => {
      const result = buildSystemPrompt("Admissions info here", "academic");
      expect(result).toContain("UET GPT");
      expect(result).toContain("Admissions info here");
      expect(result).not.toContain("off-topic");
    });

    it("includes off_topic redirect when intent is off_topic", () => {
      const result = buildSystemPrompt(null, "off_topic");
      expect(result).toContain("off-topic");
    });

    it("handles null context gracefully", () => {
      const result = buildSystemPrompt(null, "general");
      expect(result).toContain("You don't have specific context");
    });
  });

  describe("model selection", () => {
    it("returns models in priority order when API keys are set", () => {
      vi.stubEnv("GROQ_API_KEY", "groq-key");
      vi.stubEnv("CEREBRAS_API_KEY", "cerebras-key");
      vi.stubEnv("GEMINI_API_KEY", "gemini-key");

      const models = getModelPriorities();
      expect(models).toHaveLength(4);
      expect(models[0]).toBe("meta-llama/llama-4-scout-17b-16e-instruct");
      expect(models[1]).toBe("gpt-oss-120b");
      expect(models[2]).toBe("llama-3.1-8b-instant");
      expect(models[3]).toBe("gemini-2.5-flash");

      vi.unstubAllEnvs();
    });

    it("returns empty array when no API keys are set", () => {
      vi.stubEnv("GROQ_API_KEY", "");
      vi.stubEnv("CEREBRAS_API_KEY", "");
      vi.stubEnv("GEMINI_API_KEY", "");

      expect(getModelPriorities()).toHaveLength(0);

      vi.unstubAllEnvs();
    });
  });
});
