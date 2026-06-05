import { describe, expect, it } from "vitest";
import { hybridRank } from "../../convex/embeddings/search";

describe("hybridRank (Reciprocal Rank Fusion)", () => {
  it("correctly fuses vector and text search results with default k=20", () => {
    const vectorRes = [
      { id: "doc_a", score: 0.9 },
      { id: "doc_b", score: 0.8 },
    ];
    const textRes = [
      { id: "doc_b", score: 0.95 },
      { id: "doc_c", score: 0.7 },
    ];

    const fused = hybridRank(vectorRes, textRes, 20);

    // doc_b is in both, so it should have a higher fused score than doc_a and doc_c
    expect(fused[0]!.id).toBe("doc_b");
    
    // Default k = 20
    // doc_b ranks: vector=1 (index 1), text=0 (index 0)
    // score_b = 1/(20 + 1) + 1/(20 + 0) = 1/21 + 1/20 = 0.0476 + 0.05 = 0.0976
    // doc_a ranks: vector=0, text=none
    // score_a = 1/(20 + 0) = 1/20 = 0.05
    // doc_c ranks: vector=none, text=1
    // score_c = 1/(20 + 1) = 1/21 = 0.0476
    
    expect(fused[0]!.id).toBe("doc_b");
    expect(fused[1]!.id).toBe("doc_a");
    expect(fused[2]!.id).toBe("doc_c");
    
    expect(fused[0]!.score).toBeCloseTo(1/21 + 1/20, 6);
    expect(fused[1]!.score).toBeCloseTo(1/20, 6);
    expect(fused[2]!.score).toBeCloseTo(1/21, 6);
  });

  it("respects custom k parameter", () => {
    const vectorRes = [{ id: "doc_a", score: 0.9 }];
    const textRes = [{ id: "doc_b", score: 0.95 }];
    
    const fused = hybridRank(vectorRes, textRes, 60);
    expect(fused[0]!.score).toBeCloseTo(1/60, 6);
  });

  it("respects custom weights", () => {
    const vectorRes = [{ id: "doc_a", score: 0.9 }];
    const textRes = [{ id: "doc_b", score: 0.95 }];
    
    const fused = hybridRank(vectorRes, textRes, 20, { vector: 2.0, text: 0.5 });
    
    // doc_a (vector, rank 0): score = 2.0 / 20 = 0.10
    // doc_b (text, rank 0): score = 0.5 / 20 = 0.025
    expect(fused[0]!.id).toBe("doc_a");
    expect(fused[0]!.score).toBeCloseTo(0.10, 6);
    expect(fused[1]!.id).toBe("doc_b");
    expect(fused[1]!.score).toBeCloseTo(0.025, 6);
  });
});
