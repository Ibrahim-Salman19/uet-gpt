import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import CampusLifePage, { metadata } from "@/app/campus-life/page";
import { CampusLifeHub } from "@/components/campus/campus-life-hub";

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/campus-life",
}));

describe("/campus-life page", () => {
  it("exports valid SEO metadata adhering to Google constraints", () => {
    expect(metadata.title).toBeDefined();
    const title = String(metadata.title);
    expect(title.length).toBeLessThanOrEqual(60);
    expect(title).toContain("Campus Life");

    const description = String(metadata.description);
    expect(description.length).toBeGreaterThan(120);
    expect(description.length).toBeLessThanOrEqual(160);

    expect(metadata.alternates?.canonical).toBe("https://uet-gpt.vercel.app/campus-life");
  });

  it("renders CampusLifePage header and breadcrumbs in server HTML", () => {
    const html = renderToString(<CampusLifePage />);

    expect(html).toContain("Campus Life &amp; Facilities");
    expect(html).toContain("application/ld+json");
  });

  it("renders CampusLifeHub with 5 residential halls and tab selectors", () => {
    const hubHtml = renderToString(<CampusLifeHub />);

    expect(hubHtml).toContain("Hostels &amp; Residence");
    expect(hubHtml).toContain("Bus Routes &amp; Timetables");
    expect(hubHtml).toContain("Societies &amp; Clubs");
    expect(hubHtml).toContain("Campus Directory");
    expect(hubHtml).toContain("Sir Syed Hall");
    expect(hubHtml).toContain("Quaid-e-Azam Hall");
    expect(hubHtml).toContain("Fatima Jinnah Hall");
  });
});
