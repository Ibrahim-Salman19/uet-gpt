import { describe, expect, it } from "vitest";
import { contentTokens, FAQ_MIN_COVERAGE, faqCoverage } from "../../convex/shared/faqMatch";

// Questions and FAQ wording taken from scripts/faq/official-faqs.json.
describe("faqMatch - FAQ retrieval gate", () => {
  it("drops words that every UET question shares", () => {
    expect(contentTokens("What is the fee structure at UET Taxila?")).toEqual(
      new Set(["fee", "structur"]),
    );
  });

  it("matches singular and plural forms", () => {
    expect(contentTokens("freezing programs")).toEqual(contentTokens("freeze program"));
  });

  it("admits the FAQ that answers the question", () => {
    expect(
      faqCoverage(
        "What are the eligibility criteria for admission to BS Computer Science at UET Taxila?",
        "What are the eligibility criteria for admission?",
      ),
    ).toBeGreaterThanOrEqual(FAQ_MIN_COVERAGE);
    expect(
      faqCoverage(
        "Can I freeze my semester at UET Taxila and what is the procedure?",
        "How to get freezing of a Semester?",
      ),
    ).toBeGreaterThanOrEqual(FAQ_MIN_COVERAGE);
    expect(
      faqCoverage(
        "What is the fee structure for BS Software Engineering at UET Taxila?",
        "What is the fee structure for the first semester?",
      ),
    ).toBeGreaterThanOrEqual(FAQ_MIN_COVERAGE);
  });

  it("admits the alias wording carried in the FAQ data file", () => {
    // official-faqs.json repeats the eligibility answer under this wording, because the
    // page's own question ("eligibility criteria") shares no content word with it.
    expect(
      faqCoverage(
        "What is the minimum percentage required in FSc for admission to UET Taxila?",
        "What is the minimum percentage required in FSc for admission?",
      ),
    ).toBe(1);
  });

  it("rejects a FAQ that merely shares a common word", () => {
    // "semester" alone must not pull the grade-sheet FAQ into a fee question.
    expect(
      faqCoverage(
        "How can I pay my semester fee at UET Taxila?",
        "How to apply for Semester Grade Sheets?",
      ),
    ).toBeLessThan(FAQ_MIN_COVERAGE);
    expect(
      faqCoverage(
        "How many seats are available for BS Electrical Engineering at UET Taxila?",
        "Is hostel facility available?",
      ),
    ).toBe(0);
    expect(
      faqCoverage(
        "What merit scholarships are available for top students at UET Taxila?",
        "When are the merit lists announced?",
      ),
    ).toBe(0);
  });

  it("needs a single-word question to match that word", () => {
    expect(faqCoverage("how to apply", "How can I apply for Undergraduate Admissions?")).toBe(1);
    expect(faqCoverage("contact number", "How can I contact the Admission Office?")).toBe(0);
  });

  it("returns 0 when the question has no content words", () => {
    expect(faqCoverage("what is this at UET Taxila?", "What is the fee structure?")).toBe(0);
  });
});
