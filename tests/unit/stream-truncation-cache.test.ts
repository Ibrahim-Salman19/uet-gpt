import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * A model that stops because it hit `maxOutputTokens` produces an answer cut off
 * mid-sentence, and it arrives down the NORMAL completion path - not the mid-stream
 * error path that src/lib/chat/stream.ts already refuses to cache. `streamText` reports
 * the difference as `result.finishReason`, which was never plumbed through to onFinish
 * (typed `(text, model) => void` throughout), so a truncated answer was handed to the
 * semantic-cache write exactly like a complete one.
 *
 * That matters more than a single bad reply: the user who triggers it sees it once, but
 * a cached copy is replayed to every semantically similar question until the TTL expires.
 */
const streamTextMock = vi.fn();
vi.mock("ai", () => ({ streamText: (...args: unknown[]) => streamTextMock(...args) }));
vi.mock("@/lib/llm-models", () => ({ LLM_FALLBACK_CHAIN: [] }));

import { tryStreamWithFallback } from "@/lib/chat/stream";

function fakeResult(chunks: string[], finishReason: PromiseLike<string>) {
  return {
    finishReason,
    textStream: new ReadableStream<string>({
      start(controller) {
        for (const c of chunks) controller.enqueue(c);
        controller.close();
      },
    }),
  };
}

async function drain(stream: ReadableStream<string>): Promise<string> {
  const reader = stream.getReader();
  let out = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    out += value;
  }
  return out;
}

async function run(chunks: string[], finishReason: PromiseLike<string>) {
  const onFinish = vi.fn();
  streamTextMock.mockReturnValue(fakeResult(chunks, finishReason));
  const result = await tryStreamWithFallback([{ modelId: "fake-model" } as never], {
    system: "s",
    messages: [{ role: "user", content: "q" }],
    temperature: 0.3,
    maxOutputTokens: 2000,
    onFinish,
  });
  const text = await drain(result.textStream as unknown as ReadableStream<string>);
  return { onFinish, text };
}

describe("semantic-cache write is gated on how the model stopped", () => {
  beforeEach(() => {
    streamTextMock.mockReset();
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  it("caches a normally completed answer", async () => {
    const { onFinish, text } = await run(["The fee is ", "Rs. 101,800."], Promise.resolve("stop"));
    expect(text).toBe("The fee is Rs. 101,800.");
    expect(onFinish).toHaveBeenCalledTimes(1);
    expect(onFinish).toHaveBeenCalledWith("The fee is Rs. 101,800.", "fake-model");
  });

  it("still streams a truncated answer to the user but never caches it", async () => {
    const { onFinish, text } = await run(
      ["The fee structure for BS programmes is"],
      Promise.resolve("length"),
    );
    // The user keeps what was generated - it is already on their screen.
    expect(text).toBe("The fee structure for BS programmes is");
    // ...but it must not become a cached answer replayed to everyone else.
    expect(onFinish).not.toHaveBeenCalled();
  });

  it("fails closed when the stop reason cannot be determined", async () => {
    const { onFinish, text } = await run(
      ["partial answer"],
      Promise.reject(new Error("no reason")),
    );
    expect(text).toBe("partial answer");
    expect(onFinish).not.toHaveBeenCalled();
  });
});
