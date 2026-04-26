import { test, expect } from "@playwright/test";

/**
 * A03:2021 – Injection
 * Tests for SQL injection, XSS, and other injection vulnerabilities
 */

test.describe("A03 - Injection", () => {
  test.describe("SQL Injection Prevention", () => {
    test("should sanitize SQL injection in campaign search", async ({ request }) => {
      const maliciousInputs = [
        "' OR '1'='1",
        "'; DROP TABLE campaigns; --",
        "1' UNION SELECT * FROM accounts --",
        "' OR 1=1--",
        "' OR 'a'='a",
      ];

      for (const input of maliciousInputs) {
        // Try various endpoints that accept user input
        const endpoints = [
          `/api/campaigns?q=${encodeURIComponent(input)}`,
          `/api/contacts?q=${encodeURIComponent(input)}`,
        ];

        for (const endpoint of endpoints) {
          const response = await request.get(endpoint);
          // Should not return 200 with all data (successful injection)
          // Should either error or return empty results
          if (response.status() === 200) {
            const body = await response.json();
            // If response is an array, it shouldn't contain excessive data
            if (Array.isArray(body?.data)) {
              expect(body.data.length).toBeLessThan(1000); // Arbitrary large number check
            }
          }
        }
      }
    });

    test("should prevent injection in campaign names", async ({ request }) => {
      const xssPayload = "<script>alert('XSS')</script>";
      const sqlPayload = "'; DROP TABLE campaigns; --";

      const response = await request.post("/api/campaigns", {
        data: {
          name: xssPayload,
          type: sqlPayload,
        },
      });

      // Should either reject (400) or sanitize (200 but clean data)
      if (response.status() === 200) {
        const body = await response.json();
        // If stored, the payload should be sanitized
        expect(body?.data?.name).not.toContain("<script>");
      } else {
        const status = response.status();
        expect([400, 401, 403]).toContain(status);
      }
    });
  });

  test.describe("XSS (Cross-Site Scripting) Prevention", () => {
    test("should encode output to prevent reflected XSS", async ({ page }) => {
      const xssPayload = "<script>alert('XSS')</script>";

      // Navigate with payload in query string
      await page.goto(`/search?q=${encodeURIComponent(xssPayload)}`);

      // Check that the payload is not executed (no alert dialogs)
      // Also check page content is encoded
      const pageContent = await page.content();
      expect(pageContent).not.toContain(xssPayload); // Should be encoded
    });

    test("should sanitize stored XSS in campaign content", async ({ request }) => {
      const storedXssPayload = "<img src=x onerror=alert('XSS')>";

      // Try to create a campaign with malicious content
      const response = await request.post("/api/campaigns", {
        data: {
          name: "Test Campaign",
          content: storedXssPayload,
        },
      });

      if (response.status() === 200) {
        const body = await response.json();
        const content = body?.data?.content || body?.data?.settings?.content;
        if (content) {
          // Malicious attributes should be removed
          expect(content).not.toMatch(/onerror\s*=/i);
          expect(content).not.toContain("<script>");
        }
      }
    });

    test("should prevent DOM-based XSS", async ({ page }) => {
      // Test for common DOM XSS vectors
      const domXssVectors = [
        "#<img src=x onerror=alert(1)>",
        "?search=<script>alert(1)</script>",
      ];

      for (const vector of domXssVectors) {
        await page.goto(`/${vector}`);
        // Page should not contain unencoded scripts
        const html = await page.content();
        expect(html).not.toMatch(/<script>\s*alert\s*\(/i);
      }
    });
  });

  test.describe("Command Injection Prevention", () => {
    test("should not execute shell commands via file uploads", async ({ request }) => {
      // Attempt command injection in filename
      const maliciousFilename = "; cat /etc/passwd; #.txt";

      // This would require multipart form data, simplified here
      const response = await request.post("/api/contacts/upload", {
        headers: {
          "Content-Type": "multipart/form-data",
        },
        multipart: {
          file: {
            name: maliciousFilename,
            mimeType: "text/plain",
            buffer: Buffer.from("test content"),
          },
        },
      });

      // Should not return 200 with command output
      if (response.status() === 200) {
        const body = await response.text();
        expect(body).not.toContain("root:"); // /etc/passwd content
      } else {
        const status = response.status();
        expect([400, 401, 403, 415]).toContain(status);
      }
    });
  });

  test.describe("NoSQL Injection Prevention", () => {
    test("should prevent NoSQL injection in MongoDB-style queries", async ({ request }) => {
      const noSqlInjection = JSON.stringify({
        "$where": "this.password.length > 0",
        "$ne": null,
      });

      const response = await request.get(`/api/campaigns?filter=${encodeURIComponent(noSqlInjection)}`);

      // Should not successfully execute the NoSQL query
      const status = response.status();
      if (status === 200) {
        // If the server responds 200, the filter must have been sanitized – results must be empty
        const body = await response.json();
        const results = body.data ?? body.results ?? body;
        expect(
          Array.isArray(results),
          `Expected response body to be an array but got: ${JSON.stringify(body)}`
        ).toBe(true);
        expect(results.length, "NoSQL injection filter must return zero results").toBe(0);
      } else {
        expect([400, 401, 403]).toContain(status);
      }
    });
  });

  test.describe("Template Injection Prevention", () => {
    test("should prevent SSTI (Server-Side Template Injection)", async ({ request }) => {
      const templateInjectionPayloads = [
        "{{ 7*7 }}", // Jinja2
        "${7*7}", // Expression language
        "<%= 7*7 %>", // ERB
        "#{7*7}", // Ruby
      ];

      for (const payload of templateInjectionPayloads) {
        const response = await request.post("/api/campaigns", {
          data: {
            name: payload,
            description: payload,
          },
        });

        if (response.status() === 200) {
          const body = await response.json();
          // Should not evaluate the expression (49)
          expect(body?.data?.name).not.toBe("49");
          expect(body?.data?.description).not.toBe("49");
        }
      }
    });
  });
});
