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

  it("should call Gemini API via KeyPool with gemini-embedding-2 and dimensions 3072", async () => {
    process.env.GEMINI_API_KEY_1 = "test_gemini_key";

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      headers: new Headers({ "content-type": "application/json" }),
      text: async () => JSON.stringify({
        embedding: {
          values: [0.1, 0.2, 0.3],
        },
      }),
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
        _handler: (ctx: MockCtx, args: { text: string }) => Promise<number[]>;
      }
    )._handler(mockCtx, { text: "Hello world" });

    const fetchCalls = mockFetch.mock.calls;
    expect(fetchCalls).toHaveLength(1);
    
    const [url, options] = fetchCalls[0]!;
    expect(url).toBe("https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-2:embedContent?key=test_gemini_key");
    expect(options!.method).toBe("POST");
    expect((options!.headers as any)["Content-Type"]).toBe("application/json");

    const body = JSON.parse(options!.body as string);
    expect(body).toEqual({
      content: {
        parts: [{ text: "task: search result | query: Hello world" }],
      },
      outputDimensionality: 3072,
    });

    expect(result).toEqual([0.1, 0.2, 0.3]);
  });

  it("should throw an error if GEMINI_API_KEY is not set", async () => {
    delete process.env.GEMINI_API_KEY_1;
    delete process.env.GEMINI_API_KEY_2;
    delete process.env.GEMINI_API_KEY;
    delete process.env.OPENROUTER_API_KEY;
    const mockCtx: MockCtx = { runQuery: vi.fn() };
    await expect(
      (
        generate as unknown as {
          _handler: (ctx: MockCtx, args: { text: string }) => Promise<number[]>;
        }
      )._handler(mockCtx, { text: "test" }),
    ).rejects.toThrow("GEMINI_API_KEY environment variable is not set");
  });

  it("should throw an error if the API request fails", async () => {
    process.env.GEMINI_API_KEY_1 = "test_gemini_key";

    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      text: async () => "Bad Request",
      headers: new Headers({ "content-type": "application/json" }),
    });

    const mockCtx: MockCtx = { runQuery: vi.fn() };
    await expect(
      (
        generate as unknown as {
          _handler: (ctx: MockCtx, args: { text: string }) => Promise<number[]>;
        }
      )._handler(mockCtx, { text: "test" }),
    ).rejects.toThrow("Bad Request");
  });
});
