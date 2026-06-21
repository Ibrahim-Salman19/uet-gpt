import { test, expect } from "@playwright/test";
import { setupClerkTestingToken } from "@clerk/testing/playwright";

test.describe("Sidebar", () => {
  test.beforeEach(async ({ page }) => {
    await setupClerkTestingToken({ page });
    await page.goto("/chat");
    // Wait for page to be interactive
    await expect(page.locator("#chat-input-field")).toBeVisible({ timeout: 5000 });
  });

  test("desktop: sidebar visible by default", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    const sidebar = page.locator("aside[aria-label='Navigation sidebar']");
    await expect(sidebar).toBeVisible();
  });

  test("desktop: toggle on hamburger click", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    const hamburger = page.getByLabel("Toggle navigation");
    const sidebar = page.locator("aside[aria-label='Navigation sidebar']");

    // Close using keyboard shortcut (since hamburger is hidden when sidebar is open on desktop)
    await page.keyboard.press("Control+/");
    await expect(sidebar).toHaveCSS("width", "0px", { timeout: 2000 });

    // Open using hamburger (since hamburger is now visible when sidebar is closed)
    await hamburger.click();
    await expect(sidebar).not.toHaveCSS("width", "0px", { timeout: 2000 });
  });

  test("mobile: sidebar hidden by default", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    const sidebar = page.locator("aside[aria-label='Navigation sidebar']");
    const box = await sidebar.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.x + box!.width).toBeLessThanOrEqual(0);
  });
});
