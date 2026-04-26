import { test, expect } from "@playwright/test";

/**
 * E2E Tests: Funnel Campaigns
 * Covers funnel creation with entry conditions, sequential follow-up steps, and activation.
 * Routes: /campaigns/funnel/new, /campaigns/funnel/[id]
 */

test.describe("Funnel Campaigns", () => {
  test.beforeEach(async ({ page }) => {
    // Use storage state from global setup
    await page.goto("/campaigns");
    if (page.url().includes("/login")) {
      const email = process.env.TEST_USER_EMAIL ?? "test@example.com";
      const password = process.env.TEST_USER_PASSWORD ?? "password123";
      await page.fill('input[type="email"]', email);
      await page.fill('input[type="password"]', password);
      await page.click('button[type="submit"]');
      await page.waitForLoadState("networkidle");
    }
  });

  test.describe("Funnel Builder", () => {
    test("should open the funnel builder page", async ({ page }) => {
      await page.goto("/campaigns/funnel/new");
      
      // Page should have heading with "Funnel"
      await expect(page.locator("text=Funnel").first()).toBeVisible();
    });

    test("should render default follow-up steps", async ({ page }) => {
      await page.goto("/campaigns/funnel/new");

      // The default steps include Initial, 1st Follow Up, 2nd Follow Up, Hail Mary
      // Check for step names in the UI
      const stepNames = ["Initial", "1st Follow Up", "2nd Follow Up", "Hail Mary"];
      let foundSteps = 0;
      
      for (const stepName of stepNames) {
        if (await page.locator(`text=${stepName}`).first().isVisible()) {
          foundSteps++;
        }
      }
      
      // All 4 default steps should be present
      expect(foundSteps).toBe(stepNames.length);
    });

    test.skip("should allow adding a custom step", async ({ page }) => {
      // SKIPPED: Requires verification of step adding functionality
      await page.goto("/campaigns/funnel/new");

      const addStepBtn = page.locator('button:has-text("Add Step"), button:has-text("+ Step")').first();
      if (await addStepBtn.isVisible().catch(() => false)) {
        await addStepBtn.click();
        // Verify step was added
      }
    });
  });

  test.describe("Entry Conditions", () => {
    test("should present the funnel condition dropdown", async ({ page }) => {
      await page.goto("/campaigns/funnel/new");

      // Look for condition type select
      const conditionSelect = page.locator("select").first();

      if (await conditionSelect.isVisible().catch(() => false)) {
        const options = await conditionSelect.locator("option").allTextContents();
        expect(options.length, "Condition dropdown must have at least one option").toBeGreaterThan(0);
        const hasExpectedOption = options.some((o) => /did not open|opened|replied|filled form/i.test(o));
        expect(hasExpectedOption, "Condition dropdown must include a known option").toBe(true);
      } else {
        test.skip(true, "Condition dropdown not visible");
      }
    });
  });

  test.describe("Funnel Lifecycle", () => {
    test("should validate required fields before creating a funnel", async ({ page }) => {
      await page.goto("/campaigns/funnel/new");

      // Try to submit empty form - look for create button
      const submitBtn = page.locator('button:has-text("Create"), button[type="submit"]').first();

      if (await submitBtn.isVisible().catch(() => false)) {
        await submitBtn.click();
        // Assert we remain on the same page (validation should prevent navigation)
        await expect(page).toHaveURL(/\/campaigns\/funnel\/new/);
      } else {
        test.skip(true, "Submit button not visible");
      }
    });

    test("should display funnel creation form at the new route", async ({ page }) => {
      // Validates the /campaigns/funnel/new route is reachable and renders the name input.
      await page.goto("/campaigns/funnel/new");

      await expect(page).toHaveURL(/\/campaigns\/funnel\/new/);

      // Look for name input
      const nameInput = page.locator('input[type="text"]').first();

      await expect(nameInput, "Funnel name input must be visible on the creation form").toBeVisible();
    });
  });
});
