import { test, expect } from "@playwright/test";
import { setupClerkTestingToken } from "@clerk/testing/playwright";

const viewports = [
  { name: "iPhone SE", width: 375, height: 667 },
  { name: "iPhone 14", width: 390, height: 844 },
  { name: "iPad", width: 768, height: 1024 },
  { name: "Desktop", width: 1440, height: 900 },
];

for (const vp of viewports) {
  test.describe(`Responsive: ${vp.name} (${vp.width}x${vp.height})`, () => {
    test.beforeEach(async ({ page }) => {
      await setupClerkTestingToken({ page });
      await page.setViewportSize({ width: vp.width, height: vp.height });
    });

    test("chat page renders without overflow", async ({ page }) => {
      await page.goto("/chat");
      await expect(page.locator("#chat-input-field")).toBeVisible({ timeout: 5000 });

      // No horizontal scrollbar
      const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
      const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
      expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1);
    });

    test("chat input is reachable and usable", async ({ page }) => {
      await page.goto("/chat");
      const input = page.locator("#chat-input-field");
      await expect(input).toBeVisible({ timeout: 5000 });
      await input.fill("Test message");
      await expect(input).toHaveValue("Test message");
    });
  });
}
