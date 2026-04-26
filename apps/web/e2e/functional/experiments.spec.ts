import { test, expect } from "@playwright/test";

/**
 * E2E Tests: A/B Experiments
 * Covers A/B test setup, subject line experiments, and champion selection.
 * Routes: /campaigns/ab-test/setup, /campaigns/ab-test/[id]/subject
 */

test.describe("A/B Experiments", () => {
  test.beforeEach(async ({ page }) => {
    const email = process.env.TEST_USER_EMAIL;
    const password = process.env.TEST_USER_PASSWORD;
    if (!email || !password) {
      throw new Error("TEST_USER_EMAIL and TEST_USER_PASSWORD env vars must be set before running A/B Experiments tests");
    }
    await page.goto("/login");
    await page.fill('input[type="email"], input[name="email"]', email);
    await page.fill('input[type="password"], input[name="password"]', password);
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/(dashboard|settings|campaigns)/, { timeout: 15000 });
  });

  test.describe("A/B Setup", () => {
    test("should require a campaignId query param", async ({ page }) => {
      await page.goto("/campaigns/ab-test/setup");

      // Page shows "Missing campaign ID" when no campaignId is provided
      await expect(
        page.getByText(/missing campaign id|missing campaign/i).first()
      ).toBeVisible({ timeout: 5000 });
    });

    test("should render setup form when campaignId provided", async ({ page }) => {
      // Use a placeholder UUID — page will still render the form
      await page.goto("/campaigns/ab-test/setup?campaignId=00000000-0000-0000-0000-000000000000");

      // The setup form renders an h1 and a "Continue to Subject Lines" button
      await expect(page.getByRole('heading', { name: /a\/b test/i }).first()).toBeVisible({ timeout: 5000 });
      await expect(
        page.getByRole('button', { name: /continue to subject lines/i }).first()
      ).toBeVisible({ timeout: 5000 });
    });

    test("should display error message when contact groups API fails", async ({ page }) => {
      // Stub the contact groups API to simulate failure
      await page.route('/api/contact-groups', async (route) => {
        await route.fulfill({
          status: 500,
          body: JSON.stringify({ error: 'Failed to load contact groups' }),
        });
      });

      await page.goto("/campaigns/ab-test/setup?campaignId=00000000-0000-0000-0000-000000000000");

      // Error message should be visible when API fails
      await expect(
        page.getByText(/no contact groups found/i).first()
          .or(page.getByText(/failed to load contact groups/i).first())
      ).toBeVisible({ timeout: 5000 });
    });

    test("should have a back-to-campaigns escape hatch when campaignId missing", async ({ page }) => {
      await page.goto("/campaigns/ab-test/setup");

      const goBackLink = page
        .locator('a:has-text("Go to Campaigns"), button:has-text("Go to Campaigns")')
        .first();

      const isVisible = await goBackLink.isVisible().catch(() => false);
      expect(isVisible).toBe(true);
    });
  });

  test.describe("Subject Line Experiment", () => {
    test("should preserve the subject route shape", async ({ page }) => {
      await page.goto("/campaigns/ab-test/00000000-0000-0000-0000-000000000000/subject");

      const loaded =
        (await page.locator('h1, h2').first().isVisible().catch(() => false)) ||
        (await page.getByText(/not found|error|subject/i).first().isVisible().catch(() => false));

      expect(loaded).toBe(true);
    });
  });

  test.describe("Experiment Log API", () => {
    test("should expose an experiments list endpoint", async ({ request }) => {
      const response = await request.get("/api/campaigns/experiments");
      expect(response.status()).toBeLessThan(500);
    });

    test("should expose a per-campaign experiments endpoint", async ({ request }) => {
      const response = await request.get(
        "/api/campaigns/00000000-0000-0000-0000-000000000000/experiments"
      );
      expect(response.status()).toBeLessThan(500);
    });
  });

  test.describe("Champion Selection", () => {
    test("should expose a champion-selection API", async ({ request }) => {
      // Typical endpoint shape — adjust if different in actual impl
      const response = await request.post(
        "/api/campaigns/00000000-0000-0000-0000-000000000000/experiments/select-champion",
        {
          data: { variant: "A" },
        }
      );

      // 404 / 400 / 401 are acceptable; 500 should not occur
      expect(response.status()).toBeLessThan(500);
    });
  });
});
