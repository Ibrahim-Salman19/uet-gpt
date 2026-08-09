import { describe, expect, it } from "vitest";
import {
  calculateCitationCorrectness,
  calculateMRR,
  calculateRecallAtK,
  calculateUnsupportedClaimRate,
  computeEvaluationMetrics,
} from "../../convex/evaluation/metrics";

describe("Phase 4: Metrics & Observability", () => {
  it("calculates Recall@K and MRR accurately", () => {
    const retrieved = ["doc1", "doc2", "doc3", "doc4"];
    const groundTruth = ["doc3", "doc5"];

    const recall = calculateRecallAtK(retrieved, groundTruth);
    expect(recall).toBe(0.5); // 1 out of 2 matched

    const mrr = calculateMRR(retrieved, groundTruth);
    expect(mrr).toBe(1 / 3); // doc3 is at rank 3
  });

  it("calculates citation correctness for official hosts", () => {
    const cited = [
      "https://uettaxila.edu.pk/admissions/fees.html",
      "https://subdomain.uet.edu.pk/notice.asp",
      "https://malicious-site.com/fake-uet",
    ];

    const correctness = calculateCitationCorrectness(cited);
    expect(correctness).toBeCloseTo(2 / 3);
  });

  it("calculates unsupported claim rate and groundedness score", () => {
    const claims = [
      { text: "Fee is 85,000 PKR", supportedByEvidence: true },
      { text: "Deadline is August 15", supportedByEvidence: true },
      { text: "Classes start in January", supportedByEvidence: false },
    ];

    const rate = calculateUnsupportedClaimRate(claims);
    expect(rate).toBeCloseTo(1 / 3);

    const metrics = computeEvaluationMetrics({
      retrievedDocIds: ["doc1", "doc2"],
      groundTruthDocIds: ["doc1"],
      citedUrls: ["https://uettaxila.edu.pk/fees.html"],
      claims,
    });

    expect(metrics.recallAtK).toBe(1.0);
    expect(metrics.mrr).toBe(1.0);
    expect(metrics.citationCorrectness).toBe(1.0);
    expect(metrics.groundednessScore).toBeCloseTo(2 / 3);
  });
});
