/**
 * tests/convex/governance/freshnessSweep.test.ts
 *
 * August 2026 incident remediation: runFreshnessSweepBatch previously had no
 * auth check (any client holding the public Convex URL could call it) and no
 * upper bound on batchSize. It is now internalMutation (not reachable by any
 * client, the narrowest access model - Convex enforces this structurally,
 * not something a unit test re-verifies) with a hard batchSize ceiling.
 */
vi.mock("../../../convex/_generated/server", () => ({
  internalMutation: (opts: { handler: Function }) => ({ handler: opts.handler }),
}));

import { describe, expect, it, vi } from "vitest";
import { runFreshnessSweepBatch } from "../../../convex/governance/freshnessSweep";

function makeDoc(overrides: any = {}) {
  return {
    _id: overrides._id ?? `doc-${Math.random().toString(36).slice(2, 8)}`,
    status: "indexed",
    freshnessTier: "medium",
    updatedAt: Date.now(),
    crawledAt: Date.now(),
    ...overrides,
  };
}

function createMockDb(documents: any[]) {
  const patched: Record<string, any> = {};
  return {
    query: vi.fn(() => ({
      withIndex: vi.fn(() => ({
        take: vi.fn(async (n: number) => documents.slice(0, n)),
      })),
    })),
    patch: vi.fn(async (id: string, updates: any) => {
      patched[id] = updates;
    }),
    _patched: patched,
  };
}

describe("runFreshnessSweepBatch", () => {
  it("caps an oversized requested batchSize at the hard ceiling instead of honoring it verbatim", async () => {
    const manyDocs = Array.from({ length: 10_000 }, () => makeDoc());
    const db = createMockDb(manyDocs);
    const takeSpy = db.query().withIndex().take;

    await (runFreshnessSweepBatch as any).handler({ db } as any, { batchSize: 100_000 });

    // The .take() call must have been bounded, not passed 100,000 verbatim.
    expect(takeSpy).toHaveBeenCalled();
    const requested = takeSpy.mock.calls[0]![0];
    expect(requested).toBeLessThanOrEqual(500);
  });

  it("still honors a reasonable requested batchSize below the ceiling", async () => {
    const db = createMockDb([makeDoc(), makeDoc()]);
    const takeSpy = db.query().withIndex().take;

    await (runFreshnessSweepBatch as any).handler({ db } as any, { batchSize: 50 });

    expect(takeSpy).toHaveBeenCalledWith(50);
  });

  it("defaults to 100 when no batchSize is given", async () => {
    const db = createMockDb([makeDoc()]);
    const takeSpy = db.query().withIndex().take;

    await (runFreshnessSweepBatch as any).handler({ db } as any, {});

    expect(takeSpy).toHaveBeenCalledWith(100);
  });

  it("flags aged documents and clears fresh ones based on freshnessTier TTL", async () => {
    const now = Date.now();
    const aged = makeDoc({ _id: "aged-1", freshnessTier: "high", updatedAt: now - 20 * 24 * 60 * 60 * 1000 });
    const fresh = makeDoc({ _id: "fresh-1", freshnessTier: "high", updatedAt: now });
    const db = createMockDb([aged, fresh]);

    const result = await (runFreshnessSweepBatch as any).handler({ db } as any, {});

    expect(result.flaggedAged).toBe(1);
    expect(result.clearedFresh).toBe(1);
    expect(db._patched["aged-1"]).toEqual(expect.objectContaining({ isStale: true }));
    expect(db._patched["fresh-1"]).toEqual(expect.objectContaining({ isStale: false }));
  });
});
