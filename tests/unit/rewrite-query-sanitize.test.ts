import { describe, expect, it } from "vitest";
import { sanitizeRewrittenQuery } from "../../convex/rag/routing";

// Every `rewritten` string below is real output from rag/routing:rewriteQueryAction
// captured against production on 2026-09-18.
describe("sanitizeRewrittenQuery", () => {
  it("drops a year the user never wrote", () => {
    expect(
      sanitizeRewrittenQuery(
        "UET Taxila admission deadline last date 2024 application period",
        "When is the last date to apply for admission at UET Taxila?",
      ),
    ).toBe("UET Taxila admission deadline last date application period");
  });

  it("keeps a year the user did write", () => {
    expect(
      sanitizeRewrittenQuery(
        "UET Taxila merit list 2026 announcement date",
        "When is the 2026 merit list announced at UET Taxila?",
      ),
    ).toBe("UET Taxila merit list 2026 announcement date");
  });

  it("collapses a runaway year enumeration", () => {
    expect(
      sanitizeRewrittenQuery(
        "UET Taxila merit list announcement date 2024 2025 2026 2027 2028 2029 2030",
        "When will the merit list be announced at UET Taxila?",
      ),
    ).toBe("UET Taxila merit list announcement date");
  });

  it("removes a leaked model control token", () => {
    expect(
      sanitizeRewrittenQuery(
        "UET Taxila entrance exam date schedule 2024 entry test timing <|constrain|>**",
        "When is the entry test for UET Taxila?",
      ),
    ).toBe("UET Taxila entrance exam date schedule entry test timing");
  });

  it("leaves a year range without a dangling separator", () => {
    expect(
      sanitizeRewrittenQuery(
        "UET Taxila academic calendar 2024-2025 schedule dates",
        "What is the academic calendar for UET Taxila?",
      ),
    ).toBe("UET Taxila academic calendar schedule dates");
  });

  it("falls back to the user's query when nothing survives", () => {
    const original = "When is the entry test?";
    expect(sanitizeRewrittenQuery("2024 **", original)).toBe(original);
  });
});
