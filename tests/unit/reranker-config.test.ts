import { describe, expect, it } from "vitest";
import { CASCADE_CONFIG } from "../../convex/rag/constants";

describe("Cohere reranker configuration contract", () => {
  it("uses the correct Cohere model version rerank-v4.0-fast", () => {
    expect(CASCADE_CONFIG.cohereModel).toBe("rerank-v4.0-fast");
  });

  it("uses the official Cohere v2 rerank API endpoint", () => {
    expect(CASCADE_CONFIG.cohereEndpoint).toBe("https://api.cohere.com/v2/rerank");
  });

  it("has calibrated candidate limit within bounds", () => {
    expect(CASCADE_CONFIG.tier2CandidateCount).toBeGreaterThanOrEqual(5);
    expect(CASCADE_CONFIG.tier2CandidateCount).toBeLessThanOrEqual(50);
  });
});
