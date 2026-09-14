import { describe, expect, it } from "vitest";
import { LEARN_TERMS_DATE_MODIFIED } from "@/lib/dates";
import { getTermBySlug, LEARN_TERMS } from "@/lib/learn-terms";

describe("Learn Terms SEO Differentiation", () => {
  it("differentiates fee-structure glossary term from main fee-structure page", () => {
    const feeTerm = getTermBySlug("fee-structure");
    expect(feeTerm?.pageTitle).toBe("What is UET Taxila Fee Structure? - Glossary | UET GPT");
  });

  it("differentiates ecat term title from admissions page", () => {
    const ecatTerm = getTermBySlug("ecat");
    expect(ecatTerm?.pageTitle).toBe("What is ECAT? UET Entry Test Explained | UET GPT");
  });

  it("all terms have valid dateModified matching SCHEMA_DATE_MODIFIED", () => {
    expect(LEARN_TERMS.length).toBe(9);
    for (const term of LEARN_TERMS) {
      expect(term.dateModified).toBe(LEARN_TERMS_DATE_MODIFIED);
      expect(getTermBySlug(term.slug)).toBeDefined();
    }
  });
});
