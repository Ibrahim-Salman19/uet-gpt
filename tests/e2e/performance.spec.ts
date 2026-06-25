import { setupClerkTestingToken } from "@clerk/testing/playwright";
import { expect, test } from "@playwright/test";

// Hard performance/bundle budgets are only meaningful against a production
// build (`next build && next start`). The default Playwright webServer runs
// `next dev`, whose on-demand compilation and unminified bundles make wall-clock
// and payload assertions flaky and unrepresentative. Enforce strict budgets
// only when E2E_PERF_BUDGETS=1 (set in a prod-build CI job); otherwise use
// generous dev-mode sanity ceilings so the suite still smoke-tests these paths
// without flaking.
const STRICT_BUDGETS = process.env.E2E_PERF_BUDGETS === "1";

const TTI_BUDGET_MS = STRICT_BUDGETS ? 5_000 : 30_000;
// Uncompressed JS ceiling. Dev bundles are far larger than the prod output.
const JS_BUDGET_BYTES = STRICT_BUDGETS ? 1_500_000 : 12_000_000;

test.describe("Performance", () => {
  test.beforeEach(async ({ page }) => {
    await setupClerkTestingToken({ page });
  });

  test("chat page Time to Interactive within budget", async ({ page }) => {
    const startTime = Date.now();
    await page.goto("/chat");
    await expect(page.locator("#chat-input-field")).toBeVisible({ timeout: TTI_BUDGET_MS });
    const tti = Date.now() - startTime;

    console.log(
      `Time to Interactive: ${tti}ms (budget ${TTI_BUDGET_MS}ms, strict=${STRICT_BUDGETS})`,
    );
    expect(tti).toBeLessThan(TTI_BUDGET_MS);
  });

  test("no significant layout shift (CLS < 0.1)", async ({ page }) => {
    await page.goto("/chat");
    await page.waitForLoadState("networkidle");

    const cls = await page.evaluate(() => {
      return new Promise<number>((resolve) => {
        let clsValue = 0;
        const observer = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            const shift = entry as PerformanceEntry & {
              value: number;
              hadRecentInput: boolean;
            };
            if (!shift.hadRecentInput) {
              clsValue += shift.value;
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

  test("initial JS bundle within budget", async ({ page }) => {
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
    console.log(
      `Total JS: ${(totalSize / 1024).toFixed(0)}KB across ${resources.length} files ` +
        `(budget ${(JS_BUDGET_BYTES / 1024).toFixed(0)}KB, strict=${STRICT_BUDGETS})`,
    );

    // Note: this is uncompressed. The strict budget is only representative of
    // the production build; the dev ceiling is a loose sanity check.
    expect(totalSize).toBeLessThan(JS_BUDGET_BYTES);
  });
});
