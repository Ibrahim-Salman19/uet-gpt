import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import GpaCalculatorPage, { metadata } from "@/app/gpa-calculator/page";

describe("/gpa-calculator page", () => {
  it("exports valid SEO metadata adhering to search engine constraints", () => {
    expect(metadata.title).toBeDefined();
    const title = String(metadata.title);
    expect(title.length).toBeLessThanOrEqual(60);
    expect(title).toContain("GPA Calculator");

    const description = String(metadata.description);
    expect(description.length).toBeGreaterThan(120);
    expect(description.length).toBeLessThanOrEqual(160);

    expect(metadata.alternates?.canonical).toBe("https://uet-gpt.vercel.app/gpa-calculator");
  });

  it("renders GPA calculator form, UET Taxila grading table, and WebApplication schema in server HTML", () => {
    const html = renderToString(<GpaCalculatorPage />);

    expect(html).toContain("UET Taxila GPA &amp; CGPA Calculator");
    expect(html).toContain("UET Taxila Semester Grading System Regulations");
    expect(html).toContain("4.00");
    expect(html).toContain("Semester GPA (SGPA)");
    expect(html).toContain("application/ld+json");
    expect(html).toContain("WebApplication");
    expect(html).toContain("FAQPage");
  });
});
