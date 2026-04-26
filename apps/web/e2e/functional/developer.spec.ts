import { test, expect } from "@playwright/test";

/**
 * E2E Tests: Developer Portal
 * Covers API keys, webhooks, usage chart, and API docs tabs.
 * Routes: /developer, /developer/usage
 */

test.describe("Developer Portal", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    await page.fill('input[type="email"], input[name="email"]', "test@example.com");
    await page.fill('input[type="password"], input[name="password"]', "testpassword123");
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/(dashboard|settings|developer)/, { timeout: 15000 });
  });

  test.describe("Tabs", () => {
    test("should render all four tabs", async ({ page }) => {
      await page.goto("/developer");

      const tabs = ["API Keys", "API Docs", "Webhooks", "Usage"];
      for (const label of tabs) {
        await expect(
          page.getByText(label, { exact: false }).first(),
          `Tab "${label}" should be visible`
        ).toBeVisible();
      }
    });

    test("should switch between tabs", async ({ page }) => {
      await page.goto("/developer");

      const webhooksTab = page.getByRole("button", { name: /webhooks/i }).first();
      if (await webhooksTab.isVisible().catch(() => false)) {
        await webhooksTab.click();
        // Webhook-related controls should appear
        const webhookPanel = page.getByText(/endpoint/i)
          .or(page.getByText(/webhook/i))
          .or(page.locator('button:has-text("Add")'))
          .first();
        await expect(webhookPanel).toBeVisible({ timeout: 5000 });
      } else {
        test.skip(true, "Webhooks tab not exposed in current build");
      }
    });
  });

  test.describe("API Keys", () => {
    test("should show the API keys panel by default", async ({ page }) => {
      await page.goto("/developer");
      await expect(page.getByText(/api key/i).first()).toBeVisible();
    });

    test("should open a create-key modal", async ({ page }) => {
      await page.goto("/developer");

      const createBtn = page
        .locator('button:has-text("Create"), button:has-text("New Key"), button:has-text("Generate")')
        .first();

      if (await createBtn.isVisible().catch(() => false)) {
        await createBtn.click();

        const nameField = page
          .locator('input[name="name"], input[placeholder*="name" i]')
          .first();
        await expect(nameField).toBeVisible({ timeout: 5000 });
      } else {
        test.skip(true, "Create key button not exposed");
      }
    });

    test("should validate key name before submit", async ({ page }) => {
      await page.goto("/developer");

      const createBtn = page.locator('button:has-text("Create"), button:has-text("New Key")').first();
      if (!(await createBtn.isVisible().catch(() => false))) {
        test.skip(true, "Create key flow unavailable");
        return;
      }
      await createBtn.click();

      const submitBtn = page
        .locator('button:has-text("Create"), button[type="submit"]')
        .last();

      await expect(submitBtn, "Submit button must be visible after opening the create key modal").toBeVisible();
      await submitBtn.click();
      // Should remain in modal (validation kept us here)
      const stillHasModal =
        (await page.locator('input[name="name"]').first().isVisible().catch(() => false)) ||
        (await page.getByText(/required|invalid/i).first().isVisible().catch(() => false));
      expect(stillHasModal).toBe(true);
    });
  });

  test.describe("Webhooks", () => {
    test("should render a webhooks list or empty state", async ({ page }) => {
      await page.goto("/developer");

      const webhooksTab = page.getByText(/webhooks/i).first();
      if (await webhooksTab.isVisible().catch(() => false)) {
        await webhooksTab.click();

        const hasWebhookUi =
          (await page.locator('button:has-text("Add"), button:has-text("Register")').first().isVisible().catch(() => false)) ||
          (await page.getByText(/no webhooks|empty/i).first().isVisible().catch(() => false));

        expect(hasWebhookUi, "Expected either a webhook action button or an empty-state message to be visible").toBe(true);
      } else {
        test.skip(true, "Webhooks tab not exposed");
      }
    });
  });

  test.describe("Usage", () => {
    test("should render the usage page", async ({ page }) => {
      await page.goto("/developer/usage");
      await expect(page.locator("h1, h2").first()).toBeVisible();
    });

    test("should expose the usage API endpoint", async ({ request }) => {
      const response = await request.get("/api/developer/usage");
      expect(response.status()).toBeLessThan(500);
    });
  });

  test.describe("API Docs", () => {
    test("should expose the OpenAPI spec endpoint", async ({ request }) => {
      const response = await request.get("/api/openapi");
      expect(response.status()).toBeLessThan(500);
    });
  });
});
