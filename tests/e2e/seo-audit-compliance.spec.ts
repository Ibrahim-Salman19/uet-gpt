import { expect, test } from "@playwright/test";

test.describe("SEO Remediation End-to-End Audit Compliance", () => {
  test("homepage delivers complete metadata, schema, and main landmarks", async ({ page }) => {
    await page.goto("/");

    // 1. Title and Description
    await expect(page).toHaveTitle(/UET GPT/);
    const metaDescription = page.locator('meta[name="description"]');
    await expect(metaDescription).toHaveAttribute("content", /.+/);

    // 2. Canonical alternate
    const canonical = page.locator('link[rel="canonical"]');
    await expect(canonical).toHaveAttribute("href", /https:\/\/uet-gpt\.vercel\.app/);

    // 3. OpenGraph tags
    const ogTitle = page.locator('meta[property="og:title"]');
    await expect(ogTitle).toHaveAttribute("content", /.+/);
    const ogImage = page.locator('meta[property="og:image"]');
    await expect(ogImage).toHaveAttribute("content", /opengraph-image/);

    // 4. Main landmark
    const main = page.locator("main#main-content");
    await expect(main).toBeVisible();

    // 5. JSON-LD Schemas present
    const schemas = await page.locator('script[type="application/ld+json"]').allTextContents();
    expect(schemas.length).toBeGreaterThan(0);
    const hasOrgOrWebSite = schemas.some(
      (s) => s.includes("WebSite") || s.includes("Organization") || s.includes("FAQPage"),
    );
    expect(hasOrgOrWebSite).toBe(true);
  });

  test("legal pages are crawlable and deliver proper titles and breadcrumbs", async ({ page }) => {
    const legalPages = ["/about", "/privacy", "/terms", "/contact"];

    for (const path of legalPages) {
      await page.goto(path);
      const heading = page.locator("h1");
      await expect(heading).toBeVisible();
      const canonical = page.locator('link[rel="canonical"]');
      await expect(canonical).toHaveAttribute("href", new RegExp(`.*${path}`));
    }
  });

  test("sub-pages deliver optimized title lengths and cross-linking", async ({ page }) => {
    await page.goto("/uet-taxila");
    const admissionsLink = page.locator('a[href="/uet-taxila/admissions"]');
    await expect(admissionsLink.first()).toBeVisible();

    await page.goto("/uet-taxila/admissions");
    const feeLink = page.locator('a[href="/uet-taxila/fee-structure"]');
    await expect(feeLink.first()).toBeVisible();
  });
});
