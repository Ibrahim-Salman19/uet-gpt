import { describe, expect, it } from "vitest";
import { evaluateEvidenceGate } from "../../convex/governance/evidenceGate";

describe("EvidenceGate Evaluator", () => {
  it("refuses when no evidence candidates are provided", () => {
    const res = evaluateEvidenceGate({
      queryRisk: "high_current",
      temporalIntent: "current",
      candidates: [],
    });
    expect(res.decision).toBe("refuse");
    expect(res.reasonCode).toBe("NO_ELIGIBLE_EVIDENCE");
  });

  it("abstains on high_current query without fresh primary evidence", () => {
    const res = evaluateEvidenceGate({
      queryRisk: "high_current",
      temporalIntent: "current",
      candidates: [
        {
          id: "doc1",
          authority: "official_secondary",
          freshnessState: "aged",
          applicability: "current",
        },
      ],
    });
    expect(res.decision).toBe("abstain");
    expect(res.reasonCode).toBe("HIGH_CURRENT_NO_FRESH_PRIMARY_SOURCE");
  });

  it("allows answer on high_current query with fresh primary evidence", () => {
    const res = evaluateEvidenceGate({
      queryRisk: "high_current",
      temporalIntent: "current",
      candidates: [
        {
          id: "doc1",
          authority: "official_primary",
          freshnessState: "fresh",
          applicability: "current",
        },
      ],
    });
    expect(res.decision).toBe("answer");
    expect(res.reasonCode).toBe("APPROVED_FOR_GENERATION");
  });

  it("abstains when temporal conflict is detected", () => {
    const res = evaluateEvidenceGate({
      queryRisk: "medium_current",
      temporalIntent: "current",
      candidates: [
        {
          id: "doc1",
          authority: "official_primary",
          freshnessState: "fresh",
          applicability: "current",
          hasConflict: true,
        },
      ],
    });
    expect(res.decision).toBe("abstain");
    expect(res.reasonCode).toBe("TEMPORAL_CONFLICT_UNRESOLVED");
  });

  it("returns historical_answer for historical temporal intent", () => {
    const res = evaluateEvidenceGate({
      queryRisk: "historical",
      temporalIntent: "historical",
      candidates: [
        {
          id: "doc_archive",
          authority: "official_archive",
          freshnessState: "aged",
          applicability: "historical",
        },
      ],
    });
    expect(res.decision).toBe("historical_answer");
    expect(res.reasonCode).toBe("APPROVED_FOR_GENERATION");
  });
});
