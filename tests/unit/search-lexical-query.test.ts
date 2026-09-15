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
