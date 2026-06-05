import { test, expect } from "@playwright/test";
import { AxeBuilder } from "@axe-core/playwright";
import { setupClerkTestingToken } from "@clerk/testing/playwright";

test.describe("Accessibility (WCAG 2.2)", () => {
  test.beforeEach(async ({ page }) => {
    await setupClerkTestingToken({ page });
  });

  test("chat page has no auto-detected a11y violations", async ({ page }) => {
    await page.goto("/chat");
    await expect(page.locator("#chat-input-field")).toBeVisible({ timeout: 5000 });

    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
      .exclude("#webgl-canvas") // Exclude decorative canvas
      .analyze();

    expect(results.violations).toEqual([]);
  });

  test("all interactive elements have accessible names", async ({ page }) => {
    await page.goto("/chat");
    await expect(page.locator("#chat-input-field")).toBeVisible({ timeout: 5000 });

    // Check all buttons have labels
    const buttons = await page.locator("button").all();
    for (const button of buttons) {
      const name = await button.getAttribute("aria-label");
      const text = await button.textContent();
      const hasLabel = name || (text && text.trim().length > 0);
      expect(hasLabel).toBeTruthy();
    }
  });
});
