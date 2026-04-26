import { test, expect } from "@playwright/test";

/**
 * A09:2021 – Security Logging and Monitoring Failures
 * Tests for sensitive data exposure and insufficient logging
 */

test.describe("A09 - Security Logging and Data Exposure", () => {
  test.describe("Sensitive Data Exposure Prevention", () => {
    test("should not expose API keys in responses", async ({ request }) => {
      const endpoints = [
        "/api/settings/preferences",
        "/api/integrations",
        "/api/mcp-servers",
      ];

      for (const endpoint of endpoints) {
        const response = await request.get(endpoint);

        if (response.status() === 200) {
          const body = await response.json();
          const bodyString = JSON.stringify(body);

          // Check for common API key patterns
          expect(bodyString).not.toMatch(/api[_-]?key['"]?:\s*['"][a-zA-Z0-9]{20,}/i);
          expect(bodyString).not.toMatch(/password['"]?:\s*['"][^'"]{8,}/i);
          expect(bodyString).not.toMatch(/secret['"]?:\s*['"][a-zA-Z0-9]{16,}/i);
          expect(bodyString).not.toMatch(/token['"]?:\s*['"][a-zA-Z0-9]{20,}/i);
        }
      }
    });

    test("should mask sensitive data in error messages", async ({ request }) => {
      // Trigger various error conditions
      const errorEndpoints = [
        { method: "GET", url: "/api/campaigns/invalid-id", expectedStatus: 404 },
        { method: "POST", url: "/api/campaigns", data: { invalid: true }, expectedStatus: 400 },
      ];

      for (const { method, url, data, expectedStatus } of errorEndpoints) {
        let response;
        if (method === "POST") {
          response = await request.post(url, { data });
        } else {
          response = await request.get(url);
        }

        expect(response.status()).toBe(expectedStatus);

        const body = await response.text();

        // Error messages should not contain:
        // - Stack traces with file paths
        expect(body).not.toMatch(/at\s+\/.+:\d+:\d+/);
        // - Internal error details
        expect(body).not.toMatch(/Error:.*at\s*\(/);
        // - Database connection strings
        expect(body).not.toMatch(/postgres(ql)?:\/\//i);
        // - File system paths
        expect(body).not.toMatch(/\/Users\/[^/]+\//);
      }
    });

    test("should not expose user emails in bulk responses", async ({ request }) => {
      const response = await request.get("/api/contacts");

      if (response.status() === 200) {
        const body = await response.json();

        // If contacts are returned, emails must be masked (e.g. "j***@example.com")
        if (body.data && Array.isArray(body.data)) {
          for (const contact of body.data) {
            if (contact.email) {
              // A fully unmasked email matches: one-or-more non-@ chars, @, one-or-more non-@ chars
              // A masked email must contain at least one '*' in the local part
              const isFullyExposed = /^[^@*]+@[^@]+$/.test(contact.email);
              expect(isFullyExposed).toBe(false);
            }
          }
        }
      }
    });

    test("should not expose refresh tokens in OAuth responses", async ({ request }) => {
      const response = await request.get("/api/settings/preferences");

      if (response.status() === 200) {
        const body = await response.json();
        const bodyString = JSON.stringify(body);

        // Should not contain refresh tokens
        expect(bodyString).not.toMatch(/refresh[_-]?token/i);
        // Should not contain full access tokens
        expect(bodyString).not.toMatch(/access[_-]?token['"]?:\s*['"][a-zA-Z0-9_-]{20,}/i);
      }
    });
  });

  test.describe("Debug Information Exposure", () => {
    test("should not expose debug info in production mode", async ({ request }) => {
      // In production, debug information should be minimal
      const response = await request.get("/api/non-existent-endpoint");

      if (response.status() === 404) {
        const body = await response.text();

        // Should not contain detailed routing information
        expect(body.toLowerCase()).not.toContain("route not found");
        expect(body.toLowerCase()).not.toContain("cannot get");

        // Should not expose framework information
        expect(body).not.toMatch(/Next\.js|Express|Fastify/i);
      }
    });

    test("should hide stack traces in error responses", async ({ request }) => {
      const response = await request.get("/api/error");

      if (response.status() >= 500) {
        const body = await response.text();

        // Stack traces should not be exposed
        expect(body).not.toMatch(/\s+at\s+[\w.]+\s*\(/);
        expect(body).not.toMatch(/\s+at\s+\/[\w/]+:\d+:\d+/);
      }
    });
  });

  test.describe("Logging and Monitoring", () => {
    test("should log security events appropriately", async ({ request }) => {
      // Perform actions that should be logged and assert each returns a security-appropriate status
      const securityEvents = [
        { action: "failed login", endpoint: "/api/auth/login", method: "POST", data: { email: "test@test.com", password: "wrong" }, expectedStatuses: [400, 401, 403] },
        { action: "unauthorized access", endpoint: "/api/admin/users", method: "GET", data: undefined, expectedStatuses: [401, 403] },
      ];

      for (const { action, endpoint, method, data, expectedStatuses } of securityEvents) {
        const response = method === "POST"
          ? await request.post(endpoint, { data })
          : await request.get(endpoint);

        expect(
          expectedStatuses,
          `Expected ${action} to return one of ${expectedStatuses.join("|")} but got ${response.status()}`
        ).toContain(response.status());
      }
    });

    test("may include request ID header for audit tracing", async ({ request }) => {
      const response = await request.get("/api/campaigns");

      // Check for request ID header (useful for tracing)
      const headers = response.headers();
      const hasRequestId = headers["x-request-id"] || headers["x-correlation-id"];

      // Header is optional; if present it must be a non-empty string
      if (hasRequestId) {
        expect(typeof hasRequestId).toBe("string");
        expect(hasRequestId.length).toBeGreaterThan(0);
      }
    });
  });

  test.describe("Sensitive File Exposure", () => {
    test("should not serve sensitive files", async ({ request }) => {
      const sensitiveFiles = [
        "/.env",
        "/.env.local",
        "/.env.production",
        "/config/secrets.json",
        "/package.json",
        "/package-lock.json",
        "/yarn.lock",
        "/pnpm-lock.yaml",
        "/tsconfig.json",
        "/.git/config",
        "/.gitignore",
        "/Dockerfile",
        "/docker-compose.yml",
      ];

      for (const file of sensitiveFiles) {
        const response = await request.get(file);

        // Should return 404 or 403
        const status = response.status();
        expect([404, 403]).toContain(status);
      }
    });

    test("should not expose database files", async ({ request }) => {
      const dbFiles = [
        "/database.sqlite",
        "/db.sqlite3",
        "/data.db",
        "/dump.sql",
        "/backup.sql",
      ];

      for (const file of dbFiles) {
        const response = await request.get(file);
          const status = response.status();
          expect([404, 403]).toContain(status);
      }
    });
  });
});
