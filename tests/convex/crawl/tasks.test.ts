vi.mock("../../convex/_generated/server", () => ({
  internalMutation: (opts: { handler: Function }) => ({ handler: opts.handler }),
  mutation: (opts: { handler: Function, returns?: any }) => ({ handler: opts.handler }),
}));

import { describe, it, expect, vi, beforeEach } from "vitest";

function createDbQueryResult(result: any) {
  const chain: any = {};
  chain.withIndex = vi.fn(() => chain);
  chain.filter = vi.fn(() => chain);
  chain.order = vi.fn(() => chain);
  chain.gte = vi.fn(() => chain);
  chain.lte = vi.fn(() => chain);
  chain.eq = vi.fn(() => chain);
  chain.first = vi.fn(() => {
    if (result === null) return null;
    return Array.isArray(result) ? result[0] ?? null : result;
  });
  chain.unique = vi.fn(() => {
    if (result === null) return null;
    return Array.isArray(result) ? result[0] ?? null : result;
  });
  chain.collect = vi.fn(() => {
    if (result === null) return [];
    return Array.isArray(result) ? result : [result];
  });
  chain.take = vi.fn((n: number) => {
    if (result === null) return [];
    const arr = Array.isArray(result) ? result : [result];
    return arr.slice(0, n);
  });
  return chain;
}

function createMockDb(resultMap?: Record<string, any>) {
  return {
    query: vi.fn((tableName: string) => {
      const result = resultMap?.[tableName] ?? null;
      return createDbQueryResult(result);
    }),
    get: vi.fn(),
    insert: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  };
}

function makeExpiredEntry(overrides: any = {}) {
  return {
    _id: overrides._id ?? "expired-default-id",
    _creationTime: Date.now() - 99999,
    expiresAt: Date.now() - 1000,
    ...overrides,
  };
}

function makeCacheEntry(overrides: any = {}) {
  return {
    _id: overrides._id ?? "cache-default-id",
    _creationTime: Date.now() - 99999,
    expiresAt: Date.now() - 1000,
    query: "test query",
    response: "test response",
    ...overrides,
  };
}

function makeWebhookEntry(overrides: any = {}) {
  return {
    _id: overrides._id ?? "webhook-default-id",
    _creationTime: Date.now() - 99999,
    expiresAt: Date.now() - 1000,
    jobId: "task-expired",
    processedAt: Date.now() - 99999,
    ...overrides,
  };
}

function makeUser(overrides: any = {}) {
  return {
    _id: "user-default-id",
    _creationTime: Date.now(),
    role: "admin",
    ...overrides,
  };
}

function makeFeedback(overrides: any = {}) {
  return {
    _id: "feedback-default-id",
    _creationTime: Date.now(),
    rating: "thumbsUp",
    ...overrides,
  };
}

describe("cleanupExpiredCache", () => {
  let handler: any;

  beforeEach(async () => {
    const mod = await import("../../convex/crawl/tasks");
    handler = mod.cleanupExpiredCache;
  });

  it("deletes expired semantic cache entries", async () => {
    const expiredCache = [makeCacheEntry({ _id: "cache-1" }), makeCacheEntry({ _id: "cache-2" })];
    const db = createMockDb({ semanticCache: expiredCache, processedWebhooks: [] });
    const ctx = { db, auth: { getUserIdentity: vi.fn() } };

    const result = await (handler as any).handler(ctx, {});

    expect(result).toBe(2);
    expect(db.delete).toHaveBeenCalledWith("cache-1");
    expect(db.delete).toHaveBeenCalledWith("cache-2");
  });

  it("deletes expired processedWebhooks entries", async () => {
    const expiredWebhooks = [
      makeWebhookEntry({ _id: "wh-1" }),
      makeWebhookEntry({ _id: "wh-2" }),
      makeWebhookEntry({ _id: "wh-3" }),
    ];
    const db = createMockDb({ semanticCache: [], processedWebhooks: expiredWebhooks });
    const ctx = { db, auth: { getUserIdentity: vi.fn() } };

    const result = await (handler as any).handler(ctx, {});

    expect(result).toBe(3);
    expect(db.delete).toHaveBeenCalledWith("wh-1");
    expect(db.delete).toHaveBeenCalledWith("wh-2");
    expect(db.delete).toHaveBeenCalledWith("wh-3");
  });

  it("respects the limit parameter", async () => {
    const expiredCache = Array.from({ length: 200 }, (_, i) =>
      makeCacheEntry({ _id: `cache-${i}` }),
    );
    const db = createMockDb({ semanticCache: expiredCache, processedWebhooks: [] });
    const ctx = { db, auth: { getUserIdentity: vi.fn() } };

    const result = await (handler as any).handler(ctx, { limit: 50 });

    expect(result).toBe(50);
  });

  it("uses default limit of 100 when not provided", async () => {
    const manyEntries = Array.from({ length: 150 }, (_, i) =>
      makeCacheEntry({ _id: `many-${i}` }),
    );
    const db = createMockDb({ semanticCache: manyEntries, processedWebhooks: manyEntries.slice(0, 0) });
    const ctx = { db, auth: { getUserIdentity: vi.fn() } };

    const result = await (handler as any).handler(ctx, {});

    expect(result).toBe(100);
  });

  it("returns 0 when no expired entries exist", async () => {
    const db = createMockDb({ semanticCache: [], processedWebhooks: [] });
    const ctx = { db, auth: { getUserIdentity: vi.fn() } };

    const result = await (handler as any).handler(ctx, {});

    expect(result).toBe(0);
  });

  it("handles non-expired entries without deleting them", async () => {
    const validEntry = makeCacheEntry({
      _id: "cache-valid",
      expiresAt: Date.now() + 999999,
    });
    const db = createMockDb({ semanticCache: [validEntry], processedWebhooks: [] });
    const ctx = { db, auth: { getUserIdentity: vi.fn() } };

    const result = await (handler as any).handler(ctx, {});

    expect(result).toBe(0);
    expect(db.delete).not.toHaveBeenCalled();
  });
});

