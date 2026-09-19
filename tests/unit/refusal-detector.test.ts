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

    it("catches the second production refusal, which cited two sources and quoted a fee", () => {
      // 2026-09-19, after the CRAG fix: retrieval delivered 2 sources and the figures
      // reached the model (logs: resultCount 2, sourceCount 2, cragTier null), and it
      // STILL opened with the refusal. That is what the GROUNDING_RULES edit addresses;
      // until it takes effect this answer must not be cached.
      expect(
        isRefusalAnswer(
          "I\u2019m sorry, but I couldn\u2019t find verified information about the fee structure " +
            "specifically for BS programs in the available sources. The only fee details provided " +
            "relate to the first-semester fees (Regular \u2248 Rs 104,800).",
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

    it("keeps the substance-first partial answer the grounding rules now ask for", () => {
      // src/lib/prompt.ts instructs the model to lead with what the reference data does
      // support and only then name the gap. Those answers must stay cacheable, otherwise
      // the prompt fix and this guard would cancel each other out.
      expect(
        isRefusalAnswer(
          "First-semester fees for BS programmes are Rs 104,800 (Regular) and Rs 339,800 " +
            "(Partial-Subsidized) according to the FAQs page. I couldn't find verified " +
            "information about the fee structure beyond the first semester.",
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
