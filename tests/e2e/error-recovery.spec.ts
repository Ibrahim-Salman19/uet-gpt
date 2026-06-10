import { test, expect } from "@playwright/test";
import { setupClerkTestingToken } from "@clerk/testing/playwright";

test.describe("Error Recovery", () => {
  test.beforeEach(async ({ page }) => {
    await setupClerkTestingToken({ page });
  });

  test("shows timeout UI when Convex is unreachable", async ({ page }) => {
    // Block Convex WebSocket
    await page.route("**/*.convex.cloud/**", (route) => route.abort());
    await page.goto("/chat");

    // After ConvexReadyGate timeout (10s), should show retry UI
    await expect(page.getByText("TIMEOUT // CONNECTION FAILURE")).toBeVisible({ timeout: 15000 });
    await expect(page.getByText("RETRY CONNECTION")).toBeVisible();
  });

  test("shows offline banner when network drops", async ({ page }) => {
    await page.goto("/chat");
    await expect(page.locator("#chat-input-field")).toBeVisible({ timeout: 5000 });

    // Simulate going offline
    await page.context().setOffline(true);
    await expect(page.getByText("You are offline")).toBeVisible({ timeout: 3000 });

    // Come back online
    await page.context().setOffline(false);
    await expect(page.getByText("Reconnected")).toBeVisible({ timeout: 5000 });
  });
});
