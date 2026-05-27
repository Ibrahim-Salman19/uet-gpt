import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Doc, Id } from "../../convex/_generated/dataModel";

// Mock convex/_generated/server so query()/mutation() return the raw handler
vi.mock("../../convex/_generated/server", () => ({
  query: (opts: { handler: Function }) => ({ handler: opts.handler }),
  mutation: (opts: { handler: Function }) => ({ handler: opts.handler }),
}));

import {
  dashboardStats,
  deleteDocument,
  deleteFeedback,
} from "../../convex/admin/stats";

/* ------------------------------------------------------------------ */
/*  helpers                                                            */
/* ------------------------------------------------------------------ */

function makeChain(resolvedValue: unknown) {
  const data = resolvedValue;
  const chain = {
    withIndex: vi.fn((indexName, indexFilterFn) => {
      if (Array.isArray(data) && indexFilterFn) {
        const filterState: Record<string, any> = {};
        const q = {
          eq: vi.fn((field, val) => {
            filterState[field] = val;
            return q;
          }),
          gt: vi.fn(),
          gte: vi.fn((field, val) => {
            filterState[field] = { operator: "$gte", value: val };
            return q;
          }),
          lt: vi.fn(),
          lte: vi.fn(),
        };
        try {
          indexFilterFn(q);
          const filtered = data.filter((item) => {
            for (const [key, filter] of Object.entries(filterState)) {
              if (filter && typeof filter === "object" && filter.operator === "$gte") {
                if (!(item[key] >= filter.value)) return false;
              } else {
                if (item[key] !== filter) return false;
              }
            }
            return true;
          });
          return makeChain(filtered);
        } catch (e) {
          // Fallback on error
        }
      }
      return chain;
    }),
    order: vi.fn(),
    take: vi.fn(),
    collect: vi.fn(),
    unique: vi.fn(),
    first: vi.fn(),
    filter: vi.fn(),
    count: vi.fn(),
  };

  chain.order.mockReturnValue(chain);
  chain.filter.mockReturnValue(chain);

  chain.take.mockImplementation(async (n) => {
    return Array.isArray(data) ? data.slice(0, n) : (data ?? []);
  });
  chain.collect.mockImplementation(async () => {
    return data ?? [];
  });
  chain.unique.mockImplementation(async () => {
    return Array.isArray(data) ? (data[0] ?? null) : (data ?? null);
  });
  chain.first.mockImplementation(async () => {
    return Array.isArray(data) ? (data[0] ?? null) : (data ?? null);
  });
  chain.count.mockImplementation(async () => {
    return Array.isArray(data) ? data.length : (data ? 1 : 0);
  });

  return chain;
}

type MockQueryCtx = {
  auth: { getUserIdentity: ReturnType<typeof vi.fn> };
  db: {
    query: ReturnType<typeof vi.fn>;
    get: ReturnType<typeof vi.fn>;
  };
};

type MockMutationCtx = {
  auth: { getUserIdentity: ReturnType<typeof vi.fn> };
  db: {
    insert: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
    get: ReturnType<typeof vi.fn>;
    query: ReturnType<typeof vi.fn>;
  };
};

function makeQueryCtx(overrides?: Partial<MockQueryCtx>): MockQueryCtx {
  return {
    auth: { getUserIdentity: vi.fn() },
    db: { query: vi.fn().mockReturnValue(makeChain(null)), get: vi.fn() },
    ...overrides,
  };
}

function makeMutationCtx(overrides?: Partial<MockMutationCtx>): MockMutationCtx {
  return {
    auth: { getUserIdentity: vi.fn() },
    db: {
      insert: vi.fn().mockResolvedValue("new_id" as Id<"adminAuditLog">),
      delete: vi.fn().mockResolvedValue(undefined),
      get: vi.fn(),
      query: vi.fn().mockReturnValue(makeChain(null)),
    },
    ...overrides,
  };
}

/* ================================================================== */
/*  dashboardStats                                                     */
/* ================================================================== */

