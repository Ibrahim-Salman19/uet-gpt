import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PublicFooter } from "@/components/navigation/public-footer";
import { PublicNav } from "@/components/navigation/public-nav";

describe("Public Navigation & Footer System", () => {
  it("renders PublicNav with accessible skip link and 4 streamlined core pillars", () => {
    const html = renderToString(<PublicNav />);

    expect(html).toContain("Skip to main content");
    expect(html).toContain('href="/tools"');
    expect(html).toContain('href="/academics"');
    expect(html).toContain('href="/admissions"');
    expect(html).toContain('href="/campus-life"');
    expect(html).toContain('href="/learn"');
    expect(html).toContain('href="/chat"');
    expect(html).toContain('aria-label="Main Navigation"');
  });

  it("renders PublicFooter with 5 distinct directory columns and trust links", () => {
    const html = renderToString(<PublicFooter />);

    expect(html).toContain("Engineering Tools");
    expect(html).toContain("Academics &amp; Syllabi");
    expect(html).toContain("Admissions &amp; Aid");
    expect(html).toContain("Campus Life");
    expect(html).toContain("Knowledge &amp; Trust");
    expect(html).toContain('href="/privacy"');
    expect(html).toContain('href="/terms"');
    expect(html).toContain('href="/contact"');
    expect(html).toContain("llms.txt");
  });
});
