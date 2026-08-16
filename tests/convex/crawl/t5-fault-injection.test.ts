/**
 * T5 fault injection, updated for the stale-generation-race remediation.
 *
 * The original Phase 6.21A version of this file tested the OLD
 * rag.add-then-saveEmbedding two-step sequence, where every successful
 * rag.add() call was always followed by exactly one saveEmbedding call.
 * That two-step sequence is exactly what let a stale generation's rag.add()
 * call physically delete a newer generation's already-committed RAG entry
 * (saveEmbedding's unconditional replacedEntry cleanup ran BEFORE its own
 * generation check) - see computeRagVersionKey in crawl/chunkKey.ts for the
 * full source-verified rationale.
 *
 * The remediated architecture makes the follow-up call CONDITIONAL: for the
 * normal created:true path, rag.defineOnComplete's callback (onRagEntryComplete
 * in crawl/mutations.ts) already ran the commit-or-discard decision INSIDE
 * the awaited rag.add() call (source-verified against
 * component/entries.js's `add` handler, which calls promoteToReadyHandler -
 * and therefore onComplete - inline before returning, whenever allChunks is
 * populated). There is no separate follow-up call left for this file to
 * fault-inject for that path. The one remaining follow-up call this action
 * makes itself is the created:false fast-dedup fallback's
 * commitCurrentGenerationChunk, which this file now targets instead.
 *
 * Boundary NOT tested (named explicitly, not silently assumed): what
 * happens INSIDE @convex-dev/rag's own transaction, including inside
 * onComplete's execution as part of that same nested call chain - that
 * state lives entirely inside the component's own tables and mutation
 * boundary, which this project is not permitted to inspect or mutate
 * directly. The real, unmocked proof of onComplete's own failure modes
 * (F1-F10) is the failure-injection matrix run against a real local Convex
 * backend, not this mocked file - do not mistake this file's PASS for that
 * proof.
 */

vi.mock("../../../convex/_generated/server", () => ({
  internalAction: (opts: { handler: Function }) => ({ handler: opts.handler }),
}));

vi.mock("../../../convex/_generated/api", () => ({
  internal: {
    crawl: {
      mutations: {
        stagePendingChunkText: "stagePendingChunkText" as any,
        commitCurrentGenerationChunk: "commitCurrentGenerationChunk" as any,
        onRagEntryComplete: "onRagEntryComplete" as any,
      },
      queries: { getChunkByKey: "getChunkByKey" as any },
      actions: {},
      bulkOperationsControl: {
        checkBulkOperationsEnabled: "checkBulkOperationsEnabled" as any,
      },
    },
    embeddings: { contextualize: { contextualizeNewChunk: "contextualizeNewChunk" as any } },
  },
}));

vi.mock("../../../convex/rag/instance", () => ({
  rag: { add: vi.fn(), delete: vi.fn(), deleteAsync: vi.fn() },
}));

import { beforeEach, describe, expect, it, vi } from "vitest";

describe("embedSingleChunk fault injection (rag.add and the created:false follow-up)", () => {
  let embedSingleChunk: any;
  let ragModule: any;
  let mockCtx: any;

  beforeEach(async () => {
    ragModule = await import("../../../convex/rag/instance");
    (ragModule.rag.add as any).mockReset();
    const mod = await import("../../../convex/crawl/actions");
    embedSingleChunk = mod.embedSingleChunk;
    mockCtx = {
      runMutation: vi.fn().mockResolvedValue(undefined),
      // Default: bulk operations enabled (matches production's "absence
      // means enabled"), no existing chunk at this key for anything else.
      runQuery: vi.fn().mockImplementation((fnRef: string) =>
        Promise.resolve(fnRef === "checkBulkOperationsEnabled" ? true : null),
      ),
      runAction: vi.fn(),
      auth: { getUserIdentity: vi.fn() },
      scheduler: { runAfter: vi.fn().mockResolvedValue(undefined) },
    };
  });

  const args = {
    documentId: "doc-t5" as any,
    url: "https://web.uettaxila.edu.pk/t5",
    chunkText: "Replacement content that will fail before becoming ready.",
    contentHash: "hash-replacement",
    chunkKey: "key-t5",
    ingestionGeneration: 2,
    jobId: "job-t5",
    namespaceId: "ns-t5",
  };

  it("scenario A - rag.add() itself fails: no commit is ever attempted, existing GOOD row is provably untouched", async () => {
    ragModule.rag.add.mockRejectedValue(new Error("ECONNRESET (simulated transient failure)"));

    await expect((embedSingleChunk as any).handler(mockCtx, args)).rejects.toThrow("ECONNRESET");

    // The staged text is deliberately left untouched here (retry-storm
    // race): ragVersionKey is shared by every concurrent attempt at this
    // exact (position, generation), and a still-in-flight sibling may need
    // the SAME staged row to commit from. Workpool retries this failed
    // attempt with fresh staging of its own.
    expect(mockCtx.runMutation).not.toHaveBeenCalledWith(
      "deletePendingChunkText",
      expect.anything(),
    );
    // commitCurrentGenerationChunk - the only call that ever writes
    // crawledChunks - was never invoked, so whatever GOOD row already
    // existed for this position is untouched.
    expect(mockCtx.runMutation).not.toHaveBeenCalledWith(
      "commitCurrentGenerationChunk",
      expect.anything(),
    );
  });

  it("scenario B - rag.add() resolves created:true: no follow-up commit call is made from this action - onComplete already ran inside the awaited call", async () => {
    ragModule.rag.add.mockResolvedValue({
      entryId: "rag-new-ready",
      created: true,
      replacedEntry: { entryId: "rag-old-same-generation" },
    });

    await (embedSingleChunk as any).handler(mockCtx, args);

    expect(mockCtx.runMutation).not.toHaveBeenCalledWith(
      "commitCurrentGenerationChunk",
      expect.anything(),
    );
  });

  it("scenario C - rag.add() resolves created:false but the follow-up commitCurrentGenerationChunk then fails: the error propagates (workpool retries) rather than being silently swallowed", async () => {
    ragModule.rag.add.mockResolvedValue({
      entryId: "rag-existing-ready",
      created: false,
      replacedEntry: null,
    });
    mockCtx.runMutation.mockImplementation((fn: string) => {
      if (fn === "commitCurrentGenerationChunk") {
        return Promise.reject(new Error("Convex OCC conflict (simulated)"));
      }
      return Promise.resolve(undefined);
    });

    await expect((embedSingleChunk as any).handler(mockCtx, args)).rejects.toThrow(
      "Convex OCC conflict",
    );

    // The contextualization scheduling step, which only runs after a
    // successful save, never fires - confirming nothing downstream treated
    // this failed attempt as complete.
    expect(mockCtx.scheduler.runAfter).not.toHaveBeenCalled();
  });
});
