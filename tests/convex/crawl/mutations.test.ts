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
    getOrCreateNamespace: vi.fn().mockResolvedValue({ namespaceId: "mock-ns-id" }),
  },
}));

vi.mock("../../../convex/crawl/workpools", () => ({
  embeddingPool: {
    enqueueAction: vi.fn(),
    enqueueActionBatch: vi.fn().mockResolvedValue(undefined),
  },
}));

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * Creates a chainable query result mock.
 * Supports withIndex status-based filtering: if the query builder receives
 * a status-equality predicate (via eq("status", X)), the result array will
 * be filtered to only include documents with that status.
 */
function createDbQueryResult(result: any) {
  let filterStatus: string | null = null;

  const getFiltered = () => {
    if (result === null) return [];
    const arr = Array.isArray(result) ? result : [result];
    if (filterStatus === null) return arr;
    return arr.filter((doc: any) => doc.status === filterStatus);
  };

  const chain: any = {};

  // withIndex may receive a constraint builder function - we call it with a spy
  // that captures eq("status", X) calls to enable status-based filtering.
  chain.withIndex = vi.fn((_indexName: string, constraintFn?: Function) => {
    if (constraintFn) {
      const constraintSpy = {
        eq: (field: string, value: any) => {
          if (field === "status") filterStatus = value;
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
  return chain;
}

function createMockDb(resultMap?: Record<string, any>) {
  const db: any = {
    query: vi.fn((tableName: string) => {
      const result = resultMap?.[tableName] ?? null;
      return createDbQueryResult(result);
    }),
    get: vi.fn(),
    insert: vi.fn((_table: string, _doc: any) => "new-id-" + Math.random().toString(36).slice(2, 10)),
    patch: vi.fn(),
    delete: vi.fn(),
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
    payload: { documentId: "doc-id", url: "https://...", chunkText: "...", contentHash: "...", jobId: "job-id" },
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

    expect(db.insert).toHaveBeenCalledWith("processedWebhooks", expect.objectContaining({
      jobId: "task-456",
      processedAt: expect.any(Number),
    }));
  });

  it("uses provided expiresAt", async () => {
    const db = createMockDb();
    const ctx = { db, auth: { getUserIdentity: vi.fn() } };
    const future = Date.now() + 999999;

    await (handler as any).handler(ctx, { jobId: "task-789", expiresAt: future });

    expect(db.insert).toHaveBeenCalledWith("processedWebhooks", expect.objectContaining({
      expiresAt: future,
    }));
  });

  it("uses default 30-day TTL when expiresAt not provided", async () => {
    const db = createMockDb();
    const ctx = { db, auth: { getUserIdentity: vi.fn() } };
    const before = Date.now();

    await (handler as any).handler(ctx, { jobId: "task-ttl-test" });

    expect(db.insert).toHaveBeenCalledWith("processedWebhooks", expect.objectContaining({
      expiresAt: expect.any(Number),
    }));
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
    { text: "Chunk one content here with enough words.", contentHash: "hash-c1", parentContentHash: "parent-hash-1" },
    { text: "Chunk two content here for testing.", contentHash: "hash-c2", parentContentHash: "parent-hash-2" },
  ];

  it("returns unchanged when document content hash matches", async () => {
    const existingDoc = makeDoc({ _id: "doc-existing", contentHash: "same-hash", status: "indexed" });
    const db = createMockDb({ documents: existingDoc, crawledChunks: [] });
    const ctx = { db, auth: { getUserIdentity: vi.fn() }, runMutation: vi.fn(), runQuery: vi.fn(), runAction: vi.fn() };

    const result = await (handler as any).handler(ctx, {
      url: existingDoc.url,
      title: "Test",
      contentHash: "same-hash",
      jobId: "job-1",
      parents: defaultParents,
      children: defaultChildren,
    });

    expect(result).toEqual({ status: "unchanged", chunksQueued: 0 });
    expect(db.patch).toHaveBeenCalledWith("doc-existing", expect.objectContaining({
      status: "indexed",
    }));
    expect(embeddingPoolModule.embeddingPool.enqueueAction).not.toHaveBeenCalled();
  });

  it("updates metadata on unchanged document when etag/lastModified provided", async () => {
    const existingDoc = makeDoc({ _id: "doc-existing", contentHash: "same-hash" });
    const db = createMockDb({ documents: existingDoc, crawledChunks: [] });
    const ctx = { db, auth: { getUserIdentity: vi.fn() }, runMutation: vi.fn(), runQuery: vi.fn(), runAction: vi.fn() };

    await (handler as any).handler(ctx, {
      url: existingDoc.url,
      title: "Test",
      contentHash: "same-hash",
      jobId: "job-1",
      parents: [],
      children: [],
      etag: "\"abc123\"",
      lastModified: "Wed, 30 May 2026 12:00:00 GMT",
    });

    expect(db.patch).toHaveBeenCalledWith("doc-existing", expect.objectContaining({
      metadata: { lastModified: "Wed, 30 May 2026 12:00:00 GMT", etag: "\"abc123\"" },
    }));
  });

  it("inserts a new document when no existing document found", async () => {
    const db = createMockDb({ documents: null, crawledChunks: [] });
    db.insert.mockReturnValue("doc-new-id");
    const ctx = { db, auth: { getUserIdentity: vi.fn() }, runMutation: vi.fn(), runQuery: vi.fn(), runAction: vi.fn() };

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
    expect(db.insert).toHaveBeenCalledWith("documents", expect.objectContaining({
      url: "https://web.uettaxila.edu.pk/new-page",
      source: "web.uettaxila.edu.pk",
      contentHash: "new-hash",
    }));
    // enqueueActionBatch is called once with all new chunks as a batch
    expect(embeddingPoolModule.embeddingPool.enqueueActionBatch).toHaveBeenCalledTimes(1);
  });

  it("patches existing document when content hash changed", async () => {
    const existingDoc = makeDoc({ _id: "doc-existing", contentHash: "old-hash" });
    const db = createMockDb({ documents: existingDoc, crawledChunks: [] });
    const ctx = { db, auth: { getUserIdentity: vi.fn() }, runMutation: vi.fn(), runQuery: vi.fn(), runAction: vi.fn() };

    await (handler as any).handler(ctx, {
      url: existingDoc.url,
      title: "Updated Page",
      contentHash: "new-hash",
      jobId: "job-3",
      parents: defaultParents,
      children: defaultChildren,
    });

    expect(db.patch).toHaveBeenCalledWith("doc-existing", expect.objectContaining({
      contentHash: "new-hash",
      status: "processing",
    }));
  });

  it("diffs chunks and only enqueues new/changed ones", async () => {
    const existingDoc = makeDoc({ _id: "doc-existing", contentHash: "old-hash" });
    const existingChunks = [
      makeChunk({ _id: "chunk-keep", documentId: "doc-existing", contentHash: "hash-c1", ragId: "rag-c1" }),
    ];
    const db = createMockDb({ documents: existingDoc, crawledChunks: existingChunks });
    const ctx = { db, auth: { getUserIdentity: vi.fn() }, runMutation: vi.fn(), runQuery: vi.fn(), runAction: vi.fn() };

    const newChildren = [
      { text: "Chunk one (unchanged)", contentHash: "hash-c1", parentContentHash: "parent-hash-1" },
      { text: "Chunk three (new)", contentHash: "hash-c3", parentContentHash: "parent-hash-1" },
    ];

    await (handler as any).handler(ctx, {
      url: existingDoc.url,
      title: "Test",
      contentHash: "new-hash",
      jobId: "job-4",
      parents: [defaultParents[0]],
      children: newChildren,
    });

    // enqueueActionBatch called once with only the new chunk (hash-c3)
    expect(embeddingPoolModule.embeddingPool.enqueueActionBatch).toHaveBeenCalledTimes(1);
    const enqueuedArgs = embeddingPoolModule.embeddingPool.enqueueActionBatch.mock.calls[0];
    // enqueuedArgs[2] is the argsArray passed to enqueueActionBatch - check the first item's contentHash
    expect(enqueuedArgs[2][0].contentHash).toBe("hash-c3");
  });

  it("deletes stale chunks that no longer exist", async () => {
    const ragModule = await import("../../../convex/rag/instance");
    (ragModule.rag.delete as any).mockReset();
    const existingDoc = makeDoc({ _id: "doc-existing", contentHash: "old-hash" });
    const staleChunk = makeChunk({ _id: "chunk-stale", documentId: "doc-existing", contentHash: "hash-removed", ragId: "rag-stale" });
    const db = createMockDb({ documents: existingDoc, crawledChunks: [staleChunk] });
    const ctx = { db, auth: { getUserIdentity: vi.fn() }, runMutation: vi.fn(), runQuery: vi.fn(), runAction: vi.fn() };

    await (handler as any).handler(ctx, {
      url: existingDoc.url,
      title: "Test",
      contentHash: "new-hash",
      jobId: "job-5",
      parents: [],
      children: [],
    });

    expect(ragModule.rag.delete).toHaveBeenCalledWith(ctx, { entryId: "rag-stale" });
    expect(db.delete).toHaveBeenCalledWith("chunk-stale");
  });

  it("handles empty chunks array gracefully", async () => {
    const db = createMockDb({ documents: null, crawledChunks: [] });
    const ctx = { db, auth: { getUserIdentity: vi.fn() }, runMutation: vi.fn(), runQuery: vi.fn(), runAction: vi.fn() };

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
});

describe("saveEmbedding", () => {
  let handler: any;

  beforeEach(async () => {
    const mod = await import("../../../convex/crawl/mutations");
    handler = mod.saveEmbedding;
  });

  it("inserts a new crawledChunks record", async () => {
    const db = createMockDb({
      crawledChunks: null,
      documents: makeDoc({ _id: "doc-save", chunkCount: 1 }),
    });
    db.get.mockResolvedValue(makeDoc({ _id: "doc-save", chunkCount: 1 }));
    const ctx = { db, auth: { getUserIdentity: vi.fn() } };

    await (handler as any).handler(ctx, {
      documentId: "doc-save" as any,
      chunkText: "This is the chunk text.",
      contentHash: "hash-save-1",
      ragId: "rag-save-1",
      parentId: "parent-save-1" as any,
    });

    expect(db.insert).toHaveBeenCalledWith("crawledChunks", expect.objectContaining({
      documentId: "doc-save",
      contentHash: "hash-save-1",
      ragId: "rag-save-1",
      parentId: "parent-save-1",
    }));
  });

  it("skips insertion when chunk with same contentHash already exists", async () => {
    const existing = makeChunk({ documentId: "doc-skip", contentHash: "hash-exists" });
    const db = createMockDb({ crawledChunks: existing });
    const ctx = { db, auth: { getUserIdentity: vi.fn() } };

    await (handler as any).handler(ctx, {
      documentId: "doc-skip" as any,
      chunkText: "Duplicate chunk.",
      contentHash: "hash-exists",
      ragId: "rag-skip",
    });

    expect(db.insert).not.toHaveBeenCalled();
  });

  it("marks document as indexed when all chunks processed", async () => {
    // chunkCount=1: saving the final chunk (h2) brings chunksEmbedded to 1 >= chunkCount → "indexed"
    const doc = makeDoc({ _id: "doc-complete", chunkCount: 1, chunksEmbedded: 0 });
    const db = createMockDb({
      crawledChunks: null,
      documents: doc,
    });
    db.get.mockResolvedValue(doc);
    const ctx = { db, auth: { getUserIdentity: vi.fn() } };

    await (handler as any).handler(ctx, {
      documentId: "doc-complete" as any,
      chunkText: "Final chunk.",
      contentHash: "h2",
      ragId: "rag-final",
    });

    expect(db.patch).toHaveBeenCalledWith("doc-complete", expect.objectContaining({
      status: "indexed",
    }));
  });

  it("uses default embedding model name", async () => {
    const doc = makeDoc({ _id: "doc-model", chunkCount: 1 });
    const db = createMockDb({ crawledChunks: null });
    db.get.mockResolvedValue(doc);
    const ctx = { db, auth: { getUserIdentity: vi.fn() } };

    await (handler as any).handler(ctx, {
      documentId: "doc-model" as any,
      chunkText: "Model check.",
      contentHash: "hash-model",
      ragId: "rag-model",
    });

    expect(db.insert).toHaveBeenCalledWith("crawledChunks", expect.objectContaining({
      embeddingModel: "gemini-embedding-2",
    }));
  });
});

describe("upsertDocument", () => {
  let handler: any;
  let ragModule: any;

  beforeEach(async () => {
    ragModule = await import("../../../convex/rag/instance");
    ragModule.rag.delete.mockReset();
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
    const ctx = { db, auth: { getUserIdentity: vi.fn() }, runMutation: vi.fn(), runQuery: vi.fn(), runAction: vi.fn() };

    const result = await (handler as any).handler(ctx, defaultArgs);

    expect(result).toEqual({ action: "inserted", documentId: "doc-inserted-id" });
    expect(db.insert).toHaveBeenCalledWith("documents", expect.objectContaining({
      url: defaultArgs.url,
      contentHash: "hash-1",
      source: "web.uettaxila.edu.pk",
      status: "pending_embed",
    }));
  });

  it("returns skipped when existing document has same contentHash", async () => {
    const existingDoc = makeDoc({ _id: "doc-skip", contentHash: "hash-1" });
    const db = createMockDb({ documents: existingDoc });
    const ctx = { db, auth: { getUserIdentity: vi.fn() } };

    const result = await (handler as any).handler(ctx, defaultArgs);

    expect(result).toEqual({ action: "skipped", documentId: "doc-skip" });
    expect(db.patch).toHaveBeenCalledWith("doc-skip", expect.objectContaining({
      status: "active",
    }));
  });

  it("returns updated when existing document has different contentHash", async () => {
    const existingDoc = makeDoc({ _id: "doc-update", contentHash: "old-hash" });
    const db = createMockDb({ documents: existingDoc, crawledChunks: [] });
    const ctx = { db, auth: { getUserIdentity: vi.fn() }, runMutation: vi.fn(), runQuery: vi.fn(), runAction: vi.fn() };

    const result = await (handler as any).handler(ctx, {
      ...defaultArgs,
      contentHash: "new-hash",
    });

    expect(result).toEqual({ action: "updated", documentId: "doc-update" });
    expect(db.patch).toHaveBeenCalledWith("doc-update", expect.objectContaining({
      contentHash: "new-hash",
      status: "pending_embed",
    }));
  });

  it("deletes old chunks and rag vectors on content update", async () => {
    const existingDoc = makeDoc({ _id: "doc-update", contentHash: "old-hash" });
    const oldChunks = [
      makeChunk({ _id: "old-c1", documentId: "doc-update", contentHash: "old-c1", ragId: "rag-old-1" }),
      makeChunk({ _id: "old-c2", documentId: "doc-update", contentHash: "old-c2", ragId: "rag-old-2" }),
    ];
    const db = createMockDb({ documents: existingDoc, crawledChunks: oldChunks });
    const ctx = { db, auth: { getUserIdentity: vi.fn() }, runMutation: vi.fn(), runQuery: vi.fn(), runAction: vi.fn() };

    await (handler as any).handler(ctx, {
      ...defaultArgs,
      contentHash: "new-hash-v2",
    });

    expect(ragModule.rag.delete).toHaveBeenCalledTimes(2);
    expect(ragModule.rag.delete).toHaveBeenCalledWith(ctx, { entryId: "rag-old-1" });
    expect(ragModule.rag.delete).toHaveBeenCalledWith(ctx, { entryId: "rag-old-2" });
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

    expect(db.insert).toHaveBeenCalledWith("documents", expect.objectContaining({
      title: defaultArgs.url,
    }));
  });

  it("includes freshnessTier in inserted document", async () => {
    const db = createMockDb({ documents: null });
    db.insert.mockReturnValue("doc-tier");
    const ctx = { db, auth: { getUserIdentity: vi.fn() } };

    await (handler as any).handler(ctx, {
      ...defaultArgs,
      freshnessTier: "high",
    });

    expect(db.insert).toHaveBeenCalledWith("documents", expect.objectContaining({
      freshnessTier: "high",
    }));
  });

  it("handles rag.delete failure gracefully during content update", async () => {
    ragModule.rag.delete.mockRejectedValue(new Error("Vector delete failed"));
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
    const ctx = { db, auth: { getUserIdentity: vi.fn() }, runMutation: vi.fn(), runQuery: vi.fn(), runAction: vi.fn() };

    const parents = [{ contentHash: "parent-hash-a", text: "Parent A block." }];
    const children = [
      { text: "Chunk A", contentHash: "hash-a", parentContentHash: "parent-hash-a" },
      { text: "Chunk B", contentHash: "hash-b", parentContentHash: "parent-hash-a" },
      { text: "Chunk C", contentHash: "hash-c", parentContentHash: "parent-hash-a" },
    ];

    await (handler as any).handler(ctx, {
      documentId: "doc-enqueue" as any,
      url: "https://web.uettaxila.edu.pk/page",
      parents,
      children,
    });

    // enqueueActionBatch is called once with all chunks as a batch
    expect(embeddingPoolModule.embeddingPool.enqueueActionBatch).toHaveBeenCalledTimes(1);
  });

  it("sets chunkCount on the document", async () => {
    const db = createMockDb();
    const ctx = { db, auth: { getUserIdentity: vi.fn() }, runMutation: vi.fn(), runQuery: vi.fn(), runAction: vi.fn() };

    await (handler as any).handler(ctx, {
      documentId: "doc-count" as any,
      url: "https://web.uettaxila.edu.pk/page",
      parents: [{ contentHash: "parent-single", text: "Parent block." }],
      children: [{ text: "Single chunk", contentHash: "hash-single", parentContentHash: "parent-single" }],
    });

    expect(db.patch).toHaveBeenCalledWith("doc-count", expect.objectContaining({
      chunkCount: 1,
    }));
  });

  it("sets status to indexed when chunks array is empty", async () => {
    const db = createMockDb();
    const ctx = { db, auth: { getUserIdentity: vi.fn() }, runMutation: vi.fn(), runQuery: vi.fn(), runAction: vi.fn() };

    await (handler as any).handler(ctx, {
      documentId: "doc-empty" as any,
      url: "https://web.uettaxila.edu.pk/page",
      parents: [],
      children: [],
    });

    expect(db.patch).toHaveBeenCalledWith("doc-empty", expect.objectContaining({
      status: "indexed",
      chunkCount: 0,
    }));
    expect(embeddingPoolModule.embeddingPool.enqueueActionBatch).not.toHaveBeenCalled();
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
    const docs = [
      makeDoc({ _id: "doc-fresh", crawlSessionId: "session-current" }),
    ];
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
    const staleDocs = [
      makeDoc({ _id: "doc-purge-1", status: "stale" }),
    ];
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
    const ctx = { db, auth: { getUserIdentity: vi.fn() }, runMutation: vi.fn(), runQuery: vi.fn(), runAction: vi.fn() };

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
