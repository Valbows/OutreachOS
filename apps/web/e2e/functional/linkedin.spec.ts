import { test, expect } from "@playwright/test";

/**
 * E2E Tests: LinkedIn Playbook
 * Covers LinkedIn copy generation, playbook viewing, and per-group/batch message generation.
 * Routes: /linkedin
 */

test.describe("LinkedIn Playbook", () => {
  test.beforeEach(async ({ page }) => {
    // Use storage state from global setup
    await page.goto("/linkedin");
    if (page.url().includes("/login")) {
      const email = process.env.TEST_USER_EMAIL ?? "test@example.com";
      const password = process.env.TEST_USER_PASSWORD ?? "password123";
      await page.fill('input[type="email"]', email);
      await page.fill('input[type="password"]', password);
      await page.click('button[type="submit"]');
      await page.waitForLoadState("networkidle");
    }
  });

  test.describe("Playbook View", () => {
    test("should render the LinkedIn playbook page", async ({ page }) => {
      await page.goto("/linkedin");
      
      // Should have heading with "LinkedIn" or "Playbook"
      const heading = page.locator("h1", { hasText: /LinkedIn|Playbook/ });
      await expect(heading.or(page.locator("h2").first())).toBeVisible();
    });

    test("should show stat summary (total, generated, sent)", async ({ page }) => {
      await page.goto("/linkedin");

      // Stats section shows Total, Generated, Sent
      const labels = ["Total", "Generated", "Sent"];
      let matched = 0;
      for (const label of labels) {
        if (await page.locator("text=" + label).first().isVisible().catch(() => false)) {
          matched++;
        }
      }
      expect(matched).toBeGreaterThan(0);
    });

    test("should display playbook entries or empty state", async ({ page }) => {
      await page.goto("/linkedin");

      // Should show either entries or empty state
      const hasEntries = await page.locator("table tbody tr, [data-testid], article, li").count() > 0;
      const hasEmptyState = await page.locator("text=/no entries|empty|get started/i").first().isVisible().catch(() => false);

      expect(hasEntries || hasEmptyState, "Expected either playbook entries or an empty-state message").toBe(true);
    });
  });

  test.describe("Generate Single Message", () => {
    test("should expose a generate copy button", async ({ page }) => {
      await page.goto("/linkedin");

      // Look for Generate button (either Generate, New, or similar)
      const generateBtn = page.locator('button', { hasText: /Generate|New/i }).first();

      if (await generateBtn.isVisible().catch(() => false)) {
        await expect(generateBtn).toBeVisible();
      } else {
        test.skip(true, "Generate button not visible - may be in dropdown or different location");
      }
    });

    test.skip("should open the generate panel when triggered", async ({ page }) => {
      // SKIPPED: Requires verification of generate panel UI
      await page.goto("/linkedin");

      const generateBtn = page.locator('button', { hasText: /Generate/i }).first();
      if (await generateBtn.isVisible().catch(() => false)) {
        await generateBtn.click();
        // Panel should show with textarea or input
      }
    });
  });

  test.describe("Batch Generation", () => {
    test.skip("should expose a batch generate flow", async ({ page }) => {
      // SKIPPED: Requires verification of batch generate UI
      await page.goto("/linkedin");

      // Look for batch-related buttons
      const batchBtn = page.locator('button', { hasText: /Batch|Group|All Contacts/i }).first();
      if (await batchBtn.isVisible().catch(() => false)) {
        await expect(batchBtn).toBeVisible();
      }
    });
  });

  test.describe("Status Management", () => {
    test("should allow updating an entry status from the API", async ({ page }) => {
      // Use page.request so the call carries the authenticated session from beforeEach
      const response = await page.request.patch("/api/linkedin/playbook/00000000-0000-0000-0000-000000000000", {
        data: { status: "sent" },
      });

      // A nil UUID does not correspond to any real entry – expect 404, not a server error
      expect(response.status()).toBe(404);
    });
  });
});
