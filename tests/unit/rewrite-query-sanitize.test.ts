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
  // Every `rewritten` below is real production output captured 2026-09-18 by
  // calling rag/routing:rewriteQueryAction against the deployed rewriter.
  it("keeps only the query preceding a synonym dump", () => {
    expect(
      sanitizeRewrittenQuery(
        "BS program fee structure keywords: BS program tuition fees, BS program cost, BS program fee details, BS program tuition breakdown, BS program fee schedule, BS program cost structure",
        "What is the fee structure for BS programs?",
      ),
    ).toBe("BS program fee structure");
  });

  it("collapses a dump whose label is capitalised and spaced", () => {
    expect(
      sanitizeRewrittenQuery(
        "hostel charges Keywords : hostel fees, accommodation cost, room rent",
        "What are the hostel charges?",
      ),
    ).toBe("hostel charges");
  });

  it("keeps the first item when the dump has no query before the label", () => {
    expect(
      sanitizeRewrittenQuery(
        "keywords: admission deadline last date, apply online, application form",
        "When is the last date to apply?",
      ),
    ).toBe("admission deadline last date");
  });

  it("strips a trailing bare label the model leaked", () => {
    expect(
      sanitizeRewrittenQuery(
        "BS program tuition fee structure keywords",
        "What is the fee structure for BS programs?",
      ),
    ).toBe("BS program tuition fee structure");
  });

  it("leaves a clean short rewrite untouched", () => {
    expect(
      sanitizeRewrittenQuery(
        "BS Software Engineering fee structure University of Engineering and Technology Taxila",
        "What is the fee structure for BS Software Engineering at UET Taxila?",
      ),
    ).toBe("BS Software Engineering fee structure University of Engineering and Technology Taxila");
  });

  it("does not treat a genuine question about keywords as a dump", () => {
    expect(
      sanitizeRewrittenQuery(
        "research paper keywords guidelines University of Engineering and Technology Taxila",
        "What are the keywords guidelines for research papers?",
      ),
    ).toBe("research paper keywords guidelines University of Engineering and Technology Taxila");
  });
});
