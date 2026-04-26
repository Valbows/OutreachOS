import { test, expect } from "@playwright/test";

/**
 * A10:2021 – Server-Side Request Forgery (SSRF)
 * Tests for unauthorized outbound requests and internal resource access
 */

test.describe("A10 - Server-Side Request Forgery", () => {
  test.describe("Outbound Request Validation", () => {
    test("should not allow fetching internal metadata endpoints", async ({ request }) => {
      const internalEndpoints = [
        "http://169.254.169.254/latest/meta-data/", // AWS IMDS
        "http://metadata.google.internal/", // GCP Metadata
        "http://192.168.1.1/", // Common router
        "http://10.0.0.1/", // Private network
        "http://127.0.0.1:3001/", // Local MCP server
        "http://localhost:5432/", // Database
      ];

      for (const url of internalEndpoints) {
        // Try via webhook or URL-based features
        const response = await request.post("/api/webhooks", {
          data: {
            url,
            events: ["campaign.created"],
          },
        });

        // Should block or sanitize internal URLs
        if (response.status() === 200) {
          const body = await response.json();
          // If created, webhook should not have access to internal data
          expect(body.url).not.toMatch(
            /169\.254\.169\.254|metadata\.google|192\.168\.|10\.|127\.|localhost|\[::1\]/i
          );
        } else {
          const status = response.status();
          expect([400, 403, 422]).toContain(status);
        }
      }
    });

    test("should validate URL schemes", async ({ request }) => {
      const dangerousSchemes = [
        "file:///etc/passwd",
        "ftp://internal-server/",
        "gopher://localhost/",
        "dict://localhost:11211/",
      ];

      for (const url of dangerousSchemes) {
        const response = await request.post("/api/integrations/connect", {
          data: {
            url,
            type: "webhook",
          },
        });

        // Should reject non-http(s) schemes
        const status = response.status();
        expect([400, 403, 422]).toContain(status);
      }
    });

    test.skip("should prevent DNS rebinding attacks", async () => {
      // TODO: This test requires a controlled DNS rebinding service (e.g. rebind.network or a
      // self-hosted test server) whose domain initially resolves to a public IP but later
      // resolves to an internal IP (127.x, 10.x, 192.168.x).  The placeholder domains used
      // here ("attacker.com", "evil.example.com") do NOT actually rebind in CI so no meaningful
      // assertion can be made.
      //
      // To implement this properly:
      //   1. Stand up a rebinding endpoint (e.g. 1u.ms or a custom DNS server in test infra).
      //   2. Register its URL in rebindingDomains below.
      //   3. Assert request.post("/api/webhooks", { data: { url, events: ["test"] } }) returns
      //      400/403/422 – meaning the webhook handler rejected the post-rebind internal IP.
    });
  });

  test.describe("Webhook URL Validation", () => {
    test("should only allow http/https webhooks", async ({ request }) => {
      const invalidWebhooks = [
        { url: "javascript:alert('xss')", description: "JavaScript scheme" },
        { url: "data:text/html,<script>alert('xss')</script>", description: "Data scheme" },
        { url: "vbscript:msgbox('xss')", description: "VBScript scheme" },
      ];

      for (const { url, description } of invalidWebhooks) {
        const response = await request.post("/api/webhooks", {
          data: {
            url,
            events: ["campaign.created"],
          },
        });

        // All non-http(s) schemes should be rejected
        const status = response.status();
        expect([400, 403, 422]).toContain(status);
      }
    });

    test("should validate webhook domains", async ({ request }) => {
      // Try to set webhook to internal services
      const internalWebhooks = [
        "http://localhost/api/internal",
        "http://127.0.0.1:3000/admin",
        "http://0.0.0.0:3001/health",
      ];

      for (const url of internalWebhooks) {
        const response = await request.post("/api/webhooks", {
          data: { url, events: ["test"] },
        });

        // Should block localhost/127.0.0.1 webhooks
        const status = response.status();
        expect([400, 403]).toContain(status);
      }
    });
  });

  test.describe("Import/Export URL Validation", () => {
    test("should validate import URLs", async ({ request }) => {
      const maliciousImportUrls = [
        "http://169.254.169.254/latest/user-data",
        "file:///etc/hosts",
        "http://localhost:3001/internal",
      ];

      for (const url of maliciousImportUrls) {
        const response = await request.post("/api/contacts/import-url", {
          data: {
            url,
            format: "csv",
          },
        });

        // Should reject URLs that could access internal resources
        const status = response.status();
        expect([400, 403, 422]).toContain(status);
      }
    });
  });

  test.describe("Cloud Metadata Protection", () => {
    test("should block access to cloud metadata services", async ({ request }) => {
      // Common cloud metadata endpoints
      const metadataServices = [
        { service: "AWS", url: "http://169.254.169.254/latest/meta-data/iam/security-credentials/" },
        { service: "GCP", url: "http://metadata.google.internal/computeMetadata/v1/" },
        { service: "Azure", url: "http://169.254.169.254/metadata/instance?api-version=2021-02-01" },
      ];

      for (const { service, url } of metadataServices) {
        const response = await request.post("/api/integrations/fetch", {
          data: { url },
        });

        // All cloud metadata access attempts should be blocked
        const status = response.status();
        expect([400, 403, 500]).toContain(status);
      }
    });
  });
});
