import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import CampusLifePage, { metadata } from "@/app/campus-life/page";

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

  it("renders on-campus hostels, bus routes, central library, and societies in server HTML", () => {
    const html = renderToString(<CampusLifePage />);

    expect(html).toContain("Quaid-e-Azam Hall");
    expect(html).toContain("Allama Iqbal Hall");
    expect(html).toContain("Ayesha Hall");
    expect(html).toContain("University Bus Transport Network");
    expect(html).toContain("Islamabad Express Route");
    expect(html).toContain("Central Library &amp; Book Bank");
    expect(html).toContain("ACM Student Chapter");
    expect(html).toContain("IEEE Student Branch");
    expect(html).toContain("application/ld+json");
    expect(html).toContain("FAQPage");
  });
});
