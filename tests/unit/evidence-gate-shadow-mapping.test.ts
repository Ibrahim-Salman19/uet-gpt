// Verifies the mapping introduced by the Sept 2026 retrieval-pipeline
// remediation plan's Phase 3 (evidence-gate shadow-mode wiring):
// buildEvidenceGateInput (convex/rag/retrieval.ts) turns a live query +
// search results into evaluateEvidenceGate's input shape. This is the part
// with real risk of being wrong - an incorrect authority/queryRisk mapping
// could make every high_current query (admissions deadlines) abstain, which
// evaluateEvidenceGate's own existing unit tests (evidence-gate.test.ts)
// can't catch since they exercise the gate directly with already-correct
// inputs, not the mapping that produces those inputs from real data.
import { describe, expect, it } from "vitest";
import { evaluateEvidenceGate } from "../../convex/governance/evidenceGate";
import { buildEvidenceGateInput } from "../../convex/rag/retrieval";
import { isOfficialUrlAllowed } from "../../convex/verification/officialSourceVerifier";

const OFFICIAL_URL = "https://admissions.uettaxila.edu.pk/Schedule.php";
const NON_OFFICIAL_URL = "https://example.com/uet-taxila-mirror/schedule";

describe("buildEvidenceGateInput (evidence-gate shadow mapping)", () => {
  it("classifies a UET domain as official and a non-UET domain as not", () => {
    expect(isOfficialUrlAllowed(OFFICIAL_URL)).toBe(true);
    expect(isOfficialUrlAllowed(NON_OFFICIAL_URL)).toBe(false);
  });

  it("does NOT abstain on a high-impact query with a fresh official source", () => {
    const input = buildEvidenceGateInput("What is the last date to apply for admission?", [
      {
        entryId: "doc1",
        url: OFFICIAL_URL,
        title: "Admissions Schedule",
        relevanceScore: 0.9,
        content: "The entry test is scheduled for October 15.",
        freshnessState: "fresh",
        applicability: "current",
      },
    ]);

    expect(input.queryRisk).toBe("high_current");
    const verdict = evaluateEvidenceGate(input);
    expect(verdict.decision).not.toBe("abstain");
    expect(verdict.decision).not.toBe("refuse");
  });

  it("DOES abstain on a high-impact query with only a non-official/aged source", () => {
    const input = buildEvidenceGateInput("What is the admission fee deadline?", [
      {
        entryId: "doc2",
        url: NON_OFFICIAL_URL,
        title: "Third-party mirror",
        relevanceScore: 0.8,
        content: "The fee deadline was some date.",
        freshnessState: "aged",
        applicability: "current",
      },
    ]);

    expect(input.queryRisk).toBe("high_current");
    const verdict = evaluateEvidenceGate(input);
    expect(verdict.decision).toBe("abstain");
    expect(verdict.reasonCode).toBe("HIGH_CURRENT_NO_FRESH_PRIMARY_SOURCE");
  });

  it("maps a low-impact query to low_current/unknown temporal intent", () => {
    const input = buildEvidenceGateInput("Tell me about the library facilities", [
      {
        entryId: "doc3",
        url: OFFICIAL_URL,
        title: "Library",
        relevanceScore: 0.7,
        content: "The library is open daily.",
        freshnessState: "fresh",
        applicability: "current",
      },
    ]);

    expect(input.queryRisk).toBe("low_current");
    expect(input.temporalIntent).toBe("unknown");
  });

  it("narrows missing/unrecognized freshnessState and applicability to 'unknown' rather than throwing", () => {
    const input = buildEvidenceGateInput("What is the merit list schedule?", [
      {
        entryId: "doc4",
        url: OFFICIAL_URL,
        title: "Merit List",
        relevanceScore: 0.5,
        content: "Merit lists are published in phases.",
        freshnessState: undefined,
        applicability: undefined,
      },
    ]);

    expect(input.candidates[0]?.freshnessState).toBe("unknown");
    expect(input.candidates[0]?.applicability).toBe("unknown");
  });
});
