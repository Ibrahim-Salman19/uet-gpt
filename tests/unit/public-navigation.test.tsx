import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PublicFooter } from "@/components/navigation/public-footer";
import { PublicNav } from "@/components/navigation/public-nav";

describe("Public Navigation & Footer System", () => {
  it("renders PublicNav with accessible skip link and all core routes", () => {
    const html = renderToString(<PublicNav />);

    expect(html).toContain("Skip to main content");
    expect(html).toContain('href="/calculator"');
    expect(html).toContain('href="/gpa-calculator"');
    expect(html).toContain('href="/merit-archive"');
    expect(html).toContain('href="/uet-taxila/programs"');
    expect(html).toContain('href="/calendar"');
    expect(html).toContain('href="/directory"');
    expect(html).toContain('href="/compare"');
    expect(html).toContain('href="/ecat-guide"');
    expect(html).toContain('href="/scholarships"');
    expect(html).toContain('href="/campus-life"');
    expect(html).toContain('href="/learn"');
    expect(html).toContain('href="/chat"');
    expect(html).toContain('aria-label="Main Navigation"');
  });

  it("renders PublicFooter with 5 distinct directory columns and trust links", () => {
    const html = renderToString(<PublicFooter />);

    expect(html).toContain("Admissions &amp; Tools");
    expect(html).toContain("Academics &amp; Fees");
    expect(html).toContain("Campus Life");
    expect(html).toContain("Knowledge &amp; AI");
    expect(html).toContain("About &amp; Trust");
    expect(html).toContain('href="/privacy"');
    expect(html).toContain('href="/terms"');
    expect(html).toContain('href="/contact"');
    expect(html).toContain("llms.txt");
  });
});