describe("admin:stats / dashboardStats", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("should throw when user is not authenticated", async () => {
    const ctx = makeQueryCtx();
    ctx.auth.getUserIdentity.mockResolvedValue(null);

    await expect(
      (
        dashboardStats as unknown as {
          handler: (ctx: MockQueryCtx, args: Record<string, unknown>) => Promise<unknown>;
        }
      ).handler(ctx, {}),
    ).rejects.toThrow("Authentication required");
  });

  it("should throw when user is not an admin", async () => {
    const ctx = makeQueryCtx();
    ctx.auth.getUserIdentity.mockResolvedValue({ subject: "clerk_123" });
    const userChain = makeChain({ _id: "user1", role: "user" });
    userChain.unique.mockResolvedValue({
      _id: "user1" as Id<"users">,
      role: "user",
    } as Doc<"users">);
    ctx.db.query = vi.fn().mockReturnValue(userChain);

    await expect(
      (
        dashboardStats as unknown as {
          handler: (ctx: MockQueryCtx, args: Record<string, unknown>) => Promise<unknown>;
        }
      ).handler(ctx, {}),
    ).rejects.toThrow("Admin access required");
  });

  it("should return aggregated stats for admin user", async () => {
    const ctx = makeQueryCtx();
    ctx.auth.getUserIdentity.mockResolvedValue({ subject: "clerk_admin_1" });

    const adminUser = {
      _id: "admin1" as Id<"users">,
      role: "admin",
      clerkId: "clerk_admin_1",
    } as Doc<"users">;

    const documents = [
      { _id: "doc1", status: "indexed", title: "Doc 1", url: "https://example.com/1" },
      { _id: "doc2", status: "indexed", title: "Doc 2", url: "https://example.com/2" },
      { _id: "doc3", status: "pending", title: "Doc 3", url: "https://example.com/3" },
      { _id: "doc4", status: "failed", title: "Doc 4", url: "https://example.com/4" },
    ] as Doc<"documents">[];

    const feedback = [
      {
        _id: "fb1" as Id<"feedback">,
        rating: "thumbsUp" as const,
        createdAt: Date.now(),
        category: "accurate",
      },
      {
        _id: "fb2" as Id<"feedback">,
        rating: "thumbsDown" as const,
        createdAt: Date.now(),
      },
    ] as Doc<"feedback">[];

    const users = [
      {
        _id: "u1" as Id<"users">,
        role: "admin",
        lastLoginAt: Date.now() - 1000,
      },
      {
        _id: "u2" as Id<"users">,
        role: "user",
        lastLoginAt: Date.now() - 100_000,
      },
      {
        _id: "u3" as Id<"users">,
        role: "user",
        lastLoginAt: undefined,
      },
    ] as Doc<"users">[];

    const crawlJobs = [
      { _id: "cj1", status: "completed", startedAt: Date.now() - 5000, trigger: "scheduled" },
    ] as Doc<"crawlJobs">[];

    const cacheEntries: Doc<"semanticCache">[] = [];

    // Build query chains for each table
    const userChain = makeChain(adminUser);
    userChain.unique.mockResolvedValue(adminUser);

    const docChain = makeChain(documents);
    docChain.collect.mockResolvedValue(documents);

    const feedbackChain = makeChain(feedback);
    feedbackChain.collect.mockResolvedValue(feedback);

    const usersChain = makeChain(users);
    usersChain.collect.mockResolvedValue(users);

    const crawlChain = makeChain(crawlJobs);
    crawlChain.collect.mockResolvedValue(crawlJobs);
    crawlChain.take.mockResolvedValue(crawlJobs);

    const cacheChain = makeChain(cacheEntries);
    cacheChain.collect.mockResolvedValue(cacheEntries);

    // feedback order desc take(10)
    const recentFbChain = makeChain(feedback);
    recentFbChain.take.mockResolvedValue(feedback);

    // crawlJobs order desc take(5)
    const recentCrawlChain = makeChain(crawlJobs);
    recentCrawlChain.take.mockResolvedValue(crawlJobs);

    let callCount = 0;
    ctx.db.query = vi.fn((tableName: string) => {
      callCount++;
      if (callCount === 1) return userChain;
      if (tableName === "users") return usersChain;
      if (tableName === "documents") return docChain;
      if (tableName === "feedback") return feedbackChain;
      if (tableName === "crawlJobs") return crawlChain;
      if (tableName === "semanticCache") return cacheChain;
      return makeChain([]);
    });

    const stats = await (
      dashboardStats as unknown as {
        handler: (ctx: MockQueryCtx, args: Record<string, unknown>) => Promise<Record<string, unknown>>;
      }
    ).handler(ctx, {});

    expect(stats.totalDocuments).toBe(4);
    expect(stats.totalFeedback).toBe(2);
    expect(stats.totalUsers).toBe(3);
    expect(stats.totalCrawlJobs).toBe(1);
    expect(stats.totalCacheEntries).toBe(0);
    expect(stats.indexedDocuments).toBe(2);
    expect(stats.pendingDocuments).toBe(1);
    expect(stats.failedDocuments).toBe(1);
    expect(stats.activeUsersLast24h).toBe(2); // u1 (recent) + u2 (within 24h but > 24h? let's check)
    // u1: lastLoginAt = Date.now() - 1000 (within 24h) → counted
    // u2: lastLoginAt = Date.now() - 100_000 (within 24h since 100s < 86400s) → counted
    // u3: undefined → not counted
    expect(stats.activeUsersLast24h).toBe(2);
    expect(stats.recentFeedback).toHaveLength(2);
    expect(stats.recentCrawls).toHaveLength(1);
    expect(stats.storageUsed).toBeDefined();
  });

  it("should handle empty tables gracefully", async () => {
    const ctx = makeQueryCtx();
    ctx.auth.getUserIdentity.mockResolvedValue({ subject: "clerk_admin_1" });
    const adminUser = {
      _id: "admin1" as Id<"users">,
      role: "superadmin",
    } as Doc<"users">;

    const emptyChain = makeChain([]);
    emptyChain.collect.mockResolvedValue([]);
    emptyChain.take.mockResolvedValue([]);

    const userChain = makeChain(adminUser);
    userChain.unique.mockResolvedValue(adminUser);

    let callCount = 0;
    ctx.db.query = vi.fn(() => {
      callCount++;
      if (callCount === 1) return userChain;
      return emptyChain;
    });

    const stats = await (
      dashboardStats as unknown as {
        handler: (ctx: MockQueryCtx, args: Record<string, unknown>) => Promise<Record<string, unknown>>;
      }
    ).handler(ctx, {});
    expect(stats.totalDocuments).toBe(0);
    expect(stats.totalFeedback).toBe(0);
    expect(stats.totalUsers).toBe(0);
    expect(stats.totalCrawlJobs).toBe(0);
    expect(stats.totalCacheEntries).toBe(0);
    expect(stats.activeUsersLast24h).toBe(0);
  });
});

