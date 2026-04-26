import { test, expect } from "@playwright/test";

/**
 * A07:2021 – Identification and Authentication Failures
 * Tests for weak authentication mechanisms, session management, and credential handling
 */

test.describe("A07 - Identification and Authentication Failures", () => {
  test.describe("Password Policy Enforcement", () => {
    test("should reject weak passwords during registration", async ({ request }) => {
      const weakPasswords = [
        { password: "123456", reason: "too short" },
        { password: "password", reason: "common word" },
        { password: "qwerty", reason: "common pattern" },
        { password: "abc123", reason: "simple alphanumeric" },
        { password: "Password1", reason: "lack of complexity" },
      ];

      for (const { password, reason } of weakPasswords) {
        const response = await request.post("/api/auth/register", {
          data: {
            email: `test-${Date.now()}@example.com`,
            password,
          },
        });

        // Should reject weak passwords
        if (response.status() === 200) {
          const body = await response.json();
          expect(body.success).not.toBe(true);
        } else {
          const status = response.status();
          expect([400, 422]).toContain(status);
        }
      }
    });

    test("should require minimum password length", async ({ request }) => {
      const shortPassword = "aB1!"; // Only 4 characters

      const response = await request.post("/api/auth/register", {
        data: {
          email: `test-${Date.now()}@example.com`,
          password: shortPassword,
        },
      });

      expect(response.status()).toBeGreaterThanOrEqual(400);
    });
  });

  test.describe("Brute Force Protection", () => {
    test("should rate limit failed login attempts", async ({ request }) => {
      const attempts = 10;
      const responses = [];

      const bruteForceEmail = "nonexistent@example.com";
      for (let i = 0; i < attempts; i++) {
        const response = await request.post("/api/auth/login", {
          data: {
            email: bruteForceEmail,
            password: "wrongpassword123",
          },
        });
        responses.push(response.status());
      }

      // After multiple failed attempts, should see rate limiting
      const rateLimitedCount = responses.filter(s => s === 429).length;
      const hasRateLimiting = rateLimitedCount > 0 || responses.slice(-3).every(s => s === 429);

      expect(hasRateLimiting).toBe(true);
    });
  });

  test.describe("Session Security", () => {
    const sessionTestEmail = process.env.TEST_USER_EMAIL ?? "test@example.com";
    const sessionTestPassword = process.env.TEST_USER_PASSWORD ?? "TestP@ssw0rd!2024";

    test.beforeAll(async ({ request }) => {
      // Ensure the test user exists before session tests run
      await request.post("/api/test/users", {
        data: { email: sessionTestEmail, password: sessionTestPassword },
        failOnStatusCode: false,
      });
    });

    test.afterAll(async ({ request }) => {
      // Remove the test user after session tests complete
      await request.delete("/api/test/users", {
        data: { email: sessionTestEmail },
        failOnStatusCode: false,
      });
    });

    test("should invalidate session on logout", async ({ page }) => {
      // Login first
      await page.goto("/login");
      await page.fill('input[type="email"]', sessionTestEmail);
      await page.fill('input[type="password"]', sessionTestPassword);
      await page.click('button[type="submit"]');

      // Wait for navigation
      await page.waitForURL(/\/(dashboard|settings)/, { timeout: 10000 });

      // Logout
      await page.goto("/logout");
      await page.waitForURL(/\/login/);

      // Try to access protected resource
      const response = await page.goto("/dashboard");
      expect(response?.url()).toMatch(/\/login/);
    });

    test("should regenerate session ID after login", async ({ request }) => {
      // This test checks that session fixation is prevented
      // Get a pre-login session
      const preLogin = await request.get("/");
      const preCookies = preLogin.headers()["set-cookie"];

      // Login
      await request.post("/api/auth/login", {
        data: {
          email: sessionTestEmail,
          password: sessionTestPassword,
        },
      });

      // Get post-login session
      const postLogin = await request.get("/dashboard");
      const postCookies = postLogin.headers()["set-cookie"];

      // Both cookie headers must be present and non-empty
      expect(preCookies, "pre-login Set-Cookie header must be present").toBeDefined();
      expect(preCookies!.length).toBeGreaterThan(0);
      expect(postCookies, "post-login Set-Cookie header must be present").toBeDefined();
      expect(postCookies!.length).toBeGreaterThan(0);
      // Session must be regenerated after login (session fixation prevention)
      expect(postCookies).not.toBe(preCookies);
    });

    test("should expire sessions after inactivity", async ({ page }) => {
      test.skip(true, "Session timeout test requires artificial time manipulation");
    });
  });

  test.describe("Credential Handling", () => {
    test("should not expose passwords in error messages", async ({ request }) => {
      const response = await request.post("/api/auth/login", {
        data: {
          email: "test@example.com",
          password: "SuperSecretPassword123!",
        },
      });

      const body = await response.text();

      // Error messages should not echo back the actual secret value
      expect(body).not.toContain("SuperSecretPassword123!");
    });

    test("should not store passwords in plain text", async ({ request }) => {
      // Create a user
      const email = `plaintext-test-${Date.now()}@example.com`;
      const password = "MyTestPassword123!";

      await request.post("/api/auth/register", {
        data: { email, password },
      });

      // Try to retrieve the user via API (if endpoint exists)
      const response = await request.get(`/api/admin/users?email=${email}`);

      if (response.status() === 200) {
        const body = await response.json();
        const userData = JSON.stringify(body);

        // Password should never appear in API responses
        expect(userData).not.toContain(password);
      }
    });
  });

  test.describe("Multi-Factor Authentication", () => {
    test("should support MFA enrollment", async ({ page }) => {
      test.skip(true, "MFA not yet implemented");
    });

    test("should require MFA code when enabled", async ({ page }) => {
      test.skip(true, "MFA not yet implemented");
    });
  });
});
