import { beforeEach, describe, expect, it, vi } from "vitest";

const captured: { system?: string } = {};

vi.mock("server-only", () => ({}));
vi.mock("@clerk/nextjs/server", () => ({ auth: vi.fn() }));
vi.mock("@/lib/rate-limit", () => ({ checkChatRateLimit: vi.fn() }));
vi.mock("@/lib/chat/models", () => ({
  getAvailableModels: () => [{ modelId: "fake-model" }],
  getPreferredModel: vi.fn(),
}));
vi.mock("@/lib/chat/stream", () => ({
  tryStreamWithFallback: vi.fn(async (_models: unknown, config: { system: string }) => {
    captured.system = config.system;
    return { toTextStreamResponse: () => new Response("ok") };
  }),
}));
vi.mock("@/lib/chat/cache", () => ({
  buildCacheWriteCallback: () => () => {},
  encodeSourcesHeader: () => "",
}));

import { buildStreamResponse } from "@/lib/chat/pipeline";

describe("buildStreamResponse confidence directive seam", () => {
  beforeEach(() => {
    captured.system = undefined;
  });

  it("passes the retrieval directive into the system prompt outside the context fence", async () => {
    const directive = "SYSTEM INSTRUCTION TO AI: cite every claim";
    await buildStreamResponse(
      [{ role: "user", content: "fee?" }],
      "fee?",
      {} as never,
      {
        intent: "admissions",
        context: "Source: [Fees](https://uettaxila.edu.pk/fees)\n\nRs. 1",
        answerInstruction: directive,
        retrievalQuestion: "fee?",
        sources: [],
        cachedResponse: null,
        queryEmbedding: [],
      },
      undefined,
    );

    const system = captured.system ?? "";
    expect(system).toContain(directive);
    expect(system.indexOf(directive)).toBeGreaterThan(system.indexOf("<<<END_UET_CONTEXT>>>"));
  });
});
