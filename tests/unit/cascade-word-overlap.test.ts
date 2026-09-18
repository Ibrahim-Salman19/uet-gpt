import { describe, expect, it } from "vitest";
import { computeWordOverlap } from "../../convex/reranking/cascade";

// Chunk text is abridged from the candidates production returned for these
// questions; production reaches no cross-encoder, so this score picks the
// 4 chunks the answer is written from.
const FREEZE_QUESTION = "Can I freeze my semester at UET Taxila and what is the procedure?";

const EXAMS_FAQ_CHUNK =
  "Examination Frequently Asked Questions - How to get freezing of a Semester? - If student " +
  "has some valid reasons and want to get freeze one or Two Consecutive Semesters then Student " +
  "can apply for Freezing of Semester(s) by submitting the Freezing-Semester-Form available on " +
  "UET website in Examinations Download Section.";

const IEEE_REPORT_CHUNK =
  "TEAM IEEE SB UET TAXILA AT A GLANCE. EX-CHAIRPERSONS NOTE. Sad but nothing lasts forever so " +
  "I would like to share some words with all my juniors. The only way that we can live, is if " +
  "we grow. The only way that we can grow is if we change. And the only way that we can become " +
  "exposed is if we throw ourselves out into the open. What is the procedure? Do it.";

describe("cascade computeWordOverlap", () => {
  it("ranks the chunk that answers the question above an unrelated long one", () => {
    expect(computeWordOverlap(FREEZE_QUESTION, EXAMS_FAQ_CHUNK)).toBeGreaterThan(
      computeWordOverlap(FREEZE_QUESTION, IEEE_REPORT_CHUNK),
    );
  });

  it("does not let shared stop words alone earn a score", () => {
    // Every word this chunk shares with the question is a stop word.
    expect(computeWordOverlap(FREEZE_QUESTION, "Can I tell you what this is at UET Taxila?")).toBe(
      0,
    );
  });

  it("matches inflected forms of the question's content words", () => {
    expect(computeWordOverlap("How do I freeze a semester?", "Freezing of Semesters")).toBe(1);
  });

  it("falls back to raw word overlap when the query is all stop words", () => {
    // "who is this" has no content tokens; without the fallback every chunk
    // would score 0 and the reranker would lose its ordering entirely.
    expect(computeWordOverlap("who is this", "who is this person")).toBeGreaterThan(0);
  });

  it("ignores the rewriter's expansion of UET", () => {
    // rewriteQueryAction turns "UET Taxila" into "University of Engineering and
    // Technology Taxila", so "technology" reaches the reranker on almost every
    // query; a chunk must not score on it alone.
    const rewritten =
      "BS Software Engineering fee structure University of Engineering and Technology Taxila";
    expect(
      computeWordOverlap(rewritten, "Department of Technology, University of Engineering"),
    ).toBe(0);
    expect(
      computeWordOverlap(rewritten, "BS Software Engineering fee structure per semester"),
    ).toBe(1);
  });

  it("returns 0 for an empty chunk", () => {
    expect(computeWordOverlap(FREEZE_QUESTION, "")).toBe(0);
  });
});
