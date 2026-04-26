import { defineConfig, devices } from "@playwright/test";
import path from "path";

// Load environment variables from .env.local for E2E tests
import dotenv from "dotenv";
dotenv.config({ path: path.join(__dirname, ".env.local") });

const storageStatePath = path.join(process.cwd(), "e2e", ".auth", "user.json");

/**
 * OutreachOS Playwright E2E Test Configuration
 * Supports both functional tests and security-focused OWASP testing
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  testDir: "./e2e",
  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  /* Opt out of parallel tests on CI */
  workers: process.env.CI ? 1 : undefined,
  /* Reporter to use */
  reporter: [
    ["html", { outputFolder: "./playwright-report" }],
    ["json", { outputFile: "./playwright-report/results.json" }],
    ["list"],
  ],
  /* Global setup for authentication */
  globalSetup: require.resolve("./e2e/global-setup"),
  /* Shared settings for all the projects below */
  use: {
    /* Base URL to use in actions like `await page.goto('/')` */
    baseURL: process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3000",
    /* Collect trace when retrying the failed test */
    trace: "on-first-retry",
    /* Screenshot on failure */
    screenshot: "only-on-failure",
    /* Video recording */
    video: "on-first-retry",
    /* Extra HTTP headers for security testing */
    extraHTTPHeaders: {
      "X-Test-Session": process.env.PLAYWRIGHT_TEST_SESSION || "default",
    },
  },

  /* Configure projects for different test types */
  projects: [
    // Functional E2E Tests - Desktop Chrome (default runner)
    {
      name: "functional",
      testMatch: /functional\/.*\.spec\.ts/,
      use: { ...devices["Desktop Chrome"], storageState: storageStatePath, ignoreHTTPSErrors: true },
    },
    // Functional E2E Tests - Firefox (cross-browser)
    {
      name: "functional-firefox",
      testMatch: /functional\/.*\.spec\.ts/,
      use: { ...devices["Desktop Firefox"], storageState: storageStatePath, ignoreHTTPSErrors: true },
    },
    // Functional E2E Tests - WebKit (Safari)
    {
      name: "functional-webkit",
      testMatch: /functional\/.*\.spec\.ts/,
      use: { ...devices["Desktop Safari"], storageState: storageStatePath, ignoreHTTPSErrors: true },
    },
    // Functional E2E Tests - Mobile
    {
      name: "functional-mobile",
      testMatch: /functional\/.*\.spec\.ts/,
      use: { ...devices["Pixel 5"], storageState: storageStatePath, ignoreHTTPSErrors: true },
    },

    // Security Tests (OWASP Top 10) - All security tests in one project
    {
      name: "security",
      testMatch: /security\/.*\.test\.ts/,
      use: { ...devices["Desktop Chrome"], ignoreHTTPSErrors: false },
    },
  ],

  /* Run local dev server before starting the tests */
  webServer: {
    command: process.env.CI ? "pnpm start" : "pnpm dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
    stdout: "pipe",
    stderr: "pipe",
  },
});
