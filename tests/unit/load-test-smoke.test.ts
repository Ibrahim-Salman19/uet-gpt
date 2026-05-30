import { describe, it, expect } from "vitest";
import { runLoadTest } from "../load-test";

describe("load-test smoke (CI-safe)", () => {
  it("completes without error in safe mode", async () => {
    const convexSiteUrl = process.env.CONVEX_SITE_URL ?? "http://localhost:3000";
    const webhookSecret = process.env.CRAWL_WEBHOOK_SECRET ?? "test-secret";

    await expect(
      runLoadTest({ convexSiteUrl, webhookSecret, safeMode: true }),
    ).resolves.toBeUndefined();
  });
});
