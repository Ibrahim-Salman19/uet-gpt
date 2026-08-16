/**
 * tests/convex/crawl/workflow.test.ts
 *
 * Focused coverage for the bulk-operations kill-switch check added to
 * kickoffDailyCrawl (resource-safety mandate section 10, "before crawl
 * scheduling"). Cron-driven, so it skips quietly (returns null) rather than
 * throwing when disabled - see the comment in workflow.ts.
 */
vi.mock("../../../convex/_generated/server", () => ({
  internalMutation: (opts: { handler: Function }) => ({ handler: opts.handler }),
  // workflow.ts imports isBulkOperationsEnabled from bulkOperationsControl.ts,
  // which also exports an internalQuery - the mock must provide it even
  // though this file only directly needs internalMutation.
  internalQuery: (opts: { handler: Function }) => ({ handler: opts.handler }),
}));

vi.mock("../../../convex/crawl/workpools", () => ({
  crawlPool: { enqueueAction: vi.fn().mockResolvedValue("work-id-1") },
}));

import { beforeEach, describe, expect, it, vi } from "vitest";
import { crawlPool } from "../../../convex/crawl/workpools";

function createMockDb(resultMap: Record<string, any[]> = {}) {
  const tables: Record<string, any[]> = { ...resultMap };
  return {
    query: vi.fn((table: string) => {
      const rows = tables[table] ?? [];
      const chain: any = {
        withIndex: vi.fn((_name: string, builder: (q: any) => any) => {
          const predicates: Record<string, any> = {};
          builder({
            eq: (field: string, value: any) => {
              predicates[field] = value;
              return { eq: () => {} };
            },
          });
          const filtered = rows.filter((r) =>
            Object.entries(predicates).every(([k, v]) => r[k] === v),
          );
          return {
            first: vi.fn(async () => filtered[0] ?? null),
            unique: vi.fn(async () => filtered[0] ?? null),
            order: vi.fn(() => ({ first: vi.fn(async () => filtered[0] ?? null) })),
          };
        }),
      };
      return chain;
    }),
    insert: vi.fn(async () => "new-job-id"),
  };
}

describe("crawl/workflow.ts: kickoffDailyCrawl", () => {
  let handler: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    (crawlPool.enqueueAction as any).mockResolvedValue("work-id-1");
    const mod = await import("../../../convex/crawl/workflow");
    handler = mod.kickoffDailyCrawl;
  });

  it("skips quietly (returns null, no crawlJobs query, no enqueue) when bulk operations are disabled", async () => {
    const db = createMockDb({
      bulkOperationsControl: [{ _id: "row-1", key: "global", enabled: false }],
      crawlJobs: [],
    });
    const ctx = { db };

    const result = await (handler as any).handler(ctx);

    expect(result).toBeNull();
    expect(db.query).not.toHaveBeenCalledWith("crawlJobs");
    expect(crawlPool.enqueueAction).not.toHaveBeenCalled();
  });

  it("proceeds to the normal idempotency checks when bulk operations are enabled (absent row)", async () => {
    const db = createMockDb({ bulkOperationsControl: [], crawlJobs: [] });
    const ctx = { db };

    await (handler as any).handler(ctx);

    expect(db.query).toHaveBeenCalledWith("crawlJobs");
    expect(crawlPool.enqueueAction).toHaveBeenCalledTimes(1);
  });

  it("still respects the pre-existing running-job guard when bulk operations are enabled", async () => {
    const db = createMockDb({
      bulkOperationsControl: [],
      crawlJobs: [{ _id: "job-1", status: "running" }],
    });
    const ctx = { db };

    const result = await (handler as any).handler(ctx);

    expect(result).toBeNull();
    expect(crawlPool.enqueueAction).not.toHaveBeenCalled();
  });
});
