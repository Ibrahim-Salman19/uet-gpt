import { test, expect } from "@playwright/test";

test("sign-in page shows welcome message and Clerk component", async ({ page }) => {
  await page.goto("/sign-in");
  await expect(page.getByText("Welcome to UET GPT")).toBeVisible();
});

test("sign-up page loads", async ({ page }) => {
  await page.goto("/sign-up");
  await expect(page).toHaveTitle(/UET GPT/);
});
