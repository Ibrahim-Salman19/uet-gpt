/**
 * tests/convex/crawl/reset_ops.test.ts
 *
 * reembedPendingBatch has zero callers anywhere in the codebase (confirmed
 * by search) but is a real internalMutation reachable via the Convex
 * dashboard/CLI, so the August 2026 incident remediation's kill-switch gate
 * and per-document job-identity fix still need to hold even though nothing
 * currently invokes it in production. This file covers only reembedPendingBatch
 * - resetAbandonedDLQ/resetPipelineBatch/resetFailedDocuments are unchanged
 * by this remediation and already had no dedicated coverage before it.
 */
vi.mock("../../../convex/_generated/server", () => ({
  internalMutation: (opts: { handler: Function }) => ({ handler: opts.handler }),
  // reset_ops.ts imports assertBulkOperationsEnabled from bulkOperationsControl.ts,
  // which also exports an internalQuery - the mock must provide it even
  // though this file only directly needs internalMutation.
  internalQuery: (opts: { handler: Function }) => ({ handler: opts.handler }),
}));

vi.mock("../../../convex/_generated/api", () => ({
  internal: {
    crawl: {
      actions: { embedSingleChunk: "embedSingleChunk" as any },
      mutations: { onChunkEmbedded: "onChunkEmbedded" as any },
    },
  },
}));

vi.mock("../../../convex/rag/instance", () => ({
  rag: {
    getOrCreateNamespace: vi.fn().mockResolvedValue({ namespaceId: "mock-ns-id" }),
  },
}));

vi.mock("../../../convex/crawl/workpools", () => ({
  embeddingPool: { enqueueActionBatch: vi.fn().mockResolvedValue(undefined) },
}));

import { beforeEach, describe, expect, it, vi } from "vitest";
import { embeddingPool } from "../../../convex/crawl/workpools";

function createMockDb({
  bulkOperationsControl = [] as any[],
  documents = [] as any[],
  crawledChunksByDoc = {} as Record<string, any[]>,
}) {
  const patched: Record<string, any> = {};
  return {
    query: vi.fn((table: string) => {
      if (table === "bulkOperationsControl") {
        return {
          withIndex: vi.fn(() => ({
            unique: vi.fn(async () => bulkOperationsControl[0] ?? null),
          })),
        };
      }
      if (table === "documents") {
        return {
          withIndex: vi.fn(() => ({
            take: vi.fn(async (n: number) => documents.slice(0, n)),
          })),
        };
      }
      if (table === "crawledChunks") {
        return {
          withIndex: vi.fn((_name: string, builder: (q: any) => any) => {
            let docId: string | undefined;
            builder({
              eq: (_field: string, value: any) => {
                docId = value;
                return { eq: () => {} };
              },
            });
            const chunks = crawledChunksByDoc[docId as string] ?? [];
            return {
              paginate: vi.fn(async () => ({
                page: chunks,
                isDone: true,
                continueCursor: null,
              })),
            };
          }),
        };
      }
      throw new Error(`createMockDb: unexpected table "${table}"`);
    }),
    patch: vi.fn(async (id: string, updates: any) => {
      patched[id] = { ...(patched[id] ?? {}), ...updates };
    }),
    _patched: patched,
  };
}

