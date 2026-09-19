import { describe, expect, it } from "vitest";
import { isRefusalAnswer, REFUSAL_TEXT } from "../../convex/shared/refusal";

describe("isRefusalAnswer", () => {
  describe("refusals that must never be cached", () => {
    it("catches the exact paraphrase that reached a user in production", () => {
      // Verbatim from the 2026-09-18 transcript for "What is the fee structure for BS
      // programs?". This answer cited two sources, so both sources.length guards
      // admitted it. Note the typographic apostrophes - the ASCII forms in the prompt
      // text never match model output as written, which is why normalization exists.
      expect(
        isRefusalAnswer(
          "I’m sorry, but I couldn’t find verified information about the overall fee " +
            "structure for BS programs in the available data. Please check the UET Taxila " +
            "website (uettaxila.edu.pk) or contact the admissions office for the most up‑to‑date details.",
        ),
      ).toBe(true);
    });

    it("catches the canonical refusal the refuse tier orders verbatim", () => {
      expect(isRefusalAnswer(REFUSAL_TEXT)).toBe(true);
    });

    it("catches the rag/prompts.ts phrasing", () => {
      expect(
        isRefusalAnswer(
          "I couldn't find specific information about this in the UET Taxila website. " +
            "Please contact the relevant department directly.",
        ),
      ).toBe(true);
    });

    it("catches other plausible negations of the trained phrase", () => {
      for (const answer of [
        "I do not have verified information about the hostel fee.",
        "Unfortunately I was unable to find verified information on this topic.",
        "There is no verified information in the provided sources about the merit list.",
        "I cannot find verified information about the entry test date.",
      ]) {
        expect(isRefusalAnswer(answer), answer).toBe(true);
      }
    });

    it("treats an empty or blank answer as unservable", () => {
      expect(isRefusalAnswer("")).toBe(true);
      expect(isRefusalAnswer("   \n  ")).toBe(true);
      expect(isRefusalAnswer(null)).toBe(true);
      expect(isRefusalAnswer(undefined)).toBe(true);
    });
  });

  describe("real answers that must stay cacheable", () => {
    it("keeps an answer that merely tells the user to verify details", () => {
      expect(
        isRefusalAnswer(
          "The first semester dues for BS programs total Rs. 101,800 as listed in the " +
            "2025 Prospectus. For authoritative details, please verify at uettaxila.edu.pk.",
        ),
      ).toBe(false);
    });

    it("keeps a hedged answer that still delivers the figure", () => {
      expect(
        isRefusalAnswer(
          "Based on limited information available - the admission deadline is 15 August 2025. " +
            "For authoritative details, please verify at uettaxila.edu.pk.",
        ),
      ).toBe(false);
    });

    it("keeps an answer that names the word 'verified' without a negation", () => {
      expect(
        isRefusalAnswer("This figure comes from verified information in the 2025 Prospectus."),
      ).toBe(false);
    });

    it("does not fire on a negation separated from the phrase by a sentence boundary", () => {
      // The clause guard is what stops "I can't help with X. Verified information about
      // fees is in the prospectus." from being read as a refusal.
      expect(
        isRefusalAnswer(
          "I can't process images. Verified information about fees is in the 2025 Prospectus: " +
            "first semester dues are Rs. 101,800.",
        ),
      ).toBe(false);
    });

    it("does not fire when the phrase appears only late in a long correct answer", () => {
      const answer =
        "UET Taxila offers BS programs in Computer, Electrical, Mechanical, Civil and " +
        "Software Engineering. Admission is on open merit, calculated from the entry test " +
        "and intermediate marks, and the first semester dues are Rs. 101,800 per the 2025 " +
        "Prospectus. For hostel charges I don't have verified information.";
      expect(isRefusalAnswer(answer)).toBe(false);
    });
  });
});
