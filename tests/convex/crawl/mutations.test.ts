vi.mock("../../../convex/_generated/server", () => ({
  internalMutation: (opts: { handler: Function }) => ({ handler: opts.handler }),
  internalQuery: (opts: { handler: Function }) => ({ handler: opts.handler }),
}));

vi.mock("../../../convex/_generated/api", () => ({
  internal: {
    crawl: {
      mutations: { onChunkEmbedded: "onChunkEmbedded" as any },
      actions: { embedSingleChunk: "embedSingleChunk" as any },
    },
  },
}));

vi.mock("../../../convex/rag/instance", () => ({
  rag: {
    add: vi.fn(),
    delete: vi.fn(),
    deleteAsync: vi.fn(),
    getOrCreateNamespace: vi.fn().mockResolvedValue({ namespaceId: "mock-ns-id" }),
    // rag.defineOnComplete(fn) registers fn as an internal mutation in the
    // real component; the mock just needs to preserve fn behind the same
    // { handler } shape every other mocked internalMutation/internalQuery
    // in this file uses, so (onRagEntryComplete as any).handler(ctx, args)
    // works identically to every other handler-under-test here.
    defineOnComplete: vi.fn((fn: unknown) => ({ handler: fn })),
  },
}));

vi.mock("../../../convex/crawl/workpools", () => ({
  embeddingPool: {
    enqueueAction: vi.fn(),
    enqueueActionBatch: vi.fn().mockResolvedValue(undefined),
  },
}));

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { computeIndexingFingerprint } from "../../../convex/crawl/chunkKey";
import { PENDING_EMBEDDING_BACKLOG_CEILING } from "../../../convex/crawl/mutations";

// Phase 6.21A Part 7: the real fast-path fingerprint, computed once for the
// whole file. It is a pure function of pipeline constants (no Convex/mocking
// involved), so using the REAL value here - rather than an arbitrary string -
// keeps these tests honest about what the fast path actually compares against.
let CURRENT_FINGERPRINT: string;
beforeEach(async () => {
  CURRENT_FINGERPRINT = await computeIndexingFingerprint();
});

/**
 * Creates a chainable query result mock.
 * Supports withIndex multi-field equality filtering: every eq(field, value)
 * call on the constraint builder is recorded, and the result array is
 * filtered to rows matching ALL recorded predicates. This generalizes the
 * original status-only filter (Phase 6.21A: saveEmbedding/getAllChunksBy...
 * now filter by documentId+chunkKey, documentId+contentHash, and ragId, not
 * just status) while staying backward compatible with existing status-only
 * usages.
 */
function createDbQueryResult(result: any) {
  const filters: Record<string, any> = {};

  const getFiltered = () => {
    if (result === null) return [];
    const arr = Array.isArray(result) ? result : [result];
    const keys = Object.keys(filters);
    if (keys.length === 0) return arr;
    return arr.filter((doc: any) => keys.every((k) => doc[k] === filters[k]));
  };

  const chain: any = {};

  // withIndex may receive a constraint builder function - we call it with a spy
  // that records every eq(field, value) call to enable multi-field filtering.
  chain.withIndex = vi.fn((_indexName: string, constraintFn?: Function) => {
    if (constraintFn) {
      const constraintSpy = {
        eq: (field: string, value: any) => {
          filters[field] = value;
          return constraintSpy;
        },
        gte: () => constraintSpy,
        lte: () => constraintSpy,
        gt: () => constraintSpy,
        lt: () => constraintSpy,
      };
      constraintFn(constraintSpy);
    }
    return chain;
  });

  chain.filter = vi.fn(() => chain);
  chain.order = vi.fn(() => chain);

  chain.first = vi.fn(() => {
    const arr = getFiltered();
    return arr[0] ?? null;
  });
  chain.unique = vi.fn(() => {
    const arr = getFiltered();
    return arr[0] ?? null;
  });
  chain.collect = vi.fn(() => getFiltered());
  chain.take = vi.fn((n: number) => getFiltered().slice(0, n));
  chain.paginate = vi.fn(() => ({
    page: getFiltered(),
    isDone: true,
    continueCursor: null,
  }));
  // Phase 6.21A: getAllChunksByDocumentId/countChunksByDocumentId iterate the
  // query directly with `for await`, matching Convex's real query objects.
  chain[Symbol.asyncIterator] = async function* () {
    for (const doc of getFiltered()) {
      yield doc;
    }
  };
  return chain;
}

/**
 * Phase 6.21A: per-table arrays are now MUTABLE, and insert/patch/delete
 * actually update them, so a query issued later in the SAME handler call
 * sees this call's own writes so far - matching real Convex's
 * read-your-own-writes semantics within one mutation. This matters for
 * completion-contract tests (bumpDocumentProgress's countChunksByDocumentId
 * re-scans crawledChunks AFTER an insert earlier in the same
 * saveEmbedding invocation) and multi-step generation-race tests that call
 * a handler twice and expect the second call to see the first's writes.
 * Existing tests that override behavior with `.mockResolvedValue(...)` /
 * `.mockReturnValue(...)` / `.mockReset()` on individual db methods are
 * unaffected - a vi.fn() override always takes precedence over the
 * implementation below.
 */
function createMockDb(resultMap?: Record<string, any>) {
  const tables: Record<string, any[]> = {};
  for (const [table, value] of Object.entries(resultMap ?? {})) {
    tables[table] = value === null ? [] : Array.isArray(value) ? [...value] : [value];
  }

  const db: any = {
    query: vi.fn((tableName: string) => {
      if (!(tableName in tables)) tables[tableName] = [];
      return createDbQueryResult(tables[tableName]);
    }),
    get: vi.fn((id: any) => {
      for (const rows of Object.values(tables)) {
        const found = rows.find((r) => r._id === id);
        if (found) return found;
      }
      return null;
    }),
    insert: vi.fn((table: string, doc: any) => {
      const id = doc._id ?? "new-id-" + Math.random().toString(36).slice(2, 10);
      if (!(table in tables)) tables[table] = [];
      tables[table]!.push({ _id: id, _creationTime: Date.now(), ...doc });
      return id;
    }),
    patch: vi.fn((id: any, updates: any) => {
      for (const rows of Object.values(tables)) {
        const idx = rows.findIndex((r) => r._id === id);
        if (idx !== -1) {
          rows[idx] = { ...rows[idx], ...updates };
          return;
        }
      }
    }),
    delete: vi.fn((id: any) => {
      for (const table of Object.keys(tables)) {
        tables[table] = tables[table]!.filter((r) => r._id !== id);
      }
    }),
  };
  return db;
}

function makeDoc(overrides: any = {}) {
  return {
    _id: overrides._id ?? "doc-default-id",
    _creationTime: Date.now(),
    url: "https://web.uettaxila.edu.pk/page",
    title: "Test Page",
    source: "web.uettaxila.edu.pk",
    category: "crawled",
    contentHash: "hash-default",
    // Phase 6.21A: defaults to the REAL current fingerprint/generation 1 so
    // a test that doesn't care about Part 4/5/7 behavior still exercises the
    // fast path / generation fencing correctly by default. Tests that DO
    // care override these explicitly.
    indexingFingerprint: CURRENT_FINGERPRINT,
    ingestionGeneration: 1,
    status: "active",
    crawledAt: Date.now(),
    updatedAt: Date.now(),
    chunkCount: 0,
    crawlSessionId: "session-default",
    isStale: false,
    freshnessTier: "medium",
    metadata: {},
    error: undefined,
    ...overrides,
  };
}

function makeChunk(overrides: any = {}) {
  return {
    _id: overrides._id ?? "chunk-default-id",
    _creationTime: Date.now(),
    documentId: "doc-default-id",
    contentHash: "chunk-hash-default",
    chunkKey: "chunkkey-default",
    ingestionGeneration: 1,
    text: "Chunk text content for testing purposes.",
    ragId: "rag-default-id",
    embeddingModel: "gemini-embedding-2",
    ...overrides,
  };
}

function makeProcessedWebhook(overrides: any = {}) {
  return {
    _id: "webhook-default-id",
    _creationTime: Date.now(),
    jobId: "task-default",
    processedAt: Date.now(),
    expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
    ...overrides,
  };
}

function makeDLQ(overrides: any = {}) {
  return {
    _id: "dlq-default-id",
    _creationTime: Date.now(),
    url: "https://web.uettaxila.edu.pk/page",
    jobId: "job-default",
    status: "pending_retry",
    failureCount: 1,
    failureReason: "Timeout",
    lastAttemptAt: Date.now(),
    payload: {
      documentId: "doc-id",
      url: "https://...",
      chunkText: "...",
      contentHash: "...",
      jobId: "job-id",
    },
    ...overrides,
  };
}

describe("getProcessedWebhook", () => {
  let handler: any;

  beforeEach(async () => {
    const mod = await import("../../../convex/crawl/mutations");
    handler = mod.getProcessedWebhook;
  });

  it("returns the processed webhook when found", async () => {
    const existing = makeProcessedWebhook({ jobId: "task-123" });
    const db = createMockDb({ processedWebhooks: existing });
    const ctx = { db, auth: { getUserIdentity: vi.fn() } };

    const result = await (handler as any).handler(ctx, { jobId: "task-123" });
    expect(result).toEqual(existing);
    expect(db.query).toHaveBeenCalledWith("processedWebhooks");
  });

  it("returns null when no processed webhook exists", async () => {
    const db = createMockDb({ processedWebhooks: null });
    const ctx = { db, auth: { getUserIdentity: vi.fn() } };

    const result = await (handler as any).handler(ctx, { jobId: "unknown-task" });
    expect(result).toBeNull();
  });
});

describe("markWebhookProcessed", () => {
  let handler: any;

  beforeEach(async () => {
    const mod = await import("../../../convex/crawl/mutations");
    handler = mod.markWebhookProcessed;
  });

  it("inserts a processed webhook record", async () => {
    const db = createMockDb();
    const ctx = { db, auth: { getUserIdentity: vi.fn() } };

    await (handler as any).handler(ctx, { jobId: "task-456" });

    expect(db.insert).toHaveBeenCalledWith(
      "processedWebhooks",
      expect.objectContaining({
        jobId: "task-456",
        processedAt: expect.any(Number),
      }),
    );
  });

  it("uses provided expiresAt", async () => {
    const db = createMockDb();
    const ctx = { db, auth: { getUserIdentity: vi.fn() } };
    const future = Date.now() + 999999;

    await (handler as any).handler(ctx, { jobId: "task-789", expiresAt: future });

    expect(db.insert).toHaveBeenCalledWith(
      "processedWebhooks",
      expect.objectContaining({
        expiresAt: future,
      }),
    );
  });

  it("uses default 30-day TTL when expiresAt not provided", async () => {
    const db = createMockDb();
    const ctx = { db, auth: { getUserIdentity: vi.fn() } };
    const before = Date.now();

    await (handler as any).handler(ctx, { jobId: "task-ttl-test" });

    expect(db.insert).toHaveBeenCalledWith(
      "processedWebhooks",
      expect.objectContaining({
        expiresAt: expect.any(Number),
      }),
    );
    const callArgs = (db.insert as any).mock.calls[0][1];
    // The code uses 30 * 24 * 60 * 60 * 1000 = 30 days
    expect(callArgs.expiresAt).toBeGreaterThan(before + 29 * 24 * 60 * 60 * 1000);
    expect(callArgs.expiresAt).toBeLessThanOrEqual(before + 30 * 24 * 60 * 60 * 1000 + 1000);
  });
});

