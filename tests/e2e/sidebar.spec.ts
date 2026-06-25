import { expect, test } from "./fixtures/base-test";

test.describe("Sidebar", () => {
  test("desktop: sidebar visible by default", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/chat");
    await expect(page.locator("#chat-input-field")).toBeVisible({ timeout: 5000 });
    const sidebar = page.locator("aside[aria-label='Navigation sidebar']");
    await expect(sidebar).toBeVisible();
  });

  test("desktop: toggle on hamburger click", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/chat");
    await expect(page.locator("#chat-input-field")).toBeVisible({ timeout: 5000 });
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
    // Set the mobile viewport BEFORE navigation so the app renders in its
    // mobile (collapsed-sidebar) state, rather than resizing a desktop-open
    // layout after load.
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/chat");
    await expect(page.locator("#chat-input-field")).toBeVisible({ timeout: 5000 });

    // Assert the sidebar is not presented to the user. Using a semantic
    // visibility check is resilient to the hiding mechanism (display:none,
    // visibility:hidden, zero width, or an off-screen transform) instead of
    // relying on brittle bounding-box pixel math.
    const sidebar = page.locator("aside[aria-label='Navigation sidebar']");
    await expect(sidebar).toBeHidden();
  });
});
