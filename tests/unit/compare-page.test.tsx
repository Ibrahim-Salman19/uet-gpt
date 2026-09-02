import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import ComparePage, { metadata } from "@/app/compare/page";

describe("/compare page", () => {
  it("exports valid SEO metadata adhering to search engine constraints", () => {
    expect(metadata.title).toBeDefined();
    const title = String(metadata.title);
    expect(title.length).toBeLessThanOrEqual(60);
    expect(title).toContain("Comparison");

    const description = String(metadata.description);
    expect(description.length).toBeGreaterThan(120);
    expect(description.length).toBeLessThanOrEqual(160);

    expect(metadata.alternates?.canonical).toBe("https://uet-gpt.vercel.app/compare");
  });

  it("renders comparison matrix of UET Taxila, NUST, FAST, and GIKI in server HTML", () => {
    const html = renderToString(<ComparePage />);

    expect(html).toContain("UET Taxila vs NUST, FAST, UET Lahore &amp; GIKI");
    expect(html).toContain("ECAT (33% weight)");
    expect(html).toContain("NET (75% weight)");
    expect(html).toContain("Level-II (Washington Accord)");
    expect(html).toContain("application/ld+json");
    expect(html).toContain("FAQPage");
  });
});