describe("queueChunksForEmbedding", () => {
  let handler: any;
  let embeddingPoolModule: any;

  beforeEach(async () => {
    embeddingPoolModule = await import("../../../convex/crawl/workpools");
    (embeddingPoolModule.embeddingPool.enqueueAction as any).mockReset();
    (embeddingPoolModule.embeddingPool.enqueueActionBatch as any).mockReset();
    const mod = await import("../../../convex/crawl/mutations");
    handler = mod.queueChunksForEmbedding;
  });

  const defaultParents = [
    { contentHash: "parent-hash-1", text: "Parent block one for context." },
    { contentHash: "parent-hash-2", text: "Parent block two for context." },
  ];
  const defaultChildren = [
    {
      text: "Chunk one content here with enough words.",
      contentHash: "hash-c1",
      chunkKey: "key-c1",
      parentContentHash: "parent-hash-1",
    },
    {
      text: "Chunk two content here for testing.",
      contentHash: "hash-c2",
      chunkKey: "key-c2",
      parentContentHash: "parent-hash-2",
    },
  ];

  it("returns unchanged when document content hash AND indexingFingerprint match", async () => {
    const existingDoc = makeDoc({
      _id: "doc-existing",
      contentHash: "same-hash",
      status: "indexed",
    });
    const db = createMockDb({ documents: existingDoc, crawledChunks: [] });
    const ctx = {
      db,
      auth: { getUserIdentity: vi.fn() },
      runMutation: vi.fn(),
      runQuery: vi.fn(),
      runAction: vi.fn(),
    };

    const result = await (handler as any).handler(ctx, {
      url: existingDoc.url,
      title: "Test",
      contentHash: "same-hash",
      jobId: "job-1",
      parents: defaultParents,
      children: defaultChildren,
    });

    expect(result).toEqual({ status: "unchanged", chunksQueued: 0 });
    expect(db.patch).toHaveBeenCalledWith(
      "doc-existing",
      expect.objectContaining({
        status: "indexed",
      }),
    );
    expect(embeddingPoolModule.embeddingPool.enqueueAction).not.toHaveBeenCalled();
  });

  it("Part 7: does NOT take the fast path when contentHash matches but indexingFingerprint differs", async () => {
    const existingDoc = makeDoc({
      _id: "doc-existing",
      contentHash: "same-hash",
      status: "indexed",
      indexingFingerprint: "some-stale-pipeline-fingerprint",
      ingestionGeneration: 3,
    });
    const db = createMockDb({ documents: existingDoc, crawledChunks: [] });
    const ctx = {
      db,
      auth: { getUserIdentity: vi.fn() },
      runMutation: vi.fn(),
      runQuery: vi.fn(),
      runAction: vi.fn(),
    };

    const result = await (handler as any).handler(ctx, {
      url: existingDoc.url,
      title: "Test",
      contentHash: "same-hash",
      jobId: "job-1",
      parents: defaultParents,
      children: defaultChildren,
    });

    expect(result.status).toBe("updated");
    // A pipeline change forces a full rebuild - both chunks get queued even
    // though source contentHash didn't change (no prior chunkKey rows exist
    // in this test's empty crawledChunks, so both are "new" for the round).
    expect(result.chunksQueued).toBe(2);
    expect(db.patch).toHaveBeenCalledWith(
      "doc-existing",
      expect.objectContaining({ ingestionGeneration: 4 }),
    );
  });

  it("updates metadata on unchanged document when etag/lastModified provided", async () => {
    const existingDoc = makeDoc({ _id: "doc-existing", contentHash: "same-hash" });
    const db = createMockDb({ documents: existingDoc, crawledChunks: [] });
    const ctx = {
      db,
      auth: { getUserIdentity: vi.fn() },
      runMutation: vi.fn(),
      runQuery: vi.fn(),
      runAction: vi.fn(),
    };

    await (handler as any).handler(ctx, {
      url: existingDoc.url,
      title: "Test",
      contentHash: "same-hash",
      jobId: "job-1",
      parents: [],
      children: [],
      etag: '"abc123"',
      lastModified: "Wed, 30 May 2026 12:00:00 GMT",
    });

    expect(db.patch).toHaveBeenCalledWith(
      "doc-existing",
      expect.objectContaining({
        metadata: { lastModified: "Wed, 30 May 2026 12:00:00 GMT", etag: '"abc123"' },
      }),
    );
  });

  it("inserts a new document when no existing document found", async () => {
    const db = createMockDb({ documents: null, crawledChunks: [] });
    db.insert.mockReturnValue("doc-new-id");
    const ctx = {
      db,
      auth: { getUserIdentity: vi.fn() },
      runMutation: vi.fn(),
      runQuery: vi.fn(),
      runAction: vi.fn(),
    };

    const result = await (handler as any).handler(ctx, {
      url: "https://web.uettaxila.edu.pk/new-page",
      title: "New Page",
      contentHash: "new-hash",
      jobId: "job-2",
      parents: defaultParents,
      children: defaultChildren,
    });

    expect(result.status).toBe("updated");
    expect(result.chunksQueued).toBe(2);
    expect(db.insert).toHaveBeenCalledWith(
      "documents",
      expect.objectContaining({
        url: "https://web.uettaxila.edu.pk/new-page",
        source: "web.uettaxila.edu.pk",
        contentHash: "new-hash",
      }),
    );
    // enqueueActionBatch is called once with all new chunks as a batch
    expect(embeddingPoolModule.embeddingPool.enqueueActionBatch).toHaveBeenCalledTimes(1);
  });

  it("patches existing document when content hash changed", async () => {
    const existingDoc = makeDoc({ _id: "doc-existing", contentHash: "old-hash" });
    const db = createMockDb({ documents: existingDoc, crawledChunks: [] });
    const ctx = {
      db,
      auth: { getUserIdentity: vi.fn() },
      runMutation: vi.fn(),
      runQuery: vi.fn(),
      runAction: vi.fn(),
    };

    await (handler as any).handler(ctx, {
      url: existingDoc.url,
      title: "Updated Page",
      contentHash: "new-hash",
      jobId: "job-3",
      parents: defaultParents,
      children: defaultChildren,
    });

    expect(db.patch).toHaveBeenCalledWith(
      "doc-existing",
      expect.objectContaining({
        contentHash: "new-hash",
        status: "processing",
      }),
    );
  });

  it("diffs chunks by chunkKey: unchanged key+hash is pre-credited, new key is enqueued", async () => {
    const existingDoc = makeDoc({ _id: "doc-existing", contentHash: "old-hash" });
    const existingChunks = [
      makeChunk({
        _id: "chunk-keep",
        documentId: "doc-existing",
        chunkKey: "key-c1",
        contentHash: "hash-c1",
        ragId: "rag-c1",
      }),
    ];
    const db = createMockDb({ documents: existingDoc, crawledChunks: existingChunks });
    const ctx = {
      db,
      auth: { getUserIdentity: vi.fn() },
      runMutation: vi.fn(),
      runQuery: vi.fn(),
      runAction: vi.fn(),
    };

    const newChildren = [
      {
        text: "Chunk one (unchanged)",
        contentHash: "hash-c1",
        chunkKey: "key-c1",
        parentContentHash: "parent-hash-1",
      },
      {
        text: "Chunk three (new)",
        contentHash: "hash-c3",
        chunkKey: "key-c3",
        parentContentHash: "parent-hash-1",
      },
    ];

    await (handler as any).handler(ctx, {
      url: existingDoc.url,
      title: "Test",
      contentHash: "new-hash",
      jobId: "job-4",
      parents: [defaultParents[0]],
      children: newChildren,
    });

    // enqueueActionBatch called once with only the new chunk (key-c3)
    expect(embeddingPoolModule.embeddingPool.enqueueActionBatch).toHaveBeenCalledTimes(1);
    const enqueuedArgs = embeddingPoolModule.embeddingPool.enqueueActionBatch.mock.calls[0];
    expect(enqueuedArgs[2]).toHaveLength(1);
    expect(enqueuedArgs[2][0].chunkKey).toBe("key-c3");
    // The unchanged chunk (key-c1) is pre-credited - chunksEmbedded starts
    // at 1 (of chunkCount 2), not 0, so the round only needs ONE more
    // saveEmbedding call to reach "indexed".
    expect(db.patch).toHaveBeenCalledWith(
      "doc-existing",
      expect.objectContaining({ chunkCount: 2, chunksEmbedded: 1, status: "processing" }),
    );
  });

  it("same chunkKey with a DIFFERENT contentHash is a same-position edit, not delete+insert", async () => {
    const existingDoc = makeDoc({ _id: "doc-existing", contentHash: "old-hash" });
    const existingChunks = [
      makeChunk({
        _id: "chunk-edit",
        documentId: "doc-existing",
        chunkKey: "key-c1",
        contentHash: "hash-c1-old",
        ragId: "rag-c1",
      }),
    ];
    const db = createMockDb({ documents: existingDoc, crawledChunks: existingChunks });
    const ctx = {
      db,
      auth: { getUserIdentity: vi.fn() },
      runMutation: vi.fn(),
      runQuery: vi.fn(),
      runAction: vi.fn(),
    };

    const newChildren = [
      {
        text: "Chunk one (edited)",
        contentHash: "hash-c1-new",
        chunkKey: "key-c1",
        parentContentHash: "parent-hash-1",
      },
    ];

    await (handler as any).handler(ctx, {
      url: existingDoc.url,
      title: "Test",
      contentHash: "new-hash",
      jobId: "job-edit",
      parents: [defaultParents[0]],
      children: newChildren,
    });

    // The edited position is queued for re-embedding (its value changed)...
    expect(embeddingPoolModule.embeddingPool.enqueueActionBatch).toHaveBeenCalledTimes(1);
    const enqueuedArgs = embeddingPoolModule.embeddingPool.enqueueActionBatch.mock.calls[0];
    expect(enqueuedArgs[2][0].chunkKey).toBe("key-c1");
    // ...but it is NOT in chunksToDelete (same key survives as a patch
    // target in saveEmbedding, not a delete+insert pair).
    const ragModule = await import("../../../convex/rag/instance");
    expect(ragModule.rag.deleteAsync as any).not.toHaveBeenCalled();
    expect(db.delete).not.toHaveBeenCalled();
  });

  it("deletes stale chunks whose chunkKey no longer appears in the new set", async () => {
    const ragModule = await import("../../../convex/rag/instance");
    (ragModule.rag.deleteAsync as any).mockReset();
    const existingDoc = makeDoc({ _id: "doc-existing", contentHash: "old-hash" });
    const staleChunk = makeChunk({
      _id: "chunk-stale",
      documentId: "doc-existing",
      chunkKey: "key-removed",
      contentHash: "hash-removed",
      ragId: "rag-stale",
    });
    const db = createMockDb({ documents: existingDoc, crawledChunks: [staleChunk] });
    const ctx = {
      db,
      auth: { getUserIdentity: vi.fn() },
      runMutation: vi.fn(),
      runQuery: vi.fn(),
      runAction: vi.fn(),
    };

    await (handler as any).handler(ctx, {
      url: existingDoc.url,
      title: "Test",
      contentHash: "new-hash",
      jobId: "job-5",
      parents: [],
      children: [],
    });

    expect(ragModule.rag.deleteAsync).toHaveBeenCalledWith(ctx, { entryId: "rag-stale" });
    expect(db.delete).toHaveBeenCalledWith("chunk-stale");
  });

  it("deletes legacy chunks with no chunkKey unconditionally (cannot be matched positionally)", async () => {
    const ragModule = await import("../../../convex/rag/instance");
    (ragModule.rag.deleteAsync as any).mockReset();
    const existingDoc = makeDoc({ _id: "doc-existing", contentHash: "old-hash" });
    const legacyChunk = makeChunk({
      _id: "chunk-legacy",
      documentId: "doc-existing",
      chunkKey: undefined,
      contentHash: "hash-c1",
      ragId: "rag-legacy",
    });
    const db = createMockDb({ documents: existingDoc, crawledChunks: [legacyChunk] });
    const ctx = {
      db,
      auth: { getUserIdentity: vi.fn() },
      runMutation: vi.fn(),
      runQuery: vi.fn(),
      runAction: vi.fn(),
    };

    // Even though the new set's chunkKey "key-c1" has the SAME contentHash
    // as the legacy row, the legacy row has no chunkKey to match against and
    // is treated as stale (see diffAndDeleteStaleChunks's legacyRows logic).
    await (handler as any).handler(ctx, {
      url: existingDoc.url,
      title: "Test",
      contentHash: "new-hash",
      jobId: "job-legacy",
      parents: [defaultParents[0]],
      children: [
        {
          text: "Chunk one",
          contentHash: "hash-c1",
          chunkKey: "key-c1",
          parentContentHash: "parent-hash-1",
        },
      ],
    });

    expect(ragModule.rag.deleteAsync).toHaveBeenCalledWith(ctx, { entryId: "rag-legacy" });
    expect(db.delete).toHaveBeenCalledWith("chunk-legacy");
    expect(embeddingPoolModule.embeddingPool.enqueueActionBatch).toHaveBeenCalledTimes(1);
  });

  it("handles empty chunks array gracefully", async () => {
    const db = createMockDb({ documents: null, crawledChunks: [] });
    const ctx = {
      db,
      auth: { getUserIdentity: vi.fn() },
      runMutation: vi.fn(),
      runQuery: vi.fn(),
      runAction: vi.fn(),
    };

    const result = await (handler as any).handler(ctx, {
      url: "https://web.uettaxila.edu.pk/empty-doc",
      title: "Empty",
      contentHash: "empty-hash",
      jobId: "job-6",
      parents: [],
      children: [],
    });

    expect(result.status).toBe("updated");
    expect(result.chunksQueued).toBe(0);
  });

  // Mirrors the "embedding backlog backpressure" coverage under
  // enqueueDocumentChunks below, but for queueChunksForEmbedding's OWN direct
  // call into enqueueNewChunks -> assertEmbeddingBacklogHasRoom (mutations.ts
  // line ~275). This is the dormant crawlWebhook/ingestWebhook-driven path -
  // the shared helper's ceiling math is already proven once by the
  // enqueueDocumentChunks tests, so this only needs to prove THIS call site
  // actually wires the same check in, not re-derive the ceiling arithmetic.
  describe("embedding backlog backpressure", () => {
    function pendingChunkTextRows(count: number) {
      return Array.from({ length: count }, (_, i) => ({
        _id: `pending-${i}`,
        _creationTime: Date.now(),
        ragVersionKey: `key-${i}`,
        chunkText: "staged text",
        updatedAt: Date.now(),
      }));
    }

    it("enqueues normally for a new document when the backlog is well below the ceiling", async () => {
      const db = createMockDb({
        documents: null,
        crawledChunks: [],
        pendingChunkText: pendingChunkTextRows(5),
      });
      const ctx = {
        db,
        auth: { getUserIdentity: vi.fn() },
        runMutation: vi.fn(),
        runQuery: vi.fn(),
        runAction: vi.fn(),
      };

      await (handler as any).handler(ctx, {
        url: "https://web.uettaxila.edu.pk/webhook-page",
        title: "Test",
        contentHash: "hash-below",
        jobId: "job-below",
        parents: defaultParents,
        children: defaultChildren,
      });

      expect(embeddingPoolModule.embeddingPool.enqueueActionBatch).toHaveBeenCalledTimes(1);
    });

    it("blocks a new document's enqueue (controlled failure) once the backlog is AT the ceiling", async () => {
      const db = createMockDb({
        documents: null,
        crawledChunks: [],
        pendingChunkText: pendingChunkTextRows(PENDING_EMBEDDING_BACKLOG_CEILING),
      });
      const ctx = {
        db,
        auth: { getUserIdentity: vi.fn() },
        runMutation: vi.fn(),
        runQuery: vi.fn(),
        runAction: vi.fn(),
      };

      await expect(
        (handler as any).handler(ctx, {
          url: "https://web.uettaxila.edu.pk/webhook-page",
          title: "Test",
          contentHash: "hash-at-ceiling",
          jobId: "job-at-ceiling",
          parents: defaultParents,
          children: defaultChildren,
        }),
      ).rejects.toThrow(/backlog/i);
      expect(embeddingPoolModule.embeddingPool.enqueueActionBatch).not.toHaveBeenCalled();
    });

    it("does not check the backlog (or block) when the diff yields no chunks to embed", async () => {
      const existingDoc = makeDoc({
        _id: "doc-existing",
        contentHash: "same-hash",
        status: "indexed",
      });
      const db = createMockDb({
        documents: existingDoc,
        crawledChunks: [],
        pendingChunkText: pendingChunkTextRows(PENDING_EMBEDDING_BACKLOG_CEILING + 50),
      });
      const ctx = {
        db,
        auth: { getUserIdentity: vi.fn() },
        runMutation: vi.fn(),
        runQuery: vi.fn(),
        runAction: vi.fn(),
      };

      // Fast unchanged-path: same contentHash, no fingerprint drift - must
      // not throw even though the backlog is far over the ceiling, since
      // nothing new is being queued.
      await (handler as any).handler(ctx, {
        url: existingDoc.url,
        title: "Test",
        contentHash: "same-hash",
        jobId: "job-unchanged",
        parents: defaultParents,
        children: defaultChildren,
      });

      expect(embeddingPoolModule.embeddingPool.enqueueActionBatch).not.toHaveBeenCalled();
    });
  });
});

