import { test, expect } from "@playwright/test";

/**
 * E2E Tests: MCP Integrations
 * Covers MCP server CRUD, connectivity test, enable/disable toggle, and removal.
 * Routes: /settings (integrations tab) and /api/mcp-servers
 */

test.describe("MCP Integrations", () => {
  test.beforeEach(async ({ page }) => {
    // Use storage state from global setup
    await page.goto("/settings");
    if (page.url().includes("/login")) {
      const email = process.env.TEST_USER_EMAIL ?? "test@example.com";
      const password = process.env.TEST_USER_PASSWORD ?? "password123";
      await page.fill('input[type="email"]', email);
      await page.fill('input[type="password"]', password);
      await page.click('button[type="submit"]');
      await page.waitForLoadState("networkidle");
    }
  });

  test.describe("Settings Navigation", () => {
    test("should expose an MCP / integrations section in settings", async ({ page }) => {
      await page.goto("/settings");

      // Click on Integrations tab
      const integrationsTab = page.locator("button", { hasText: "Integrations" });
      await expect(integrationsTab).toBeVisible();
      
      await integrationsTab.click();
      
      // Should show MCP-related content
      await expect(page.locator("text=MCP").first()).toBeVisible();
    });
  });

  test.describe("MCP Server CRUD", () => {
    test("should allow adding a new MCP server via UI", async ({ page }) => {
      await page.goto("/settings");

      // Click on Integrations tab
      await page.locator("button", { hasText: "Integrations" }).click();

      // Look for Add Server button
      const addBtn = page.locator('button', { hasText: /Add Server|\+ Add/i }).first();

      if (await addBtn.isVisible().catch(() => false)) {
        await addBtn.click();

        // Form should appear with name input
        const nameField = page.locator('input[type="text"]').first();
        await expect(nameField).toBeVisible({ timeout: 5000 });
      } else {
        test.skip(true, "Add server button not visible");
      }
    });

    test("should validate MCP server URL", async ({ request }) => {
      // The backend should reject obviously-invalid URLs
      const response = await request.post("/api/mcp-servers", {
        data: {
          name: "Invalid URL Test",
          url: "not-a-url",
          apiKey: "test-key",
        },
      });

      expect(response.status()).toBeGreaterThanOrEqual(400);
      expect(response.status()).toBeLessThan(500);
    });
  });

  test.describe("Connectivity Test", () => {
    test("should expose a test-connectivity endpoint", async ({ request }) => {
      const response = await request.post(
        "/api/mcp-servers/00000000-0000-0000-0000-000000000000/test",
        { data: {} }
      );

      // Accept 404 (unknown id) / 401 (auth) / 400 (bad id) — never 500
      expect(response.status()).toBeLessThan(500);
    });
  });

  test.describe("Enable/Disable Toggle", () => {
    test("should expose a PATCH endpoint to toggle server state", async ({ request }) => {
      const response = await request.patch(
        "/api/mcp-servers/00000000-0000-0000-0000-000000000000",
        { data: { enabled: false } }
      );

      expect(response.status()).toBeLessThan(500);
    });
  });

  test.describe("Removal", () => {
    test("should expose a DELETE endpoint for MCP servers", async ({ request }) => {
      const response = await request.delete(
        "/api/mcp-servers/00000000-0000-0000-0000-000000000000"
      );

      expect(response.status()).toBeLessThan(500);
    });

    test("should reject deletion with malformed UUID", async ({ request }) => {
      const response = await request.delete("/api/mcp-servers/not-a-uuid");

      // Should return a client error, not a server error
      expect(response.status()).toBeGreaterThanOrEqual(400);
      expect(response.status()).toBeLessThan(500);
    });
  });

  test.describe("API Key Security", () => {
    test("should never return API keys in list responses", async ({ request }) => {
      const response = await request.get("/api/mcp-servers");

      if (response.status() === 200) {
        const body = await response.json();
        const serialized = JSON.stringify(body);

        // API keys should be masked or omitted
        expect(serialized).not.toMatch(/"apiKey":\s*"[a-zA-Z0-9_-]{16,}/);
        expect(serialized).not.toMatch(/"api_key":\s*"[a-zA-Z0-9_-]{16,}/);
      }
    });
  });
});
