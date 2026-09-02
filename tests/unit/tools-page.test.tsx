import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import ToolsPage, { metadata } from "@/app/tools/page";

describe("Tools Hub Page (/tools)", () => {
  it("exports comprehensive metadata with canonical URL", () => {
    expect(metadata.title).toContain("Engineering Tools & Calculators Suite");
    expect(metadata.alternates?.canonical).toBe("https://uet-gpt.vercel.app/tools");
  });

  it("renders ToolsPage with all 4 tool tab selectors and JSON-LD schema", () => {
    const html = renderToString(<ToolsPage />);

    expect(html).toContain("Engineering Tools &amp; Calculators");
    expect(html).toContain("Merit Calculator");
    expect(html).toContain("GPA &amp; CGPA Calculator");
    expect(html).toContain("5-Yr Closing Merit");
    expect(html).toContain("Scholarship Screener");
    expect(html).toContain("application/ld+json");
    expect(html).toContain("FAQPage");
  });
});
