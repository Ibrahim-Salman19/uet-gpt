import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../convex/_generated/server", () => ({
  action: (opts: { handler: Function }) => ({ handler: opts.handler }),
}));

import { generate } from "../../convex/embeddings/generate";

function createMockResponse(body: any, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(body),
    json: async () => body,
    headers: new Headers({
      "content-type": "application/json",
    }),
  } as unknown as Response;
}

describe("Embedding Generation Integration", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.stubEnv("GEMINI_API_KEY", "");
    vi.stubEnv("GEMINI_API_KEY_1", "test-gemini-key");
    vi.stubEnv("GEMINI_API_KEY_2", "");
    vi.stubEnv("GOOGLE_GENERATIVE_AI_API_KEY", "");
  });

  describe("generate - Gemini API integration", () => {
    it("calls Gemini API with correct payload and returns embedding", async () => {
      global.fetch = vi.fn().mockImplementation(async (url, options: any) => {
        expect(url).toContain("generativelanguage.googleapis.com/v1beta/models/gemini-embedding-2:embedContent");
        const body = JSON.parse(options.body);
        expect(body).toMatchObject({
          content: {
            parts: [{ text: "task: search result | query: Test embedding generation" }],
          },
          outputDimensionality: 3072,
        });
        return createMockResponse({
          embedding: { values: [0.1, 0.2, 0.3] },
        });
      });

      const embeddings = await (generate as any).handler({} as any, {
        text: "Test embedding generation",
      });

      expect(embeddings).toEqual([0.1, 0.2, 0.3]);
    });

    it("retries on 5xx errors", async () => {
      let callCount = 0;
      global.fetch = vi.fn().mockImplementation(async () => {
        callCount++;
        if (callCount < 2) {
          return createMockResponse({ error: { message: "Internal server error" } }, 500);
        }
        return createMockResponse({
          embedding: { values: [0.1, 0.2, 0.3] },
        });
      });

      const result = await (generate as any).handler({} as any, {
        text: "Retry test",
      });

      expect(callCount).toBe(2);
      expect(result).toEqual([0.1, 0.2, 0.3]);
    });

    it("retries on 429 rate limit errors", async () => {
      let callCount = 0;
      global.fetch = vi.fn().mockImplementation(async () => {
        callCount++;
        if (callCount < 2) {
          return createMockResponse({ error: { message: "Too many requests" } }, 429);
        }
        return createMockResponse({
          embedding: { values: [0.4, 0.5, 0.6] },
        });
      });

      const result = await (generate as any).handler({} as any, {
        text: "Rate limit test",
      });

      expect(callCount).toBe(2);
      expect(result).toEqual([0.4, 0.5, 0.6]);
    });

    it("throws immediately on 4xx client errors", async () => {
      global.fetch = vi.fn().mockImplementation(async () => {
        return createMockResponse({ error: { message: "Bad Request" } }, 400);
      });

      await expect(
        (generate as any).handler({} as any, {
          text: "Bad request test",
        }),
      ).rejects.toThrow();
    });

    it("exhausts retries and throws on persistent 5xx", async () => {
      global.fetch = vi.fn().mockImplementation(async () => {
        return createMockResponse({ error: { message: "Service Unavailable" } }, 503);
      });

      await expect(
        (generate as any).handler({} as any, {
          text: "Persistent failure test",
        }),
      ).rejects.toThrow(/Gemini/i);
    }, 15000);

    it("throws when GEMINI_API_KEY_1 is not set", async () => {
      vi.unstubAllEnvs();
      vi.stubEnv("GEMINI_API_KEY", "");
      vi.stubEnv("GEMINI_API_KEY_1", "");
      vi.stubEnv("GEMINI_API_KEY_2", "");
      vi.stubEnv("GOOGLE_GENERATIVE_AI_API_KEY", "");
      vi.stubEnv("OPENROUTER_API_KEY", ""); 

      await expect(
        (generate as any).handler({} as any, {
          text: "No key test",
        }),
      ).rejects.toThrow(/GEMINI_API_KEY/);
    });

    it("throws on unexpected API response shape", async () => {
      global.fetch = vi.fn().mockImplementation(async () => {
        return createMockResponse({
          embedding: { wrong_field: [0.1] },
        });
      });

      await expect(
        (generate as any).handler({} as any, {
          text: "Bad response test",
        }),
      ).rejects.toThrow(/Gemini/i);
    });
  });
});
