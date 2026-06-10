import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ["html", { outputFolder: "playwright-report" }],
    ["json", { outputFile: "test-results/results.json" }],
  ],
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    // Setup project for Clerk authentication
    {
      name: "setup",
      testMatch: /global\.setup\.ts/,
    },
    {
      name: "Desktop Chrome",
      use: {
        ...devices["Desktop Chrome"],
        storageState: "playwright/.clerk/state.json",
      },
      dependencies: ["setup"],
    },
    {
      name: "Mobile Chrome",
      use: {
        ...devices["Pixel 5"],
        storageState: "playwright/.clerk/state.json",
      },
      dependencies: ["setup"],
    },
  ],
  /* webServer: {
    command: "npm run dev", // Use dev server for faster E2E test runs locally
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 180 * 1000,
  }, */
});
