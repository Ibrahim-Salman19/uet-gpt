import { setupClerkTestingToken } from "@clerk/testing/playwright";
import { expect, test } from "@playwright/test";

test.describe("Error Recovery", () => {
  test.beforeEach(async ({ page }) => {
    await setupClerkTestingToken({ page });
  });

  test("shows timeout UI when Convex is unreachable", async ({ page }) => {
    // Block the Convex realtime/HTTP endpoints. Cover both the websocket
    // (wss://*.convex.cloud) and HTTP (*.convex.cloud / *.convex.site) hosts so
    // the gate's connection handshake genuinely fails regardless of transport.
    await page.route(/(\.convex\.cloud|\.convex\.site)(\/|$)/, (route) => route.abort());
    await page.goto("/chat");

    // After the ConvexReadyGate handshake timeout the retry UI appears. Assert
    // on the stable RETRY CONNECTION control (a real, interactive element) and
    // give generous headroom over the internal gate timeout for CI load.
    // Web-first assertions poll until the element is visible.
    await expect(page.getByRole("button", { name: /retry connection/i })).toBeVisible({
      timeout: 20000,
    });
    await expect(page.getByText(/connection failure/i)).toBeVisible();
  });

  test("shows offline banner when network drops", async ({ page }) => {
    await page.goto("/chat");
    await expect(page.locator("#chat-input-field")).toBeVisible({ timeout: 10000 });

    // The ConnectionStatus banner is a single role=status region whose text
    // toggles between offline/reconnected. Target it by role for resilience to
    // copy changes, and poll the text rather than racing a fixed window.
    const banner = page.getByRole("status");

    // Simulate going offline.
    await page.context().setOffline(true);
    await expect(banner).toContainText(/you are offline/i, { timeout: 10000 });

    // Come back online — the "Reconnected" state is shown briefly (auto-dismiss
    // after ~3s in the component), so poll with margin.
    await page.context().setOffline(false);
    await expect(banner).toContainText(/reconnected/i, { timeout: 10000 });
  });
});
