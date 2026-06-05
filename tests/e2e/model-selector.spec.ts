import { test, expect } from "@playwright/test";
import { setupClerkTestingToken } from "@clerk/testing/playwright";

test.describe("Model Selector", () => {
  test.beforeEach(async ({ page }) => {
    await setupClerkTestingToken({ page });
    await page.goto("/chat");
    await expect(page.locator("#chat-input-field")).toBeVisible({ timeout: 5000 });
  });

  test("shows current model label", async ({ page }) => {
    const modelButton = page.getByLabel("Select AI Model");
    await expect(modelButton).toBeVisible();
    const text = await modelButton.textContent();
    expect(text).toMatch(/UET-(Fast|Pro)/);
  });

  test("opens dropdown with model options", async ({ page }) => {
    await page.getByLabel("Select AI Model").click();
    await expect(page.getByText("UET-Fast")).toBeVisible();
    await expect(page.getByText("UET-Pro")).toBeVisible();
  });
});
