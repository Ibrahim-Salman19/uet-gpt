import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import AcademicsPage, { metadata } from "@/app/academics/page";

describe("Academics Hub Page (/academics)", () => {
  it("exports comprehensive metadata with canonical URL", () => {
    expect(metadata.title).toContain("Academics, Degree Syllabi & Calendar");
    expect(metadata.alternates?.canonical).toBe("https://uet-gpt.vercel.app/academics");
  });

  it("renders AcademicsPage with 14 degree roadmaps and calendar tab selectors", () => {
    const html = renderToString(<AcademicsPage />);

    expect(html).toContain("Academics, Syllabi &amp; Calendar");
    expect(html).toContain("14 Degree Curriculums");
    expect(html).toContain("Academic Calendar");
    expect(html).toContain("Past Papers &amp; OBE Grading");
    expect(html).toContain("Computer Science");
    expect(html).toContain("Software Engineering");
    expect(html).toContain("application/ld+json");
  });
});
