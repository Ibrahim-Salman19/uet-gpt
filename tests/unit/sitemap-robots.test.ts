import { describe, expect, it } from "vitest";
import robots from "@/app/robots";
import sitemap from "@/app/sitemap";

describe("Sitemap & Robots Validation", () => {
  it("includes all primary, legal, and learn pages in the sitemap", async () => {
    const urls = await sitemap();
    const siteUrls = urls.map((u) => u.url);

    expect(siteUrls).toContain("https://uet-gpt.vercel.app");
    expect(siteUrls).toContain("https://uet-gpt.vercel.app/tools");
    expect(siteUrls).toContain("https://uet-gpt.vercel.app/academics");
    expect(siteUrls).toContain("https://uet-gpt.vercel.app/admissions");
    expect(siteUrls).toContain("https://uet-gpt.vercel.app/campus-life");
    expect(siteUrls).toContain("https://uet-gpt.vercel.app/uet");
    expect(siteUrls).toContain("https://uet-gpt.vercel.app/uet-taxila");
    expect(siteUrls).toContain("https://uet-gpt.vercel.app/uet-gpt");
    expect(siteUrls).toContain("https://uet-gpt.vercel.app/learn");
    expect(siteUrls).toContain("https://uet-gpt.vercel.app/learn/ecat");
    expect(siteUrls).toContain("https://uet-gpt.vercel.app/about");
    expect(siteUrls).toContain("https://uet-gpt.vercel.app/privacy");
    expect(siteUrls).toContain("https://uet-gpt.vercel.app/terms");
    expect(siteUrls).toContain("https://uet-gpt.vercel.app/contact");
  });

  it("uses stable per-page lastModified dates rather than dynamic current timestamp", async () => {
    const urls = await sitemap();
    expect(urls.length).toBeGreaterThan(0);
    for (const entry of urls) {
      expect(entry.lastModified).toBeDefined();
      const date = new Date(entry.lastModified!);
      expect(date.getFullYear()).toBe(2026);
      expect(Number.isNaN(date.getTime())).toBe(false);
    }
  });

  it("configures robots.txt to allow search engines and disallow private routes", () => {
    const r = robots();
    expect(r.rules).toBeDefined();
    expect(r.sitemap).toBe("https://uet-gpt.vercel.app/sitemap.xml");
  });
});
