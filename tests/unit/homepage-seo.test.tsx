import { describe, expect, it } from "vitest";
import { metadata } from "@/app/page";

describe("Homepage SEO Metadata", () => {
  it("exports valid canonical, openGraph, twitter, and robots metadata", () => {
    expect(metadata.title).toBeDefined();
    expect((metadata.title as string).length).toBeLessThanOrEqual(60);
    expect(metadata.description).toContain("UET Taxila");
    expect((metadata.description as string).length).toBeLessThanOrEqual(160);
    expect(metadata.alternates?.canonical).toBe("https://uet-gpt.vercel.app");
    expect(metadata.openGraph?.images).toBeDefined();
    expect((metadata.twitter as { card?: string })?.card).toBe("summary_large_image");
  });
});
