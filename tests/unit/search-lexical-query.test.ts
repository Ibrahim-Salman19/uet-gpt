import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../../convex/_generated/server", () => ({
  internalAction: (opts: { handler: Function }) => ({ handler: opts.handler }),
  internalQuery: (opts: { handler: Function }) => ({ handler: opts.handler }),
  internalMutation: (opts: { handler: Function }) => ({ handler: opts.handler }),
  query: (opts: { handler: Function }) => ({ handler: opts.handler }),
  mutation: (opts: { handler: Function }) => ({ handler: opts.handler }),
  action: (opts: { handler: Function }) => ({ handler: opts.handler }),
}));
vi.mock("../../convex/rag/instance", () => ({
  rag: { search: vi.fn(async () => ({ results: [] })) },
}));

import { searchDocumentsAction } from "../../convex/embeddings/search";
import { rag } from "../../convex/rag/instance";

describe("searchDocumentsAction query routing", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("sends the keyword query to lexical channels and HyDE only to the dense channel", async () => {
    vi.stubEnv("KNOWLEDGE_STORE_BACKEND", "convex");
    const keywordQuery = "first merit list display date Fall 2026 UET Taxila admissions";
    const hyde =
      "UET Taxila typically announces its first merit list a few weeks after the deadline.";
    const runQuery = vi.fn(async () => []);
    const ctx = { runQuery, runAction: vi.fn(async () => []), runMutation: vi.fn() };

    await (searchDocumentsAction as unknown as { handler: Function }).handler(ctx, {
      queryText: keywordQuery,
      hydeQuery: hyde,
      limit: 8,
    });

    const lexicalQueries = runQuery.mock.calls
      .map((call) => (call as unknown[])[1] as { query?: unknown; limit?: unknown })
      .filter((a) => typeof a?.query === "string" && typeof a?.limit === "number")
      .map((a) => a.query);
    expect(lexicalQueries.length).toBeGreaterThanOrEqual(3);
    expect(lexicalQueries.every((q) => q === keywordQuery)).toBe(true);
    expect(vi.mocked(rag.search).mock.calls[0]?.[1]).toMatchObject({ query: hyde });
  });
});

describe("searchDocumentsAction dense channels (pinecone backend)", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("searches both the HyDE paragraph and the question, and fuses hits from each", async () => {
    vi.stubEnv("KNOWLEDGE_STORE_BACKEND", "pinecone");
    const { getFunctionName } = await import("convex/server");
    const hyde = "UET Taxila admits DAE holders into the second year of engineering programmes.";
    const question = "Does UET Taxila accept DAE students for lateral entry?";
    const embeddedTexts: string[] = [];

    const runAction = vi.fn(async (ref: unknown, args: Record<string, unknown>) => {
      const name = getFunctionName(ref as never);
      if (name.endsWith("cloudflareEmbedQuery")) {
        embeddedTexts.push(args.text as string);
        return args.text === hyde ? [1] : [2];
      }
      if (name.endsWith("denseSearch")) {
        const chunkKey = (args.queryEmbedding as number[])[0] === 1 ? "hyde-hit" : "question-hit";
        return [{ documentId: `doc-${chunkKey}`, chunkKey, score: 0.9 }];
      }
      return [];
    });
    const runQuery = vi.fn(async (ref: unknown, args: Record<string, unknown>) => {
      if (getFunctionName(ref as never).endsWith("getRagIdAndTextByChunkRefs")) {
        return (args.refs as Array<{ chunkKey: string }>).map((r) => ({
          ragId: `rag-${r.chunkKey}`,
          text: `text of ${r.chunkKey}`,
        }));
      }
      return [];
    });

    const results = (await (searchDocumentsAction as unknown as { handler: Function }).handler(
      { runQuery, runAction, runMutation: vi.fn() },
      { queryText: "UET Taxila DAE lateral entry", hydeQuery: hyde, questionText: question, limit: 8 },
    )) as Array<{ entryId: string; content: string }>;

    expect(embeddedTexts.sort()).toEqual([hyde, question].sort());
    expect(results.map((r) => r.entryId).sort()).toEqual(["rag-hyde-hit", "rag-question-hit"]);
    expect(results.find((r) => r.entryId === "rag-question-hit")?.content).toBe(
      "text of question-hit",
    );
  });
});
