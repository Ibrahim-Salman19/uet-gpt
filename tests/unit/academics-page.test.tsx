import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import AcademicsPage, { metadata } from "@/app/academics/page";
import { AcademicsHub } from "@/components/academics/academics-hub";

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/academics",
}));

describe("Academics Hub Page (/academics)", () => {
  it("exports comprehensive metadata with canonical URL", () => {
    expect(metadata.title).toContain("Academics, Degree Syllabi & Calendar");
    expect(metadata.alternates?.canonical).toBe("https://uet-gpt.vercel.app/academics");
  });

  it("renders AcademicsPage with header and breadcrumbs", () => {
    const html = renderToString(<AcademicsPage />);

    expect(html).toContain("Academics, Syllabi &amp; Calendar");
    expect(html).toContain("application/ld+json");
  });

  it("renders AcademicsHub with 14 degree roadmaps and tab selectors", () => {
    const html = renderToString(<AcademicsHub />);

    expect(html).toContain("14 Degree Curriculums");
    expect(html).toContain("Academic Calendar");
    expect(html).toContain("Past Papers &amp; OBE Grading");
    expect(html).toContain("Computer Science");
    expect(html).toContain("Software Engineering");
  });
});
