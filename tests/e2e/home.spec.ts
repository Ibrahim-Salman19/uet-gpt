import { expect, test } from "./fixtures/base-test";

test("root redirects to /chat", async ({ page }) => {
  await page.goto("/");
  await page.waitForURL("/chat");
  await expect(page).toHaveURL(/\/chat/);
});

test("chat page loads and renders the chat window", async ({ page }) => {
  await page.goto("/chat");
  await expect(page).toHaveTitle(/UET GPT/);
});
