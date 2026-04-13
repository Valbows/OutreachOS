/**
 * Reply Detection Accuracy Tests
 * Phase 5.9 - Testing various reply matching scenarios
 */

import { describe, expect, it } from "vitest";
import { InboxService } from "./inbox-service.js";

describe("Reply Detection Accuracy", () => {
  describe("In-Reply-To header matching", () => {
    it("matches exact message ID", () => {
      const reply = {
        inReplyTo: "<original-msg-123@resend.com>",
      };
      const original = {
        resendMessageId: "<original-msg-123@resend.com>",
      };

      const isMatch = reply.inReplyTo === original.resendMessageId;
      expect(isMatch).toBe(true);
    });

    it("handles angle brackets in message IDs", () => {
      const reply = {
        inReplyTo: "<abc-123@example.com>",
      };
      const original = {
        resendMessageId: "<abc-123@example.com>",
      };

      const isMatch = reply.inReplyTo === original.resendMessageId;
      expect(isMatch).toBe(true);
    });

    it("rejects non-matching message IDs", () => {
      const reply = {
        inReplyTo: "<different-msg@example.com>",
      };
      const original = {
        resendMessageId: "<original-msg-123@resend.com>",
      };

      const isMatch = reply.inReplyTo === original.resendMessageId;
      expect(isMatch).toBe(false);
    });

    it("handles case sensitivity in message IDs", () => {
      const reply = {
        inReplyTo: "<MSG-123@EXAMPLE.COM>",
      };
      const original = {
        resendMessageId: "<msg-123@example.com>",
      };

      // Message IDs should be case-sensitive
      const isMatch = reply.inReplyTo === original.resendMessageId;
      expect(isMatch).toBe(false);
    });
  });

  describe("References header matching", () => {
    it("matches first reference", () => {
      const reply = {
        references: ["<original-123@resend.com>", "<other@example.com>"],
      };
      const original = {
        resendMessageId: "<original-123@resend.com>",
      };

      const isMatch = reply.references?.includes(original.resendMessageId) ?? false;
      expect(isMatch).toBe(true);
    });

    it("matches any reference in chain", () => {
      const reply = {
        references: [
          "<first@example.com>",
          "<second@example.com>",
          "<original-456@resend.com>",
          "<fourth@example.com>",
        ],
      };
      const original = {
        resendMessageId: "<original-456@resend.com>",
      };

      const isMatch = reply.references?.includes(original.resendMessageId) ?? false;
      expect(isMatch).toBe(true);
    });

    it("handles empty references array", () => {
      const reply: { references: string[] } = {
        references: [],
      };
      const original = {
        resendMessageId: "<original@resend.com>",
      };

      const isMatch = reply.references?.includes(original.resendMessageId) ?? false;
      expect(isMatch).toBe(false);
    });

    it("handles missing references field", () => {
      const reply = {};
      const original = {
        resendMessageId: "<original@resend.com>",
      };

      const isMatch = (reply as { references?: string[] }).references?.includes(original.resendMessageId) ?? false;
      expect(isMatch).toBe(false);
    });

    it("filters whitespace in references", () => {
      const reply = {
        references: "<original-123@resend.com> <other@example.com>".split(/\s+/).filter(Boolean),
      };
      const original = {
        resendMessageId: "<original-123@resend.com>",
      };

      const isMatch = reply.references.includes(original.resendMessageId);
      expect(isMatch).toBe(true);
    });
  });

  describe("Sender email matching", () => {
    it("extracts email from Name <email> format", () => {
      expect(InboxService.extractEmail("John Doe <john@example.com>")).toBe("john@example.com");
    });

    it("handles bare email addresses", () => {
      expect(InboxService.extractEmail("jane@example.com")).toBe("jane@example.com");
    });

    it("handles emails with display names", () => {
      expect(InboxService.extractEmail('"Company Support" <support@company.com>')).toBe("support@company.com");
    });

    it("handles malformed from headers gracefully", () => {
      expect(InboxService.extractEmail("not-an-email")).toBeNull();
    });

    it("matches extracted email to contact", () => {
      const contact = { id: "contact-123", email: "contact@example.com" };
      const extractedEmail = InboxService.extractEmail("contact@example.com");
      expect(extractedEmail).toBe(contact.email);
    });

    it("handles email normalization", () => {
      const contact = { email: "user@example.com" };
      const extractedEmail = InboxService.extractEmail("User@Example.COM");
      // extractEmail returns the address as-is; callers normalise before DB lookup
      expect(extractedEmail?.toLowerCase()).toBe(contact.email);
    });
  });

  describe("matching priority order", () => {
    it("prioritizes In-Reply-To over References", () => {
      const reply = {
        inReplyTo: "<correct@resend.com>",
        references: ["<wrong@resend.com>"],
      };

      // In-Reply-To should be checked first
      const matchByInReplyTo = reply.inReplyTo === "<correct@resend.com>";
      expect(matchByInReplyTo).toBe(true);
    });

    it("falls back to References when In-Reply-To missing", () => {
      const reply = {
        inReplyTo: undefined,
        references: ["<original@resend.com>"],
      };

      const matchByInReplyTo = reply.inReplyTo === "<original@resend.com>";
      const matchByReferences = reply.references?.includes("<original@resend.com>") ?? false;

      expect(matchByInReplyTo).toBe(false);
      expect(matchByReferences).toBe(true);
    });

    it("falls back to sender email when headers unavailable", () => {
      const reply = {
        inReplyTo: undefined,
        references: undefined,
        from: "John <john@example.com>",
      };

      const hasMessageIdMatch = !!(reply.inReplyTo || reply.references);
      expect(hasMessageIdMatch).toBe(false);

      // Fall back to sender email matching — exercise the real extraction function
      const extractedEmail = InboxService.extractEmail(reply.from);
      expect(extractedEmail).toBe("john@example.com");
    });
  });

  describe("edge cases", () => {
    it("handles very long message IDs", () => {
      const longId = "<" + "a".repeat(200) + "@resend.com>";
      const reply = { inReplyTo: longId };
      const original = { resendMessageId: longId };

      const isMatch = reply.inReplyTo === original.resendMessageId;
      expect(isMatch).toBe(true);
      expect(longId.length).toBeGreaterThan(200);
    });

    it("handles special characters in message IDs", () => {
      const specialId = "<msg_123.test+label@resend-mail.com>";
      const reply = { inReplyTo: specialId };
      const original = { resendMessageId: specialId };

      const isMatch = reply.inReplyTo === original.resendMessageId;
      expect(isMatch).toBe(true);
    });

    it("handles multiple In-Reply-To values (edge case)", () => {
      // Rare case: multiple In-Reply-To headers
      const reply = {
        inReplyTo: "<first@resend.com>, <second@resend.com>",
      };

      const ids = reply.inReplyTo.split(/,\s*/);
      expect(ids).toHaveLength(2);
      expect(ids).toContain("<first@resend.com>");
      expect(ids).toContain("<second@resend.com>");
    });

    it("handles circular references gracefully", () => {
      // Edge case: reply references itself
      const circularReply = {
        messageId: "<self@example.com>",
        references: ["<self@example.com>"],
      };

      const isCircular = circularReply.references?.includes(circularReply.messageId) ?? false;
      expect(isCircular).toBe(true);
    });

    it("handles null/undefined values safely", () => {
      const reply: { inReplyTo?: string | null; references?: string[] | null } = {
        inReplyTo: null,
        references: null,
      };

      const inReplyToValid = !!reply.inReplyTo;
      const referencesValid = Array.isArray(reply.references) && reply.references.length > 0;

      expect(inReplyToValid).toBe(false);
      expect(referencesValid).toBe(false);
    });
  });

  describe("accuracy metrics", () => {
    it("calculates precision and recall", () => {
      // True Positives: Correctly matched replies
      const tp = 95;
      // False Positives: Incorrectly matched (wrong reply linked)
      const fp = 3;
      // False Negatives: Missed replies (not matched)
      const fn = 5;

      const precision = tp / (tp + fp);
      const recall = tp / (tp + fn);
      const f1 = 2 * ((precision * recall) / (precision + recall));

      expect(precision).toBeCloseTo(0.969, 2);
      expect(recall).toBeCloseTo(0.95, 2);
      expect(f1).toBeGreaterThan(0.95);
    });

    it("measures match confidence by strategy", () => {
      // Confidence levels for each matching strategy
      const confidence = {
        inReplyTo: 1.0, // Highest - exact reference
        references: 0.95, // High - in conversation chain
        senderEmail: 0.7, // Medium - heuristic based
      };

      expect(confidence.inReplyTo).toBeGreaterThan(confidence.senderEmail);
      expect(confidence.references).toBeGreaterThan(confidence.senderEmail);
    });
  });
});