/* ================================================================== */
/*  deleteDocument                                                     */
/* ================================================================== */

describe("admin:stats / deleteDocument", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("should throw when user is not authenticated", async () => {
    const ctx = makeMutationCtx();
    ctx.auth.getUserIdentity.mockResolvedValue(null);
    await expect(
      (
        deleteDocument as unknown as {
          handler: (ctx: MockMutationCtx, args: { documentId: Id<"documents"> }) => Promise<void>;
        }
      ).handler(ctx, { documentId: "doc1" as Id<"documents"> }),
    ).rejects.toThrow("Authentication required");
  });

  it("should throw when user is not admin", async () => {
    const ctx = makeMutationCtx();
    ctx.auth.getUserIdentity.mockResolvedValue({ subject: "clerk_user_1" });
    const userChain = makeChain({ _id: "user1", role: "user" });
    userChain.unique.mockResolvedValue({ _id: "user1" as Id<"users">, role: "user" } as Doc<"users">);
    ctx.db.query = vi.fn().mockReturnValue(userChain);

    await expect(
      (
        deleteDocument as unknown as {
          handler: (ctx: MockMutationCtx, args: { documentId: Id<"documents"> }) => Promise<void>;
        }
      ).handler(ctx, { documentId: "doc1" as Id<"documents"> }),
    ).rejects.toThrow("Admin access required");
  });

  it("should throw when document does not exist", async () => {
    const ctx = makeMutationCtx();
    ctx.auth.getUserIdentity.mockResolvedValue({ subject: "clerk_admin_1" });
    const adminUser = { _id: "admin1" as Id<"users">, role: "admin" } as Doc<"users">;
    const userChain = makeChain(adminUser);
    userChain.unique.mockResolvedValue(adminUser);
    ctx.db.query = vi.fn().mockReturnValue(userChain);
    ctx.db.get = vi.fn().mockResolvedValue(null);

    await expect(
      (
        deleteDocument as unknown as {
          handler: (ctx: MockMutationCtx, args: { documentId: Id<"documents"> }) => Promise<void>;
        }
      ).handler(ctx, { documentId: "missing_doc" as Id<"documents"> }),
    ).rejects.toThrow("Document not found");
  });

  it("should delete document and create audit log entry", async () => {
    const insert = vi.fn().mockResolvedValue("log_id" as Id<"adminAuditLog">);
    const deleteFn = vi.fn().mockResolvedValue(undefined);
    const adminUser = { _id: "admin1" as Id<"users">, role: "admin" } as Doc<"users">;
    const document = {
      _id: "doc1" as Id<"documents">,
      title: "Test Doc",
      url: "https://example.com/doc",
    } as Doc<"documents">;

    const userChain = makeChain(adminUser);
    userChain.unique.mockResolvedValue(adminUser);
    const query = vi.fn().mockReturnValue(userChain);
    const get = vi.fn().mockResolvedValue(document);

    const ctx = makeMutationCtx({ db: { insert, delete: deleteFn, get, query } });
    ctx.auth.getUserIdentity.mockResolvedValue({ subject: "clerk_admin_1" });

    await (
      deleteDocument as unknown as {
        handler: (ctx: MockMutationCtx, args: { documentId: Id<"documents"> }) => Promise<void>;
      }
    ).handler(ctx, { documentId: "doc1" as Id<"documents"> });

    expect(deleteFn).toHaveBeenCalledWith("doc1");
    expect(insert).toHaveBeenCalledOnce();
    const auditEntry = insert.mock.calls[0]?.[1] as Record<string, unknown>;
    expect(auditEntry.userId).toBe("admin1");
    expect(auditEntry.action).toBe("document.delete");
    expect(auditEntry.target).toBe("https://example.com/doc");
    expect(auditEntry.details).toMatchObject({
      oldValue: "Test Doc",
      reason: "Admin deletion",
    });
  });
});

