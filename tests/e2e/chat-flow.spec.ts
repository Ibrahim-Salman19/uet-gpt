import { expect, test } from "./fixtures/base-test";

test("chat page has the chat input", async ({ page }) => {
  await page.goto("/chat");

  const textarea = page.locator("textarea").first();
  await expect(textarea).toBeAttached({ timeout: 10_000 });
});

test("chat page enables sending a message", async ({ page }) => {
  await page.goto("/chat");

  const textarea = page.locator("textarea").first();
  await expect(textarea).toBeAttached({ timeout: 10_000 });

  await textarea.fill("What is the fee structure?");
  const submitButton = page.locator('button[type="submit"]').first();
  await expect(submitButton).toBeEnabled();
});
