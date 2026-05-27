import { describe, expect, it, vi } from "vitest";
import { retrieveContext } from "../../convex/rag/retrieval";

function createMockCtx() {
  let callIndex = 0;
  const actionResults: Record<number, unknown> = {};

  const ctx = {
    runAction: vi.fn().mockImplementation(async (_ref: unknown, args: unknown) => {
      const idx = callIndex++;
      const result = actionResults[idx];
      if (result instanceof Error) throw result;
      return result;
    }),
    runQuery: vi.fn().mockImplementation(async (_ref: unknown, args: unknown) => {
      const a = args as Record<string, unknown>;
      const chunks = a.chunks as Array<{ content: string; relevanceScore: number }>;
      if (!chunks || chunks.length === 0) return "";
      return chunks.map((c) => c.content).join("\n\n---\n\n");
    }),
    runMutation: vi.fn(),
    _setResults: (results: Record<number, unknown>) => {
      Object.assign(actionResults, results);
    },
    _reset: () => {
      callIndex = 0;
      Object.keys(actionResults).forEach((k) => delete actionResults[Number(k)]);
    },
  };

  return ctx;
}

describe("RAG Pipeline Integration", () => {
  describe("retrieveContext - full pipeline orchestration", () => {
    it("classifies intent, rewrites query, generates HyDE, embeds, searches, and assembles context", async () => {
      const ctx = createMockCtx();
      ctx._setResults({
        0: "academic",
        1: "rewritten: What are the admission requirements for UET Taxila?",
        2: "hyde: admission requirements for UET Taxila",
        3: Array(768).fill(0.1),
        4: null,
        5: [
          {
            entryId: "entry_1",
            url: "https://web.uettaxila.edu.pk/admissions/",
            title: "Admissions Guide",
            relevanceScore: 0.92,
            content: "UET Taxila offers undergraduate programs in engineering...",
          },
          {
            entryId: "entry_2",
            url: "https://web.uettaxila.edu.pk/programs/",
            title: "Academic Programs",
            relevanceScore: 0.85,
            content: "The university offers BS, MS, and PhD programs...",
          },
        ],
      });

      const result = await (retrieveContext as any)._handler(ctx as any, {
        question: "What are the admission requirements for UET Taxila?",
      });

      expect(result.intent).toBe("academic");
      expect(result.sources).toHaveLength(2);
      expect(result.sources[0].title).toBe("Admissions Guide");
      expect(result.sources[1].title).toBe("Academic Programs");
      expect(result.cachedResponse).toBeNull();
      expect(result.context).toContain("UET Taxila offers undergraduate");
      expect(result.queryEmbedding).toHaveLength(768);
    });

    it("returns a polite off_topic response when intent is off_topic", async () => {
      const ctx = createMockCtx();
      ctx._setResults({ 0: "off_topic" });

      const result = await (retrieveContext as any)._handler(ctx as any, {
        question: "Tell me about quantum physics",
      });

      expect(result.intent).toBe("off_topic");
      expect(result.context).toBe("");
      expect(result.sources).toHaveLength(0);
      expect(result.cachedResponse).toContain("UET Taxila");
      expect(result.queryEmbedding).toHaveLength(0);
    });

    it("returns cached response when semantic cache hits", async () => {
      const ctx = createMockCtx();
      ctx._setResults({
        0: "general",
        1: "rewritten query",
        2: "hyde query",
        3: Array(768).fill(0.1),
        4: {
          response: "Cached response about admissions",
          sources: [
            {
              entryId: "entry_1",
              url: "https://web.uettaxila.edu.pk/",
              title: "Home",
              relevanceScore: 0.9,
              excerpt: "UET Taxila homepage",
            },
          ],
          model: "llama-4-scout",
        },
      });

      const result = await (retrieveContext as any)._handler(ctx as any, {
        question: "What is UET Taxila?",
      });

      expect(result.cachedResponse).toBe("Cached response about admissions");
      expect(result.sources).toHaveLength(1);
      expect(result.context).toBe("");
    });

    it("handles intent classification failure gracefully", async () => {
      const ctx = createMockCtx();
      ctx._setResults({
        0: new Error("LLM unavailable"),
        1: "rewritten query",
        2: "hyde query",
        3: Array(768).fill(0.1),
        4: null,
        5: [
          {
            entryId: "entry_1",
            url: "https://web.uettaxila.edu.pk/",
            title: "Home",
            relevanceScore: 0.5,
            content: "UET Taxila homepage content",
          },
        ],
      });

      const result = await (retrieveContext as any)._handler(ctx as any, {
        question: "Tell me about UET",
      });

      expect(result.intent).toBe("general");
      expect(result.sources).toHaveLength(1);
    });

    it("handles HyDE and rewrite failures gracefully", async () => {
      const ctx = createMockCtx();
      ctx._setResults({
        0: "general",
        1: new Error("Rewrite failed"),
        2: new Error("HyDE failed"),
        3: Array(768).fill(0.1),
        4: null,
        5: [
          {
            entryId: "entry_1",
            url: "https://web.uettaxila.edu.pk/",
            title: "Home",
            relevanceScore: 0.7,
            content: "UET Taxila home",
          },
        ],
      });

      const result = await (retrieveContext as any)._handler(ctx as any, {
        question: "What is UET?",
      });

      expect(result.intent).toBe("general");
    });

    it("handles search failure and returns empty context", async () => {
      const ctx = createMockCtx();
      ctx._setResults({
        0: "general",
        1: "rewritten",
        2: "hyde",
        3: Array(768).fill(0.1),
        4: null,
        5: new Error("Search failed"),
      });

      const result = await (retrieveContext as any)._handler(ctx as any, {
        question: "Something about UET",
      });

      expect(result.sources).toHaveLength(0);
      expect(result.context).toBe("");
    });

    it("handles embedding generation failure gracefully", async () => {
      const ctx = createMockCtx();
      ctx._setResults({
        0: "general",
        1: "rewritten",
        2: "hyde",
        3: new Error("Embedding failed"),
      });

      const result = await (retrieveContext as any)._handler(ctx as any, {
        question: "Test question",
      });

      expect(result.queryEmbedding).toHaveLength(0);
      expect(result.sources).toHaveLength(0);
      expect(result.context).toBe("");
    });
  });
});
