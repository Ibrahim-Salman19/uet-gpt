import { clerkSetup, clerk, setupClerkTestingToken } from "@clerk/testing/playwright";
import { test as setup } from "@playwright/test";
import path from "path";

const authFile = path.join(__dirname, "../../playwright/.clerk/state.json");

setup("clerk auth setup", async ({ page }) => {
  await clerkSetup();
  await setupClerkTestingToken({ page });
  
  // Navigate to sign-in page to load Clerk
  await page.goto("/sign-in");
  
  // Sign in programmatically
  await clerk.signIn({
    page,
    emailAddress: "ibrahim.pk848@gmail.com",
  });
  
  // Save storage state for reuse
  await page.context().storageState({ path: authFile });
});
