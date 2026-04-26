import { test, expect } from "@playwright/test";

/**
 * E2E Tests: Campaigns Management
 * Tests for campaign CRUD operations and lifecycle
 * Updated to match actual 3-step campaign creation wizard UI
 */

test.describe("Campaigns", () => {
  test.beforeEach(async ({ page }) => {
    // Use storage state from global setup (already authenticated)
    // Navigate to campaigns page to verify auth
    await page.goto("/campaigns");
    // If redirected to login, we need to authenticate
    if (page.url().includes("/login")) {
      const email = process.env.TEST_USER_EMAIL ?? "test@example.com";
      const password = process.env.TEST_USER_PASSWORD ?? "testpassword123";
      await page.fill('input[type="email"]', email);
      await page.fill('input[type="password"]', password);
      await page.click('button[type="submit"]');
      await page.waitForLoadState("networkidle");
    }
  });

  test.describe("Campaign List", () => {
    test("should display campaign list", async ({ page }) => {
      await page.goto("/campaigns");

      // Should show campaigns page with h1 heading
      await expect(page.locator("h1").filter({ hasText: "Campaigns" })).toBeVisible();
    });

    test("should have create campaign button", async ({ page }) => {
      await page.goto("/campaigns");

      // Look for "New Campaign" link (actual UI uses this text)
      await expect(page.locator("a").filter({ hasText: "New Campaign" })).toBeVisible();
    });

    test("should filter campaigns by status", async ({ page }) => {
      await page.goto("/campaigns");

      // The filter buttons are visible: All, Draft, Active, Paused, Completed
      // Click on "Active" filter button
      await page.locator("button", { hasText: "Active" }).click();

      // The "Active" button should now have the selected style (bg-primary class)
      const activeButton = page.locator("button", { hasText: "Active" });
      await expect(activeButton).toBeVisible();

      // If there are campaigns, check they have Active badge
      // Campaign table uses tr elements with status badges
      const rows = page.locator("table tbody tr");
      const rowCount = await rows.count();
      if (rowCount > 0) {
        // All visible rows should have "Active" badge
        for (let i = 0; i < rowCount; i++) {
          const row = rows.nth(i);
          await expect(row.locator("text=Active")).toBeVisible();
        }
      }
    });
  });

  test.describe("Create Campaign", () => {
    test("should create one-time campaign", async ({ page }) => {
      await page.goto("/campaigns/new");

      // Step 1: Select campaign type - click on "One-Time Campaign" button
      await page.click("text=One-Time Campaign");

      // Step 2: Fill campaign details
      const campaignName = `Test One-Time ${Date.now()}`;
      await page.fill('#campaign-name', campaignName);
      // Group and template are optional, skip them

      // Click Next to go to schedule step
      await page.click('button:has-text("Next: Schedule")');

      // Step 3: Create campaign (send immediately is default)
      await page.click('button:has-text("Create Campaign")');

      // Should redirect to analytics page
      await page.waitForURL(/\/campaigns\/.*\/analytics/, { timeout: 10000 });
    });

    test("should create newsletter campaign", async ({ page }) => {
      await page.goto("/campaigns/new");

      // Step 1: Select "Newsletter" type
      await page.locator("button", { hasText: "Newsletter" }).first().click();

      // Step 2: Fill name
      await page.fill('#campaign-name', `Test Newsletter ${Date.now()}`);

      // Click Next
      await page.click('button:has-text("Next: Schedule")');

      // Step 3: Create
      await page.click('button:has-text("Create Campaign")');

      // Should redirect to analytics
      await page.waitForURL(/\/campaigns\/.*\/analytics/, { timeout: 10000 });
    });

    test("should validate required fields", async ({ page }) => {
      await page.goto("/campaigns/new");

      // Select campaign type first
      await page.click("text=One-Time Campaign");

      // Try to proceed without entering name - button should be disabled
      const nextButton = page.locator('button:has-text("Next: Schedule")');
      await expect(nextButton).toBeDisabled();
    });

    test("should create journey campaign", async ({ page }) => {
      await page.goto("/campaigns/new");

      // Step 1: Select "Journey (Multi-Step)"
      await page.click("text=Journey");

      // Step 2: Fill name
      await page.fill('#campaign-name', `Test Journey ${Date.now()}`);

      // Click Next
      await page.click('button:has-text("Next: Schedule")');

      // Step 3: Create
      await page.click('button:has-text("Create Campaign")');

      // Journey redirects to journey builder page
      await page.waitForURL(/\/campaigns\/journey/, { timeout: 10000 });
    });
  });

  test.describe("Campaign Detail", () => {
    test("should view campaign details", async ({ page }) => {
      // Create a campaign first
      const campaignName = `Detail Test ${Date.now()}`;
      await page.goto("/campaigns/new");
      await page.click("text=One-Time Campaign");
      await page.fill('#campaign-name', campaignName);
      await page.click('button:has-text("Next: Schedule")');
      await page.click('button:has-text("Create Campaign")');

      // Wait for redirect to analytics
      await page.waitForURL(/\/campaigns\/.*\/analytics/, { timeout: 10000 });

      // Navigate back to list
      await page.goto("/campaigns");

      // Click on the campaign name in the table
      await page.locator("table tbody tr td a", { hasText: campaignName }).first().click();

      // Should be on analytics page with campaign name visible
      await expect(page.locator("h1, h2").filter({ hasText: campaignName })).toBeVisible();
    });

    test("should delete campaign", async ({ page }) => {
      // Create a campaign to delete
      const campaignName = `Delete Test ${Date.now()}`;
      await page.goto("/campaigns/new");
      await page.click("text=One-Time Campaign");
      await page.fill('#campaign-name', campaignName);
      await page.click('button:has-text("Next: Schedule")');
      await page.click('button:has-text("Create Campaign")');
      await page.waitForURL(/\/campaigns\/.*\/analytics/, { timeout: 10000 });

      // Navigate to list
      await page.goto("/campaigns");

      // Set up dialog handler BEFORE clicking delete
      page.on('dialog', dialog => dialog.accept());

      // Find the row with campaign name and click its Delete button
      const campaignRow = page.locator("table tbody tr", { hasText: campaignName });
      await campaignRow.locator("button", { hasText: "Delete" }).click();

      // Wait for deletion to complete and UI to update
      await page.waitForLoadState('networkidle');

      // Campaign should be removed
      await expect(page.locator("table tbody tr", { hasText: campaignName })).not.toBeVisible();
    });
  });

  test.describe("Campaign Analytics", () => {
    test("should view campaign analytics", async ({ page }) => {
      // Create a campaign
      const campaignName = `Analytics Test ${Date.now()}`;
      await page.goto("/campaigns/new");
      await page.click("text=One-Time Campaign");
      await page.fill('#campaign-name', campaignName);
      await page.click('button:has-text("Next: Schedule")');
      await page.click('button:has-text("Create Campaign")');

      // Should be redirected to analytics page
      await page.waitForURL(/\/campaigns\/.*\/analytics/, { timeout: 10000 });

      // Analytics page should have heading with campaign name
      await expect(page.locator("h1").filter({ hasText: campaignName })).toBeVisible();

      // Should show analytics metrics
      await expect(page.locator("text=/Analytics|Performance|Stats/i").first()).toBeVisible();

      // Cleanup: delete the campaign
      await page.goto("/campaigns");
      const campaignRow = page.locator("table tbody tr", { hasText: campaignName });
      
      // Set up dialog handler BEFORE clicking delete
      page.on('dialog', dialog => dialog.accept());
      await campaignRow.locator("button", { hasText: "Delete" }).click();
    });
  });
});
