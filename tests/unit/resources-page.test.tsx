import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import ResourcesPage, { metadata } from "@/app/resources/page";

describe("/resources page", () => {
  it("exports valid SEO metadata conforming to character limits and canonical rules", () => {
    expect(metadata.title).toBeDefined();
    const title = String(metadata.title);
    expect(title.length).toBeLessThanOrEqual(60);
    expect(title).toContain("Past Papers");

    const description = String(metadata.description);
    expect(description.length).toBeGreaterThan(120);
    expect(description.length).toBeLessThanOrEqual(160);
    expect(metadata.alternates?.canonical).toBe("https://uet-gpt.vercel.app/resources");
  });

  it("renders OBE evaluation rubrics, Central Library digital access, Book Bank, and FAQ schema", () => {
    const html = renderToString(<ResourcesPage />);

    expect(html).toContain("Past Papers, Grading &amp; Study Resources");
    expect(html).toContain("Continuous Assessment (20% – 30%)");
    expect(html).toContain("Mid-Semester Exam (20% – 25%)");
    expect(html).toContain("Final Examination (40% – 50%)");
    expect(html).toContain("HEC National Digital Library &amp; IEEE Xplore");
    expect(html).toContain("Book Bank Lending Program");
    expect(html).toContain("application/ld+json");
    expect(html).toContain("FAQPage");
  });
});
