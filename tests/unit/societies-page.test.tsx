import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import SocietiesPage, { metadata } from "@/app/societies/page";

describe("/societies page", () => {
  it("exports valid SEO metadata conforming to character limits and canonical rules", () => {
    expect(metadata.title).toBeDefined();
    const title = String(metadata.title);
    expect(title.length).toBeLessThanOrEqual(60);
    expect(title).toContain("Societies");

    const description = String(metadata.description);
    expect(description.length).toBeGreaterThan(120);
    expect(description.length).toBeLessThanOrEqual(160);
    expect(metadata.alternates?.canonical).toBe("https://uet-gpt.vercel.app/societies");
  });

  it("renders technical and cultural societies, flagship events, and ItemList schema in server HTML", () => {
    const html = renderToString(<SocietiesPage />);

    expect(html).toContain("Student Societies &amp; Technical Chapters");
    expect(html).toContain("IEEE UET Taxila Student Branch");
    expect(html).toContain("GDG on Campus UET Taxila");
    expect(html).toContain("HackXila National Hackathon");
    expect(html).toContain("CIVCON by ICE");
    expect(html).toContain("UET AutoShow by ASME");
    expect(html).toContain("application/ld+json");
    expect(html).toContain("ItemList");
    expect(html).toContain("FAQPage");
  });
});
