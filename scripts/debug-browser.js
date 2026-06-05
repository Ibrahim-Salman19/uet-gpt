const { chromium } = require('@playwright/test');
const path = require('path');

(async () => {
  console.log('Launching browser...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 }
  });
  const page = await context.newPage();

  // Log all console messages
  page.on('console', msg => {
    console.log(`[BROWSER CONSOLE] [${msg.type()}] ${msg.text()}`);
  });

  // Log all uncaught errors
  page.on('pageerror', err => {
    console.error(`[BROWSER ERROR] ${err.message}\nStack: ${err.stack}`);
  });

  console.log('Navigating to http://localhost:3000/chat...');
  try {
    await page.goto('http://localhost:3000/chat', { waitUntil: 'networkidle', timeout: 30000 });
    console.log('Page loaded. Current URL:', page.url());
    
    // Let's wait a bit for any dynamic rendering
    await page.waitForTimeout(5000);
    
    const screenshotPath = path.join(__dirname, 'browser_debug.png');
    await page.screenshot({ path: screenshotPath });
    console.log(`Screenshot saved to ${screenshotPath}`);
  } catch (error) {
    console.error('Error during navigation:', error);
  } finally {
    await browser.close();
    console.log('Browser closed.');
  }
})();
