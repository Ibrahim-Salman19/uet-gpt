import { describe, expect, it } from "vitest";
import { hybridRank } from "../../convex/embeddings/search";

describe("hybridRank (Reciprocal Rank Fusion)", () => {
  it("correctly fuses vector and text search results with the production default k=60", () => {
    // The production RRF constant (convex/embeddings/search.ts: RRF_K) is 60,
    // matching the value from the original RRF paper (Cormack et al.) and the
    // RAG-rubric recommendation. Pin the test to that same default rather than
    // an ad-hoc smaller k so the fusion contract reflects the real code path.
    const k = 60;
    const vectorRes = [
      { id: "doc_a", score: 0.9 },
      { id: "doc_b", score: 0.8 },
    ];
    const textRes = [
      { id: "doc_b", score: 0.95 },
      { id: "doc_c", score: 0.7 },
    ];

    const fused = hybridRank(vectorRes, textRes, k);

    // doc_b is in both, so it should have a higher fused score than doc_a and doc_c
    // doc_b ranks: vector=1 (index 1), text=0 (index 0)
    // score_b = 1/(60 + 1) + 1/(60 + 0) = 1/61 + 1/60
    // doc_a ranks: vector=0, text=none -> score_a = 1/(60 + 0) = 1/60
    // doc_c ranks: vector=none, text=1 -> score_c = 1/(60 + 1) = 1/61
    expect(fused[0]!.id).toBe("doc_b");
    expect(fused[1]!.id).toBe("doc_a");
    expect(fused[2]!.id).toBe("doc_c");

    expect(fused[0]!.score).toBeCloseTo(1 / (k + 1) + 1 / k, 6);
    expect(fused[1]!.score).toBeCloseTo(1 / k, 6);
    expect(fused[2]!.score).toBeCloseTo(1 / (k + 1), 6);
  });

  it("respects custom k parameter", () => {
    const vectorRes = [{ id: "doc_a", score: 0.9 }];
    const textRes = [{ id: "doc_b", score: 0.95 }];

    const fused = hybridRank(vectorRes, textRes, 60);
    expect(fused[0]!.score).toBeCloseTo(1 / 60, 6);
  });

  it("respects custom weights", () => {
    const vectorRes = [{ id: "doc_a", score: 0.9 }];
    const textRes = [{ id: "doc_b", score: 0.95 }];

    const fused = hybridRank(vectorRes, textRes, 20, { vector: 2.0, text: 0.5 });

    // doc_a (vector, rank 0): score = 2.0 / 20 = 0.10
    // doc_b (text, rank 0): score = 0.5 / 20 = 0.025
    expect(fused[0]!.id).toBe("doc_a");
    expect(fused[0]!.score).toBeCloseTo(0.1, 6);
    expect(fused[1]!.id).toBe("doc_b");
    expect(fused[1]!.score).toBeCloseTo(0.025, 6);
  });
});