/* ================================================================== */
/*  deleteFeedback                                                     */
/* ================================================================== */

describe("admin:stats / deleteFeedback", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("should throw when user is not authenticated", async () => {
    const ctx = makeMutationCtx();
    ctx.auth.getUserIdentity.mockResolvedValue(null);
    await expect(
      (
        deleteFeedback as unknown as {
          handler: (ctx: MockMutationCtx, args: { feedbackId: Id<"feedback"> }) => Promise<void>;
        }
      ).handler(ctx, { feedbackId: "fb1" as Id<"feedback"> }),
    ).rejects.toThrow("Authentication required");
  });

  it("should throw when user is not admin", async () => {
    const ctx = makeMutationCtx();
    ctx.auth.getUserIdentity.mockResolvedValue({ subject: "clerk_user" });
    const userChain = makeChain({ _id: "user1", role: "user" });
    userChain.unique.mockResolvedValue({ _id: "user1" as Id<"users">, role: "user" } as Doc<"users">);
    ctx.db.query = vi.fn().mockReturnValue(userChain);

    await expect(
      (
        deleteFeedback as unknown as {
          handler: (ctx: MockMutationCtx, args: { feedbackId: Id<"feedback"> }) => Promise<void>;
        }
      ).handler(ctx, { feedbackId: "fb1" as Id<"feedback"> }),
    ).rejects.toThrow("Admin access required");
  });

  it("should delete feedback for admin user", async () => {
    const deleteFn = vi.fn().mockResolvedValue(undefined);
    const adminUser = { _id: "admin1" as Id<"users">, role: "admin" } as Doc<"users">;

    const userChain = makeChain(adminUser);
    userChain.unique.mockResolvedValue(adminUser);
    const query = vi.fn().mockReturnValue(userChain);

    const ctx = makeMutationCtx({ db: { ...makeMutationCtx().db, delete: deleteFn, query } });
    ctx.auth.getUserIdentity.mockResolvedValue({ subject: "clerk_admin_1" });

    await (
      deleteFeedback as unknown as {
        handler: (ctx: MockMutationCtx, args: { feedbackId: Id<"feedback"> }) => Promise<void>;
      }
    ).handler(ctx, { feedbackId: "fb1" as Id<"feedback"> });

    expect(deleteFn).toHaveBeenCalledWith("fb1");
  });

  it("should allow superadmin to delete feedback", async () => {
    const deleteFn = vi.fn().mockResolvedValue(undefined);
    const superAdmin = { _id: "super1" as Id<"users">, role: "superadmin" } as Doc<"users">;

    const userChain = makeChain(superAdmin);
    userChain.unique.mockResolvedValue(superAdmin);
    const query = vi.fn().mockReturnValue(userChain);

    const ctx = makeMutationCtx({ db: { ...makeMutationCtx().db, delete: deleteFn, query } });
    ctx.auth.getUserIdentity.mockResolvedValue({ subject: "clerk_superadmin_1" });

    await (
      deleteFeedback as unknown as {
        handler: (ctx: MockMutationCtx, args: { feedbackId: Id<"feedback"> }) => Promise<void>;
      }
    ).handler(ctx, { feedbackId: "fb2" as Id<"feedback"> });

    expect(deleteFn).toHaveBeenCalledWith("fb2");
  });
});