describe("commitCurrentGenerationChunk", () => {
  // This replaces the old saveEmbedding: it is now called ONLY after the
  // caller (onRagEntryComplete, or embedSingleChunk's created:false
  // fallback - actions.ts) has ALREADY verified the generation is current
  // and cleaned up any same-generation replacedEntry. It does no generation
  // fencing of its own - that coverage now lives in the "onRagEntryComplete"
  // describe block below, against OnCompleteArgs' actual shape.
  let handler: any;
  let ragModule: any;

  beforeEach(async () => {
    ragModule = await import("../../../convex/rag/instance");
    (ragModule.rag.deleteAsync as any).mockReset();
    const mod = await import("../../../convex/crawl/mutations");
    handler = mod.commitCurrentGenerationChunk;
  });

  it("inserts a new crawledChunks record and credits progress toward chunkCount", async () => {
    const doc = makeDoc({
      _id: "doc-save",
      chunkCount: 1,
      chunksEmbedded: 0,
      ingestionGeneration: 1,
    });
    const db = createMockDb({ crawledChunks: null, documents: doc });
    const ctx = { db, auth: { getUserIdentity: vi.fn() } };

    await (handler as any).handler(ctx, {
      documentId: "doc-save" as any,
      chunkText: "This is the chunk text.",
      contentHash: "hash-save-1",
      baseChunkKey: "key-save-1",
      ragId: "rag-save-1",
      ingestionGeneration: 1,
      parentId: "parent-save-1" as any,
    });

    expect(db.insert).toHaveBeenCalledWith(
      "crawledChunks",
      expect.objectContaining({
        documentId: "doc-save",
        contentHash: "hash-save-1",
        chunkKey: "key-save-1",
        ragId: "rag-save-1",
        parentId: "parent-save-1",
        ingestionGeneration: 1,
      }),
    );
    // Sole chunk of a chunkCount=1 document: the counter reaches chunkCount,
    // AND the real row count (this insert) matches it too - "indexed".
    expect(db.patch).toHaveBeenCalledWith(
      "doc-save",
      expect.objectContaining({
        chunksEmbedded: 1,
        status: "indexed",
      }),
    );
  });

  it("no-ops (idempotency guard) when this exact ragId is already the committed one", async () => {
    const doc = makeDoc({ _id: "doc-skip", chunkCount: 1, ingestionGeneration: 1 });
    const existing = makeChunk({
      documentId: "doc-skip",
      chunkKey: "key-exists",
      contentHash: "hash-exists",
      ingestionGeneration: 1,
      ragId: "rag-original",
    });
    const db = createMockDb({ crawledChunks: existing, documents: doc });
    const ctx = { db, auth: { getUserIdentity: vi.fn() } };

    await (handler as any).handler(ctx, {
      documentId: "doc-skip" as any,
      chunkText: "Duplicate chunk.",
      contentHash: "hash-exists",
      baseChunkKey: "key-exists",
      ragId: "rag-original", // SAME ragId already committed
      ingestionGeneration: 1,
    });

    expect(db.insert).not.toHaveBeenCalled();
    expect(db.patch).not.toHaveBeenCalledWith(
      "doc-skip",
      expect.objectContaining({ chunksEmbedded: expect.anything() }),
    );
  });

  it("skips insertion (no double-credit) when the SAME baseChunkKey already has the SAME contentHash this generation", async () => {
    const doc = makeDoc({ _id: "doc-skip2", chunkCount: 1, ingestionGeneration: 1 });
    const existing = makeChunk({
      documentId: "doc-skip2",
      chunkKey: "key-exists2",
      contentHash: "hash-exists2",
      ingestionGeneration: 1,
      ragId: "rag-original2",
    });
    const db = createMockDb({ crawledChunks: existing, documents: doc });
    const ctx = { db, auth: { getUserIdentity: vi.fn() } };

    await (handler as any).handler(ctx, {
      documentId: "doc-skip2" as any,
      chunkText: "Duplicate chunk.",
      contentHash: "hash-exists2",
      baseChunkKey: "key-exists2",
      // Same ragId as the row already has - the true no-op case. See the
      // next test for the (real, retry-storm-proven) DIFFERENT-ragId case.
      ragId: "rag-original2",
      ingestionGeneration: 1,
    });

    expect(db.insert).not.toHaveBeenCalled();
    expect(db.patch).not.toHaveBeenCalledWith(
      "doc-skip2",
      expect.objectContaining({ chunksEmbedded: expect.anything() }),
    );
  });

  it("retry-storm: repoints ragId (without double-crediting progress) when a SAME-generation chained promotion left crawledChunks pointing at an already-superseded entry", async () => {
    // Reproduces the second Part 15 finding: many concurrent rag.add() calls
    // at ONE brand-new ragVersionKey can create several pending entries that
    // chain-promote (RAG's own promoteToReadyHandler unconditionally marks
    // whatever is CURRENTLY ready as replaced, with zero awareness of
    // crawledChunks - source-verified against component/entries.js). Each
    // earlier entry in the chain commits and patches crawledChunks.ragId to
    // ITSELF before being superseded and deleted by the next one - so by the
    // time the LAST (currently-alive) entry's own commit runs, the row can
    // already show the SAME contentHash and the SAME generation, but a
    // DIFFERENT (now-deleted) ragId. The old "already credited this
    // generation -> no-op" branch left this dangling forever; it must
    // instead repoint ragId to the caller's own (alive) entry while still
    // skipping the progress bump (this position was already credited
    // earlier in the same chain).
    const doc = makeDoc({ _id: "doc-chain", chunkCount: 1, ingestionGeneration: 3 });
    const existing = makeChunk({
      documentId: "doc-chain",
      chunkKey: "key-chain",
      contentHash: "hash-chain",
      ingestionGeneration: 3,
      ragId: "rag-chain-superseded", // an earlier, now-deleted link in the same chain
    });
    const db = createMockDb({ crawledChunks: existing, documents: doc });
    const ctx = { db, auth: { getUserIdentity: vi.fn() } };

    await (handler as any).handler(ctx, {
      documentId: "doc-chain" as any,
      chunkText: "Chained chunk.",
      contentHash: "hash-chain", // SAME content
      baseChunkKey: "key-chain",
      ragId: "rag-chain-survivor", // DIFFERENT (currently-alive) ragId
      ingestionGeneration: 3, // SAME generation
    });

    expect(db.insert).not.toHaveBeenCalled();
    expect(db.patch).toHaveBeenCalledWith("chunk-default-id", { ragId: "rag-chain-survivor" });
    expect(db.patch).not.toHaveBeenCalledWith(
      "doc-chain",
      expect.objectContaining({ chunksEmbedded: expect.anything() }),
    );
  });

  it("retry-storm: does NOT touch crawledChunks/progress/vector when args.ingestionGeneration is stale relative to the document's CURRENT generation", async () => {
    // Reproduces the Part 15 retry-storm finding: embedSingleChunk's
    // created:false fast-dedup fallback calls this primitive directly,
    // bypassing onRagEntryComplete's own generation fence entirely (RAG
    // never invokes onComplete for created:false). Without this guard, a
    // stale caller whose OWN generation's ragVersionKey already has a ready
    // entry (from an earlier same-generation commit) could reach here after
    // a NEWER generation has already taken over the position and either
    // resurrect the stale row or delete the current generation's vector via
    // retireSupersededCrossGenerationVector.
    const doc = makeDoc({ _id: "doc-stale-storm", chunkCount: 1, ingestionGeneration: 2 });
    const db = createMockDb({ crawledChunks: null, documents: doc });
    const ctx = { db, auth: { getUserIdentity: vi.fn() } };

    await (handler as any).handler(ctx, {
      documentId: "doc-stale-storm" as any,
      chunkText: "Stale generation 1 retry text.",
      contentHash: "hash-stale-storm",
      baseChunkKey: "key-stale-storm",
      ragId: "rag-stale-storm-old", // a pre-existing entry this call does not own
      ingestionGeneration: 1, // STALE - document is already at generation 2
    });

    expect(db.insert).not.toHaveBeenCalled();
    expect(db.patch).not.toHaveBeenCalled();
    expect(ragModule.rag.deleteAsync).not.toHaveBeenCalled();
  });

  it("patches in place (not insert) when the same position has a DIFFERENT contentHash, and retires the superseded cross-generation vector", async () => {
    const doc = makeDoc({
      _id: "doc-edit",
      chunkCount: 1,
      chunksEmbedded: 0,
      ingestionGeneration: 2,
    });
    const existing = makeChunk({
      _id: "chunk-edit-id",
      documentId: "doc-edit",
      chunkKey: "key-edit",
      contentHash: "hash-old",
      ingestionGeneration: 1,
      ragId: "rag-old",
    });
    const db = createMockDb({ crawledChunks: existing, documents: doc });
    const ctx = { db, auth: { getUserIdentity: vi.fn() } };

    await (handler as any).handler(ctx, {
      documentId: "doc-edit" as any,
      chunkText: "Edited text.",
      contentHash: "hash-new",
      baseChunkKey: "key-edit",
      ragId: "rag-new",
      ingestionGeneration: 2,
    });

    expect(db.insert).not.toHaveBeenCalled();
    expect(db.patch).toHaveBeenCalledWith(
      "chunk-edit-id",
      expect.objectContaining({
        contentHash: "hash-new",
        ragId: "rag-new",
        ingestionGeneration: 2,
      }),
    );
    expect(db.get("chunk-edit-id" as any)).toEqual(expect.objectContaining({ ragId: "rag-new" }));
    // The OLD generation's RAG entry (rag-old) is now orphaned by this patch
    // - a different generation never shares a ragVersionKey, so nothing else
    // (in particular, not onRagEntryComplete's replacedEntry cleanup, which
    // only ever sees SAME-generation replacements) will ever clean it up.
    // Retiring it here is the fix for the leak the generation-scoped-key
    // design would otherwise introduce for this exact, common case: a
    // re-crawl where a chunk's content genuinely changed.
    expect(ragModule.rag.deleteAsync).toHaveBeenCalledWith(ctx, { entryId: "rag-old" });
  });

  it("adopts a baseChunkKey match written under a DIFFERENT (older) generation into the current one, repoints ragId, and retires the old vector", async () => {
    const doc = makeDoc({
      _id: "doc-adopt",
      chunkCount: 1,
      chunksEmbedded: 0,
      ingestionGeneration: 2,
    });
    const existing = makeChunk({
      _id: "chunk-adopt-id",
      documentId: "doc-adopt",
      chunkKey: "key-adopt",
      contentHash: "hash-same",
      ingestionGeneration: 1,
      ragId: "rag-adopt-old",
    });
    const db = createMockDb({ crawledChunks: existing, documents: doc });
    const ctx = { db, auth: { getUserIdentity: vi.fn() } };

    await (handler as any).handler(ctx, {
      documentId: "doc-adopt" as any,
      chunkText: "Same value, re-derived this round.",
      contentHash: "hash-same",
      baseChunkKey: "key-adopt",
      ragId: "rag-adopt-new",
      ingestionGeneration: 2,
    });

    // The row is repointed at the NEW generation's own entry (this
    // deliberately diverges from the pre-remediation behavior, which kept
    // the OLD ragId unchanged and discarded the new attempt's vector - safe
    // only because same-key replace made the old entry's cleanup automatic.
    // Generation-scoped keys remove that automatic path, so this function
    // must now do the repoint AND the cleanup explicitly)...
    expect(db.patch).toHaveBeenCalledWith(
      "chunk-adopt-id",
      expect.objectContaining({ ingestionGeneration: 2, ragId: "rag-adopt-new" }),
    );
    // ...and the OLD generation's now-superseded entry is explicitly retired.
    expect(ragModule.rag.deleteAsync).toHaveBeenCalledWith(ctx, { entryId: "rag-adopt-old" });
    // ...AND progress is credited (chunkCount=1 → indexed), otherwise this
    // position would never contribute to the current round's completion.
    expect(db.patch).toHaveBeenCalledWith(
      "doc-adopt",
      expect.objectContaining({ status: "indexed" }),
    );
  });

  it("uses the shared EMBEDDING_MODEL_ID constant, not a re-hardcoded string", async () => {
    const doc = makeDoc({ _id: "doc-model", chunkCount: 1, ingestionGeneration: 1 });
    const db = createMockDb({ crawledChunks: null, documents: doc });
    const ctx = { db, auth: { getUserIdentity: vi.fn() } };

    await (handler as any).handler(ctx, {
      documentId: "doc-model" as any,
      chunkText: "Model check.",
      contentHash: "hash-model",
      baseChunkKey: "key-model",
      ragId: "rag-model",
      ingestionGeneration: 1,
    });

    const { EMBEDDING_MODEL_ID } = await import("../../../convex/crawl/chunkKey");
    expect(db.insert).toHaveBeenCalledWith(
      "crawledChunks",
      expect.objectContaining({
        embeddingModel: EMBEDDING_MODEL_ID,
      }),
    );
  });

  it("Part 6: does not transition to indexed if the counter reaches chunkCount but the real row count disagrees", async () => {
    // A sibling chunk's row is missing from crawledChunks (e.g. still in
    // flight) even though chunksEmbedded is about to reach chunkCount=2 -
    // the completion contract must not trust the counter alone.
    const doc = makeDoc({
      _id: "doc-desync",
      chunkCount: 2,
      chunksEmbedded: 1,
      ingestionGeneration: 1,
    });
    const db = createMockDb({ crawledChunks: null, documents: doc });
    const ctx = { db, auth: { getUserIdentity: vi.fn() } };

    await (handler as any).handler(ctx, {
      documentId: "doc-desync" as any,
      chunkText: "Second of two chunks.",
      contentHash: "hash-second",
      baseChunkKey: "key-second",
      ragId: "rag-second",
      ingestionGeneration: 1,
    });

    // chunksEmbedded reaches 2 (== chunkCount)...
    const patchCall = (db.patch as any).mock.calls.find((c: any[]) => c[0] === "doc-desync");
    expect(patchCall[1].chunksEmbedded).toBe(2);
    // ...but the actual crawledChunks row count is only 1 (this insert;
    // the doc-desync test never pre-seeded a first row), so status must
    // NOT be forced to "indexed" on this mismatched evidence.
    expect(patchCall[1].status).toBeUndefined();
  });
});