describe("aggregateDailyStats", () => {
  let handler: any;

  beforeEach(async () => {
    const mod = await import("../../convex/crawl/tasks");
    handler = mod.aggregateDailyStats;
  });

  it("inserts audit log entry with stats", async () => {
    const feedback = [makeFeedback(), makeFeedback()];
    const adminUser = makeUser({ _id: "admin-1" });
    const db = createMockDb({
      feedback,
      crawlStats: { _id: "stats-1", totalDocuments: 100, indexedDocuments: 75 },
      users: adminUser,
    });
    db.insert.mockReturnValue("audit-log-id");
    const ctx = { db, auth: { getUserIdentity: vi.fn() } };

    await (handler as any).handler(ctx, {});

    expect(db.insert).toHaveBeenCalledWith("adminAuditLog", expect.objectContaining({
      userId: "admin-1",
      action: "settings.update",
    }));
  });

  it("calculates positive feedback rate correctly", async () => {
    const feedback = [
      makeFeedback({ rating: "thumbsUp" }),
      makeFeedback({ rating: "thumbsUp" }),
      makeFeedback({ rating: "thumbsDown" }),
      makeFeedback({ rating: "thumbsUp" }),
    ];
    const adminUser = makeUser({ _id: "admin-2" });
    const db = createMockDb({
      feedback,
      crawlStats: { totalDocuments: 50, indexedDocuments: 30 },
      users: adminUser,
    });
    db.insert.mockReturnValue("audit-log-id");
    const ctx = { db, auth: { getUserIdentity: vi.fn() } };

    await (handler as any).handler(ctx, {});

    expect(db.insert).toHaveBeenCalledWith("adminAuditLog", expect.objectContaining({
      details: expect.objectContaining({
        newValue: expect.stringContaining('"positiveRate":75'),
      }),
    }));
  });

  it("handles zero feedback gracefully", async () => {
    const adminUser = makeUser({ _id: "admin-3" });
    const db = createMockDb({
      feedback: [],
      crawlStats: { totalDocuments: 0, indexedDocuments: 0 },
      users: adminUser,
    });
    db.insert.mockReturnValue("audit-log-id");
    const ctx = { db, auth: { getUserIdentity: vi.fn() } };

    await (handler as any).handler(ctx, {});

    expect(db.insert).toHaveBeenCalledWith("adminAuditLog", expect.objectContaining({
      details: expect.objectContaining({
        newValue: expect.stringContaining('"positiveRate":0'),
      }),
    }));
  });

  it("skips audit log when no admin user exists", async () => {
    const db = createMockDb({
      feedback: [],
      crawlStats: { totalDocuments: 0, indexedDocuments: 0 },
    });
    const ctx = { db, auth: { getUserIdentity: vi.fn() } };

    const result = await (handler as any).handler(ctx, {});

    expect(result).toBeNull();
    expect(db.insert).not.toHaveBeenCalled();
  });

  it("falls back to superadmin when no regular admin exists", async () => {
    const superadmin = makeUser({ _id: "super-1", role: "superadmin" });
    const db = createMockDb({
      feedback: [],
      crawlStats: { totalDocuments: 0, indexedDocuments: 0 },
      users: superadmin,
    });
    db.query.mockImplementation((tableName: string) => {
      if (tableName === "feedback") return createDbQueryResult([]);
      if (tableName === "crawlStats") return createDbQueryResult({ totalDocuments: 0, indexedDocuments: 0 });
      if (tableName === "users") return createDbQueryResult(superadmin);
      return createDbQueryResult(null);
    });
    db.insert.mockReturnValue("audit-log-id");
    const ctx = { db, auth: { getUserIdentity: vi.fn() } };

    await (handler as any).handler(ctx, {});

    expect(db.insert).toHaveBeenCalledWith("adminAuditLog", expect.objectContaining({
      userId: "super-1",
    }));
  });
});
