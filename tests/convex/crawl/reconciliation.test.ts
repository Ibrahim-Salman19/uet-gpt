/**
 * Phase 6.21A: auditRagReconciliation was ported from the isolated workspace
 * (Part 1-2) but never actually exercised - it is `requireAdmin`-gated, so
 * the admin-key-authenticated ConvexHttpClient scripts used elsewhere this
 * phase for live local-backend verification cannot call it (admin-deployment
 * auth is a different concern from ctx.auth.getUserIdentity(), which
 * requireAdmin needs and a plain admin key does not satisfy). Per this
 * phase's own standard - an analytical claim must not stand in for an
 * executed test (see t5-fault-injection.test.ts) - this file actually runs
 * the handler against a mocked ctx/rag and checks every one of its six
 * TRACKED and UNTRACKED categories, the pagination pass-through, the
 * sampleUntrackedReady cap, and that the admin gate itself is still wired up.
 */
vi.mock("../../../convex/_generated/server", () => ({
  query: (opts: { handler: Function }) => ({ handler: opts.handler }),
  mutation: (opts: { handler: Function }) => ({ handler: opts.handler }),
}));

vi.mock("../../../convex/auth", () => ({
  requireAdmin: vi.fn().mockResolvedValue({ _id: "admin-user-id", role: "admin" }),
}));

vi.mock("../../../convex/rag/instance", () => ({
  rag: {
    getNamespace: vi.fn(),
    list: vi.fn(),
    deleteAsync: vi.fn(),
  },
}));

import { beforeEach, describe, expect, it, vi } from "vitest";
import { requireAdmin } from "../../../convex/auth";
import {
  auditRagReconciliation,
  gcOrphanedPendingChunkText,
  gcOrphanedRagEntries,
} from "../../../convex/crawl/reconciliation";
import { rag } from "../../../convex/rag/instance";

function makeEntry(overrides: any = {}) {
  return {
    entryId: "entry-1",
    key: "some-chunk-key",
    importance: 1,
    filterValues: [],
    status: "ready",
    ...overrides,
  };
}

// Minimal query builder: only what auditRagReconciliation actually calls -
// ctx.db.query("crawledChunks").withIndex("by_ragId", q => q.eq(...)).first().
function makeCtx(trackedRagIds: string[]) {
  const db = {
    query: vi.fn((table: string) => {
      expect(table).toBe("crawledChunks");
      return {
        withIndex: vi.fn((indexName: string, constraintFn: Function) => {
          expect(indexName).toBe("by_ragId");
          let matchedRagId: string | undefined;
          constraintFn({
            eq: (field: string, value: string) => {
              expect(field).toBe("ragId");
              matchedRagId = value;
              return { eq: () => {} };
            },
          });
          return {
            first: vi.fn(() =>
              matchedRagId && trackedRagIds.includes(matchedRagId)
                ? { _id: "tracked-row", ragId: matchedRagId }
                : null,
            ),
          };
        }),
      };
    }),
  };
  return { db } as any;
}

