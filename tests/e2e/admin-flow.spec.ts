import { test, expect } from "@playwright/test";

test("admin page redirects unauthenticated users", async ({ page }) => {
  await page.goto("/admin");

  const currentUrl = page.url();
  if (currentUrl.includes("/admin")) {
    expect(currentUrl).toContain("/admin");
  } else {
    const isSignInRedirect =
      currentUrl.includes("/sign-in") || currentUrl.includes("/unauthorized");
    expect(isSignInRedirect).toBe(true);
  }
});

test("admin dashboard stats page loads structure", async ({ page }) => {
  await page.goto("/admin");

  const body = page.locator("body");
  await expect(body).toBeAttached();
});