describe("onRagEntryComplete", () => {
  // The new canonical commit boundary (stale rag.add race remediation).
  // Registered as rag.add()'s onComplete - see the extensive design comment
  // on the export in crawl/mutations.ts. Exercises the handler directly
  // against OnCompleteArgs' real shape ({namespace, entry, replacedEntry,
  // error}), not the old flat saveEmbedding args.
  let handler: any;
  let ragModule: any;

  function makeEntry(overrides: any = {}) {
    return {
      entryId: "entry-default",
      key: "ragversion-default",
      status: "ready",
      importance: 1,
      filterValues: [],
      contentHash: "content-hash-default",
      metadata: {
        documentId: "doc-default",
        baseChunkKey: "basekey-default",
        ingestionGeneration: 1,
      },
      ...overrides,
    };
  }

  beforeEach(async () => {
    ragModule = await import("../../../convex/rag/instance");
    (ragModule.rag.deleteAsync as any).mockReset();
    const mod = await import("../../../convex/crawl/mutations");
    handler = mod.onRagEntryComplete;
  });

  it("current generation, status ready: cleans up a same-generation replacedEntry and commits crawledChunks from staged text, WITHOUT deleting the shared staged row (a later same-generation chain link may still need it)", async () => {
    const doc = makeDoc({ _id: "doc-default", chunkCount: 1, ingestionGeneration: 1 });
    const staged = { ragVersionKey: "ragversion-default", chunkText: "Staged text." };
    const db = createMockDb({ documents: doc, crawledChunks: null, pendingChunkText: staged });
    const ctx = { db, auth: { getUserIdentity: vi.fn() } };

    await (handler as any).handler(ctx, {
      namespace: { namespaceId: "ns-1" },
      entry: makeEntry({ entryId: "entry-new", contentHash: "hash-1" }),
      replacedEntry: { entryId: "entry-old-same-gen", status: "replaced" },
      error: undefined,
    });

    expect(ragModule.rag.deleteAsync).toHaveBeenCalledWith(ctx, { entryId: "entry-old-same-gen" });
    expect(db.insert).toHaveBeenCalledWith(
      "crawledChunks",
      expect.objectContaining({
        documentId: "doc-default",
        chunkKey: "basekey-default",
        ragId: "entry-new",
        text: "Staged text.",
        ingestionGeneration: 1,
      }),
    );
    // The staged row is deliberately left in place - see the retry-storm
    // comment on this success path in mutations.ts. reconciliation.ts's GC
    // mode sweeps it later instead.
    expect(db.delete).not.toHaveBeenCalled();
  });

  it("stale generation, status ready: does NOT touch crawledChunks/progress/status, deletes only its own entry", async () => {
    const doc = makeDoc({ _id: "doc-stale", chunkCount: 1, chunksEmbedded: 0, ingestionGeneration: 3 });
    const db = createMockDb({ documents: doc, crawledChunks: null, pendingChunkText: null });
    const ctx = { db, auth: { getUserIdentity: vi.fn() } };

    await (handler as any).handler(ctx, {
      namespace: { namespaceId: "ns-1" },
      entry: makeEntry({
        entryId: "entry-stale",
        key: "ragversion-stale",
        metadata: { documentId: "doc-stale", baseChunkKey: "key-stale", ingestionGeneration: 2 },
      }),
      replacedEntry: undefined,
      error: undefined,
    });

    expect(db.insert).not.toHaveBeenCalled();
    expect(db.patch).not.toHaveBeenCalled();
    expect(ragModule.rag.deleteAsync).toHaveBeenCalledWith(ctx, { entryId: "entry-stale" });
  });

  it("status replaced (swept while pending by a concurrent same-generation retry): deletes itself, never touches crawledChunks, regardless of generation", async () => {
    const db = createMockDb({ documents: null, crawledChunks: null, pendingChunkText: null });
    const ctx = { db, auth: { getUserIdentity: vi.fn() } };

    await (handler as any).handler(ctx, {
      namespace: { namespaceId: "ns-1" },
      entry: makeEntry({ entryId: "entry-swept", status: "replaced", replacedAt: Date.now() }),
      replacedEntry: null,
      error: undefined,
    });

    expect(db.insert).not.toHaveBeenCalled();
    expect(db.patch).not.toHaveBeenCalled();
    expect(ragModule.rag.deleteAsync).toHaveBeenCalledWith(ctx, { entryId: "entry-swept" });
  });

  it("error path: deletes the failed entry, never touches crawledChunks", async () => {
    const db = createMockDb({ documents: null, crawledChunks: null, pendingChunkText: null });
    const ctx = { db, auth: { getUserIdentity: vi.fn() } };

    await (handler as any).handler(ctx, {
      namespace: { namespaceId: "ns-1" },
      entry: makeEntry({ entryId: "entry-failed" }),
      replacedEntry: undefined,
      error: "simulated embedding failure",
    });

    expect(db.insert).not.toHaveBeenCalled();
    expect(db.patch).not.toHaveBeenCalled();
    expect(ragModule.rag.deleteAsync).toHaveBeenCalledWith(ctx, { entryId: "entry-failed" });
  });

  it("missing identity metadata: does NOT delete the entry (cannot prove ownership), and does NOT touch the shared staged text either (a concurrent sibling at the same ragVersionKey may still need it)", async () => {
    const staged = { ragVersionKey: "ragversion-no-metadata", chunkText: "orphaned staged text" };
    const db = createMockDb({ documents: null, crawledChunks: null, pendingChunkText: staged });
    const ctx = { db, auth: { getUserIdentity: vi.fn() } };

    await (handler as any).handler(ctx, {
      namespace: { namespaceId: "ns-1" },
      entry: makeEntry({ entryId: "entry-no-metadata", key: "ragversion-no-metadata", metadata: {} }),
      replacedEntry: undefined,
      error: undefined,
    });

    expect(ragModule.rag.deleteAsync).not.toHaveBeenCalled();
    expect(db.insert).not.toHaveBeenCalled();
    expect(db.patch).not.toHaveBeenCalled();
    expect(db.delete).not.toHaveBeenCalled();
  });
});

