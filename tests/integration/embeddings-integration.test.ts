import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../convex/_generated/server", () => ({
  action: (opts: { handler: Function }) => ({ handler: opts.handler }),
  internalAction: (opts: { handler: Function }) => ({ handler: opts.handler }),
  query: (opts: { handler: Function }) => ({ handler: opts.handler }),
  internalQuery: (opts: { handler: Function }) => ({ handler: opts.handler }),
  mutation: (opts: { handler: Function }) => ({ handler: opts.handler }),
  internalMutation: (opts: { handler: Function }) => ({ handler: opts.handler }),
}));

import { generate } from "../../convex/embeddings/generate";

// Production embedder enforces the L2-normalized-vector invariant
// (convex/shared/invariants.ts assertFiniteVector), so mock embeddings must be unit vectors.
const UNIT_EMBEDDING = new Array(768).fill(1 / Math.sqrt(768));
const UNIT_EMBEDDING_2 = new Array(768).fill(1).map((_, i) => (i === 0 ? 1 : 0));

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
        expect(url).toContain(
          "generativelanguage.googleapis.com/v1beta/models/gemini-embedding-2:embedContent",
        );
        const body = JSON.parse(options.body);
        expect(body).toMatchObject({
          content: {
            parts: [{ text: "Test embedding generation" }],
          },
          outputDimensionality: 768,
        });
        return createMockResponse({
          embedding: { values: UNIT_EMBEDDING },
        });
      });

      const embeddings = await (generate as any).handler({} as any, {
        text: "Test embedding generation",
      });

      expect(embeddings).toEqual(UNIT_EMBEDDING);
    });

    it("retries on 5xx errors", async () => {
      let callCount = 0;
      global.fetch = vi.fn().mockImplementation(async () => {
        callCount++;
        if (callCount < 2) {
          return createMockResponse({ error: { message: "Internal server error" } }, 500);
        }
        return createMockResponse({
          embedding: { values: UNIT_EMBEDDING },
        });
      });

      const result = await (generate as any).handler({} as any, {
        text: "Retry test",
      });

      expect(callCount).toBe(2);
      expect(result).toEqual(UNIT_EMBEDDING);
    });

    it("retries on 429 rate limit errors", async () => {
      let callCount = 0;
      global.fetch = vi.fn().mockImplementation(async () => {
        callCount++;
        if (callCount < 2) {
          return createMockResponse({ error: { message: "Too many requests" } }, 429);
        }
        return createMockResponse({
          embedding: { values: UNIT_EMBEDDING_2 },
        });
      });

      const result = await (generate as any).handler({} as any, {
        text: "Rate limit test",
      });

      expect(callCount).toBe(2);
      expect(result).toEqual(UNIT_EMBEDDING_2);
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