describe("auditRagReconciliation", () => {
  beforeEach(() => {
    vi.mocked(requireAdmin).mockClear();
    vi.mocked(rag.getNamespace).mockReset();
    vi.mocked(rag.list).mockReset();
  });

  it("enforces the admin gate before doing any work", async () => {
    vi.mocked(rag.getNamespace).mockResolvedValue(null);
    await (auditRagReconciliation as any).handler(makeCtx([]), {});
    expect(requireAdmin).toHaveBeenCalledTimes(1);
  });

  it("returns all-zero counts, isDone=true, when the namespace does not exist yet (nothing ever ingested)", async () => {
    vi.mocked(rag.getNamespace).mockResolvedValue(null);
    const result = await (auditRagReconciliation as any).handler(makeCtx([]), {});
    expect(result).toEqual({
      counts: {
        TRACKED_READY: 0,
        TRACKED_PENDING: 0,
        TRACKED_REPLACED_STALE: 0,
        UNTRACKED_READY: 0,
        UNTRACKED_PENDING: 0,
        UNTRACKED_REPLACED: 0,
      },
      entriesAudited: 0,
      sampleUntrackedReady: [],
      isDone: true,
      continueCursor: undefined,
    });
    expect(rag.list).not.toHaveBeenCalled();
  });

  it("categorizes all six TRACKED_*/UNTRACKED_* combinations correctly in one page", async () => {
    vi.mocked(rag.getNamespace).mockResolvedValue({ namespaceId: "ns-1" } as any);
    vi.mocked(rag.list).mockResolvedValue({
      page: [
        makeEntry({ entryId: "tracked-ready", status: "ready" }),
        makeEntry({ entryId: "tracked-pending", status: "pending" }),
        makeEntry({ entryId: "tracked-replaced", status: "replaced", replacedAt: 123 }),
        makeEntry({ entryId: "untracked-ready", status: "ready", key: "orphan-key" }),
        makeEntry({ entryId: "untracked-pending", status: "pending" }),
        makeEntry({ entryId: "untracked-replaced", status: "replaced", replacedAt: 456 }),
      ],
      isDone: true,
      continueCursor: "",
    } as any);

    const result = await (auditRagReconciliation as any).handler(
      makeCtx(["tracked-ready", "tracked-pending", "tracked-replaced"]),
      {},
    );

    expect(result.counts).toEqual({
      TRACKED_READY: 1,
      TRACKED_PENDING: 1,
      TRACKED_REPLACED_STALE: 1,
      UNTRACKED_READY: 1,
      UNTRACKED_PENDING: 1,
      UNTRACKED_REPLACED: 1,
    });
    expect(result.entriesAudited).toBe(6);
    expect(result.sampleUntrackedReady).toEqual([
      { entryId: "untracked-ready", key: "orphan-key" },
    ]);
    expect(result.isDone).toBe(true);
    expect(result.continueCursor).toBeUndefined();
  });

  it("caps sampleUntrackedReady at 20 even when more untracked-ready entries exist in the page", async () => {
    vi.mocked(rag.getNamespace).mockResolvedValue({ namespaceId: "ns-1" } as any);
    const page = Array.from({ length: 25 }, (_, i) =>
      makeEntry({ entryId: `untracked-${i}`, status: "ready" }),
    );
    vi.mocked(rag.list).mockResolvedValue({ page, isDone: true, continueCursor: "" } as any);

    const result = await (auditRagReconciliation as any).handler(makeCtx([]), {});

    expect(result.counts.UNTRACKED_READY).toBe(25);
    expect(result.sampleUntrackedReady).toHaveLength(20);
  });

  it("passes through isDone=false and continueCursor for the caller to page through", async () => {
    vi.mocked(rag.getNamespace).mockResolvedValue({ namespaceId: "ns-1" } as any);
    vi.mocked(rag.list).mockResolvedValue({
      page: [makeEntry({ entryId: "e1", status: "ready" })],
      isDone: false,
      continueCursor: "cursor-abc",
    } as any);

    const result = await (auditRagReconciliation as any).handler(makeCtx(["e1"]), {
      cursor: undefined,
      limit: 1,
    });

    expect(result.isDone).toBe(false);
    expect(result.continueCursor).toBe("cursor-abc");
    expect(rag.list).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        namespaceId: "ns-1",
        paginationOpts: { numItems: 1, cursor: null },
      }),
    );
  });

  it("clamps a caller-supplied limit above the page-size ceiling instead of trusting it directly", async () => {
    vi.mocked(rag.getNamespace).mockResolvedValue({ namespaceId: "ns-1" } as any);
    vi.mocked(rag.list).mockResolvedValue({ page: [], isDone: true, continueCursor: "" } as any);

    await (auditRagReconciliation as any).handler(makeCtx([]), { limit: 999999 });

    expect(rag.list).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ paginationOpts: expect.objectContaining({ numItems: 200 }) }),
    );
  });
});

