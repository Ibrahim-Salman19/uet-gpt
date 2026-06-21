import { test } from "@playwright/test";
import path from "path";

const ARTIFACT_DIR = "C:/Users/hafiz/.gemini/antigravity/brain/c00e70d0-efbf-4e8c-928a-24993418ddf7";

const viewports = [
  { name: "mobile", width: 375, height: 667 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "desktop", width: 1440, height: 900 }
];

test("capture landing viewports", async ({ page }) => {
  test.setTimeout(60000);
  for (const vp of viewports) {
    console.log(`Capturing landing ${vp.name} viewport...`);
    await page.setViewportSize({ width: vp.width, height: vp.height });
    
    // Go to chat page
    await page.goto("/chat");
    
    // Wait for the main chat input to be visible
    await page.waitForSelector("#chat-input-field", { timeout: 20000 });
    await page.waitForTimeout(2000);
    
    const screenshotPath = path.join(ARTIFACT_DIR, `viewport_${vp.name}.png`);
    await page.screenshot({ path: screenshotPath });
    console.log(`Saved screenshot to ${screenshotPath}`);
  }
});

test("capture active thread viewports", async ({ page }) => {
  test.setTimeout(90000);
  
  // Set to desktop size first to start thread
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/chat");
  await page.waitForSelector("#chat-input-field", { timeout: 20000 });
  
  // Wait for Convex client authentication to be established
  console.log("Waiting for Convex auth to settle...");
  await page.waitForTimeout(5000);
  
  // Click first suggestion to start thread
  console.log("Clicking suggestion chip to start thread...");
  const suggestionBtn = page.locator("button:has-text('BS Fee Structure')").first();
  await suggestionBtn.click();
  
  // Wait for redirect to active thread URL
  console.log("Waiting for redirection to chat thread URL...");
  await page.waitForURL(/\/chat\/[a-zA-Z0-9_-]+/i, { timeout: 25000 });
  console.log(`Navigated to active thread URL: ${page.url()}`);
  
  // Wait for the response to load (chat message container / items)
  await page.waitForSelector(".chat-textarea, #chat-input-field", { timeout: 15000 });
  // Let it load/generate for a bit
  await page.waitForTimeout(5000);
  
  for (const vp of viewports) {
    console.log(`Capturing thread ${vp.name} viewport...`);
    await page.setViewportSize({ width: vp.width, height: vp.height });
    
    // Extra timeout for layout changes to adjust
    await page.waitForTimeout(3000);
    
    const screenshotPath = path.join(ARTIFACT_DIR, `thread_${vp.name}.png`);
    await page.screenshot({ path: screenshotPath });
    console.log(`Saved thread screenshot to ${screenshotPath}`);
  }
});
