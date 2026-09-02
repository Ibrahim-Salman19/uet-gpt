import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import AdmissionsPage, { metadata } from "@/app/admissions/page";

describe("Admissions Hub Page (/admissions)", () => {
  it("exports comprehensive metadata with canonical URL", () => {
    expect(metadata.title).toContain("Admissions, ECAT Guide & Fee Structure");
    expect(metadata.alternates?.canonical).toBe("https://uet-gpt.vercel.app/admissions");
  });

  it("renders AdmissionsPage with eligibility criteria, ECAT blueprint, and tabs", () => {
    const html = renderToString(<AdmissionsPage />);

    expect(html).toContain("Admissions, Aid &amp; Fees");
    expect(html).toContain("Eligibility &amp; Quotas");
    expect(html).toContain("ECAT Strategy Guide");
    expect(html).toContain("Fee Simulator");
    expect(html).toContain("Financial Aid Schemes");
    expect(html).toContain("University Comparison");
    expect(html).toContain("application/ld+json");
  });
});
