import { describe, expect, it } from "vitest";
import { pickLeastRejectedIndex } from "../../convex/rag/retrieval";

// Mirrors the F-1 pool measured in production: ranks 0-1 are the M.Sc./Ph.D. fee
// tables (0.850/0.800), rank 3 is the undergraduate FAQ answer at 0.550.
const FEE_POOL_VERDICTS = [
  { index: 0, relevant: false, confidence: 0.95 }, // M.Sc. fee table
  { index: 1, relevant: false, confidence: 0.9 }, // Ph.D. fee table
  { index: 2, relevant: false, confidence: 0.8 }, // downloads link manifest
  { index: 3, relevant: false, confidence: 0.2 }, // the UG FAQ answer
];

describe("pickLeastRejectedIndex", () => {
  it("never falls back to the rerank's top hit when CRAG rejected it hardest", () => {
    const kept = pickLeastRejectedIndex(FEE_POOL_VERDICTS, 4);
    expect(kept).not.toBe(0);
    expect(kept).toBe(3);
  });

  it("picks the lowest rejection confidence regardless of rank order", () => {
    expect(
      pickLeastRejectedIndex(
        [
          { index: 0, relevant: false, confidence: 0.4 },
          { index: 1, relevant: false, confidence: 0.1 },
          { index: 2, relevant: false, confidence: 0.6 },
        ],
        3,
      ),
    ).toBe(1);
  });

  it("still yields a chunk when EVERY rejection is high-confidence (the allIrrelevant case)", () => {
    // Production 2026-09-18: the forced judge returned allIrrelevant on a pool the
    // reranker had scored 0.7, and the refusal reached the user. That branch now
    // hedges instead, so the keep-rule must produce a real index here, never -1.
    const allHighConfidence = [
      { index: 0, relevant: false, confidence: 0.95 },
      { index: 1, relevant: false, confidence: 0.75 },
      { index: 2, relevant: false, confidence: 0.9 },
      { index: 3, relevant: false, confidence: 0.85 },
    ];
    expect(pickLeastRejectedIndex(allHighConfidence, 4)).toBe(1);
  });

  it("returns -1 when there is nothing rejected to fall back to", () => {
    expect(pickLeastRejectedIndex([], 0)).toBe(-1);
    expect(pickLeastRejectedIndex([], 3)).toBe(-1);
  });

  it("ignores chunks CRAG judged relevant", () => {
    expect(
      pickLeastRejectedIndex(
        [
          { index: 0, relevant: true, confidence: 0.05 },
          { index: 1, relevant: false, confidence: 0.3 },
        ],
        2,
      ),
    ).toBe(1);
  });

  it("ignores verdicts for indices outside the pool", () => {
    expect(
      pickLeastRejectedIndex(
        [
          { index: 0, relevant: false, confidence: 0.9 },
          { index: 7, relevant: false, confidence: 0.01 },
        ],
        1,
      ),
    ).toBe(0);
  });

  it("breaks ties on the earlier rank", () => {
    expect(
      pickLeastRejectedIndex(
        [
          { index: 0, relevant: false, confidence: 0.5 },
          { index: 1, relevant: false, confidence: 0.5 },
        ],
        2,
      ),
    ).toBe(0);
  });
});
