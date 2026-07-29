import { describe, expect, it } from "vitest";
import {
  detectFactConflict,
  normalizeCurrency,
  normalizeDate,
  normalizePercentage,
} from "../../convex/verification/conflictDetector";

describe("Deterministic Conflict Detector", () => {
  it("normalizes currency expressions", () => {
    expect(normalizeCurrency("PKR 5,000")).toBe("5000");
    expect(normalizeCurrency("Rs. 5000")).toBe("5000");
    expect(normalizeCurrency("Rupees 5000")).toBe("5000");
  });

  it("normalizes date expressions", () => {
    expect(normalizeDate("31 July 2026")).toBe("2026-07-31");
    expect(normalizeDate("2026-07-31")).toBe("2026-07-31");
  });

  it("normalizes percentage expressions", () => {
    expect(normalizePercentage("80%")).toBe("0.80");
    expect(normalizePercentage("0.80")).toBe("0.80");
  });

  it("distinguishes session differences from critical contradictions", () => {
    const fact2025 = {
      id: "f1",
      sourceVersionId: "v1",
      type: "fee_amount",
      subject: "Admission Fee",
      rawText: "PKR 5,000",
      session: "Fall 2025",
    };
    const fact2026 = {
      id: "f2",
      sourceVersionId: "v2",
      type: "fee_amount",
      subject: "Admission Fee",
      rawText: "PKR 6,000",
      session: "Fall 2026",
    };

    const conflict = detectFactConflict(fact2025, fact2026);
    expect(conflict).not.toBeNull();
    expect(conflict?.conflictClass).toBe("SESSION_DIFFERENCE");
    expect(conflict?.isCritical).toBe(false);
  });

  it("flags unresolved critical conflicts when same session has different values", () => {
    const factA = {
      id: "f1",
      sourceVersionId: "v1",
      type: "fee_amount",
      subject: "Admission Fee",
      rawText: "PKR 5,000",
      session: "Fall 2026",
    };
    const factB = {
      id: "f2",
      sourceVersionId: "v2",
      type: "fee_amount",
      subject: "Admission Fee",
      rawText: "PKR 6,000",
      session: "Fall 2026",
    };

    const conflict = detectFactConflict(factA, factB);
    expect(conflict).not.toBeNull();
    expect(conflict?.conflictClass).toBe("UNRESOLVED_CRITICAL_CONFLICT");
    expect(conflict?.isCritical).toBe(true);
  });
});