describe("gcOrphanedRagEntries", () => {
  const NOW = 1_800_000_000_000;
  const GRACE_MS = 15 * 60 * 1000;

  beforeEach(() => {
    vi.mocked(requireAdmin).mockClear();
    vi.mocked(rag.getNamespace).mockReset();
    vi.mocked(rag.list).mockReset();
    vi.mocked(rag.deleteAsync).mockReset();
  });

  function makeGcEntry(overrides: any = {}) {
    return {
      entryId: "entry-1",
      key: "some-rag-version-key",
      importance: 1,
      filterValues: [],
      status: "ready",
      metadata: {},
      ...overrides,
    };
  }

  // Extends the auditRagReconciliation makeCtx pattern with ctx.db.get, which
  // gcOrphanedRagEntries additionally needs for its still-current-generation check.
  function makeGcCtx(
    trackedRagIds: string[],
    documentsById: Record<string, { ingestionGeneration: number }> = {},
  ) {
    const db = {
      query: vi.fn((table: string) => {
        expect(table).toBe("crawledChunks");
        return {
          withIndex: vi.fn((indexName: string, constraintFn: Function) => {
            expect(indexName).toBe("by_ragId");
            let matchedRagId: string | undefined;
            constraintFn({
              eq: (field: string, value: string) => {
                expect(field).toBe("ragId");
                matchedRagId = value;
                return { eq: () => {} };
              },
            });
            return {
              first: vi.fn(() =>
                matchedRagId && trackedRagIds.includes(matchedRagId)
                  ? { _id: "tracked-row", ragId: matchedRagId }
                  : null,
              ),
            };
          }),
        };
      }),
      get: vi.fn((id: string) => documentsById[id] ?? null),
    };
    return { db } as any;
  }

  it("enforces the admin gate before doing any work", async () => {
    vi.mocked(rag.getNamespace).mockResolvedValue(null);
    await (gcOrphanedRagEntries as any).handler(makeGcCtx([]), {});
    expect(requireAdmin).toHaveBeenCalledTimes(1);
  });

  it("defaults dryRun to true: reports a qualifying orphan without deleting it", async () => {
    const originalNow = Date.now;
    Date.now = () => NOW;
    try {
      vi.mocked(rag.getNamespace).mockResolvedValue({ namespaceId: "ns-1" } as any);
      vi.mocked(rag.list).mockResolvedValue({
        page: [
          makeGcEntry({
            entryId: "orphan-1",
            metadata: {
              documentId: "doc-x",
              baseChunkKey: "key-x",
              ingestionGeneration: 1,
              createdAtMs: NOW - GRACE_MS - 1000,
            },
          }),
        ],
        isDone: true,
        continueCursor: "",
      } as any);

      const result = await (gcOrphanedRagEntries as any).handler(makeGcCtx([], {}), {});

      expect(result.dryRun).toBe(true);
      expect(result.deletedOrWouldDelete).toEqual([
        { entryId: "orphan-1", key: "some-rag-version-key", reason: "untracked-ready-past-grace-period" },
      ]);
      expect(rag.deleteAsync).not.toHaveBeenCalled();
    } finally {
      Date.now = originalNow;
    }
  });

  it("dryRun:false actually deletes a provable orphan (untracked, past grace period, document moved on to a newer generation)", async () => {
    const originalNow = Date.now;
    Date.now = () => NOW;
    try {
      vi.mocked(rag.getNamespace).mockResolvedValue({ namespaceId: "ns-1" } as any);
      vi.mocked(rag.list).mockResolvedValue({
        page: [
          makeGcEntry({
            entryId: "orphan-2",
            metadata: {
              documentId: "doc-x",
              baseChunkKey: "key-x",
              ingestionGeneration: 1,
              createdAtMs: NOW - GRACE_MS - 1000,
            },
          }),
        ],
        isDone: true,
        continueCursor: "",
      } as any);

      const result = await (gcOrphanedRagEntries as any).handler(
        makeGcCtx([], { "doc-x": { ingestionGeneration: 2 } }),
        { dryRun: false },
      );

      expect(result.dryRun).toBe(false);
      expect(result.deletedOrWouldDelete).toHaveLength(1);
      expect(rag.deleteAsync).toHaveBeenCalledWith(expect.anything(), { entryId: "orphan-2" });
    } finally {
      Date.now = originalNow;
    }
  });

  it("never deletes an entry within the grace period, even if untracked", async () => {
    const originalNow = Date.now;
    Date.now = () => NOW;
    try {
      vi.mocked(rag.getNamespace).mockResolvedValue({ namespaceId: "ns-1" } as any);
      vi.mocked(rag.list).mockResolvedValue({
        page: [
          makeGcEntry({
            entryId: "too-recent",
            metadata: {
              documentId: "doc-x",
              baseChunkKey: "key-x",
              ingestionGeneration: 1,
              createdAtMs: NOW - 1000,
            },
          }),
        ],
        isDone: true,
        continueCursor: "",
      } as any);

      const result = await (gcOrphanedRagEntries as any).handler(makeGcCtx([]), { dryRun: false });

      expect(result.deletedOrWouldDelete).toHaveLength(0);
      expect(rag.deleteAsync).not.toHaveBeenCalled();
    } finally {
      Date.now = originalNow;
    }
  });

  it("never deletes an entry with no createdAtMs (age unprovable) - counts it in skippedNoAgeInfo", async () => {
    vi.mocked(rag.getNamespace).mockResolvedValue({ namespaceId: "ns-1" } as any);
    vi.mocked(rag.list).mockResolvedValue({
      page: [makeGcEntry({ entryId: "legacy-entry", metadata: {} })],
      isDone: true,
      continueCursor: "",
    } as any);

    const result = await (gcOrphanedRagEntries as any).handler(makeGcCtx([]), { dryRun: false });

    expect(result.deletedOrWouldDelete).toHaveLength(0);
    expect(result.skippedNoAgeInfo).toBe(1);
    expect(rag.deleteAsync).not.toHaveBeenCalled();
  });

  it("never deletes an entry whose document is STILL on that exact generation, even past the grace period (more likely mid-flight than orphaned)", async () => {
    const originalNow = Date.now;
    Date.now = () => NOW;
    try {
      vi.mocked(rag.getNamespace).mockResolvedValue({ namespaceId: "ns-1" } as any);
      vi.mocked(rag.list).mockResolvedValue({
        page: [
          makeGcEntry({
            entryId: "maybe-in-flight",
            metadata: {
              documentId: "doc-x",
              baseChunkKey: "key-x",
              ingestionGeneration: 2,
              createdAtMs: NOW - GRACE_MS - 1000,
            },
          }),
        ],
        isDone: true,
        continueCursor: "",
      } as any);

      const result = await (gcOrphanedRagEntries as any).handler(
        makeGcCtx([], { "doc-x": { ingestionGeneration: 2 } }),
        { dryRun: false },
      );

      expect(result.deletedOrWouldDelete).toHaveLength(0);
      expect(result.skippedStillCurrentGeneration).toBe(1);
      expect(rag.deleteAsync).not.toHaveBeenCalled();
    } finally {
      Date.now = originalNow;
    }
  });

  it("never touches a TRACKED entry regardless of its own status (a TRACKED_REPLACED_STALE is a signal for a human, not something GC auto-resolves)", async () => {
    vi.mocked(rag.getNamespace).mockResolvedValue({ namespaceId: "ns-1" } as any);
    vi.mocked(rag.list).mockResolvedValue({
      page: [
        makeGcEntry({
          entryId: "tracked-but-replaced",
          status: "replaced",
          replacedAt: 0, // as old as possible - would qualify by age alone
        }),
      ],
      isDone: true,
      continueCursor: "",
    } as any);

    const result = await (gcOrphanedRagEntries as any).handler(makeGcCtx(["tracked-but-replaced"]), {
      dryRun: false,
    });

    expect(result.deletedOrWouldDelete).toHaveLength(0);
    expect(rag.deleteAsync).not.toHaveBeenCalled();
  });

  it("deletes a genuinely UNTRACKED_REPLACED entry past its grace period using replacedAt directly, no metadata needed", async () => {
    vi.mocked(rag.getNamespace).mockResolvedValue({ namespaceId: "ns-1" } as any);
    vi.mocked(rag.list).mockResolvedValue({
      page: [
        makeGcEntry({
          entryId: "old-replaced-orphan",
          status: "replaced",
          replacedAt: 0,
          metadata: undefined,
        }),
      ],
      isDone: true,
      continueCursor: "",
    } as any);

    const result = await (gcOrphanedRagEntries as any).handler(makeGcCtx([]), { dryRun: false });

    expect(result.deletedOrWouldDelete).toEqual([
      {
        entryId: "old-replaced-orphan",
        key: "some-rag-version-key",
        reason: "untracked-replaced-past-grace-period",
      },
    ]);
    expect(rag.deleteAsync).toHaveBeenCalledWith(expect.anything(), { entryId: "old-replaced-orphan" });
  });

  it("never touches a still-pending entry", async () => {
    vi.mocked(rag.getNamespace).mockResolvedValue({ namespaceId: "ns-1" } as any);
    vi.mocked(rag.list).mockResolvedValue({
      page: [makeGcEntry({ entryId: "pending-1", status: "pending" })],
      isDone: true,
      continueCursor: "",
    } as any);

    const result = await (gcOrphanedRagEntries as any).handler(makeGcCtx([]), { dryRun: false });

    expect(result.deletedOrWouldDelete).toHaveLength(0);
    expect(rag.deleteAsync).not.toHaveBeenCalled();
  });
});

