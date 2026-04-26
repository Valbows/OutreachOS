import { test, expect } from "@playwright/test";

/**
 * E2E Tests: Dashboard Overview
 * Tests for dashboard layout, navigation, and widgets
 */

test.describe("Dashboard Overview", () => {
  test.beforeEach(async ({ page }) => {
    // Login before each test
    await page.goto("/login");
    await page.fill('input[type="email"]', "test@example.com");
    await page.fill('input[type="password"]', "testpassword123");
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/dashboard/);
  });

  test.describe("Layout", () => {
    test("should display sidebar navigation", async ({ page }) => {
      await expect(page.locator("nav, [role='navigation']")).toBeVisible();

      // Check for main navigation items
      await expect(page.locator("text=Dashboard")).toBeVisible();
      await expect(page.locator("text=Campaigns")).toBeVisible();
      await expect(page.locator("text=Contacts")).toBeVisible();
      await expect(page.locator("text=Settings")).toBeVisible();
    });

    test("should display top bar with user info", async ({ page }) => {
      await expect(page.locator("header")).toBeVisible();
    });

    test("should have working sidebar navigation", async ({ page }) => {
      // Click on Campaigns
      await page.click('nav >> text=Campaigns');
      await expect(page).toHaveURL(/\/campaigns/);

      // Click on Contacts
      await page.click('nav >> text=Contacts');
      await expect(page).toHaveURL(/\/contacts/);
    });
  });

  test.describe("Stats Section", () => {
    test("should display stat cards", async ({ page }) => {
      // Look for stat cards with numbers
      const statCards = page.locator('[data-testid="stat-card"], .stat-card, .metric-card');
      await expect(statCards.first()).toBeVisible();
    });

    test("should display campaigns list", async ({ page }) => {
      // Campaign list container must be present
      const campaignList = page.locator(
        '[data-testid="campaign-list"], [data-testid="campaigns-list"], .campaign-list'
      );
      await expect(campaignList).toBeVisible();

      // At least one campaign item or an empty-state message should be visible
      const campaignItems = page.locator(
        '[data-testid="campaign-card"], [data-testid="campaign-item"], .campaign-item'
      );
      const emptyState = page.locator('[data-testid="empty-state"], text=/no campaigns/i');
      const hasItems = await campaignItems.count() > 0;
      if (hasItems) {
        await expect(campaignItems.first()).toBeVisible();
      } else {
        await expect(emptyState.first()).toBeVisible();
      }
    });
  });

  test.describe("Quick Actions", () => {
    test("should have create campaign button", async ({ page }) => {
      await expect(page.locator("button:has-text('New Campaign'), a:has-text('New Campaign')")).toBeVisible();
    });

    test("should have add contacts button", async ({ page }) => {
      await expect(page.locator("button:has-text('Add Contacts'), a:has-text('Add Contacts')")).toBeVisible();
    });
  });

  test.describe("Responsive Design", () => {
    test("should collapse sidebar on mobile", async ({ page }) => {
      // Resize to mobile viewport
      await page.setViewportSize({ width: 375, height: 667 });

      // Sidebar should be collapsed or hidden on mobile
      const sidebar = page.locator("nav");
      const isVisible = await sidebar.isVisible();

      if (!isVisible) {
        // Sidebar is fully hidden – acceptable mobile behaviour
        expect(isVisible).toBe(false);
      } else {
        // Sidebar is visible but must have mobile/collapsed styling
        const hasMobileClass = await sidebar.evaluate(el =>
          el.classList.contains('mobile') ||
          el.classList.contains('collapsed') ||
          getComputedStyle(el).position === 'fixed'
        );
        expect(hasMobileClass).toBe(true);
      }
    });
  });
});
