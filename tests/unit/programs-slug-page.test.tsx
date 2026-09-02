import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import ProgramDetailPage, {
  generateMetadata,
  generateStaticParams,
} from "@/app/uet-taxila/programs/[slug]/page";

describe("Program Detail Dynamic Pages (/uet-taxila/programs/[slug])", () => {
  it("generateStaticParams returns all 14 official programs", async () => {
    const params = await generateStaticParams();
    expect(params.length).toBe(14);
    expect(params.map((p) => p.slug)).toContain("computer-science");
    expect(params.map((p) => p.slug)).toContain("software-engineering");
    expect(params.map((p) => p.slug)).toContain("electrical-engineering");
    expect(params.map((p) => p.slug)).toContain("mechanical-engineering");
    expect(params.map((p) => p.slug)).toContain("civil-engineering");
  });

  it("generateMetadata produces search-engine compliant titles and descriptions", async () => {
    const meta = await generateMetadata({
      params: Promise.resolve({ slug: "computer-science" }),
    });

    expect(meta.title).toBeDefined();
    expect(String(meta.title)).toContain("BS Computer Science");
    expect(String(meta.title).length).toBeLessThanOrEqual(60);

    const desc = String(meta.description);
    expect(desc.length).toBeGreaterThan(120);
    expect(desc.length).toBeLessThanOrEqual(160);
    expect(meta.alternates?.canonical).toBe(
      "https://uet-gpt.vercel.app/uet-taxila/programs/computer-science",
    );
  });

  it("renders program curriculum, labs, career pathways, and structured schemas in HTML", async () => {
    const PageComponent = await ProgramDetailPage({
      params: Promise.resolve({ slug: "computer-science" }),
    });
    const html = renderToString(PageComponent);

    expect(html).toContain("BS Computer Science");
    expect(html).toContain("Department of Computer Science");
    expect(html).toContain("Programming Fundamentals");
    expect(html).toContain("Artificial Intelligence &amp; Machine Learning Lab");
    expect(html).toContain("EducationalOccupationalProgram");
    expect(html).toContain("FAQPage");
  });
});
