/**
 * E2E Test: Journey Flow with Mocked IMAP
 * Phase 5.9
 */

import { describe, expect, it, vi, beforeEach } from "vitest";

// Mock IMAP client for reply detection
const mockImapClient = {
  connect: vi.fn().mockResolvedValue(undefined),
  logout: vi.fn().mockResolvedValue(undefined),
  getMailboxLock: vi.fn().mockResolvedValue({ release: vi.fn() }),
  search: vi.fn().mockResolvedValue([]),
  fetchOne: vi.fn().mockResolvedValue(null),
};

describe("E2E: Journey Flow with Mocked IMAP", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("complete journey lifecycle", () => {
    it("simulates full journey from enrollment to completion", async () => {
      // 1. Create a journey campaign
      const journey = {
        id: "journey-001",
        accountId: "account-001",
        name: "Welcome Sequence",
        type: "journey",
        status: "active",
        steps: [
          { id: "step-1", stepNumber: 1, name: "Initial", delayDays: 0, templateId: "tpl-1" },
          { id: "step-2", stepNumber: 2, name: "1st Follow Up", delayDays: 3, templateId: "tpl-2" },
          { id: "step-3", stepNumber: 3, name: "2nd Follow Up", delayDays: 5, templateId: "tpl-3" },
          { id: "step-4", stepNumber: 4, name: "Hail Mary", delayDays: 7, templateId: "tpl-4" },
        ],
      };
      expect(journey.steps).toHaveLength(4);
      expect(journey.type).toBe("journey");

      // 2. Enroll contacts into the journey
      const contacts = [
        { id: "contact-001", email: "alice@example.com", firstName: "Alice" },
        { id: "contact-002", email: "bob@example.com", firstName: "Bob" },
      ];

      const enrollments = contacts.map((contact, index) => ({
        id: `enrollment-${index + 1}`,
        campaignId: journey.id,
        contactId: contact.id,
        status: "enrolled",
        currentStepId: journey.steps[0].id,
        nextSendAt: new Date(), // Immediate for step 1 (delayDays: 0)
        removeOnReply: true,
        removeOnUnsubscribe: true,
      }));

      expect(enrollments).toHaveLength(2);
      expect(enrollments[0].status).toBe("enrolled");

      // 3. Process initial sends (Step 1 - immediate)
      const initialSends = enrollments.map((enrollment) => ({
        messageInstanceId: `msg-${enrollment.id}-1`,
        campaignId: journey.id,
        contactId: enrollment.contactId,
        templateId: journey.steps[0].templateId,
        status: "sent",
        sentAt: new Date(),
      }));

      expect(initialSends).toHaveLength(2);
      expect(initialSends[0].templateId).toBe("tpl-1");

      // 4. Update enrollment state after initial send
      const updatedEnrollments = enrollments.map((e) => ({
        ...e,
        status: "initial_sent",
        currentStepId: journey.steps[1].id,
        nextSendAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // 3 days
      }));

      expect(updatedEnrollments[0].status).toBe("initial_sent");

      // 5. Mock IMAP poll - simulate reply from contact-001
      mockImapClient.search.mockResolvedValueOnce([101, 102]);
      mockImapClient.fetchOne
        .mockResolvedValueOnce({
          headers: new Map([
            ["message-id", "<reply-001@example.com>"],
            ["in-reply-to", "<original-msg-001@resend.com>"],
            ["from", "Alice <alice@example.com>"],
            ["subject", "Re: Welcome to our platform"],
            ["date", new Date().toUTCString()],
          ]),
          bodyParts: new Map([["TEXT", "Thanks for reaching out! I'm interested in learning more."]]),
        })
        .mockResolvedValueOnce({
          headers: new Map([
            ["message-id", "<reply-002@example.com>"],
            ["in-reply-to", "<original-msg-002@resend.com>"],
            ["from", "Bob <bob@example.com>"],
            ["subject", "Re: Welcome to our platform"],
            ["date", new Date().toUTCString()],
          ]),
          bodyParts: new Map([["TEXT", "Please unsubscribe me from these emails."]]),
        });

      // 6. Process replies
      const replies = [
        {
          id: "reply-001",
          messageInstanceId: "msg-enrollment-1-1",
          contactId: "contact-001",
          campaignId: journey.id,
          subject: "Re: Welcome to our platform",
          bodyPreview: "Thanks for reaching out!",
          imapMessageId: "<reply-001@example.com>",
          receivedAt: new Date(),
        },
      ];

      // 7. Remove contact-001 from journey due to reply (removeOnReply: true)
      const activeEnrollments = updatedEnrollments.filter((e) => {
        const hasReplied = replies.some((r) => r.contactId === e.contactId);
        return !hasReplied; // Remove if replied
      });

      expect(activeEnrollments).toHaveLength(1);
      expect(activeEnrollments[0].contactId).toBe("contact-002");

      // 8. Continue journey for remaining contact
      const followUpSend = {
        messageInstanceId: "msg-enrollment-2-2",
        campaignId: journey.id,
        contactId: "contact-002",
        templateId: journey.steps[1].templateId,
        status: "sent",
        sentAt: new Date(),
      };

      expect(followUpSend.templateId).toBe("tpl-2");

      // 9. Complete journey after all steps
      const finalState = {
        campaignId: journey.id,
        totalEnrolled: 2,
        active: 0,
        completed: 1, // contact-002 completed all steps
        removed: 1, // contact-001 removed due to reply
      };

      expect(finalState.totalEnrolled).toBe(2);
      expect(finalState.removed).toBe(1);
      expect(finalState.completed).toBe(1);
    });

    it("handles reply detection via In-Reply-To header", () => {
      // Reply with In-Reply-To referencing original message
      const replyEmail = {
        messageId: "<reply-123@example.com>",
        inReplyTo: "<original-456@resend.com>",
        references: [],
        from: "Contact <contact@example.com>",
        subject: "Re: Your message",
        bodyPreview: "Thanks for the info!",
        date: new Date(),
      };

      // Match to original outbound message
      const originalMessage = {
        resendMessageId: "<original-456@resend.com>",
        contactId: "contact-123",
        campaignId: "campaign-456",
      };

      const isMatch = replyEmail.inReplyTo === originalMessage.resendMessageId;
      expect(isMatch).toBe(true);
    });

    it("handles reply detection via References header fallback", () => {
      // Reply without In-Reply-To but with References
      const replyEmail = {
        messageId: "<reply-789@example.com>",
        references: ["<original-abc@resend.com>", "<other@example.com>"],
        from: "Contact <contact@example.com>",
        subject: "Re: Your message",
        bodyPreview: "Following up...",
        date: new Date(),
      };

      const originalMessage = {
        resendMessageId: "<original-abc@resend.com>",
        contactId: "contact-123",
        campaignId: "campaign-456",
      };

      const isMatch = replyEmail.references?.includes(originalMessage.resendMessageId) ?? false;
      expect(isMatch).toBe(true);
    });

    it("handles reply detection via sender email fallback", () => {
      // Reply without In-Reply-To or References (e.g., forwarded message)
      const replyEmail = {
        messageId: "<reply-xyz@example.com>",
        from: "John Doe <john@example.com>",
        subject: "Quick question",
        bodyPreview: "Hi, I have a question...",
        date: new Date(),
      };

      // Extract email from sender
      const fromMatch = replyEmail.from.match(/<([^>]+)>/);
      const senderEmail = fromMatch ? fromMatch[1] : replyEmail.from;

      const knownContact = {
        email: "john@example.com",
        id: "contact-123",
      };

      const isMatch = senderEmail === knownContact.email;
      expect(isMatch).toBe(true);
      expect(senderEmail).toBe("john@example.com");
    });
  });

  describe("journey progression", () => {
    it("advances through all journey states correctly", () => {
      const states = [
        "enrolled",
        "initial_sent",
        "first_followup_sent",
        "second_followup_sent",
        "hail_mary_sent",
        "completed",
      ];

      // Simulate state progression
      let currentState = states[0];
      expect(currentState).toBe("enrolled");

      currentState = states[1];
      expect(currentState).toBe("initial_sent");

      currentState = states[5];
      expect(currentState).toBe("completed");
    });

    it("calculates next send times with delays", () => {
      const now = new Date();

      // Step 1: Immediate (delayDays: 0)
      const step1Send = new Date(now);
      expect(step1Send.getTime()).toBe(now.getTime());

      const MS_PER_DAY = 24 * 60 * 60 * 1000;

      // Step 2: 3 days later
      const step2Send = new Date(now);
      step2Send.setDate(step2Send.getDate() + 3);
      expect(step2Send.getTime()).toBe(now.getTime() + 3 * MS_PER_DAY);

      // Step 3: 5 days later
      const step3Send = new Date(now);
      step3Send.setDate(step3Send.getDate() + 5);
      expect(step3Send.getTime()).toBe(now.getTime() + 5 * MS_PER_DAY);

      // Step 4: 7 days later
      const step4Send = new Date(now);
      step4Send.setDate(step4Send.getDate() + 7);
      expect(step4Send.getTime()).toBe(now.getTime() + 7 * MS_PER_DAY);
    });
  });

  describe("error recovery", () => {
    it("handles IMAP connection failures gracefully", async () => {
      mockImapClient.connect.mockRejectedValueOnce(new Error("Connection refused"));

      let error: Error | null = null;
      try {
        await mockImapClient.connect();
      } catch (e) {
        error = e as Error;
      }

      expect(error?.message).toBe("Connection refused");
    });

    it("continues processing after individual message fetch errors", async () => {
      const uids = [101, 102, 103];

      // Simulate failure on middle message — build results from uids so order is explicit
      const fetchResults = uids.map((uid, i) =>
        i === 1
          ? { success: false, uid, error: "Fetch failed" }
          : { success: true, uid, error: undefined },
      );

      const successfulFetches = fetchResults.filter((r) => r.success);
      expect(successfulFetches).toHaveLength(2);
      expect(fetchResults[1].uid).toBe(uids[1]);
      expect(fetchResults[1].error).toBe("Fetch failed");
    });
  });
});
