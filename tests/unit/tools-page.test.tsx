import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import ToolsPage, { metadata } from "@/app/tools/page";
import { ToolsHub } from "@/components/tools/tools-hub";

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/tools",
}));

describe("Tools Hub Page (/tools)", () => {
  it("exports comprehensive metadata with canonical URL", () => {
    expect(metadata.title).toContain("Engineering Tools & Calculators Suite");
    expect(metadata.alternates?.canonical).toBe("https://uet-gpt.vercel.app/tools");
  });

  it("renders ToolsPage with server headers, breadcrumbs and JSON-LD schema", () => {
    const html = renderToString(<ToolsPage />);

    expect(html).toContain("Engineering Tools &amp; Calculators");
    expect(html).toContain("application/ld+json");
    expect(html).toContain("FAQPage");
  });

  it("renders ToolsHub with all 4 tool tab selectors and initial panel", () => {
    const html = renderToString(<ToolsHub />);

    expect(html).toContain("Merit Calculator");
    expect(html).toContain("GPA &amp; CGPA Calculator");
    expect(html).toContain("5-Yr Closing Merit");
    expect(html).toContain("Scholarship Screener");
  });
});