describe("upsertDocument", () => {
  let handler: any;
  let ragModule: any;

  beforeEach(async () => {
    ragModule = await import("../../../convex/rag/instance");
    ragModule.rag.deleteAsync.mockReset();
    const mod = await import("../../../convex/crawl/mutations");
    handler = mod.upsertDocument;
  });

  const defaultArgs = {
    url: "https://web.uettaxila.edu.pk/page",
    markdown: "# Content\n\nSome markdown content here with enough words to pass quality checks.",
    contentHash: "hash-1",
    crawlSessionId: "session-1",
    title: "Test Page",
    sourceType: "html",
  };

  it("inserts a new document and returns inserted action", async () => {
    const db = createMockDb({ documents: null });
    db.insert.mockReturnValue("doc-inserted-id");
    const ctx = {
      db,
      auth: { getUserIdentity: vi.fn() },
      runMutation: vi.fn(),
      runQuery: vi.fn(),
      runAction: vi.fn(),
    };

    const result = await (handler as any).handler(ctx, defaultArgs);

    expect(result).toEqual({ action: "inserted", documentId: "doc-inserted-id" });
    expect(db.insert).toHaveBeenCalledWith(
      "documents",
      expect.objectContaining({
        url: defaultArgs.url,
        contentHash: "hash-1",
        source: "web.uettaxila.edu.pk",
        status: "pending_embed",
      }),
    );
  });

  it("returns skipped when existing document has same contentHash", async () => {
    const existingDoc = makeDoc({ _id: "doc-skip", contentHash: "hash-1" });
    const db = createMockDb({ documents: existingDoc });
    const ctx = { db, auth: { getUserIdentity: vi.fn() } };

    const result = await (handler as any).handler(ctx, defaultArgs);

    expect(result).toEqual({ action: "skipped", documentId: "doc-skip" });
    expect(db.patch).toHaveBeenCalledWith(
      "doc-skip",
      expect.objectContaining({
        status: "active",
      }),
    );
  });

  it("returns updated when existing document has different contentHash", async () => {
    const existingDoc = makeDoc({ _id: "doc-update", contentHash: "old-hash" });
    const db = createMockDb({ documents: existingDoc, crawledChunks: [] });
    const ctx = {
      db,
      auth: { getUserIdentity: vi.fn() },
      runMutation: vi.fn(),
      runQuery: vi.fn(),
      runAction: vi.fn(),
    };

    const result = await (handler as any).handler(ctx, {
      ...defaultArgs,
      contentHash: "new-hash",
    });

    expect(result).toEqual({ action: "updated", documentId: "doc-update" });
    expect(db.patch).toHaveBeenCalledWith(
      "doc-update",
      expect.objectContaining({
        contentHash: "new-hash",
        status: "pending_embed",
      }),
    );
  });

  it("deletes old chunks and rag vectors on content update", async () => {
    const existingDoc = makeDoc({ _id: "doc-update", contentHash: "old-hash" });
    const oldChunks = [
      makeChunk({
        _id: "old-c1",
        documentId: "doc-update",
        contentHash: "old-c1",
        ragId: "rag-old-1",
      }),
      makeChunk({
        _id: "old-c2",
        documentId: "doc-update",
        contentHash: "old-c2",
        ragId: "rag-old-2",
      }),
    ];
    const db = createMockDb({ documents: existingDoc, crawledChunks: oldChunks });
    const ctx = {
      db,
      auth: { getUserIdentity: vi.fn() },
      runMutation: vi.fn(),
      runQuery: vi.fn(),
      runAction: vi.fn(),
    };

    await (handler as any).handler(ctx, {
      ...defaultArgs,
      contentHash: "new-hash-v2",
    });

    expect(ragModule.rag.deleteAsync).toHaveBeenCalledTimes(2);
    expect(ragModule.rag.deleteAsync).toHaveBeenCalledWith(ctx, { entryId: "rag-old-1" });
    expect(ragModule.rag.deleteAsync).toHaveBeenCalledWith(ctx, { entryId: "rag-old-2" });
    expect(db.delete).toHaveBeenCalledWith("old-c1");
    expect(db.delete).toHaveBeenCalledWith("old-c2");
  });

  it("uses url as title when title is not provided for new documents", async () => {
    const db = createMockDb({ documents: null });
    db.insert.mockReturnValue("doc-no-title");
    const ctx = { db, auth: { getUserIdentity: vi.fn() } };

    await (handler as any).handler(ctx, {
      ...defaultArgs,
      title: undefined,
    });

    expect(db.insert).toHaveBeenCalledWith(
      "documents",
      expect.objectContaining({
        title: defaultArgs.url,
      }),
    );
  });

  it("uses url as title when title is not provided on re-ingest of an existing document", async () => {
    // Regression test: /ingest's own contract makes `title` optional (it is
    // not in parseAndValidateIngestRequest's required-field list), but the
    // update branch used to patch `title: args.title` directly instead of
    // falling back to the url like the insert branch does - patching an
    // explicit `undefined` onto documents.title (a required v.string() field)
    // fails Convex's real schema validation on every title-omitted re-ingest,
    // even with zero concurrency involved.
    const existingDoc = makeDoc({ _id: "doc-update-no-title", contentHash: "old-hash" });
    const db = createMockDb({ documents: existingDoc, crawledChunks: [] });
    const ctx = {
      db,
      auth: { getUserIdentity: vi.fn() },
      runMutation: vi.fn(),
      runQuery: vi.fn(),
      runAction: vi.fn(),
    };

    await (handler as any).handler(ctx, {
      ...defaultArgs,
      contentHash: "new-hash",
      title: undefined,
    });

    expect(db.patch).toHaveBeenCalledWith(
      "doc-update-no-title",
      expect.objectContaining({
        title: defaultArgs.url,
      }),
    );
  });

  it("includes freshnessTier in inserted document", async () => {
    const db = createMockDb({ documents: null });
    db.insert.mockReturnValue("doc-tier");
    const ctx = { db, auth: { getUserIdentity: vi.fn() } };

    await (handler as any).handler(ctx, {
      ...defaultArgs,
      freshnessTier: "high",
    });

    expect(db.insert).toHaveBeenCalledWith(
      "documents",
      expect.objectContaining({
        freshnessTier: "high",
      }),
    );
  });

  it("handles rag.deleteAsync failure gracefully during content update", async () => {
    ragModule.rag.deleteAsync.mockRejectedValue(new Error("Vector delete failed"));
    const existingDoc = makeDoc({ _id: "doc-graceful", contentHash: "old-hash" });
    const oldChunks = [makeChunk({ documentId: "doc-graceful", ragId: "rag-broken" })];
    const db = createMockDb({ documents: existingDoc, crawledChunks: oldChunks });
    const ctx = { db, auth: { getUserIdentity: vi.fn() } };

    const result = await (handler as any).handler(ctx, {
      ...defaultArgs,
      contentHash: "new-hash-graceful",
    });

    // When rag.delete fails, we catch the error and continue - the operation still returns "updated"
    // db.delete is NOT called because it's inside the try block after rag.delete
    expect(result.action).toBe("updated");
    expect(db.delete).not.toHaveBeenCalled();
  });
});