describe("crawl/reset_ops.ts: reembedPendingBatch", () => {
  let handler: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    (embeddingPool.enqueueActionBatch as any).mockResolvedValue(undefined);
    const mod = await import("../../../convex/crawl/reset_ops");
    handler = mod.reembedPendingBatch;
  });

  it("rejects when the bulk-operations kill switch is disabled, before touching any document", async () => {
    const db = createMockDb({
      bulkOperationsControl: [{ _id: "row-1", key: "global", enabled: false }],
      documents: [{ _id: "doc-1", status: "pending_embed" }],
    });
    const ctx = { db };

    await expect((handler as any).handler(ctx, {})).rejects.toThrow(/disabled/i);
    expect(embeddingPool.enqueueActionBatch).not.toHaveBeenCalled();
  });

  it("proceeds when bulk operations are enabled (absent row)", async () => {
    const doc = {
      _id: "doc-1",
      status: "pending_embed",
      url: "https://web.uettaxila.edu.pk/x",
      ingestionGeneration: 1,
    };
    const chunk = {
      _id: "chunk-1",
      documentId: "doc-1",
      text: "hello",
      contentHash: "hash-1",
      chunkKey: "key-1",
      parentId: undefined,
      headingPath: undefined,
    };
    const db = createMockDb({
      documents: [doc],
      crawledChunksByDoc: { "doc-1": [chunk] },
    });
    const ctx = { db };

    const result = await (handler as any).handler(ctx, {});

    expect(result).toEqual({ processed: 1, chunksQueued: 1, remaining: "done" });
    expect(embeddingPool.enqueueActionBatch).toHaveBeenCalledTimes(1);
  });

  it("derives a per-document jobId (not a shared hardcoded literal) for each document's recovery pass", async () => {
    const docA = { _id: "doc-a", status: "pending_embed", url: "https://x/a", ingestionGeneration: 0 };
    const docB = { _id: "doc-b", status: "pending_embed", url: "https://x/b", ingestionGeneration: 2 };
    const chunkA = {
      _id: "chunk-a",
      documentId: "doc-a",
      text: "a",
      contentHash: "hash-a",
      chunkKey: "key-a",
    };
    const chunkB = {
      _id: "chunk-b",
      documentId: "doc-b",
      text: "b",
      contentHash: "hash-b",
      chunkKey: "key-b",
    };
    const db = createMockDb({
      documents: [docA, docB],
      crawledChunksByDoc: { "doc-a": [chunkA], "doc-b": [chunkB] },
    });
    const ctx = { db };

    await (handler as any).handler(ctx, {});

    expect(embeddingPool.enqueueActionBatch).toHaveBeenCalledTimes(2);
    const calls = (embeddingPool.enqueueActionBatch as any).mock.calls;
    const jobIdA = calls[0][2][0].jobId;
    const jobIdB = calls[1][2][0].jobId;

    expect(jobIdA).toMatch(/^reembed-\d+-doc-a$/);
    expect(jobIdB).toMatch(/^reembed-\d+-doc-b$/);
    expect(jobIdA).not.toBe("reembed-job");
    expect(jobIdA).not.toBe(jobIdB);
  });

  it("computes newGeneration as ingestionGeneration + 1 (defaulting missing generation to 0)", async () => {
    const doc = { _id: "doc-1", status: "pending_embed", url: "https://x/1" };
    const chunk = { _id: "chunk-1", documentId: "doc-1", text: "t", contentHash: "h", chunkKey: "k" };
    const db = createMockDb({
      documents: [doc],
      crawledChunksByDoc: { "doc-1": [chunk] },
    });
    const ctx = { db };

    await (handler as any).handler(ctx, {});

    const calls = (embeddingPool.enqueueActionBatch as any).mock.calls;
    expect(calls[0][2][0].ingestionGeneration).toBe(1);
    expect(db._patched["doc-1"].ingestionGeneration).toBe(1);
  });

  it("skips legacy chunks with no chunkKey and does not enqueue them", async () => {
    const doc = { _id: "doc-1", status: "pending_embed", url: "https://x/1", ingestionGeneration: 0 };
    const goodChunk = { _id: "chunk-good", documentId: "doc-1", text: "t", contentHash: "h", chunkKey: "k" };
    const legacyChunk = { _id: "chunk-legacy", documentId: "doc-1", text: "old", contentHash: "h2" };
    const db = createMockDb({
      documents: [doc],
      crawledChunksByDoc: { "doc-1": [goodChunk, legacyChunk] },
    });
    const ctx = { db };

    const result = await (handler as any).handler(ctx, {});

    expect(result.chunksQueued).toBe(1);
    const calls = (embeddingPool.enqueueActionBatch as any).mock.calls;
    expect(calls[0][2]).toHaveLength(1);
    expect(calls[0][2][0].chunkKey).toBe("k");
  });

  it("marks a document failed (no re-crawl-worthy chunks) when all its chunks are legacy and it previously had a nonzero chunkCount", async () => {
    const doc = {
      _id: "doc-1",
      status: "pending_embed",
      url: "https://x/1",
      ingestionGeneration: 0,
      chunkCount: 3,
    };
    const legacyChunk = { _id: "chunk-legacy", documentId: "doc-1", text: "old", contentHash: "h2" };
    const db = createMockDb({
      documents: [doc],
      crawledChunksByDoc: { "doc-1": [legacyChunk] },
    });
    const ctx = { db };

    await (handler as any).handler(ctx, {});

    expect(embeddingPool.enqueueActionBatch).not.toHaveBeenCalled();
    expect(db._patched["doc-1"]).toEqual(
      expect.objectContaining({ status: "failed", error: expect.stringMatching(/re-crawl/i) }),
    );
  });
});
