import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../convex/_generated/server", () => ({
  action: (opts: { handler: Function }) => ({ handler: opts.handler }),
  internalAction: (opts: { handler: Function }) => ({ handler: opts.handler }),
  query: (opts: { handler: Function }) => ({ handler: opts.handler }),
  internalQuery: (opts: { handler: Function }) => ({ handler: opts.handler }),
  mutation: (opts: { handler: Function }) => ({ handler: opts.handler }),
  internalMutation: (opts: { handler: Function }) => ({ handler: opts.handler }),
}));

import { isNonRetryableError } from "@convex-dev/workpool";
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
    // requests outputDimensionality: EMBEDDING_DIMENSION=768; schema vectorIndex
    // is dimensions: 768; generate.ts validates emb.length === 768). Keep in sync.
    const unitVal = 1 / Math.sqrt(768);
    const dummyEmbedding = new Array(768).fill(unitVal);
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

  // August 2026 incident remediation: permanent failures must not receive
  // the same large Workpool/DLQ retry budget as transient ones. These prove
  // the actual thrown-error CLASS, not just the message, since that is what
  // Workpool's isNonRetryableError() checks before deciding whether to retry.
  describe("non-retryable failure classification", () => {
    async function captureThrown(): Promise<unknown> {
      const mockCtx: MockCtx = { runQuery: vi.fn() };
      try {
        await (
          generate as unknown as {
            handler: (ctx: MockCtx, args: { text: string }) => Promise<number[]>;
          }
        ).handler(mockCtx, { text: "test" });
      } catch (err) {
        return err;
      }
      throw new Error("expected handler to throw");
    }

    it("marks a missing GEMINI_API_KEY as non-retryable (no retry budget can ever fix a config error)", async () => {
      vi.stubEnv("GEMINI_API_KEY_1", undefined);
      vi.stubEnv("GEMINI_API_KEY_2", undefined);
      vi.stubEnv("GEMINI_API_KEY", undefined);
      vi.stubEnv("GOOGLE_GENERATIVE_AI_API_KEY", undefined);

      const thrown = await captureThrown();
      expect(isNonRetryableError(thrown)).toBe(true);
    });

    it("marks a deterministic 400 Gemini response as non-retryable", async () => {
      vi.stubEnv("GEMINI_API_KEY_1", "test_gemini_key");
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        text: async () => "Bad Request",
        headers: new Headers({ "content-type": "application/json" }),
      });

      const thrown = await captureThrown();
      expect(isNonRetryableError(thrown)).toBe(true);
    });

    it("does NOT mark a 429 (rate limit) as non-retryable even after every key is exhausted - a later attempt may succeed once quota resets", async () => {
      vi.stubEnv("GEMINI_API_KEY_1", "key-1");
      vi.stubEnv("GEMINI_API_KEY_2", "key-2");
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 429,
        text: async () => "Rate limited",
        headers: new Headers({ "content-type": "application/json" }),
      });

      const thrown = await captureThrown();
      expect(isNonRetryableError(thrown)).toBe(false);
    });
  });
});
