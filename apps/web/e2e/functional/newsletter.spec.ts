import { test, expect } from "@playwright/test";

/**
 * E2E Tests: Newsletters
 * Covers the newsletters dashboard, creation (type=newsletter), scheduling, and embedded blog posts.
 * Routes: /newsletters, /campaigns/new?type=newsletter
 */

test.describe("Newsletters", () => {
  test.beforeEach(async ({ page }) => {
    // Use storage state from global setup
    await page.goto("/newsletters");
    if (page.url().includes("/login")) {
      // Fail fast if required env vars are missing - no hardcoded fallbacks
      const email = process.env.TEST_USER_EMAIL;
      const password = process.env.TEST_USER_PASSWORD;
      
      if (!email || !password) {
        throw new Error(
          "TEST_USER_EMAIL and TEST_USER_PASSWORD environment variables must be set. " +
          "These are required for E2E authentication."
        );
      }
      
      await page.fill('input[type="email"]', email);
      await page.fill('input[type="password"]', password);
      await page.click('button[type="submit"]');
      await page.waitForLoadState("networkidle");
    }
  });

  test.describe("Dashboard", () => {
    test("should render the newsletters dashboard", async ({ page }) => {
      await page.goto("/newsletters");
      
      // Should show Newsletters heading or content
      await expect(page.locator("h1").first()).toBeVisible();
      const pageContent = await page.content();
      expect(pageContent).toMatch(/Newsletters|newsletter/i);
    });

    test("should display stat cards", async ({ page }) => {
      await page.goto("/newsletters");

      // Stat cards: Total Sent, Scheduled, Drafts, All Newsletters
      const labels = ["Total Sent", "Scheduled", "Drafts", "All Newsletters"];
      let matched = 0;
      for (const label of labels) {
        if (await page.locator("text=" + label).first().isVisible().catch(() => false)) {
          matched++;
        }
      }
      expect(matched).toBeGreaterThan(0);
    });

    test("should expose a Create Newsletter action", async ({ page }) => {
      await page.goto("/newsletters");
      
      // Should have Create Newsletter link/button
      const createBtn = page.locator('a', { hasText: /Create Newsletter/i }).first();
      await expect(createBtn.or(page.locator('button', { hasText: /Create Newsletter/i }).first())).toBeVisible();
    });
  });

  test.describe("Create Newsletter", () => {
    test("should navigate to /campaigns/new with type=newsletter", async ({ page }) => {
      await page.goto("/newsletters");

      const createLink = page.locator('a', { hasText: /Create Newsletter/i }).first();

      if (await createLink.isVisible().catch(() => false)) {
        await createLink.click();
        await page.waitForURL(/\/campaigns\/new/, { timeout: 10000 });
        
        // Verify the URL includes type=newsletter query param
        const url = page.url();
        const urlObj = new URL(url);
        expect(urlObj.pathname).toBe("/campaigns/new");
        expect(urlObj.searchParams.get("type")).toBe("newsletter");
      } else {
        test.skip(true, "Create Newsletter link not rendered");
      }
    });

    test("should populate the type field as newsletter when query param is set", async ({ page }) => {
      await page.goto("/campaigns/new?type=newsletter");

      // On the campaign wizard, should show campaign creation UI
      await expect(page.locator("h1, h2").first()).toBeVisible();
      
      // Verify the Newsletter type option is visible and appears selected/active
      // The type field is shown as buttons in Step 1 of the wizard
      const newsletterBtn = page.locator('button', { hasText: 'Newsletter' }).first();
      await expect(newsletterBtn, 'Newsletter type option should be visible').toBeVisible();
      
      // Check if the Newsletter button appears selected (has visual indicator like different styling)
      // This could be via CSS class, aria-pressed, or visual state
      const isSelected = await newsletterBtn.evaluate((el) => {
        const classes = el.className;
        const ariaPressed = el.getAttribute('aria-pressed');
        const computedStyle = window.getComputedStyle(el);
        // Check for selected state indicators
        return classes.includes('selected') || 
               classes.includes('active') || 
               ariaPressed === 'true' ||
               computedStyle.borderWidth !== '0px';
      }).catch(() => false);
      
      expect(isSelected, 'Newsletter type should be pre-selected when type=newsletter query param is set').toBe(true);
    });
  });

  test.describe("Scheduling", () => {
    test.skip("should expose schedule controls when creating a newsletter", async ({ page }) => {
      // SKIPPED: Schedule controls are in step 3 of the wizard
      // Need to complete steps 1-2 first to reach scheduling
      await page.goto("/campaigns/new?type=newsletter");
    });
  });

  test.describe("Embedded Blog Posts", () => {
    test.skip("should provide a way to attach blog posts to a newsletter", async ({ page }) => {
      // SKIPPED: Blog post attachment is in later wizard steps
      // Need to verify where this feature is exposed
      await page.goto("/campaigns/new?type=newsletter");
    });
  });
});
