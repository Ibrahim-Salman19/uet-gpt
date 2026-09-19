import { describe, expect, it } from "vitest";
import { bestFaqMatch, FAQ_MIN_COVERAGE, faqCoverage } from "../../convex/shared/faqMatch";

const FEE_FAQ = "What is the fee structure for the first semester?";
const DOCS_FAQ = "What documents are required at the time of admission?";

/**
 * Audit §20: the FAQ gate ran on the user's own words only. That is correct for English,
 * and leaves Roman Urdu users unable to reach the corpus's best source at all - the
 * rewrite is the only phrasing that has been translated into the FAQ's language.
 */
describe("FAQ matching across question phrasings", () => {
  it("cannot match Roman Urdu on the user's own words alone", () => {
    expect(faqCoverage("fees kitni hai BS Software Engineering ki", FEE_FAQ)).toBe(0);
    expect(faqCoverage("admission k liye zaruri documents kya hain?", DOCS_FAQ)).toBeLessThan(
      FAQ_MIN_COVERAGE,
    );
  });

  it("recovers the FAQ once the translated rewrite is considered too", () => {
    const { coverage } = bestFaqMatch(
      [
        "admission k liye zaruri documents kya hain?",
        "required documents for university admission",
      ],
      DOCS_FAQ,
    );
    expect(coverage).toBeGreaterThanOrEqual(FAQ_MIN_COVERAGE);
  });

  it("leaves English behaviour unchanged - the raw question still wins", () => {
    const raw = "What is the fee structure for BS Software Engineering at UET Taxila?";
    const rewrite =
      "University of Engineering and Technology Taxila BS Software Engineering fee structure";
    // The rewrite DILUTES coverage here, so max() must not let it drag the result down.
    expect(faqCoverage(rewrite, FEE_FAQ)).toBeLessThan(faqCoverage(raw, FEE_FAQ));
    expect(bestFaqMatch([raw, rewrite], FEE_FAQ).coverage).toBe(faqCoverage(raw, FEE_FAQ));
    expect(bestFaqMatch([raw, rewrite], FEE_FAQ).coverage).toBeGreaterThanOrEqual(FAQ_MIN_COVERAGE);
  });

  it("still rejects a genuinely unrelated FAQ from every phrasing", () => {
    expect(
      bestFaqMatch(["who is the vice chancellor", "Vice Chancellor UET Taxila"], FEE_FAQ).coverage,
    ).toBeLessThan(FAQ_MIN_COVERAGE);
  });
});
