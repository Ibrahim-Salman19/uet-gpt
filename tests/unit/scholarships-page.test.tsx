import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import ScholarshipsPage, { metadata } from "@/app/scholarships/page";

describe("/scholarships page", () => {
  it("exports valid SEO metadata adhering to Google constraints", () => {
    expect(metadata.title).toBeDefined();
    const title = String(metadata.title);
    expect(title.length).toBeLessThanOrEqual(60);
    expect(title).toContain("Scholarships");

    const description = String(metadata.description);
    expect(description.length).toBeGreaterThan(120);
    expect(description.length).toBeLessThanOrEqual(160);

    expect(metadata.alternates?.canonical).toBe("https://uet-gpt.vercel.app/scholarships");
  });

  it("renders major scholarship schemes, HEC aid, and FAQs in server HTML", () => {
    const html = renderToString(<ScholarshipsPage />);

    expect(html).toContain("HEC Need-Based Scholarship Program");
    expect(html).toContain("Ehsaas / BISP Undergraduate Scholarship");
    expect(html).toContain("Punjab Educational Endowment Fund (PEEF)");
    expect(html).toContain("UET Taxila Alumni Association");
    expect(html).toContain("How to Apply for Financial Aid at UET Taxila");
    expect(html).toContain("application/ld+json");
    expect(html).toContain("FAQPage");
    expect(html).toContain("CollectionPage");
  });
});
