import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import MeritArchivePage, { metadata } from "@/app/merit-archive/page";

describe("/merit-archive page", () => {
  it("exports valid SEO metadata adhering to search engine constraints", () => {
    expect(metadata.title).toBeDefined();
    const title = String(metadata.title);
    expect(title.length).toBeLessThanOrEqual(60);
    expect(title).toContain("Merit Archive");

    const description = String(metadata.description);
    expect(description.length).toBeGreaterThan(120);
    expect(description.length).toBeLessThanOrEqual(160);
    expect(metadata.alternates?.canonical).toBe("https://uet-gpt.vercel.app/merit-archive");
  });

  it("renders historical merit comparison table, 5-year trends, and FAQPage schema in server HTML", () => {
    const html = renderToString(<MeritArchivePage />);

    expect(html).toContain("UET Taxila Historical Closing Merit Archive");
    expect(html).toContain("Computer Science");
    expect(html).toContain("80.450%");
    expect(html).toContain("Software Engineering");
    expect(html).toContain("79.820%");
    expect(html).toContain("application/ld+json");
    expect(html).toContain("FAQPage");
  });
});
