/// <reference types="node" />
import { chromium, type FullConfig } from "@playwright/test";
import path from "path";
import fs from "fs";

// Debug helper to capture page state on failure
async function captureDebugInfo(page: any, label: string, storageStateDir: string) {
  const timestamp = Date.now();
  try {
    const screenshotPath = path.join(storageStateDir, `debug-${label}-${timestamp}.png`);
    await page.screenshot({ path: screenshotPath, fullPage: true });
    console.log(`[Global Setup] Screenshot saved: ${screenshotPath}`);
  } catch (e) {
    console.log(`[Global Setup] Could not capture screenshot: ${e}`);
  }
  try {
    const html = await page.content();
    const htmlPath = path.join(storageStateDir, `debug-${label}-${timestamp}.html`);
    fs.writeFileSync(htmlPath, html);
    console.log(`[Global Setup] HTML saved: ${htmlPath}`);
  } catch (e) {
    console.log(`[Global Setup] Could not capture HTML: ${e}`);
  }
}

/**
 * Global setup for Playwright E2E tests
 * Creates authenticated state for tests that require login
 */
async function globalSetup(config: FullConfig) {
  console.log("[Global Setup] ==== VERSION 2 - WITH ROOT PATH FIX ====");
  const baseURL = config.projects[0]?.use?.baseURL;
  const storageStatePath =
    (config.projects[0]?.use?.storageState as string | undefined) ||
    path.join(process.cwd(), "e2e", ".auth", "user.json");

  // Skip if no baseURL configured
  if (!baseURL) {
    console.log("[Global Setup] No baseURL configured, skipping auth setup");
    return;
  }

  // Create storage state directory if it doesn't exist
  const storageStateDir = path.dirname(storageStatePath);
  if (!fs.existsSync(storageStateDir)) {
    fs.mkdirSync(storageStateDir, { recursive: true });
  }

  // Check if we should use existing auth
  if (process.env.SKIP_GLOBAL_SETUP === "true") {
    console.log("[Global Setup] SKIP_GLOBAL_SETUP=true, skipping auth setup");
    return;
  }

  // Try to authenticate
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  // Check if we can log in with test credentials
  const testEmail = process.env.TEST_USER_EMAIL || "test@example.com";
  const testPassword = process.env.TEST_USER_PASSWORD || "testpassword123";
  const testName = process.env.TEST_USER_NAME || "Tom Brady";

  console.log(`[Global Setup] Using email: ${testEmail}, password: ${process.env.TEST_USER_PASSWORD ? "***" : "empty"}`);

  try {
    console.log(`[Global Setup] Attempting to authenticate at ${baseURL}`);

    // Navigate to login page
    await page.goto(`${baseURL}/login`, { timeout: 15000 });

    // Fill in login form
    await page.fill('input[type="email"], input[name="email"]', testEmail);
    await page.fill('input[type="password"], input[name="password"]', testPassword);

    // Submit form
    await page.click('button[type="submit"], button:has-text("Sign in"), button:has-text("Login")');

    // Wait for navigation - Neon Auth redirects to / (root) or /contacts after login
    console.log("[Global Setup] Waiting for navigation after login...");
    await page.waitForURL((url: URL) => {
      const pathname = url.pathname;
      const matches = pathname === '/' || pathname === '/dashboard' || pathname === '/settings' || pathname === '/contacts';
      console.log(`[Global Setup] URL check: ${pathname} -> ${matches}`);
      return matches;
    }, { timeout: 10000 });

    // Save storage state
    await context.storageState({ path: storageStatePath });
    console.log(`[Global Setup] Authentication successful, saved state to ${storageStatePath}`);
  } catch (loginError) {
    console.log(`[Global Setup] Login failed (${loginError instanceof Error ? loginError.message : loginError}), attempting to create test user via signup...`);

    try {
      // Navigate to signup page
      await page.goto(`${baseURL}/signup`, { timeout: 15000 });
      console.log(`[Global Setup] On signup page, filling form...`);

      // Fill in signup form
      await page.fill('input[name="name"]', testName);
      await page.fill('input[name="email"]', testEmail);
      await page.fill('input[name="password"]', testPassword);
      console.log(`[Global Setup] Form filled, submitting...`);

      // Submit signup form and wait for navigation
      await Promise.all([
        page.waitForURL((url: URL) => {
          const pathname = url.pathname;
          return pathname === '/' || pathname === '/dashboard' || pathname === '/settings' || pathname === '/contacts';
        }, { timeout: 20000 }),
        page.click('button[type="submit"]')
      ]);

      console.log(`[Global Setup] Signup successful, saving state...`);
      // Save storage state
      await context.storageState({ path: storageStatePath });
      console.log(`[Global Setup] Test user created and authenticated, saved state to ${storageStatePath}`);
    } catch (signupError) {
      console.warn("[Global Setup] Signup failed:", signupError instanceof Error ? signupError.message : signupError);
      await captureDebugInfo(page, 'signup-failed', storageStateDir);

      // Try one more time with direct navigation to see current state
      try {
        const currentUrl = page.url();
        console.log(`[Global Setup] Current URL after signup failure: ${currentUrl}`);
      } catch {
        // Ignore
      }

      console.warn("[Global Setup] Tests will run without auth state");
      // Create empty storage state so tests don't fail
      try {
        await context.storageState({ path: storageStatePath });
      } catch (saveError) {
        console.warn("[Global Setup] Could not save empty storage state:", saveError instanceof Error ? saveError.message : saveError);
      }
    }
  } finally {
    await browser.close();
  }
}

export default globalSetup;
