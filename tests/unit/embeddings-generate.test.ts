import { beforeEach, describe, expect, it, vi } from "vitest";
import { generate } from "../../convex/embeddings/generate";

interface MockCtx {
  runQuery: ReturnType<typeof vi.fn>;
}

describe("embeddings:generate", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetAllMocks();
    process.env = { ...originalEnv };
  });

  it("should call Gemini API with text-embedding-004 and outputDimensionality 768", async () => {
    process.env.GEMINI_API_KEY = "test_gemini_key";

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        embedding: {
          values: [0.1, 0.2, 0.3],
        },
      }),
    });
    global.fetch = mockFetch;

    const mockCtx: MockCtx = { runQuery: vi.fn() };
    const result = await (
      generate as unknown as {
        handler: (ctx: MockCtx, args: { text: string }) => Promise<number[]>;
      }
    ).handler(mockCtx, { text: "Hello world" });

    expect(mockFetch).toHaveBeenCalledWith(
      "https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=test_gemini_key",
      expect.objectContaining({
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "models/text-embedding-004",
          content: {
            parts: [{ text: "Hello world" }],
          },
          outputDimensionality: 768,
        }),
      }),
    );

    expect(result).toEqual([0.1, 0.2, 0.3]);
  });

  it("should throw an error if GEMINI_API_KEY is not set", async () => {
    delete process.env.GEMINI_API_KEY;
    const mockCtx: MockCtx = { runQuery: vi.fn() };
    await expect(
      (
        generate as unknown as {
          handler: (ctx: MockCtx, args: { text: string }) => Promise<number[]>;
        }
      ).handler(mockCtx, { text: "test" }),
    ).rejects.toThrow("GEMINI_API_KEY environment variable is not set");
  });

  it("should throw an error if the API request fails", async () => {
    process.env.GEMINI_API_KEY = "test_gemini_key";

    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      text: async () => "Bad Request",
    });

    const mockCtx: MockCtx = { runQuery: vi.fn() };
    await expect(
      (
        generate as unknown as {
          handler: (ctx: MockCtx, args: { text: string }) => Promise<number[]>;
        }
      ).handler(mockCtx, { text: "test" }),
    ).rejects.toThrow("Gemini API error (400): Bad Request");
  });
});
