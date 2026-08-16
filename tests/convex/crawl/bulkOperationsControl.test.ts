/**
 * tests/convex/crawl/bulkOperationsControl.test.ts
 *
 * August 2026 incident remediation: the durable, server-side kill switch
 * (resource-safety mandate section 40 - "must not depend only on process
 * memory"). Proves: absent row -> enabled (normal state, not unsafe/unknown);
 * enabled:false -> assertBulkOperationsEnabled rejects; setBulkOperationsEnabled
 * upserts correctly; checkBulkOperationsEnabled (the internalQuery actions use)
 * matches isBulkOperationsEnabled exactly.
 */
vi.mock("../../../convex/_generated/server", () => ({
  internalMutation: (opts: { handler: Function }) => ({ handler: opts.handler }),
  internalQuery: (opts: { handler: Function }) => ({ handler: opts.handler }),
}));

import { describe, expect, it, vi } from "vitest";
import {
  assertBulkOperationsEnabled,
  checkBulkOperationsEnabled,
  isBulkOperationsEnabled,
  setBulkOperationsEnabled,
} from "../../../convex/crawl/bulkOperationsControl";

function createMockDb(row: any = null) {
  const tables: { bulkOperationsControl: any[] } = {
    bulkOperationsControl: row ? [row] : [],
  };
  return {
    query: vi.fn((table: string) => ({
      withIndex: vi.fn((_name: string, builder: (q: any) => any) => {
        const predicates: Record<string, any> = {};
        builder({
          eq: (field: string, value: any) => {
            predicates[field] = value;
            return { eq: () => {} };
          },
        });
        const filtered = (tables as any)[table].filter((r: any) =>
          Object.entries(predicates).every(([k, v]) => r[k] === v),
        );
        return { unique: vi.fn(async () => filtered[0] ?? null) };
      }),
    })),
    insert: vi.fn(async (table: string, doc: any) => {
      const id = "row-" + Math.random().toString(36).slice(2, 8);
      (tables as any)[table].push({ _id: id, _creationTime: Date.now(), ...doc });
      return id;
    }),
    patch: vi.fn(async (id: string, updates: any) => {
      const idx = tables.bulkOperationsControl.findIndex((r) => r._id === id);
      if (idx !== -1) tables.bulkOperationsControl[idx] = { ...tables.bulkOperationsControl[idx], ...updates };
    }),
    _tables: tables,
  };
}

describe("bulkOperationsControl", () => {
  it("isBulkOperationsEnabled defaults to true when no row exists (normal state, not unknown/unsafe)", async () => {
    const db = createMockDb(null);
    expect(await isBulkOperationsEnabled({ db } as any)).toBe(true);
  });

  it("isBulkOperationsEnabled reflects an explicit enabled:false row", async () => {
    const db = createMockDb({ _id: "row-1", key: "global", enabled: false });
    expect(await isBulkOperationsEnabled({ db } as any)).toBe(false);
  });

  it("isBulkOperationsEnabled reflects an explicit enabled:true row", async () => {
    const db = createMockDb({ _id: "row-1", key: "global", enabled: true });
    expect(await isBulkOperationsEnabled({ db } as any)).toBe(true);
  });

  it("assertBulkOperationsEnabled does not throw when enabled", async () => {
    const db = createMockDb(null);
    await expect(assertBulkOperationsEnabled({ db } as any)).resolves.toBeUndefined();
  });

  it("assertBulkOperationsEnabled throws when disabled", async () => {
    const db = createMockDb({ _id: "row-1", key: "global", enabled: false });
    await expect(assertBulkOperationsEnabled({ db } as any)).rejects.toThrow(/disabled/i);
  });

  it("checkBulkOperationsEnabled (the internalQuery actions use via ctx.runQuery) matches isBulkOperationsEnabled", async () => {
    const db = createMockDb({ _id: "row-1", key: "global", enabled: false });
    const result = await (checkBulkOperationsEnabled as any).handler({ db }, {});
    expect(result).toBe(false);
  });

  it("setBulkOperationsEnabled inserts a new row when none exists", async () => {
    const db = createMockDb(null);
    await (setBulkOperationsEnabled as any).handler({ db }, {
      enabled: false,
      reason: "test stop",
      updatedBy: "user-1",
    });

    expect(db.insert).toHaveBeenCalledWith(
      "bulkOperationsControl",
      expect.objectContaining({ key: "global", enabled: false, reason: "test stop" }),
    );
    expect(await isBulkOperationsEnabled({ db } as any)).toBe(false);
  });

  it("setBulkOperationsEnabled patches the existing row instead of creating a second one", async () => {
    const db = createMockDb({ _id: "row-1", key: "global", enabled: true });
    await (setBulkOperationsEnabled as any).handler({ db }, {
      enabled: false,
      reason: "test stop",
      updatedBy: "user-1",
    });

    expect(db.insert).not.toHaveBeenCalled();
    expect(db.patch).toHaveBeenCalledWith("row-1", expect.objectContaining({ enabled: false }));
    expect(db._tables.bulkOperationsControl).toHaveLength(1);
  });

  it("setBulkOperationsEnabled(true) re-enables after a prior disable", async () => {
    const db = createMockDb({ _id: "row-1", key: "global", enabled: false });
    await (setBulkOperationsEnabled as any).handler({ db }, { enabled: true, reason: "resume" });

    expect(await isBulkOperationsEnabled({ db } as any)).toBe(true);
  });
});
