import { describe, expect, it, vi } from "vitest";
import {
  FALLBACK_MAX,
  buildSystemPrompt,
  createRateLimiter,
  extractText,
  getModelPriorities,
} from "./helpers";

describe("Chat API Integration", () => {
  describe("rate limiting logic", () => {
    it("rate limits after exceeding threshold", async () => {
      const limiter = createRateLimiter();

      for (let i = 0; i < FALLBACK_MAX; i++) {
        expect(await limiter.isRateLimited("user_123")).toBe(false);
      }
      expect(await limiter.isRateLimited("user_123")).toBe(true);
    });

    it("resets rate limit after window expires", async () => {
      const limiter = createRateLimiter();
      limiter.store.set("user_456", { count: 20, resetAt: Date.now() - 1000 });

      expect(await limiter.isRateLimited("user_456")).toBe(false);
      expect(limiter.store.get("user_456")?.count).toBe(1);
    });

    it("tracks separate limits for different users", async () => {
      const limiter = createRateLimiter();

      for (let i = 0; i < FALLBACK_MAX; i++) {
        await limiter.isRateLimited("user_a");
      }
      expect(await limiter.isRateLimited("user_a")).toBe(true);
      expect(await limiter.isRateLimited("user_b")).toBe(false);
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
      const result = buildSystemPrompt(null);
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
      expect(models[0]).toBe("meta-llama/llama-4-scout");
      expect(models[1]).toBe("cerebras-llama-3.3-70b");
      expect(models[2]).toBe("llama-3.1-8b-instant");
      expect(models[3]).toBe("gemini-1.5-flash");

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
