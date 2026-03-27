import { describe, expect, it } from "vitest";
import { CampaignService } from "./campaign-service.js";

/** Compute expected HMAC-SHA256 signature for testing */
async function computeTestSignature(payload: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

describe("CampaignService", () => {
  describe("class structure", () => {
    it("exports CampaignService with expected methods", () => {
      expect(CampaignService).toBeDefined();
      expect(typeof CampaignService.list).toBe("function");
      expect(typeof CampaignService.getById).toBe("function");
      expect(typeof CampaignService.create).toBe("function");
      expect(typeof CampaignService.update).toBe("function");
      expect(typeof CampaignService.delete).toBe("function");
      expect(typeof CampaignService.sendCampaign).toBe("function");
      expect(typeof CampaignService.processWebhookEvent).toBe("function");
      expect(typeof CampaignService.validateWebhookSignature).toBe("function");
    });
  });

  describe("validateWebhookSignature", () => {
    it("returns false for empty signature", async () => {
      const result = await CampaignService.validateWebhookSignature(
        '{"test": true}',
        "",
        "test-secret",
      );
      expect(result).toBe(false);
    });

    it("returns false for mismatched signature", async () => {
      const result = await CampaignService.validateWebhookSignature(
        '{"test": true}',
        "invalid-signature",
        "test-secret",
      );
      expect(result).toBe(false);
    });

    it("returns true for valid signature", async () => {
      const payload = '{"test": true}';
      const secret = "test-secret";
      const validSignature = await computeTestSignature(payload, secret);
      
      const result = await CampaignService.validateWebhookSignature(
        payload,
        validSignature,
        secret,
      );
      expect(result).toBe(true);
    });

    it("returns false for valid signature with wrong secret", async () => {
      const payload = '{"test": true}';
      const validSignature = await computeTestSignature(payload, "correct-secret");
      
      const result = await CampaignService.validateWebhookSignature(
        payload,
        validSignature,
        "wrong-secret",
      );
      expect(result).toBe(false);
    });
  });
});
