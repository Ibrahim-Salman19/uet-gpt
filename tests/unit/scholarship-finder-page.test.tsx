import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import ScholarshipFinderPage, { metadata } from "@/app/scholarship-finder/page";

describe("/scholarship-finder page", () => {
  it("exports valid SEO metadata conforming to character limits and canonical rules", () => {
    expect(metadata.title).toBeDefined();
    const title = String(metadata.title);
    expect(title.length).toBeLessThanOrEqual(60);
    expect(title).toContain("Scholarship");

    const description = String(metadata.description);
    expect(description.length).toBeGreaterThan(120);
    expect(description.length).toBeLessThanOrEqual(160);
    expect(metadata.alternates?.canonical).toBe("https://uet-gpt.vercel.app/scholarship-finder");
  });

  it("renders interactive questionnaire, matched aid programs, and FAQ schema in server HTML", () => {
    const html = renderToString(<ScholarshipFinderPage />);

    expect(html).toContain("Scholarship Eligibility Screener");
    expect(html).toContain("1. Monthly Household Income");
    expect(html).toContain("2. Domicile Province");
    expect(html).toContain("Honhaar Scholarship Program");
    expect(html).toContain("HEC Need-Based Financial Assistance Grant");
    expect(html).toContain("application/ld+json");
    expect(html).toContain("FAQPage");
  });
});
