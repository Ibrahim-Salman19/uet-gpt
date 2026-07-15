import path from "path";
import { test } from "./fixtures/base-test";

const viewports = [
  { name: "mobile", width: 375, height: 667 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "desktop", width: 1440, height: 900 },
];

test("capture landing viewports", async ({ page }, testInfo) => {
  test.setTimeout(60000);
  for (const vp of viewports) {
    await page.setViewportSize({ width: vp.width, height: vp.height });

    // Go to chat page
    await page.goto("/chat");

    // Wait for the main chat input to be visible
    await page.waitForSelector("#chat-input-field", { timeout: 20000 });

    // Write artifacts to Playwright's per-test output dir so the spec is
    // portable across machines/CI instead of a developer-specific path.
    const screenshotPath = path.join(testInfo.outputDir, `viewport_${vp.name}.png`);
    await page.screenshot({ path: screenshotPath });
    await testInfo.attach(`viewport_${vp.name}`, {
      path: screenshotPath,
      contentType: "image/png",
    });
  }
});

test("capture active thread viewports", async ({ page }, testInfo) => {
  test.setTimeout(90000);

  // Set to desktop size first to start thread
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/chat");
  await page.waitForSelector("#chat-input-field", { timeout: 20000 });

  // Click first suggestion to start thread
  const suggestionBtn = page.locator("button:has-text('BS Fee Structure')").first();
  await suggestionBtn.click();

  // Wait for redirect to active thread URL (use a consistent, anchored regex
  // that matches the full Convex ID charset).
  await page.waitForURL(/\/chat\/[a-zA-Z0-9_-]+$/i, { timeout: 25000 });

  // Wait for the response container to be present.
  await page.waitForSelector(".chat-textarea, #chat-input-field", { timeout: 15000 });
  for (const vp of viewports) {
    await page.setViewportSize({ width: vp.width, height: vp.height });

    const screenshotPath = path.join(testInfo.outputDir, `thread_${vp.name}.png`);
    await page.screenshot({ path: screenshotPath });
    await testInfo.attach(`thread_${vp.name}`, {
      path: screenshotPath,
      contentType: "image/png",
    });
  }
});
