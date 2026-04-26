import { test, expect } from "@playwright/test";

/**
 * A01:2021 – Broken Access Control
 * Tests for unauthorized access to resources and privilege escalation
 */

test.describe("A01 - Broken Access Control", () => {
  test.describe("Unauthenticated Access Prevention", () => {
    test("should redirect unauthenticated users from dashboard to login", async ({ page }) => {
      await page.goto("/dashboard");
      await expect(page).toHaveURL(/\/login/);
    });

    test("should block API access without authentication", async ({ request }) => {
      const endpoints = [
        "/api/campaigns",
        "/api/contacts",
        "/api/settings/preferences",
        "/api/journeys",
      ];

      for (const endpoint of endpoints) {
        const response = await request.get(endpoint);
        const status = response.status();
        expect([401, 403, 307, 308]).toContain(status);
      }
    });
  });

  test.describe("Cross-Account Access Prevention", () => {
    test("should not allow accessing other user's campaigns", async ({ request }) => {
      // Authenticate as the test user via API so the request context carries credentials
      const loginEmail = process.env.TEST_USER_EMAIL ?? "test@example.com";
      const loginPassword = process.env.TEST_USER_PASSWORD ?? "testpassword123";
      const loginResponse = await request.post("/api/auth/login", {
        data: { email: loginEmail, password: loginPassword },
        failOnStatusCode: false,
      });
      // Only proceed with the cross-account check if login succeeded
      const loginStatus = loginResponse.status();
      test.skip(loginStatus !== 200, `Login returned ${loginStatus} – skipping cross-account check`);

      // Try to access a campaign ID that belongs to a different account (User B fixture)
      const response = await request.get("/api/campaigns/other-user-campaign-id-99999");
      const status = response.status();
      expect([401, 403, 404]).toContain(status);
    });

    test("should not allow updating other user's settings", async ({ request }) => {
      const response = await request.put("/api/settings/preferences", {
        data: { senderName: "Hacker" },
      });
      expect(response.status()).toBeGreaterThan(399);
    });
  });

  test.describe("Privilege Escalation Prevention", () => {
    test("should prevent IDOR (Insecure Direct Object Reference) attacks", async ({ request }) => {
      // Attempt to access sequential IDs that might belong to other users
      const idorAttempts = [
        "/api/campaigns/1",
        "/api/campaigns/2",
        "/api/contacts/1",
        "/api/journeys/1",
      ];

      for (const endpoint of idorAttempts) {
        const response = await request.get(endpoint);
        // Must return 401/403/404 – any 2xx would indicate an IDOR vulnerability
        expect([401, 403, 404]).toContain(response.status());
      }
    });

    test("should enforce authorization on PATCH/DELETE operations", async ({ request }) => {
      const writeEndpoints = [
        { method: "PATCH", url: "/api/campaigns/123", data: { name: "Hacked" } },
        { method: "DELETE", url: "/api/campaigns/123", data: {} },
        { method: "POST", url: "/api/journeys", data: { name: "Evil Journey" } },
      ];

      for (const { method, url, data } of writeEndpoints) {
        let response;
        switch (method) {
          case "PATCH":
            response = await request.patch(url, { data });
            break;
          case "DELETE":
            response = await request.delete(url);
            break;
          case "POST":
            response = await request.post(url, { data });
            break;
          default:
            throw new Error(`Unrecognised HTTP method in writeEndpoints: "${method}"`);
        }
        const status = response.status();
        expect([401, 403, 404]).toContain(status);
      }
    });
  });

  test.describe("Path Traversal Prevention", () => {
    test("should block directory traversal attempts", async ({ request }) => {
      const traversalAttempts = [
        "/api/files/../../../etc/passwd",
        "/api/files/..\\..\\..\\windows\\system32\\config\\sam",
        "/static/../../../../etc/hosts",
      ];

      for (const path of traversalAttempts) {
        const response = await request.get(path);
        const status = response.status();
        expect([400, 403, 404]).toContain(status);
      }
    });
  });

  test.describe("CORS Policy Enforcement", () => {
    test("should reject cross-origin requests from unauthorized domains", async ({ request }) => {
      const response = await request.get("/api/campaigns", {
        headers: {
          Origin: "https://evil-site.com",
        },
      });

      // Check that CORS headers are not allowing unauthorized origins
      const corsHeader = response.headers()["access-control-allow-origin"];
      expect(corsHeader, "access-control-allow-origin header must be present").toBeDefined();
      expect(corsHeader).not.toBe("*");
      expect(corsHeader).not.toBe("https://evil-site.com");
    });
  });
});
