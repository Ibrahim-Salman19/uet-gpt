import { expect, test } from "@playwright/test";

test.describe("admin route authorization", () => {
  test.describe("unauthenticated user", () => {
    // Override the committed superadmin storageState with an empty/anonymous
    // context so this test actually exercises the unauthenticated gate.
    test.use({ storageState: { cookies: [], origins: [] } });

    test("redirects unauthenticated users away from /admin", async ({ page }) => {
      await page.goto("/admin");

      // The admin gate must hard-redirect anonymous users to sign-in or
      // unauthorized. Use a web-first assertion that polls until navigation
      // settles, then assert a single expected outcome (no fail-open branch).
      await expect(page).toHaveURL(/\/(sign-in|unauthorized)/);
    });
  });

  test.describe("authenticated admin user", () => {
    // Uses the default project storageState (admin session) from playwright.config.
    test("renders the admin dashboard for an authorized admin", async ({ page }) => {
      await page.goto("/admin");

      // Must stay on /admin (not bounced to sign-in/unauthorized) and render
      // an admin-only landmark rather than merely asserting <body> is attached.
      await expect(page).toHaveURL(/\/admin/);
      await expect(page.getByRole("main")).toBeVisible();
    });
  });
});