describe("gcOrphanedPendingChunkText", () => {
  // Reproduces the Part 15 retry-storm finding: no commit path deletes
  // pendingChunkText synchronously anymore (a same-generation chain link can
  // still need the shared staged row after an earlier link already
  // committed), so this GC sweep is the ONLY thing that ever removes these
  // rows. August 2026 incident remediation: stagePendingChunkText now
  // upserts by ragVersionKey and refreshes `updatedAt` on every Workpool
  // retry and DLQ re-enqueue, so the GC clock is `updatedAt ?? _creationTime`
  // (not _creationTime alone) - a row only ages out once retries genuinely
  // stop touching it, whether that's because the chunk succeeded or because
  // it was permanently abandoned to the DLQ.
  const NOW = 1_800_000_000_000;
  const GRACE_MS = 6 * 60 * 60 * 1000; // PENDING_CHUNK_TEXT_GC_GRACE_PERIOD_MS

  beforeEach(() => {
    vi.mocked(requireAdmin).mockClear();
  });

  function makePendingRow(overrides: any = {}) {
    return {
      _id: overrides._id ?? "staged-1",
      _creationTime: NOW,
      ragVersionKey: "some-rag-version-key",
      chunkText: "Some staged chunk text.",
      ...overrides,
    };
  }

  function makeGcTextCtx(rows: any[]) {
    const deleted: string[] = [];
    const db = {
      query: vi.fn((table: string) => {
        expect(table).toBe("pendingChunkText");
        return {
          paginate: vi.fn((opts: { numItems: number; cursor: string | null }) => ({
            page: rows,
            isDone: true,
            continueCursor: "",
          })),
        };
      }),
      delete: vi.fn((id: string) => {
        deleted.push(id);
      }),
    };
    return { ctx: { db } as any, deleted };
  }

  it("enforces the admin gate before doing any work", async () => {
    const { ctx } = makeGcTextCtx([]);
    await (gcOrphanedPendingChunkText as any).handler(ctx, {});
    expect(requireAdmin).toHaveBeenCalledTimes(1);
  });

  it("defaults dryRun to true: reports a qualifying orphan without deleting it", async () => {
    vi.spyOn(Date, "now").mockReturnValue(NOW + GRACE_MS + 1000);
    const { ctx, deleted } = makeGcTextCtx([
      makePendingRow({ _id: "old-staged", _creationTime: NOW }),
    ]);

    const result = await (gcOrphanedPendingChunkText as any).handler(ctx, {});

    expect(result.dryRun).toBe(true);
    expect(result.deletedOrWouldDelete).toBe(1);
    expect(deleted).toHaveLength(0);
    vi.spyOn(Date, "now").mockRestore();
  });

  it("dryRun:false actually deletes a row past the grace period", async () => {
    vi.spyOn(Date, "now").mockReturnValue(NOW + GRACE_MS + 1000);
    const { ctx, deleted } = makeGcTextCtx([
      makePendingRow({ _id: "old-staged", _creationTime: NOW }),
    ]);

    const result = await (gcOrphanedPendingChunkText as any).handler(ctx, { dryRun: false });

    expect(result.deletedOrWouldDelete).toBe(1);
    expect(deleted).toEqual(["old-staged"]);
    vi.spyOn(Date, "now").mockRestore();
  });

  it("never deletes a row within the grace period, even with dryRun:false (a same-generation commit chain may still be resolving)", async () => {
    vi.spyOn(Date, "now").mockReturnValue(NOW + 1000); // well within GRACE_MS
    const { ctx, deleted } = makeGcTextCtx([
      makePendingRow({ _id: "fresh-staged", _creationTime: NOW }),
    ]);

    const result = await (gcOrphanedPendingChunkText as any).handler(ctx, { dryRun: false });

    expect(result.deletedOrWouldDelete).toBe(0);
    expect(deleted).toHaveLength(0);
    vi.spyOn(Date, "now").mockRestore();
  });

  it("does not delete a row whose updatedAt was refreshed by a recent retry, even though it was originally staged long ago", async () => {
    // This is the scenario the whole updatedAt fix exists for: a chunk that
    // has been cycling through DLQ retries for hours has an old
    // _creationTime, but stagePendingChunkText refreshes updatedAt on every
    // retry attempt. The row must survive - "retryable intermediate failure
    // -> staging remains available when needed."
    vi.spyOn(Date, "now").mockReturnValue(NOW + GRACE_MS + 1000);
    const { ctx, deleted } = makeGcTextCtx([
      makePendingRow({
        _id: "actively-retrying",
        _creationTime: NOW - 20 * 60 * 60 * 1000, // staged 20h ago
        updatedAt: NOW + GRACE_MS - 1000, // but retried again just under a moment ago
      }),
    ]);

    const result = await (gcOrphanedPendingChunkText as any).handler(ctx, { dryRun: false });

    expect(result.deletedOrWouldDelete).toBe(0);
    expect(deleted).toHaveLength(0);
    vi.spyOn(Date, "now").mockRestore();
  });

  it("deletes a row once updatedAt itself goes past the grace period (success or terminal DLQ abandonment - nothing is retrying it anymore)", async () => {
    vi.spyOn(Date, "now").mockReturnValue(NOW + GRACE_MS + 1000);
    const { ctx, deleted } = makeGcTextCtx([
      makePendingRow({
        _id: "settled",
        _creationTime: NOW - 60 * 60 * 1000,
        updatedAt: NOW, // last touched exactly at NOW - now stale
      }),
    ]);

    const result = await (gcOrphanedPendingChunkText as any).handler(ctx, { dryRun: false });

    expect(result.deletedOrWouldDelete).toBe(1);
    expect(deleted).toEqual(["settled"]);
    vi.spyOn(Date, "now").mockRestore();
  });

  it("falls back to _creationTime for a legacy row with no updatedAt field", async () => {
    vi.spyOn(Date, "now").mockReturnValue(NOW + GRACE_MS + 1000);
    const { ctx, deleted } = makeGcTextCtx([
      makePendingRow({ _id: "legacy-row", _creationTime: NOW, updatedAt: undefined }),
    ]);

    const result = await (gcOrphanedPendingChunkText as any).handler(ctx, { dryRun: false });

    expect(result.deletedOrWouldDelete).toBe(1);
    expect(deleted).toEqual(["legacy-row"]);
    vi.spyOn(Date, "now").mockRestore();
  });

  it("handles a mix of fresh and orphaned rows in the same page correctly", async () => {
    vi.spyOn(Date, "now").mockReturnValue(NOW + GRACE_MS + 1000);
    const { ctx, deleted } = makeGcTextCtx([
      makePendingRow({ _id: "orphan-1", _creationTime: NOW }),
      makePendingRow({ _id: "fresh-1", _creationTime: NOW + GRACE_MS }), // still within grace relative to "now"
      makePendingRow({ _id: "orphan-2", _creationTime: NOW - 1000 }),
    ]);

    const result = await (gcOrphanedPendingChunkText as any).handler(ctx, { dryRun: false });

    expect(result.deletedOrWouldDelete).toBe(2);
    expect(deleted.sort()).toEqual(["orphan-1", "orphan-2"]);
    vi.spyOn(Date, "now").mockRestore();
  });
});