describe("enqueueDocumentChunks", () => {
  let handler: any;
  let embeddingPoolModule: any;

  beforeEach(async () => {
    embeddingPoolModule = await import("../../../convex/crawl/workpools");
    embeddingPoolModule.embeddingPool.enqueueAction.mockReset();
    (embeddingPoolModule.embeddingPool.enqueueActionBatch as any).mockReset();
    const mod = await import("../../../convex/crawl/mutations");
    handler = mod.enqueueDocumentChunks;
  });

  it("enqueues each chunk in the workpool", async () => {
    const db = createMockDb();
    const ctx = {
      db,
      auth: { getUserIdentity: vi.fn() },
      runMutation: vi.fn(),
      runQuery: vi.fn(),
      runAction: vi.fn(),
    };

    const parents = [{ contentHash: "parent-hash-a", text: "Parent A block." }];
    const children = [
      {
        text: "Chunk A",
        contentHash: "hash-a",
        chunkKey: "key-a",
        parentContentHash: "parent-hash-a",
      },
      {
        text: "Chunk B",
        contentHash: "hash-b",
        chunkKey: "key-b",
        parentContentHash: "parent-hash-a",
      },
      {
        text: "Chunk C",
        contentHash: "hash-c",
        chunkKey: "key-c",
        parentContentHash: "parent-hash-a",
      },
    ];

    await (handler as any).handler(ctx, {
      documentId: "doc-enqueue" as any,
      url: "https://web.uettaxila.edu.pk/page",
      parents,
      children,
    });

    // enqueueActionBatch is called once with all chunks as a batch
    expect(embeddingPoolModule.embeddingPool.enqueueActionBatch).toHaveBeenCalledTimes(1);
    const enqueuedArgs = embeddingPoolModule.embeddingPool.enqueueActionBatch.mock.calls[0];
    expect(enqueuedArgs[2]).toHaveLength(3);
    expect(enqueuedArgs[2][0].chunkKey).toBe("key-a");
  });

  // August 2026 incident remediation: every push previously shared one
  // hardcoded literal jobId ("ingest-job"), so DLQ/completion records could
  // never answer "which run created/failed this work."
  it("derives jobId from the document's real crawlSessionId instead of a shared hardcoded literal", async () => {
    const db = createMockDb({
      documents: [{ _id: "doc-session", crawlSessionId: "session-abc-123", ingestionGeneration: 2 }],
    });
    const ctx = { db, auth: { getUserIdentity: vi.fn() }, runMutation: vi.fn(), runQuery: vi.fn(), runAction: vi.fn() };

    await (handler as any).handler(ctx, {
      documentId: "doc-session" as any,
      url: "https://web.uettaxila.edu.pk/page",
      parents: [{ contentHash: "p", text: "Parent." }],
      children: [{ text: "C", contentHash: "h", chunkKey: "k", parentContentHash: "p" }],
    });

    const [, , argsArray, options] = embeddingPoolModule.embeddingPool.enqueueActionBatch.mock.calls[0];
    expect(argsArray[0].jobId).toBe("session-abc-123");
    expect(options.context.jobId).toBe("session-abc-123");
  });

  it("falls back to a labeled placeholder jobId when the document has no crawlSessionId, rather than reusing an ambiguous shared literal silently", async () => {
    const db = createMockDb({
      documents: [{ _id: "doc-no-session", ingestionGeneration: 1 }],
    });
    const ctx = { db, auth: { getUserIdentity: vi.fn() }, runMutation: vi.fn(), runQuery: vi.fn(), runAction: vi.fn() };

    await (handler as any).handler(ctx, {
      documentId: "doc-no-session" as any,
      url: "https://web.uettaxila.edu.pk/page",
      parents: [{ contentHash: "p", text: "Parent." }],
      children: [{ text: "C", contentHash: "h", chunkKey: "k", parentContentHash: "p" }],
    });

    const [, , argsArray] = embeddingPoolModule.embeddingPool.enqueueActionBatch.mock.calls[0];
    expect(argsArray[0].jobId).toBe("ingest-job-unknown-session");
  });

  it("sets chunkCount on the document", async () => {
    const db = createMockDb();
    const ctx = {
      db,
      auth: { getUserIdentity: vi.fn() },
      runMutation: vi.fn(),
      runQuery: vi.fn(),
      runAction: vi.fn(),
    };

    await (handler as any).handler(ctx, {
      documentId: "doc-count" as any,
      url: "https://web.uettaxila.edu.pk/page",
      parents: [{ contentHash: "parent-single", text: "Parent block." }],
      children: [
        {
          text: "Single chunk",
          contentHash: "hash-single",
          chunkKey: "key-single",
          parentContentHash: "parent-single",
        },
      ],
    });

    expect(db.patch).toHaveBeenCalledWith(
      "doc-count",
      expect.objectContaining({
        chunkCount: 1,
      }),
    );
  });

  it("sets status to indexed when chunks array is empty", async () => {
    const db = createMockDb();
    const ctx = {
      db,
      auth: { getUserIdentity: vi.fn() },
      runMutation: vi.fn(),
      runQuery: vi.fn(),
      runAction: vi.fn(),
    };

    await (handler as any).handler(ctx, {
      documentId: "doc-empty" as any,
      url: "https://web.uettaxila.edu.pk/page",
      parents: [],
      children: [],
    });

    expect(db.patch).toHaveBeenCalledWith(
      "doc-empty",
      expect.objectContaining({
        status: "indexed",
        chunkCount: 0,
      }),
    );
    expect(embeddingPoolModule.embeddingPool.enqueueActionBatch).not.toHaveBeenCalled();
  });

  // August 2026 incident remediation: the producer must not outrun
  // embeddingPool's throttled consumer. PENDING_EMBEDDING_BACKLOG_CEILING is
  // enforced via a bounded .take(ceiling+1) check, not a full-table scan.
  describe("embedding backlog backpressure", () => {
    function pendingChunkTextRows(count: number) {
      return Array.from({ length: count }, (_, i) => ({
        _id: `pending-${i}`,
        _creationTime: Date.now(),
        ragVersionKey: `key-${i}`,
        chunkText: "staged text",
        updatedAt: Date.now(),
      }));
    }

    it("enqueues normally when the backlog is well below the ceiling", async () => {
      const db = createMockDb({ pendingChunkText: pendingChunkTextRows(5) });
      const ctx = { db, auth: { getUserIdentity: vi.fn() }, runMutation: vi.fn(), runQuery: vi.fn(), runAction: vi.fn() };

      await (handler as any).handler(ctx, {
        documentId: "doc-below" as any,
        url: "https://web.uettaxila.edu.pk/page",
        parents: [{ contentHash: "p", text: "Parent." }],
        children: [{ text: "C", contentHash: "h", chunkKey: "k", parentContentHash: "p" }],
      });

      expect(embeddingPoolModule.embeddingPool.enqueueActionBatch).toHaveBeenCalledTimes(1);
    });

    it("blocks enqueueing (controlled failure, not a silent drop) once the backlog is AT the ceiling", async () => {
      const db = createMockDb({
        pendingChunkText: pendingChunkTextRows(PENDING_EMBEDDING_BACKLOG_CEILING),
      });
      const ctx = { db, auth: { getUserIdentity: vi.fn() }, runMutation: vi.fn(), runQuery: vi.fn(), runAction: vi.fn() };

      await expect(
        (handler as any).handler(ctx, {
          documentId: "doc-at-ceiling" as any,
          url: "https://web.uettaxila.edu.pk/page",
          parents: [{ contentHash: "p", text: "Parent." }],
          children: [{ text: "C", contentHash: "h", chunkKey: "k", parentContentHash: "p" }],
        }),
      ).rejects.toThrow(/backlog/i);
      expect(embeddingPoolModule.embeddingPool.enqueueActionBatch).not.toHaveBeenCalled();
    });

    it("blocks enqueueing when the backlog is ABOVE the ceiling", async () => {
      const db = createMockDb({
        pendingChunkText: pendingChunkTextRows(PENDING_EMBEDDING_BACKLOG_CEILING + 50),
      });
      const ctx = { db, auth: { getUserIdentity: vi.fn() }, runMutation: vi.fn(), runQuery: vi.fn(), runAction: vi.fn() };

      await expect(
        (handler as any).handler(ctx, {
          documentId: "doc-above" as any,
          url: "https://web.uettaxila.edu.pk/page",
          parents: [{ contentHash: "p", text: "Parent." }],
          children: [{ text: "C", contentHash: "h", chunkKey: "k", parentContentHash: "p" }],
        }),
      ).rejects.toThrow(/backlog/i);
      expect(embeddingPoolModule.embeddingPool.enqueueActionBatch).not.toHaveBeenCalled();
    });

    it("checks the backlog with a bounded take(), not an unbounded collect() (cost independent of table size)", async () => {
      // A huge table would make a real .collect()/count expensive; the take()
      // call must only ever request ceiling+1 rows regardless of how large
      // the underlying table actually is.
      const db = createMockDb({
        pendingChunkText: pendingChunkTextRows(PENDING_EMBEDDING_BACKLOG_CEILING + 5000),
      });
      const ctx = { db, auth: { getUserIdentity: vi.fn() }, runMutation: vi.fn(), runQuery: vi.fn(), runAction: vi.fn() };

      await expect(
        (handler as any).handler(ctx, {
          documentId: "doc-huge" as any,
          url: "https://web.uettaxila.edu.pk/page",
          parents: [{ contentHash: "p", text: "Parent." }],
          children: [{ text: "C", contentHash: "h", chunkKey: "k", parentContentHash: "p" }],
        }),
      ).rejects.toThrow();

      const pendingChunkTextCallIndex = db.query.mock.calls.findIndex(
        (call: any[]) => call[0] === "pendingChunkText",
      );
      expect(pendingChunkTextCallIndex).toBeGreaterThanOrEqual(0);
      const chain = db.query.mock.results[pendingChunkTextCallIndex].value;
      expect(chain.take).toHaveBeenCalledWith(PENDING_EMBEDDING_BACKLOG_CEILING + 1);
      expect(chain.collect).not.toHaveBeenCalled();
    });

    it("does not check the backlog (or block) when there are no children to embed", async () => {
      const db = createMockDb({
        pendingChunkText: pendingChunkTextRows(PENDING_EMBEDDING_BACKLOG_CEILING + 50),
      });
      const ctx = { db, auth: { getUserIdentity: vi.fn() }, runMutation: vi.fn(), runQuery: vi.fn(), runAction: vi.fn() };

      // Must not throw - an empty children array never touches embeddingPool.
      await (handler as any).handler(ctx, {
        documentId: "doc-no-children" as any,
        url: "https://web.uettaxila.edu.pk/page",
        parents: [],
        children: [],
      });
      expect(embeddingPoolModule.embeddingPool.enqueueActionBatch).not.toHaveBeenCalled();
    });
  });
});

