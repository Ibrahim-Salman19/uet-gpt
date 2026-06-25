import { AxeBuilder } from "@axe-core/playwright";
import { setupClerkTestingToken } from "@clerk/testing/playwright";
import { expect, test } from "@playwright/test";

test.describe("Accessibility (WCAG 2.2)", () => {
  test.beforeEach(async ({ page }) => {
    await setupClerkTestingToken({ page });
  });

  test("chat page has no auto-detected a11y violations", async ({ page }) => {
    await page.goto("/chat");
    await expect(page.locator("#chat-input-field")).toBeVisible({ timeout: 5000 });

    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
      .exclude("#webgl-canvas") // Exclude decorative canvas
      .analyze();

    expect(results.violations).toEqual([]);
  });

  test("all interactive elements have accessible names", async ({ page }) => {
    await page.goto("/chat");
    await expect(page.locator("#chat-input-field")).toBeVisible({ timeout: 5000 });

    // Compute the real accessible name per button instead of hand-rolling a
    // partial check. This honors aria-label, aria-labelledby, text content,
    // title, and an <img alt>-only button, and rejects whitespace-only labels.
    const buttons = await page.locator("button").all();
    for (const button of buttons) {
      const accessibleName = (
        await button.evaluate((el) => {
          const byId = (ids: string | null) =>
            (ids || "")
              .split(/\s+/)
              .filter(Boolean)
              .map((id) => document.getElementById(id)?.textContent ?? "")
              .join(" ");

          const ariaLabel = el.getAttribute("aria-label") ?? "";
          const labelledBy = byId(el.getAttribute("aria-labelledby"));
          const text = el.textContent ?? "";
          const title = el.getAttribute("title") ?? "";
          const imgAlt = Array.from(el.querySelectorAll("img"))
            .map((img) => img.getAttribute("alt") ?? "")
            .join(" ");

          return [ariaLabel, labelledBy, text, title, imgAlt].join(" ");
        })
      ).trim();

      expect(
        accessibleName.length,
        `Button is missing an accessible name: ${await button.evaluate((el) => el.outerHTML.slice(0, 200))}`,
      ).toBeGreaterThan(0);
    }
  });
});
