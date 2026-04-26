import { test, expect } from "@playwright/test";

/**
 * A05:2021 – Security Misconfiguration
 * Tests for security headers and secure configuration
 */

test.describe("A05 - Security Misconfiguration", () => {
  test.describe("Security Headers Presence", () => {
    test("should have X-Content-Type-Options header", async ({ request }) => {
      const response = await request.get("/");
      expect(response.headers()["x-content-type-options"]).toBe("nosniff");
    });

    test("should have X-Frame-Options header", async ({ request }) => {
      const response = await request.get("/");
      const frameOptions = response.headers()["x-frame-options"];
      expect(["deny", "sameorigin"]).toContain(frameOptions?.toLowerCase());
    });

    test("should have X-XSS-Protection header or CSP", async ({ request }) => {
      const response = await request.get("/");
      const xssProtection = response.headers()["x-xss-protection"];
      const csp = response.headers()["content-security-policy"];

      // Either X-XSS-Protection or CSP should be present
      expect(xssProtection || csp).toBeTruthy();
    });

    test("should have Referrer-Policy header", async ({ request }) => {
      const response = await request.get("/");
      const referrerPolicy = response.headers()["referrer-policy"];
      expect(referrerPolicy).toBeTruthy();
    });

    test("should have strict CSP headers", async ({ request }) => {
      const response = await request.get("/");
      const csp = response.headers()["content-security-policy"];

      // CSP header must be present
      expect(csp, "content-security-policy header must be present").toBeDefined();

      // CSP should restrict script sources
      expect(csp).toMatch(/script-src/i);

      // Should not allow 'unsafe-inline' or 'unsafe-eval' without nonce/hash
      if (!csp!.includes("nonce-") && !csp!.includes("sha256-")) {
        expect(csp).not.toMatch(/'unsafe-inline'/i);
        expect(csp).not.toMatch(/'unsafe-eval'/i);
      }
    });
  });

  test.describe("Information Disclosure Prevention", () => {
    test("should not expose server version headers", async ({ request }) => {
      const response = await request.get("/");
      const headers = response.headers();

      // Check for common server headers that reveal version info
      const serverHeader = headers["server"];
      const poweredBy = headers["x-powered-by"];

      if (serverHeader) {
        // Server header should not contain version numbers
        expect(serverHeader).not.toMatch(/\d+\.\d+/);
      }

      // X-Powered-By should ideally not be present
      if (poweredBy) {
        expect(poweredBy.toLowerCase()).not.toMatch(/(next\.js|express|node\.js)/);
      }
    });

    test("should return generic error pages without stack traces", async ({ request }) => {
      // Trigger a 404 error
      const response = await request.get("/non-existent-page-that-should-404");
      const body = await response.text();

      // Response should not contain stack traces or internal paths
      expect(body).not.toMatch(/at\s+\/.+:\d+:\d+/); // Stack trace pattern
      expect(body).not.toMatch(/Error:\s*.+at\s+\(/); // Error with stack
      expect(body).not.toMatch(/\/Users\/[^/]+\//); // File system paths
    });
  });

  test.describe("Cookie Security", () => {
    test("should set secure, httponly cookies", async ({ request }) => {
      // Make a request that might set cookies
      const response = await request.get("/");
      const setCookie = response.headers()["set-cookie"];

      if (setCookie) {
        const cookies = Array.isArray(setCookie) ? setCookie : [setCookie];
        for (const cookie of cookies) {
          // Session cookies should be HttpOnly
          if (cookie.toLowerCase().includes("session")) {
            expect(cookie.toLowerCase()).toContain("httponly");
          }
          // Cookies should be Secure in production
          if (process.env.NODE_ENV === "production") {
            expect(cookie.toLowerCase()).toContain("secure");
          }
        }
      }
    });
  });

  test.describe("HTTPS Enforcement", () => {
    test("should redirect HTTP to HTTPS", async ({ page }, testInfo) => {
      // This test is environment-specific
      // In production, HTTP requests should redirect to HTTPS
      test.skip(process.env.NODE_ENV !== "production", "HTTPS enforcement test only for production");

      // Build the HTTP URL from the configured baseURL or a dedicated production env var
      const baseURL = process.env.PROD_BASE_URL || testInfo.config.projects[0]?.use?.baseURL || "http://localhost:3000";
      const httpUrl = baseURL.replace(/^https:/, "http:");

      // Attempt HTTP request – expect redirect to HTTPS
      const response = await page.goto(httpUrl);
      expect(response?.url()).toMatch(/^https:/);
    });
  });

  test.describe("Method Not Allowed Handling", () => {
    test("should return 405 for unsupported HTTP methods", async ({ request }) => {
      // Test that TRACE method is blocked (common security test)
      try {
        const response = await request.fetch("/", { method: "TRACE" });
        expect([405, 403]).toContain(response.status());
      } catch (err) {
        // Only swallow errors caused by the server refusing the connection entirely
        // (some servers drop the TCP connection for TRACE rather than returning 405)
        const message = err instanceof Error ? err.message : String(err);
        if (!message.includes("ECONNRESET") && !message.includes("ECONNREFUSED") && !message.includes("socket hang up")) {
          throw err;
        }
      }
    });
  });
});
