import { setupClerkTestingToken } from "@clerk/testing/playwright";
import { test as base, expect } from "@playwright/test";

/**
 * Shared base test that automatically installs the Clerk testing token on every
 * page before each test. The testing token bypasses Clerk's bot/captcha
 * protection (Turnstile is enabled on this instance), which is required for
 * deterministic automated runs.
 *
 * Import `test`/`expect` from this module instead of "@playwright/test" so the
 * token setup is applied uniformly, rather than per-spec opt-in (which led to
 * some specs flaking against Clerk bot detection).
 */
export const test = base.extend({
  page: async ({ page }, use) => {
    await setupClerkTestingToken({ page });
    await use(page);
  },
});

export { expect };
