import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import AcademicCalendarPage, { metadata } from "@/app/calendar/page";

describe("/calendar page", () => {
  it("exports valid SEO metadata adhering to search engine constraints", () => {
    expect(metadata.title).toBeDefined();
    const title = String(metadata.title);
    expect(title.length).toBeLessThanOrEqual(60);
    expect(title).toContain("Academic Calendar");

    const description = String(metadata.description);
    expect(description.length).toBeGreaterThan(120);
    expect(description.length).toBeLessThanOrEqual(160);
    expect(metadata.alternates?.canonical).toBe("https://uet-gpt.vercel.app/calendar");
  });

  it("renders academic timeline events, semester dates, and FAQPage schema in server HTML", () => {
    const html = renderToString(<AcademicCalendarPage />);

    expect(html).toContain("UET Taxila Academic Calendar");
    expect(html).toContain("ECAT 2026 Online Registration Window");
    expect(html).toContain("Commencement of Fall 2026 Regular Classes");
    expect(html).toContain("Fall 2026 End-Semester Final Examinations");
    expect(html).toContain("application/ld+json");
    expect(html).toContain("FAQPage");
  });
});
