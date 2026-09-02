import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import CampusDirectoryPage, { metadata } from "@/app/directory/page";

describe("/directory page", () => {
  it("exports valid SEO metadata adhering to search engine constraints", () => {
    expect(metadata.title).toBeDefined();
    const title = String(metadata.title);
    expect(title.length).toBeLessThanOrEqual(60);
    expect(title).toContain("Directory");

    const description = String(metadata.description);
    expect(description.length).toBeGreaterThan(120);
    expect(description.length).toBeLessThanOrEqual(160);
    expect(metadata.alternates?.canonical).toBe("https://uet-gpt.vercel.app/directory");
  });

  it("renders administrative offices, departmental contacts, and ContactPage schema in server HTML", () => {
    const html = renderToString(<CampusDirectoryPage />);

    expect(html).toContain("UET Taxila Campus Directory");
    expect(html).toContain("Directorate of Admissions");
    expect(html).toContain("Department of Computer Science");
    expect(html).toContain("admissions@uettaxila.edu.pk");
    expect(html).toContain("application/ld+json");
    expect(html).toContain("ContactPage");
    expect(html).toContain("FAQPage");
  });
});
