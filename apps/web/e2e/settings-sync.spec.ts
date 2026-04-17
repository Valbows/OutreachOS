import { test, expect } from "@playwright/test";

/**
 * Regression guard: the settings page's critical API calls must return 200
 * for an authenticated user, regardless of whether a Google account is linked.
 *
 * History:
 * - 2026-04-19: Both endpoints returned 500 due to stale dist in
 *   `@outreachos/db` (schema mismatch on `mcp_servers.api_key` vs
 *   `api_key_encrypted`). Added here as a smoke test to catch that class
 *   of regression early.
 */
test("settings API endpoints return 200 for authenticated user", async ({ page }) => {
  await page.goto("http://localhost:3000/login");
  await page.getByLabel(/email/i).fill("test@example.com");
  await page.getByLabel(/password/i).fill("password123");
  await page.getByRole("button", { name: /sign in/i }).click();
  await expect(page).not.toHaveURL(/\/login/, { timeout: 15000 });

  const syncRes = await page.request.post("http://localhost:3000/api/auth/google/sync");
  expect(syncRes.status()).toBe(200);
  const syncBody = (await syncRes.json()) as { linked: boolean; gmailAddress?: string };
  expect(typeof syncBody.linked).toBe("boolean");

  const prefsRes = await page.request.get("http://localhost:3000/api/settings/preferences");
  expect(prefsRes.status()).toBe(200);

  const mcpRes = await page.request.get("http://localhost:3000/api/mcp-servers");
  expect(mcpRes.status()).toBe(200);
});
