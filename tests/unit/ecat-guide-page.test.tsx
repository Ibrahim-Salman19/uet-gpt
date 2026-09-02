import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import EcatGuidePage, { metadata } from "@/app/ecat-guide/page";

describe("/ecat-guide page", () => {
  it("exports valid SEO metadata adhering to search engine constraints", () => {
    expect(metadata.title).toBeDefined();
    const title = String(metadata.title);
    expect(title.length).toBeLessThanOrEqual(60);
    expect(title).toContain("ECAT 2026");

    const description = String(metadata.description);
    expect(description.length).toBeGreaterThan(120);
    expect(description.length).toBeLessThanOrEqual(160);

    expect(metadata.alternates?.canonical).toBe("https://uet-gpt.vercel.app/ecat-guide");
  });

  it("renders 400 marks pattern, negative marking rules, and HowTo schema in server HTML", () => {
    const html = renderToString(<EcatGuidePage />);

    expect(html).toContain("ECAT 2026 Preparation Guide");
    expect(html).toContain("400");
    expect(html).toContain("100 MCQs");
    expect(html).toContain("-1 Mark");
    expect(html).toContain("Mathematics / Biology");
    expect(html).toContain("application/ld+json");
    expect(html).toContain("HowTo");
    expect(html).toContain("FAQPage");
  });
});
