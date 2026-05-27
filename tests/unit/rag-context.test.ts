import { describe, expect, it, vi } from "vitest";
import { buildContext } from "../../convex/rag/context";

interface MockCtx {
  runQuery: ReturnType<typeof vi.fn>;
}

describe("RAG Pipeline - Context Assembly (Sandwich Strategy)", () => {
  it("correctly interleaves chunks by relevance score", async () => {
    const chunks = [
      { content: "CHUNK_1", relevanceScore: 0.9, url: "http://test.com/1", title: "T1" },
      { content: "CHUNK_2", relevanceScore: 0.8, url: "http://test.com/2", title: "T2" },
      { content: "CHUNK_3", relevanceScore: 0.7, url: "http://test.com/3", title: "T3" },
      { content: "CHUNK_4", relevanceScore: 0.6, url: "http://test.com/4", title: "T4" },
      { content: "CHUNK_5", relevanceScore: 0.5, url: "http://test.com/5", title: "T5" },
    ];

    const mockCtx: MockCtx = { runQuery: vi.fn() };
    const result = (await (
      buildContext as unknown as {
        _handler: (
          ctx: MockCtx,
          args: { chunks: typeof chunks; maxTokens: number },
        ) => Promise<string>;
      }
    )._handler(mockCtx, {
      chunks,
      maxTokens: 1000,
    })) as string;

    const pos1 = result.indexOf("CHUNK_1");
    const pos2 = result.indexOf("CHUNK_2");
    const pos3 = result.indexOf("CHUNK_3");
    const pos4 = result.indexOf("CHUNK_4");
    const pos5 = result.indexOf("CHUNK_5");

    expect(pos1).toBeGreaterThan(-1);
    expect(pos2).toBeGreaterThan(-1);
    expect(pos3).toBeGreaterThan(-1);
    expect(pos4).toBeGreaterThan(-1);
    expect(pos5).toBeGreaterThan(-1);

    expect(pos1).toBeLessThan(pos3);
    expect(pos3).toBeLessThan(pos5);
    expect(pos5).toBeLessThan(pos4);
    expect(pos4).toBeLessThan(pos2);
  });

  it("respects the maxTokens constraint", async () => {
    const chunks = [
      { content: "A".repeat(100), relevanceScore: 0.9, url: "http://test.com/1", title: "T1" },
      { content: "B".repeat(100), relevanceScore: 0.8, url: "http://test.com/2", title: "T2" },
      { content: "C".repeat(100), relevanceScore: 0.7, url: "http://test.com/3", title: "T3" },
    ];

    const mockCtx: MockCtx = { runQuery: vi.fn() };

    const result = (await (
      buildContext as unknown as {
        _handler: (
          ctx: MockCtx,
          args: { chunks: typeof chunks; maxTokens: number },
        ) => Promise<string>;
      }
    )._handler(mockCtx, {
      chunks,
      maxTokens: 40,
    })) as string;

    expect(result).toContain("A".repeat(100));
    expect(result).not.toContain("B".repeat(100));
    expect(result).not.toContain("C".repeat(100));
  });
});
