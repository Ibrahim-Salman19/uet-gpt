import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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
  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("should call Gemini API via KeyPool with gemini-embedding-2 and dimensions 768", async () => {
    vi.stubEnv("GEMINI_API_KEY_1", "test_gemini_key");

    // Production embedder uses 768-dim vectors (convex/embeddings/generate.ts
    // requests outputDimensionality: 768; schema vectorIndex is dimensions: 768;
    // generate.ts validates emb.length === 768). Keep this fixture in sync.
    const dummyEmbedding = new Array(768).fill(0.1);
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      headers: new Headers({ "content-type": "application/json" }),
      text: async () =>
        JSON.stringify({
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
    expect(url).toBe(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-2:embedContent",
    );
    expect(options!.method).toBe("POST");
    expect((options!.headers as any)["Content-Type"]).toBe("application/json");
    expect((options!.headers as any)["x-goog-api-key"]).toBe("test_gemini_key");

    const body = JSON.parse(options!.body as string);
    expect(body).toEqual({
      content: {
        parts: [{ text: "Hello world" }],
      },
      outputDimensionality: 768,
    });

    expect(result).toEqual(dummyEmbedding);
  });

  it("should throw an error if GEMINI_API_KEY is not set", async () => {
    vi.stubEnv("GEMINI_API_KEY_1", undefined);
    vi.stubEnv("GEMINI_API_KEY_2", undefined);
    vi.stubEnv("GEMINI_API_KEY", undefined);
    vi.stubEnv("GOOGLE_GENERATIVE_AI_API_KEY", undefined);

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
    vi.stubEnv("GEMINI_API_KEY_1", "test_gemini_key");

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
