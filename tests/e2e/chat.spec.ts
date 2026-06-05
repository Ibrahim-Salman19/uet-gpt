import { test, expect } from "@playwright/test";
import { setupClerkTestingToken } from "@clerk/testing/playwright";

test.describe("Chat Flow", () => {
  test.beforeEach(async ({ page }) => {
    await setupClerkTestingToken({ page });
  });

  test("page loads within 5 seconds without getting stuck", async ({ page }) => {
    const startTime = Date.now();
    await page.goto("/chat");

    // Must see the chat input, NOT a blank/skeleton screen
    await expect(page.locator("#chat-input-field")).toBeVisible({ timeout: 5000 });

    const loadTime = Date.now() - startTime;
    expect(loadTime).toBeLessThan(5000);
  });

  test("shows suggestions on empty chat", async ({ page }) => {
    await page.goto("/chat");
    await expect(page.getByText("BS Fee Structure")).toBeVisible({ timeout: 5000 });
    await expect(page.getByText("2026 Admissions")).toBeVisible();
    await expect(page.getByText("Departments")).toBeVisible();
    await expect(page.getByText("Hostel Allotment")).toBeVisible();
  });

  test("sends a message and navigates to thread", async ({ page }) => {
    await page.goto("/chat");
    await page.locator("#chat-input-field").fill("What is the fee structure?");
    await page.keyboard.press("Enter");

    // Should navigate to /chat/[threadId]
    await expect(page).toHaveURL(/\/chat\/[a-z0-9]+/, { timeout: 10000 });
  });
});
