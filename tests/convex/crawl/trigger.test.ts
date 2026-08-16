/**
 * tests/convex/crawl/trigger.test.ts
 *
 * August 2026 incident remediation regressions for crawl/trigger.ts:
 *   - the duplicate-crawl guard must reject both "pending" AND "running"
 *     jobs (previously only checked "pending", so executeCrawlJob flipping
 *     a job to "running" almost immediately meant repeated trigger() calls
 *     were not actually blocked)
 *   - the bulk-operations kill switch must block trigger() when disabled
 */
vi.mock("../../../convex/_generated/server", () => ({
  mutation: (opts: { handler: Function }) => ({ handler: opts.handler }),
  internalMutation: (opts: { handler: Function }) => ({ handler: opts.handler }),
  internalQuery: (opts: { handler: Function }) => ({ handler: opts.handler }),
}));

vi.mock("../../../convex/auth", () => ({
  requireAdmin: vi.fn().mockResolvedValue({ _id: "admin-1", role: "admin" }),
}));

vi.mock("../../../convex/crawl/workpools", () => ({
  crawlPool: {
    enqueueAction: vi.fn().mockResolvedValue("work-id-1"),
  },
}));

import { beforeEach, describe, expect, it, vi } from "vitest";
import { requireAdmin } from "../../../convex/auth";
import { crawlPool } from "../../../convex/crawl/workpools";

function createMockDb(resultMap: Record<string, any[]> = {}) {
  const tables: Record<string, any[]> = { ...resultMap };
  return {
    query: vi.fn((table: string) => {
      const rows = tables[table] ?? [];
      const chain: any = {
        withIndex: vi.fn((_name: string, builder: (q: any) => any) => {
          const predicates: Record<string, any> = {};
          const q = {
            eq: (field: string, value: any) => {
              predicates[field] = value;
              return q;
            },
          };
          builder(q);
          const filtered = rows.filter((r) =>
            Object.entries(predicates).every(([k, v]) => r[k] === v),
          );
          return {
            first: vi.fn(async () => filtered[0] ?? null),
            unique: vi.fn(async () => filtered[0] ?? null),
          };
        }),
      };
      return chain;
    }),
    insert: vi.fn(async (_table: string, _doc: any) => "new-job-id"),
  };
}

describe("crawl/trigger.ts: trigger", () => {
  let handler: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.mocked(requireAdmin).mockResolvedValue({ _id: "admin-1", role: "admin" } as any);
    (crawlPool.enqueueAction as any).mockResolvedValue("work-id-1");
    const mod = await import("../../../convex/crawl/trigger");
    handler = mod.trigger;
  });

  async function bulkOpsMockDb(overrides: Record<string, any[]> = {}) {
    // trigger.ts's assertBulkOperationsEnabled reads bulkOperationsControl -
    // absent row means enabled (see schema.ts's documented default).
    return createMockDb({ bulkOperationsControl: [], crawlJobs: [], ...overrides });
  }

  it("starts a crawl when nothing is pending or running", async () => {
    const db = await bulkOpsMockDb();
    const ctx = { db, auth: { getUserIdentity: vi.fn() } };

    const jobId = await (handler as any).handler(ctx, { url: "https://web.uettaxila.edu.pk/" });

    expect(jobId).toBe("new-job-id");
    expect(crawlPool.enqueueAction).toHaveBeenCalledTimes(1);
  });

  it("rejects a new trigger when a job is already pending", async () => {
    const db = await bulkOpsMockDb({
      crawlJobs: [{ _id: "job-1", status: "pending" }],
    });
    const ctx = { db, auth: { getUserIdentity: vi.fn() } };

    await expect(
      (handler as any).handler(ctx, { url: "https://web.uettaxila.edu.pk/" }),
    ).rejects.toThrow(/pending or running/i);
    expect(crawlPool.enqueueAction).not.toHaveBeenCalled();
  });

  it("rejects a new trigger when a job is already running (the actual gap this fix closes)", async () => {
    const db = await bulkOpsMockDb({
      crawlJobs: [{ _id: "job-1", status: "running" }],
    });
    const ctx = { db, auth: { getUserIdentity: vi.fn() } };

    await expect(
      (handler as any).handler(ctx, { url: "https://web.uettaxila.edu.pk/" }),
    ).rejects.toThrow(/pending or running/i);
    expect(crawlPool.enqueueAction).not.toHaveBeenCalled();
  });

  it("rejects starting a crawl when the bulk-operations kill switch is disabled", async () => {
    const db = await bulkOpsMockDb({
      bulkOperationsControl: [{ _id: "row-1", key: "global", enabled: false }],
    });
    const ctx = { db, auth: { getUserIdentity: vi.fn() } };

    await expect(
      (handler as any).handler(ctx, { url: "https://web.uettaxila.edu.pk/" }),
    ).rejects.toThrow(/disabled/i);
    expect(crawlPool.enqueueAction).not.toHaveBeenCalled();
  });

  it("still requires admin even when nothing is pending/running and the switch is enabled", async () => {
    vi.mocked(requireAdmin).mockRejectedValue(new Error("Admin access required"));
    const db = await bulkOpsMockDb();
    const ctx = { db, auth: { getUserIdentity: vi.fn() } };

    await expect(
      (handler as any).handler(ctx, { url: "https://web.uettaxila.edu.pk/" }),
    ).rejects.toThrow(/admin/i);
    expect(crawlPool.enqueueAction).not.toHaveBeenCalled();
  });
});
