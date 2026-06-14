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

    const dummyEmbedding = new Array(3072).fill(0.1);
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      headers: new Headers({ "content-type": "application/json" }),
      text: async () => JSON.stringify({
        embedding: {
          values: dummyEmbedding,
        },
      }),
      json: async () => ({
        embedding: {
          values: dummyEmbedding,
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

    const fetchCalls = mockFetch.mock.calls;
    expect(fetchCalls).toHaveLength(1);
    
    const [url, options] = fetchCalls[0]!;
    expect(url).toBe("https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-2:embedContent?key=test_gemini_key");
    expect(options!.method).toBe("POST");
    expect((options!.headers as any)["Content-Type"]).toBe("application/json");

    const body = JSON.parse(options!.body as string);
    expect(body).toEqual({
      content: {
        parts: [{ text: "Hello world" }],
      },
      outputDimensionality: 3072,
    });

    expect(result).toEqual(dummyEmbedding);
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
          handler: (ctx: MockCtx, args: { text: string }) => Promise<number[]>;
        }
      ).handler(mockCtx, { text: "test" }),
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
          handler: (ctx: MockCtx, args: { text: string }) => Promise<number[]>;
        }
      ).handler(mockCtx, { text: "test" }),
    ).rejects.toThrow("Bad Request");
  });
});
