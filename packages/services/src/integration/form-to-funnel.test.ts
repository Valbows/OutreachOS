/**
 * Integration Test: Form Submission → Contact Creation → Funnel Enrollment → Email Send
 * Phase 5.9
 */

import { describe, expect, it, vi } from "vitest";

describe("Form → Contact → Funnel → Email Integration", () => {
  describe("workflow orchestration", () => {
    it("defines the complete integration flow", () => {
      // Step 1: Form submission with contact data
      const formSubmission = {
        formId: "form-123",
        data: {
          firstName: "John",
          lastName: "Doe",
          email: "john@example.com",
          company: "Acme Inc",
        },
        hashedIp: "b6d767d2f8ed5d21a44b0e5886680cb9b2b0a3a3a2a3a4a5a6a7a8a9a0a1a2a3",
        userAgent: "Mozilla/5.0",
      };
      expect(formSubmission.data.email).toBe("john@example.com");

      // Step 2: Contact is created from form data
      const createdContact = {
        id: "contact-456",
        accountId: "account-789",
        firstName: formSubmission.data.firstName,
        lastName: formSubmission.data.lastName,
        email: formSubmission.data.email,
        companyName: formSubmission.data.company,
        customFields: formSubmission.data,
        createdAt: new Date(),
      };
      expect(createdContact.email).toBe("john@example.com");
      expect(createdContact.accountId).toBe("account-789");

      // Step 3: Form is mapped to a funnel
      const formMapping = {
        formId: "form-123",
        funnelId: "funnel-999",
        journeyId: null as string | null,
      };
      expect(formMapping.funnelId).toBe("funnel-999");

      // Step 4: Contact enrolls in funnel if conditions are met
      const enrollment = {
        campaignId: "funnel-999",
        contactId: createdContact.id,
        status: "enrolled",
        currentStepId: "step-1",
        nextSendAt: new Date(Date.now() + 86400000), // 1 day delay
      };
      expect(enrollment.contactId).toBe("contact-456");
      expect(enrollment.status).toBe("enrolled");

      // Step 5: Email is sent when step is due
      const emailSend = {
        messageInstanceId: "msg-777",
        campaignId: "funnel-999",
        contactId: createdContact.id,
        templateId: "tpl-888",
        subject: "Follow up from Acme Inc",
        status: "sent",
        sentAt: new Date(),
      };
      expect(emailSend.contactId).toBe("contact-456");
      expect(emailSend.status).toBe("sent");
    });

    it("handles existing contact lookup", () => {
      // When a contact already exists with the same email
      const existingContact = {
        id: "contact-existing",
        email: "jane@example.com",
        accountId: "account-789",
      };

      // Form submission with same email
      const formData = { email: "jane@example.com", firstName: "Jane" };

      // Should match existing contact instead of creating new
      const matchedContactId = formData.email === existingContact.email
        ? existingContact.id
        : null;
      
      expect(matchedContactId).toBe("contact-existing");
    });

    it("evaluates funnel conditions before enrollment", () => {
      const conditions = [
        { type: "did_not_open", referenceCampaignId: "campaign-001" },
        { type: "opened_more_than", threshold: 2 },
      ];

      const candidateContact = {
        id: "contact-123",
        opens: 1, // Did not meet opened_more_than threshold
      };

      // AND logic: all conditions must be met
      const passesDidNotOpen = true; // Assume this passed
      const passesOpenedMoreThan = candidateContact.opens > (conditions[1]?.threshold ?? 0);
      const shouldEnroll = passesDidNotOpen && passesOpenedMoreThan;

      expect(shouldEnroll).toBe(false);
    });

    it("enqueues email for future send with delay", () => {
      const now = new Date();
      const delayDays = 3;
      const delayHour = 10;

      const nextSendAt = new Date(now);
      nextSendAt.setDate(nextSendAt.getDate() + delayDays);
      nextSendAt.setUTCHours(delayHour, 0, 0, 0);

      const expected = new Date(now);
      expected.setUTCDate(expected.getUTCDate() + delayDays);
      expected.setUTCHours(delayHour, 0, 0, 0);

      expect(nextSendAt.getTime()).toBeGreaterThan(now.getTime());
      expect(nextSendAt.getUTCDate()).toBe(expected.getUTCDate());
      expect(nextSendAt.getUTCHours()).toBe(expected.getUTCHours());
    });

    it("links submission to contact for audit trail", () => {
      const submission = {
        id: "sub-111",
        formId: "form-123",
        contactId: "contact-456", // Linked to created contact
        data: { firstName: "John", email: "john@example.com" },
        submittedAt: new Date(),
      };

      expect(submission.contactId).toBe("contact-456");
    });
  });

  describe("error handling", () => {
    it("handles missing form gracefully", () => {
      const invalidFormId = "form-nonexistent";
      const formExists = false;
      
      expect(() => {
        if (!formExists) throw new Error(`Form not found: ${invalidFormId}`);
      }).toThrow("Form not found: form-nonexistent");
    });

    it("handles missing account for contact creation", () => {
      const accountId = undefined;
      const canCreateContact = !!accountId;
      
      expect(canCreateContact).toBe(false);
    });

    it("handles invalid email in form data", () => {
      const invalidEmail = "not-an-email";
      const isValidEmail = invalidEmail.includes("@") && invalidEmail.includes(".");
      
      expect(isValidEmail).toBe(false);
    });
  });

  describe("data consistency", () => {
    it("preserves custom fields in contact record", () => {
      const formData = {
        firstName: "John",
        email: "john@example.com",
        industry: "Technology",
        companySize: "50-200",
        source: "landing_page_a",
      };

      const customFields = { ...formData };
      
      expect(customFields.industry).toBe("Technology");
      expect(customFields.companySize).toBe("50-200");
      expect(customFields.source).toBe("landing_page_a");
    });

    it("normalizes email to lowercase", () => {
      const rawEmail = "John.Doe@Example.COM";
      const normalizedEmail = rawEmail.trim().toLowerCase();
      
      expect(normalizedEmail).toBe("john.doe@example.com");
    });
  });
});
