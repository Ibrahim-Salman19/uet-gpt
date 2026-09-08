import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import AdmissionsPage, { metadata } from "@/app/admissions/page";
import { AdmissionsHub } from "@/components/admissions/admissions-hub";

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/admissions",
}));

describe("Admissions Hub Page (/admissions)", () => {
  it("exports comprehensive metadata with canonical URL", () => {
    expect(metadata.title).toContain("Admissions, ECAT Guide & Fee Structure");
    expect((metadata.description as string).length).toBeLessThanOrEqual(160);
    expect((metadata.description as string).length).toBeGreaterThanOrEqual(130);
    expect(metadata.alternates?.canonical).toBe("https://uet-gpt.vercel.app/admissions");
  });

  it("renders AdmissionsPage header and breadcrumbs", () => {
    const html = renderToString(<AdmissionsPage />);

    expect(html).toContain("Admissions, Aid &amp; Fees");
    expect(html).toContain("application/ld+json");
  });

  it("renders AdmissionsHub with eligibility criteria, ECAT blueprint, and tabs", () => {
    const html = renderToString(<AdmissionsHub />);

    expect(html).toContain("Eligibility &amp; Quotas");
    expect(html).toContain("ECAT Strategy Guide");
    expect(html).toContain("Fee Simulator");
    expect(html).toContain("Financial Aid Schemes");
    expect(html).toContain("University Comparison");
  });
});
