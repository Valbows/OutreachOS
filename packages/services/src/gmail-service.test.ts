import { describe, it, expect, vi, beforeEach } from "vitest";
import { GmailService } from "./gmail-service";

describe("GmailService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.GOOGLE_CLIENT_ID = "test-client-id";
    process.env.GOOGLE_CLIENT_SECRET = "test-client-secret";
  });

  describe("refreshAccessToken", () => {
    it("should successfully refresh access token", async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: "new-access-token",
          expires_in: 3600,
        }),
      } as Response);

      const token = await GmailService.refreshAccessToken("test-refresh-token");

      expect(token).toBe("new-access-token");
      const [url, init] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(url).toBe("https://oauth2.googleapis.com/token");
      expect(init.method).toBe("POST");
      expect(init.headers).toEqual({ "Content-Type": "application/x-www-form-urlencoded" });
      expect(init.body).toBeInstanceOf(URLSearchParams);
      expect((init.body as URLSearchParams).get("refresh_token")).toBe("test-refresh-token");
      expect((init.body as URLSearchParams).get("grant_type")).toBe("refresh_token");
    });

    it("should return null when refresh fails", async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: false,
        text: async () => "invalid_grant",
      } as Response);

      const token = await GmailService.refreshAccessToken("invalid-token");

      expect(token).toBeNull();
    });

    it("should return null on network error", async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error("Network error"));

      const token = await GmailService.refreshAccessToken("test-token");

      expect(token).toBeNull();
    });
  });

  describe("sendEmail", () => {
    it("should successfully send an email", async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: "message-123",
          threadId: "thread-123",
        }),
      } as Response);

      const service = new GmailService("test-access-token");
      const result = await service.sendEmail({
        to: "recipient@example.com",
        subject: "Test Subject",
        text: "Test body",
        html: "<p>Test body</p>",
        from: "sender@gmail.com",
      });

      expect(result.success).toBe(true);
      expect(result.messageId).toBe("message-123");
      expect(fetch).toHaveBeenCalledWith(
        "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
        expect.objectContaining({
          method: "POST",
          headers: {
            Authorization: "Bearer test-access-token",
            "Content-Type": "application/json",
          },
        })
      );
    });

    it("should handle email send failure", async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 403,
        text: async () => "Insufficient permissions",
      } as Response);

      const service = new GmailService("invalid-token");
      const result = await service.sendEmail({
        to: "recipient@example.com",
        subject: "Test",
        text: "Body",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("403");
    });

    it("should handle network errors", async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error("Network failure"));

      const service = new GmailService("test-token");
      const result = await service.sendEmail({
        to: "recipient@example.com",
        subject: "Test",
        text: "Body",
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe("Network failure");
    });

    it("should use html content when provided", async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: "msg-123" }),
      } as Response);

      const service = new GmailService("test-token");
      await service.sendEmail({
        to: "test@example.com",
        subject: "HTML Email",
        text: "Plain text",
        html: "<h1>HTML content</h1>",
      });

      const callArgs = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      const body = JSON.parse(callArgs[1].body);
      expect(body.raw).toBeDefined();
      const decoded = Buffer.from(body.raw, "base64url").toString("utf-8");
      expect(decoded).toContain('Content-Type: text/html; charset="UTF-8"');
      expect(decoded).toContain("<h1>HTML content</h1>");
    });

    it("should fall back to text when html is not provided", async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: "msg-123" }),
      } as Response);

      const service = new GmailService("test-token");
      await service.sendEmail({
        to: "test@example.com",
        subject: "Text Email",
        text: "Plain text only",
      });

      const callArgs = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      const body = JSON.parse(callArgs[1].body);
      expect(body.raw).toBeDefined();
      const decoded = Buffer.from(body.raw, "base64url").toString("utf-8");
      expect(decoded).toContain('Content-Type: text/plain; charset="UTF-8"');
      expect(decoded).toContain("Plain text only");
    });
  });
});
