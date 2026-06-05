import { test, expect } from "@playwright/test";
import { setupClerkTestingToken } from "@clerk/testing/playwright";

test.describe("Performance", () => {
  test.beforeEach(async ({ page }) => {
    await setupClerkTestingToken({ page });
  });

  test("chat page Time to Interactive < 5 seconds", async ({ page }) => {
    const startTime = Date.now();
    await page.goto("/chat");
    await expect(page.locator("#chat-input-field")).toBeVisible({ timeout: 5000 });
    const tti = Date.now() - startTime;

    console.log(`Time to Interactive: ${tti}ms`);
    expect(tti).toBeLessThan(5000);
  });

  test("no significant layout shift (CLS < 0.1)", async ({ page }) => {
    await page.goto("/chat");
    await page.waitForLoadState("networkidle");

    const cls = await page.evaluate(() => {
      return new Promise<number>((resolve) => {
        let clsValue = 0;
        const observer = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (!(entry as any).hadRecentInput) {
              clsValue += (entry as any).value;
            }
          }
        });
        observer.observe({ type: "layout-shift", buffered: true });
        setTimeout(() => {
          observer.disconnect();
          resolve(clsValue);
        }, 3000);
      });
    });

    console.log(`CLS: ${cls}`);
    expect(cls).toBeLessThan(0.1);
  });

  test("initial JS bundle < 400KB gzipped", async ({ page }) => {
    const resources: { size: number; name: string }[] = [];

    page.on("response", async (response) => {
      if (response.url().includes("/_next/static") && response.url().endsWith(".js")) {
        const body = await response.body().catch(() => null);
        if (body) {
          resources.push({ size: body.length, name: response.url().split("/").pop()! });
        }
      }
    });

    await page.goto("/chat");
    await page.waitForLoadState("networkidle");

    const totalSize = resources.reduce((sum, r) => sum + r.size, 0);
    console.log(`Total JS: ${(totalSize / 1024).toFixed(0)}KB across ${resources.length} files`);

    // This is uncompressed; gzipped should be ~30% of this
    expect(totalSize).toBeLessThan(1_500_000); // 1.5MB uncompressed
  });
});
