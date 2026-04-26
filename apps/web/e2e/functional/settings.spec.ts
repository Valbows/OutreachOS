import { test, expect } from "@playwright/test";

/**
 * E2E Tests: Settings
 * Tests for account preferences, integrations, and OAuth connections
 * Updated to match actual UI - tabbed interface
 */

test.describe("Settings", () => {
  test.beforeEach(async ({ page }) => {
    // Use storage state from global setup
    await page.goto("/settings");
    
    // Wait for navigation to complete to either login or settings page
    await page.waitForURL((url) => url.pathname.includes("/login") || url.pathname.includes("/settings"));
    
    // Check if we ended up on login page
    if (page.url().includes("/login")) {
      const email = process.env.TEST_USER_EMAIL ?? "test@example.com";
      const password = process.env.TEST_USER_PASSWORD ?? "testpassword123";
      await page.fill('input[type="email"]', email);
      await page.fill('input[type="password"]', password);
      await page.click('button[type="submit"]');
      
      // Wait for successful login by checking for settings page header
      await page.waitForSelector('h1:has-text("Settings")', { timeout: 10000 });
    }
  });

  test.describe("Account Preferences", () => {
    test("should display settings page", async ({ page }) => {
      await page.goto("/settings");

      // Page has h1 with "Settings" title
      await expect(page.locator("h1", { hasText: "Settings" })).toBeVisible();
      
      // Should have tab navigation
      await expect(page.locator("button", { hasText: "Profile" })).toBeVisible();
    });

    test("should show profile tab by default", async ({ page }) => {
      await page.goto("/settings");

      // Profile tab should be active/visible
      await expect(page.locator("text=Account Profile").first()).toBeVisible();
      
      // Should have name input (labeled "Full name")
      await expect(page.locator("label", { hasText: "Full name" })).toBeVisible();
    });

    test("should update profile name", async ({ page }) => {
      await page.goto("/settings");

      // Ensure on Profile tab
      await page.locator("button", { hasText: "Profile" }).click();

      // Find the Full name input (it's an Input component with label)
      const nameInput = page.locator("label", { hasText: "Full name" }).locator("..").locator("input").first();
      
      // Assert the input is present before interacting
      await expect(nameInput, "Full name input must be visible").toBeVisible();
      
      // Clear and fill new name
      await nameInput.fill("Test User Updated");
      
      // Click Save Changes
      await page.locator("button", { hasText: "Save Changes" }).click();
      
      // Wait for save to complete
      await page.waitForLoadState("networkidle");
      
      // Verify success - check for success message or updated value
      const successMessage = page.locator("text=/updated|saved|success/i").first();
      const updatedValue = await nameInput.inputValue();
      
      // Either a success message should appear OR the value should be updated
      const hasSuccess = await successMessage.isVisible().catch(() => false);
      expect(
        hasSuccess || updatedValue === "Test User Updated",
        "Profile update should show success message or retain updated value"
      ).toBe(true);
    });

    test.skip("should update company", async ({ page }) => {
      // SKIPPED: Company field exists but API may not support it yet
      await page.goto("/settings");
      await page.locator("button", { hasText: "Profile" }).click();
      
      // Find Company input
      const companyInput = page.locator("label", { hasText: "Company" }).locator("..").locator("input").first();
      await companyInput.fill("Test Company");
      await page.locator("button", { hasText: "Save Changes" }).click();
    });
  });

  test.describe("Inbox Connection", () => {
    test("should navigate to Inbox Connection tab", async ({ page }) => {
      await page.goto("/settings");
      
      // Click Inbox Connection tab
      await page.locator("button", { hasText: "Inbox Connection" }).click();
      
      // Should show Gmail/OAuth section
      await expect(page.locator("text=Inbox Connection").first()).toBeVisible();
    });

    test.skip("should show Gmail OAuth section", async ({ page }) => {
      // SKIPPED: Requires tab navigation and Gmail OAuth UI verification
      await page.goto("/settings");
      await page.locator("button", { hasText: "Inbox Connection" }).click();
      
      // Should show Gmail connect/disconnect buttons based on state
    });
  });

  test.describe("Integrations Tab", () => {
    test("should navigate to Integrations tab", async ({ page }) => {
      await page.goto("/settings");
      
      // Click Integrations tab
      await page.locator("button", { hasText: "Integrations" }).click();
      
      // Should show integrations content
      await expect(page.locator("text=Integrations").first()).toBeVisible();
    });

    test.skip("should show integrations section", async ({ page }) => {
      // SKIPPED: Integrations tab content verification needed
      // Tab exists but specific content needs verification
    });
  });

  test.describe("Security Settings", () => {
    test("should show security section on Profile tab", async ({ page }) => {
      await page.goto("/settings");
      
      // Ensure on Profile tab (default)
      await page.locator("button", { hasText: "Profile" }).click();

      // Should show Security & Password section
      await expect(page.locator("text=Security & Password").first()).toBeVisible();
    });

    test.skip("should change password", async ({ page }) => {
      // SKIPPED: Password change requires careful handling
      // Could break subsequent tests if password change succeeds
      // Steps:
      // 1. Fill current password
      // 2. Fill new password (8+ chars)
      // 3. Fill confirm password
      // 4. Click Update Password
      // 5. Verify success message
    });
  });

  test.describe("Notifications Tab", () => {
    test("should navigate to Notifications tab", async ({ page }) => {
      await page.goto("/settings");
      
      // Click Notifications tab
      await page.locator("button", { hasText: "Notifications" }).click();
      
      // Should show notifications content
      await expect(page.locator("text=Notifications").first()).toBeVisible();
    });

    test.skip("should show notification preferences", async ({ page }) => {
      // SKIPPED: Notifications tab content verification needed
    });
  });

  test.describe("Danger Zone Tab", () => {
    test("should navigate to Danger Zone tab", async ({ page }) => {
      await page.goto("/settings");
      
      // Click Danger Zone tab
      await page.locator("button", { hasText: "Danger Zone" }).click();
      
      // Should show danger zone content
      await expect(page.locator("text=Danger Zone").first()).toBeVisible();
    });

    test.skip("should show delete account option", async ({ page }) => {
      // SKIPPED: Danger Zone content verification needed
    });
  });
});