describe("markStaleDocuments", () => {
  let handler: any;

  beforeEach(async () => {
    const mod = await import("../../../convex/crawl/staleness");
    handler = mod.markStaleDocuments;
  });

  it("marks documents with different session as stale", async () => {
    const docs = [
      makeDoc({ _id: "doc-stale-1", crawlSessionId: "session-old" }),
      makeDoc({ _id: "doc-stale-2", crawlSessionId: "session-old" }),
    ];
    const db = createMockDb({ documents: docs });
    const ctx = { db, auth: { getUserIdentity: vi.fn() } };

    const result = await (handler as any).handler(ctx, {
      crawlSessionId: "session-new",
      limit: 500,
    });

    expect(result.marked).toBe(2);
    expect(result.remaining).toBe("done");
    expect(db.patch).toHaveBeenCalledWith("doc-stale-1", { status: "stale" });
    expect(db.patch).toHaveBeenCalledWith("doc-stale-2", { status: "stale" });
  });

  it("does not mark documents with matching session", async () => {
    const docs = [makeDoc({ _id: "doc-fresh", crawlSessionId: "session-current" })];
    const db = createMockDb({ documents: docs });
    const ctx = { db, auth: { getUserIdentity: vi.fn() } };

    const result = await (handler as any).handler(ctx, {
      crawlSessionId: "session-current",
    });

    expect(result.marked).toBe(0);
    expect(db.patch).not.toHaveBeenCalled();
  });

  it("returns remaining=more when batch is full", async () => {
    // The mutation queries docs with status=active; makeDoc defaults status to 'active'
    const docs = Array.from({ length: 500 }, (_, i) =>
      makeDoc({ _id: `doc-${i}`, crawlSessionId: "session-old", status: "active" }),
    );
    const db = createMockDb({ documents: docs });
    const ctx = { db, auth: { getUserIdentity: vi.fn() } };

    const result = await (handler as any).handler(ctx, {
      crawlSessionId: "session-new",
      limit: 500,
    });

    expect(result.remaining).toBe("more");
  });

  it("handles empty results", async () => {
    const db = createMockDb();
    const ctx = { db, auth: { getUserIdentity: vi.fn() } };

    const result = await (handler as any).handler(ctx, {
      crawlSessionId: "session-any",
    });

    expect(result.marked).toBe(0);
    expect(result.remaining).toBe("done");
  });
});

describe("purgeStaleDocuments", () => {
  let handler: any;
  let ragModule: any;

  beforeEach(async () => {
    ragModule = await import("../../../convex/rag/instance");
    ragModule.rag.delete.mockReset();
    const mod = await import("../../../convex/crawl/staleness");
    handler = mod.purgeStaleDocuments;
  });

  it("deletes stale documents and their chunks", async () => {
    const staleDocs = [makeDoc({ _id: "doc-purge-1", status: "stale" })];
    const chunks = [
      makeChunk({ _id: "chunk-purge-1", documentId: "doc-purge-1", ragId: "rag-purge-1" }),
      makeChunk({ _id: "chunk-purge-2", documentId: "doc-purge-1", ragId: "rag-purge-2" }),
    ];
    const db = createMockDb({ documents: staleDocs, crawledChunks: chunks });
    const ctx = { db, auth: { getUserIdentity: vi.fn() } };

    const result = await (handler as any).handler(ctx, { limit: 100 });

    expect(result.purged).toBe(1);
    expect(ragModule.rag.delete).toHaveBeenCalledTimes(2);
    expect(db.delete).toHaveBeenCalledWith("doc-purge-1");
    expect(db.delete).toHaveBeenCalledWith("chunk-purge-1");
    expect(db.delete).toHaveBeenCalledWith("chunk-purge-2");
  });

  it("handles rag.delete failure gracefully during purge", async () => {
    ragModule.rag.delete.mockRejectedValue(new Error("Vector delete error"));
    const staleDoc = makeDoc({ _id: "doc-fail-purge", status: "stale" });
    const chunk = makeChunk({ documentId: "doc-fail-purge", ragId: "rag-fail" });
    const db = createMockDb({ documents: [staleDoc], crawledChunks: [chunk] });
    const ctx = { db, auth: { getUserIdentity: vi.fn() } };

    const result = await (handler as any).handler(ctx, {});

    expect(result.purged).toBe(1);
    expect(db.delete).toHaveBeenCalledWith("doc-fail-purge");
  });

  it("returns remaining=more when batch is full", async () => {
    const docs = Array.from({ length: 100 }, (_, i) =>
      makeDoc({ _id: `doc-stale-${i}`, status: "stale" }),
    );
    const db = createMockDb({ documents: docs, crawledChunks: [] });
    const ctx = { db, auth: { getUserIdentity: vi.fn() } };

    const result = await (handler as any).handler(ctx, { limit: 100 });

    expect(result.remaining).toBe("more");
  });

  it("handles empty results", async () => {
    const db = createMockDb();
    const ctx = { db, auth: { getUserIdentity: vi.fn() } };

    const result = await (handler as any).handler(ctx, {});

    expect(result.purged).toBe(0);
  });
});

describe("flagExpiredDocuments", () => {
  let handler: any;

  beforeEach(async () => {
    const mod = await import("../../../convex/crawl/staleness");
    handler = mod.flagExpiredDocuments;
  });

  it("flags expired high-tier documents (30 day TTL)", async () => {
    const oldDoc = makeDoc({
      _id: "doc-high",
      status: "indexed",
      freshnessTier: "high",
      crawledAt: Date.now() - 31 * 24 * 60 * 60 * 1000,
    });
    const db = createMockDb({ documents: [oldDoc] });
    const ctx = { db, auth: { getUserIdentity: vi.fn() } };

    const result = await (handler as any).handler(ctx, { limit: 200 });

    expect(result.flagged).toBe(1);
    expect(db.patch).toHaveBeenCalledWith("doc-high", { isStale: true });
  });

  it("does not flag non-expired high-tier documents", async () => {
    const freshDoc = makeDoc({
      _id: "doc-fresh",
      status: "indexed",
      freshnessTier: "high",
      crawledAt: Date.now() - 13 * 24 * 60 * 60 * 1000, // 13 days old < 14d TTL
    });
    const db = createMockDb({ documents: [freshDoc] });
    const ctx = { db, auth: { getUserIdentity: vi.fn() }, scheduler: { runAfter: vi.fn() } };

    const result = await (handler as any).handler(ctx, {});

    expect(result.flagged).toBe(0);
    expect(db.patch).not.toHaveBeenCalled();
  });

  it("flags expired medium-tier documents (60 day TTL)", async () => {
    const oldDoc = makeDoc({
      _id: "doc-med",
      status: "indexed",
      freshnessTier: "medium",
      crawledAt: Date.now() - 61 * 24 * 60 * 60 * 1000,
    });
    const db = createMockDb({ documents: [oldDoc] });
    const ctx = { db, auth: { getUserIdentity: vi.fn() }, scheduler: { runAfter: vi.fn() } };

    const result = await (handler as any).handler(ctx, {});

    expect(result.flagged).toBe(1);
  });

  it("flags expired low-tier documents (180 day TTL)", async () => {
    const oldDoc = makeDoc({
      _id: "doc-low",
      status: "indexed",
      freshnessTier: "low",
      crawledAt: Date.now() - 181 * 24 * 60 * 60 * 1000,
    });
    const db = createMockDb({ documents: [oldDoc] });
    const ctx = { db, auth: { getUserIdentity: vi.fn() }, scheduler: { runAfter: vi.fn() } };

    const result = await (handler as any).handler(ctx, {});

    expect(result.flagged).toBe(1);
  });

  it("uses low tier as default when freshnessTier is not set", async () => {
    const oldDoc = makeDoc({
      _id: "doc-default",
      status: "indexed",
      freshnessTier: undefined,
      crawledAt: Date.now() - 181 * 24 * 60 * 60 * 1000,
    });
    const db = createMockDb({ documents: [oldDoc] });
    const ctx = { db, auth: { getUserIdentity: vi.fn() }, scheduler: { runAfter: vi.fn() } };

    const result = await (handler as any).handler(ctx, {});

    expect(result.flagged).toBe(1);
  });

  it("does not flag already stale documents", async () => {
    const staleDoc = makeDoc({
      _id: "doc-already-stale",
      status: "indexed",
      isStale: true,
      crawledAt: Date.now() - 365 * 24 * 60 * 60 * 1000,
    });
    const db = createMockDb({ documents: [staleDoc] });
    const ctx = { db, auth: { getUserIdentity: vi.fn() }, scheduler: { runAfter: vi.fn() } };

    const result = await (handler as any).handler(ctx, {});

    expect(result.flagged).toBe(0);
  });

  it("returns complete status and examined count on sweep", async () => {
    const docs = Array.from({ length: 150 }, (_, i) =>
      makeDoc({
        _id: `doc-exp-${i}`,
        status: "indexed",
        crawledAt: Date.now() - 365 * 24 * 60 * 60 * 1000,
      }),
    );
    const db = createMockDb({ documents: docs });
    const ctx = { db, auth: { getUserIdentity: vi.fn() }, scheduler: { runAfter: vi.fn() } };

    const result = await (handler as any).handler(ctx, { limit: 100 });

    expect(result.complete).toBeDefined();
    expect(result.examined).toBeGreaterThan(0);
  });
});

describe("DLQ operations", () => {
  describe("retryDeadLetterQueue", () => {
    let handler: any;
    let embeddingPoolModule: any;

    beforeEach(async () => {
      embeddingPoolModule = await import("../../../convex/crawl/workpools");
      (embeddingPoolModule.embeddingPool.enqueueActionBatch as any).mockReset().mockResolvedValue(undefined);
      const mod = await import("../../../convex/crawl/mutations");
      handler = mod.retryDeadLetterQueue;
    });

    it("re-enqueues a valid pending_retry entry with its chunkKey and ingestionGeneration carried through", async () => {
      const entry = makeDLQ({
        _id: "dlq-valid",
        payload: {
          documentId: "doc-1",
          url: "https://web.uettaxila.edu.pk/page",
          contentHash: "hash-1",
          jobId: "job-1",
          chunkText: "Some chunk text with enough words for testing.",
          chunkKey: "chunk-key-1",
          ingestionGeneration: 3,
        },
      });
      const db = createMockDb({ crawlDeadLetter: [entry] });
      const ctx = { db, auth: { getUserIdentity: vi.fn() } };

      const result = await (handler as any).handler(ctx, {});

      expect(result).toEqual({ reprocessed: 1, abandoned: 0, remaining: "done" });
      expect(db.patch).toHaveBeenCalledWith(
        "dlq-valid",
        expect.objectContaining({ status: "processing" }),
      );
      expect(embeddingPoolModule.embeddingPool.enqueueActionBatch).toHaveBeenCalledTimes(1);
      const argsArray = embeddingPoolModule.embeddingPool.enqueueActionBatch.mock.calls[0][2];
      expect(argsArray).toEqual([
        expect.objectContaining({
          documentId: "doc-1",
          chunkKey: "chunk-key-1",
          ingestionGeneration: 3,
        }),
      ]);
    });

    it("abandons a legacy entry missing chunkKey instead of retrying it under an undefined identity", async () => {
      // makeDLQ's default payload has no chunkKey - the pre-Phase-6.21A legacy shape.
      const entry = makeDLQ({ _id: "dlq-legacy" });
      const db = createMockDb({ crawlDeadLetter: [entry] });
      const ctx = { db, auth: { getUserIdentity: vi.fn() } };

      const result = await (handler as any).handler(ctx, {});

      expect(result).toEqual({ reprocessed: 0, abandoned: 1, remaining: "done" });
      expect(db.patch).toHaveBeenCalledWith(
        "dlq-legacy",
        expect.objectContaining({ status: "abandoned" }),
      );
      expect(embeddingPoolModule.embeddingPool.enqueueActionBatch).not.toHaveBeenCalled();
    });

    it("abandons an entry with no chunkText payload", async () => {
      const entry = makeDLQ({
        _id: "dlq-no-text",
        payload: {
          documentId: "doc-1",
          url: "https://web.uettaxila.edu.pk/page",
          jobId: "job-1",
          chunkKey: "chunk-key-1",
          ingestionGeneration: 2,
          // chunkText intentionally omitted
        },
      });
      const db = createMockDb({ crawlDeadLetter: [entry] });
      const ctx = { db, auth: { getUserIdentity: vi.fn() } };

      const result = await (handler as any).handler(ctx, {});

      expect(result).toEqual({ reprocessed: 0, abandoned: 1, remaining: "done" });
      expect(embeddingPoolModule.embeddingPool.enqueueActionBatch).not.toHaveBeenCalled();
    });

    it("processes a mixed batch: valid entries retried, invalid ones abandoned, independently", async () => {
      const valid = makeDLQ({
        _id: "dlq-valid",
        payload: {
          documentId: "doc-1",
          url: "https://web.uettaxila.edu.pk/a",
          jobId: "job-1",
          chunkText: "Valid chunk text with enough words here.",
          chunkKey: "key-a",
          ingestionGeneration: 1,
        },
      });
      const legacy = makeDLQ({ _id: "dlq-legacy" });
      const db = createMockDb({ crawlDeadLetter: [valid, legacy] });
      const ctx = { db, auth: { getUserIdentity: vi.fn() } };

      const result = await (handler as any).handler(ctx, {});

      expect(result).toEqual({ reprocessed: 1, abandoned: 1, remaining: "done" });
      expect(db.patch).toHaveBeenCalledWith("dlq-valid", expect.objectContaining({ status: "processing" }));
      expect(db.patch).toHaveBeenCalledWith("dlq-legacy", expect.objectContaining({ status: "abandoned" }));
    });
  });

  describe("resetAbandonedDLQ", () => {
    let handler: any;

    beforeEach(async () => {
      const mod = await import("../../../convex/crawl/reset_ops");
      handler = mod.resetAbandonedDLQ;
    });

    it("resets abandoned DLQ entries to pending_retry", async () => {
      const abandoned = [
        makeDLQ({ _id: "dlq-1", status: "abandoned" }),
        makeDLQ({ _id: "dlq-2", status: "abandoned" }),
      ];
      const db = createMockDb({ crawlDeadLetter: abandoned });
      const ctx = { db, auth: { getUserIdentity: vi.fn() } };

      const result = await (handler as any).handler(ctx, { limit: 200 });

      expect(result.resetCount).toBe(2);
      expect(db.patch).toHaveBeenCalledWith("dlq-1", { status: "pending_retry" });
      expect(db.patch).toHaveBeenCalledWith("dlq-2", { status: "pending_retry" });
    });

    it("handles empty DLQ", async () => {
      const db = createMockDb();
      const ctx = { db, auth: { getUserIdentity: vi.fn() } };

      const result = await (handler as any).handler(ctx, {});

      expect(result.resetCount).toBe(0);
    });
  });
});

describe("stagePendingChunkText", () => {
  // August 2026 incident regression suite: stagePendingChunkText used to
  // unconditionally insert a new row on every call, so every Workpool retry
  // and DLQ re-enqueue of the same chunk appended a duplicate. It must now
  // upsert by ragVersionKey - at most one row per (chunk, generation), no
  // matter how many times it is retried - while still creating genuinely
  // separate rows for a different chunk/document/generation.
  let handler: any;

  beforeEach(async () => {
    const mod = await import("../../../convex/crawl/mutations");
    handler = mod.stagePendingChunkText;
  });

  it("inserts a single row on first staging", async () => {
    const db = createMockDb({ pendingChunkText: null });
    const ctx = { db, auth: { getUserIdentity: vi.fn() } };

    await (handler as any).handler(ctx, { ragVersionKey: "key-a", chunkText: "text v1" });

    expect(db.insert).toHaveBeenCalledTimes(1);
    expect(db.insert).toHaveBeenCalledWith(
      "pendingChunkText",
      expect.objectContaining({ ragVersionKey: "key-a", chunkText: "text v1" }),
    );
  });

  it("BEFORE this fix would insert N rows for N retries of the same chunk; AFTER, exactly one row remains", async () => {
    const db = createMockDb({ pendingChunkText: null });
    const ctx = { db, auth: { getUserIdentity: vi.fn() } };

    // Simulate 5 retry attempts of the identical logical chunk (same
    // ragVersionKey - stable across Workpool retries and DLQ re-enqueues).
    for (let attempt = 0; attempt < 5; attempt++) {
      await (handler as any).handler(ctx, {
        ragVersionKey: "key-retried",
        chunkText: `text attempt ${attempt}`,
      });
    }

    const rows = await db
      .query("pendingChunkText")
      .withIndex("by_ragVersionKey", (q: any) => q.eq("ragVersionKey", "key-retried"))
      .collect();
    expect(rows).toHaveLength(1);
    expect(rows[0].chunkText).toBe("text attempt 4"); // reflects the latest attempt
    expect(db.insert).toHaveBeenCalledTimes(1); // only the FIRST attempt inserted
    expect(db.patch).toHaveBeenCalledTimes(4); // every subsequent attempt patched
  });

  it("refreshes updatedAt on every retry so GC can distinguish active retries from idle rows", async () => {
    const db = createMockDb({ pendingChunkText: null });
    const ctx = { db, auth: { getUserIdentity: vi.fn() } };

    await (handler as any).handler(ctx, { ragVersionKey: "key-a", chunkText: "v1" });
    const firstUpdatedAt = (
      await db.query("pendingChunkText").withIndex("by_ragVersionKey", (q: any) => q.eq("ragVersionKey", "key-a")).first()
    ).updatedAt;

    await new Promise((resolve) => setTimeout(resolve, 5));
    await (handler as any).handler(ctx, { ragVersionKey: "key-a", chunkText: "v2" });
    const secondUpdatedAt = (
      await db.query("pendingChunkText").withIndex("by_ragVersionKey", (q: any) => q.eq("ragVersionKey", "key-a")).first()
    ).updatedAt;

    expect(secondUpdatedAt).toBeGreaterThan(firstUpdatedAt);
  });

  it("does not merge a different chunk/document/generation's staged text into an unrelated row", async () => {
    const db = createMockDb({ pendingChunkText: null });
    const ctx = { db, auth: { getUserIdentity: vi.fn() } };

    // Different ragVersionKey values simulate a different baseChunkKey,
    // documentId, or ingestionGeneration (computeRagVersionKey hashes all
    // three together in chunkKey.ts), each of which must stay isolated.
    await (handler as any).handler(ctx, { ragVersionKey: "doc-1-chunk-1-gen-1", chunkText: "A" });
    await (handler as any).handler(ctx, { ragVersionKey: "doc-1-chunk-2-gen-1", chunkText: "B" }); // different chunk
    await (handler as any).handler(ctx, { ragVersionKey: "doc-2-chunk-1-gen-1", chunkText: "C" }); // different document
    await (handler as any).handler(ctx, { ragVersionKey: "doc-1-chunk-1-gen-2", chunkText: "D" }); // different generation

    const all = await db.query("pendingChunkText").collect();
    expect(all).toHaveLength(4);
    expect(db.insert).toHaveBeenCalledTimes(4);
    expect(db.patch).not.toHaveBeenCalled();
  });
});

describe("edge cases", () => {
  it("upsertDocument rejects URLs with invalid hostnames gracefully", async () => {
    const mod = await import("../../../convex/crawl/mutations");
    const handler = mod.upsertDocument;

    const db = createMockDb({ documents: null });
    const ctx = { db, auth: { getUserIdentity: vi.fn() } };

    await expect(
      (handler as any).handler(ctx, {
        url: "not-a-url",
        markdown: "some content",
        contentHash: "hash",
        crawlSessionId: "s1",
        sourceType: "html",
      }),
    ).rejects.toThrow();
  });

  it("queueChunksForEmbedding handles missing existing document gracefully", async () => {
    const mod = await import("../../../convex/crawl/mutations");
    const handler = mod.queueChunksForEmbedding;
    const embeddingPoolModule = await import("../../../convex/crawl/workpools");
    (embeddingPoolModule.embeddingPool.enqueueAction as any).mockReset();

    const db = createMockDb({ documents: null, crawledChunks: [] });
    db.insert.mockReturnValue("doc-brand-new");
    const ctx = {
      db,
      auth: { getUserIdentity: vi.fn() },
      runMutation: vi.fn(),
      runQuery: vi.fn(),
      runAction: vi.fn(),
    };

    const result = await (handler as any).handler(ctx, {
      url: "https://web.uettaxila.edu.pk/brand-new",
      title: "Brand New",
      contentHash: "brand-new-hash",
      jobId: "job-new",
      parents: [
        { contentHash: "parent-hash-1", text: "Parent block of content for the new page." },
      ],
      children: [
        {
          text: "Brand new chunk content here with enough meaningful words.",
          contentHash: "brand-c1",
          parentContentHash: "parent-hash-1",
        },
      ],
    });

    expect(result.status).toBe("updated");
    expect(db.insert).toHaveBeenCalled();
  });

  it("markStaleDocuments handles missing status index gracefully", async () => {
    const mod = await import("../../../convex/crawl/staleness");
    const handler = mod.markStaleDocuments;

    const db = createMockDb();
    const ctx = { db, auth: { getUserIdentity: vi.fn() } };

    const result = await (handler as any).handler(ctx, {
      crawlSessionId: "session-1",
    });

    expect(result.marked).toBe(0);
    expect(result.remaining).toBe("done");
  });

  it("purgeStaleDocuments handles empty stale list gracefully", async () => {
    const mod = await import("../../../convex/crawl/staleness");
    const handler = mod.purgeStaleDocuments;

    const db = createMockDb();
    const ctx = { db, auth: { getUserIdentity: vi.fn() } };

    const result = await (handler as any).handler(ctx, {});

    expect(result.purged).toBe(0);
  });
});
