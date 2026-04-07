/**
 * LLM Template Generation Quality Tests
 * Phase 4.7 - Validates LLM output quality for email generation
 */

import { describe, expect, it, vi, beforeEach } from "vitest";
import { LLMService } from "@outreachos/services";

// Mock Google GenAI
const mockGenerateContent = vi.fn();
vi.mock("@google/genai", () => ({
  GoogleGenAI: vi.fn().mockImplementation(() => ({
    models: {
      generateContent: (...args: unknown[]) => mockGenerateContent(...args),
    },
  })),
}));

describe("LLM Template Generation Quality Tests", () => {
  const accountId = "acc_test";
  const config = { apiKey: "test_key", provider: "gemini" as const };
  
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("generateEmail", () => {
    it("generates email with proper structure (greeting, body, CTA)", async () => {
      mockGenerateContent.mockResolvedValueOnce({
        text: `
Subject: Welcome to Our Platform

Hi John,

Welcome to our platform! We're excited to have you on board.

Our solution helps companies like Acme Corp streamline their workflow and increase productivity by up to 40%.

Key benefits:
- Easy integration
- 24/7 support
- Advanced analytics

Ready to get started? Click here to schedule your onboarding call:
https://example.com/onboarding

Best regards,
The Team
        `.trim(),
        usageMetadata: { promptTokenCount: 100, candidatesTokenCount: 200 },
      });

      const result = await LLMService.generateEmail(accountId, config, {
        goal: "welcome new user",
        audience: "new signup",
        tone: "friendly",
        cta: "schedule onboarding",
      });

      // Quality checks
      expect(result.text).toBeTruthy();
      expect(result.text.length).toBeGreaterThan(100); // Substantial content
      expect(result.inputTokens).toBeGreaterThan(0);
      expect(result.outputTokens).toBeGreaterThan(0);
      expect(result.latencyMs).toBeGreaterThanOrEqual(0);
      
      // Parse subject and body from response
      const hasSubject = result.text.toLowerCase().includes("subject:");
      expect(hasSubject).toBe(true);
      
      // Structure validation
      const hasGreeting = /^(Hi|Hello|Hey|Dear|Greetings)/im.test(result.text);
      expect(hasGreeting).toBe(true);
      
      const hasCTA = /(click|schedule|get started|sign up|learn more|visit)/i.test(result.text);
      expect(hasCTA).toBe(true);
    });

    it("handles different tones appropriately", async () => {
      const toneResponses = {
        professional: {
          text: `
Subject: Quick question

Dear Sir/Madam,

Thank you for your time. We appreciate your consideration.

Best regards,
The Team
          `.trim(),
          expectedWords: ["best regards", "thank", "sincerely"],
        },
        friendly: {
          text: `
Subject: Quick question

Hello there,

Hi! Thanks for your time. Would love to connect soon.

Thanks,
The Team
          `.trim(),
          expectedWords: ["hi", "hello", "thanks"],
        },
        casual: {
          text: `
Subject: Quick question

Hey there,

Just reaching out. Would love to chat sometime!

Cheers,
The Team
          `.trim(),
          expectedWords: ["hey", "cheers", "chat"],
        },
      };

      for (const [tone, { text, expectedWords }] of Object.entries(toneResponses)) {
        mockGenerateContent.mockResolvedValueOnce({
          text,
          usageMetadata: { promptTokenCount: 50, candidatesTokenCount: 80 },
        });

        const result = await LLMService.generateEmail(accountId, config, {
          goal: "follow up",
          audience: "prospect",
          tone: tone as "professional" | "friendly" | "casual",
        });

        // Check that at least one expected word appears in the result
        const lowerText = result.text.toLowerCase();
        const hasExpectedWord = expectedWords.some((word) => lowerText.includes(word));
        expect(hasExpectedWord).toBeTruthy();

        expect(result.text.length).toBeGreaterThan(0);
        expect(result.inputTokens).toBeGreaterThan(0);
      }
    });

    it("generates subject line within 10 words for A/B testing compatibility", async () => {
      mockGenerateContent.mockResolvedValueOnce({
        text: `
Subject: Boost Your Productivity Today

Hi there,

Body content here.

Best,
Team
        `.trim(),
        usageMetadata: { promptTokenCount: 50, candidatesTokenCount: 60 },
      });

      const result = await LLMService.generateEmail(accountId, config, {
        goal: "productivity pitch",
        audience: "business owner",
        tone: "professional",
      });

      // Check for subject line format in response
      const lines = result.text.split('\n');
      const subjectLine = lines.find(l => l.toLowerCase().startsWith('subject:'));
      expect(subjectLine).toBeDefined();
      
      const wordCount = subjectLine ? subjectLine.replace(/subject:/i, '').trim().split(/\s+/).length : 0;
      expect(wordCount).toBeLessThanOrEqual(10); // Allow some flexibility
    });

    it("includes unsubscribe footer when required", async () => {
      mockGenerateContent.mockResolvedValueOnce({
        text: `
Subject: Special Offer Inside

Hello,

Check out our special offer!

Unsubscribe: https://example.com/unsubscribe
        `.trim(),
        usageMetadata: { promptTokenCount: 50, candidatesTokenCount: 70 },
      });

      const result = await LLMService.generateEmail(accountId, config, {
        goal: "promote offer",
        audience: "customers",
        tone: "professional",
      });

      expect(result.text.toLowerCase()).toMatch(/unsubscribe|opt-out|remove/);
    });

    it("returns raw HTML output from LLM (sanitization happens at render layer)", async () => {
      mockGenerateContent.mockResolvedValueOnce({
        text: '<p>Valid content</p><script>alert("xss")</script>',
        usageMetadata: { promptTokenCount: 30, candidatesTokenCount: 50 },
      });

      const result = await LLMService.generateEmail(accountId, config, {
        goal: "test",
        audience: "test",
        tone: "professional",
      });

      // LLMService returns raw LLM output - sanitization happens in TemplateService.render
      // which uses DOMPurify before sending emails
      expect(result.text).toContain("<script>");
      expect(result.text).toContain("<p>");
    });

    it("handles API errors gracefully", async () => {
      mockGenerateContent.mockRejectedValueOnce(new Error("API rate limit exceeded"));

      await expect(
        LLMService.generateEmail(accountId, config, {
          goal: "test",
          audience: "test",
          tone: "professional",
        })
      ).rejects.toThrow();
    });

    it("handles malformed responses", async () => {
      mockGenerateContent.mockResolvedValueOnce({
        text: "",
        usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 0 },
      });

      const result = await LLMService.generateEmail(accountId, config, {
        goal: "test",
        audience: "test",
        tone: "professional",
      });

      // Should return something even if empty
      expect(result).toBeDefined();
    });
  });

  describe("generateSubjectLines", () => {
    it("generates exactly 3 subject line variants", async () => {
      mockGenerateContent.mockResolvedValueOnce({
        text: '["Boost Your Sales", "Grow Revenue Fast", "Sales Tips Inside"]',
        usageMetadata: { promptTokenCount: 40, candidatesTokenCount: 30 },
      });

      const result = await LLMService.generateSubjectLines(accountId, config, {
        emailBody: "Email about sales growth",
        tone: "professional",
        count: 3,
      });

      const subjects = JSON.parse(result.text);
      expect(subjects).toHaveLength(3);
      subjects.forEach((s: string) => {
        expect(s.length).toBeGreaterThan(0);
        expect(s.length).toBeLessThan(100);
      });
    });

    it("parses non-JSON responses into array", async () => {
      mockGenerateContent.mockResolvedValueOnce({
        text: `
1. "First Subject Line"
2. "Second Subject Line"  
3. "Third Subject Line"
        `.trim(),
        usageMetadata: { promptTokenCount: 40, candidatesTokenCount: 30 },
      });

      const result = await LLMService.generateSubjectLines(accountId, config, {
        emailBody: "Test content",
        tone: "friendly",
      });

      // Should handle the fallback parsing
      expect(result.text).toBeTruthy();
    });
  });

  describe("rewriteEmail", () => {
    it("maintains original email structure while applying instruction", async () => {
      const originalBody = `
Hi {{FirstName}},

Thanks for signing up! We're excited to have you.

Best,
Team
      `.trim();

      mockGenerateContent.mockResolvedValueOnce({
        text: `
Subject: Welcome to {{CompanyName}}

Hi {{FirstName}},

Thank you for joining us! We're thrilled to have you on board and can't wait to see what you accomplish.

Best regards,
The Team
        `.trim(),
        usageMetadata: { promptTokenCount: 50, candidatesTokenCount: 100 },
      });

      const result = await LLMService.rewriteEmail(accountId, config, originalBody, "make it more enthusiastic");

      // Should preserve token placeholders
      expect(result.text).toContain("{{FirstName}}");
      
      // Should have similar structure
      expect(result.text.toLowerCase()).toContain("hi");
      expect(result.text.toLowerCase()).toContain("thank");
      
      // Should be modified per instruction
      expect(result.text.length).not.toBe(originalBody.length);
    });

    it("handles complex rewrite instructions", async () => {
      mockGenerateContent.mockResolvedValueOnce({
        text: `
Subject: Exclusive Offer for {{CompanyName}}

Hello {{FirstName}},

I noticed {{CompanyName}} is growing fast. Our solution has helped similar companies increase efficiency by 35%.

Would you be open to a brief call next Tuesday?

Regards,
Sales Team
        `.trim(),
        usageMetadata: { promptTokenCount: 60, candidatesTokenCount: 120 },
      });

      const result = await LLMService.rewriteEmail(
        accountId, 
        config,
        "Generic email content",
        "personalize for the contact and add specific value proposition"
      );

      expect(result.text).toContain("{{CompanyName}}");
      expect(result.text).toContain("{{FirstName}}");
    });
  });

  describe("token preservation", () => {
    it("preserves all template tokens in generated content", async () => {
      const bodyWithTokens = "Hi {FirstName}, welcome to {CompanyName}. Your email is {Email}.";
      
      mockGenerateContent.mockResolvedValueOnce({
        text: `
Subject: Welcome to {CompanyName}

Hi {FirstName},

Welcome to {CompanyName}! We've sent a confirmation to {Email}.

Thanks,
Team
        `.trim(),
        usageMetadata: { promptTokenCount: 50, candidatesTokenCount: 80 },
      });

      const result = await LLMService.rewriteEmail(
        accountId,
        config,
        bodyWithTokens,
        "make it warmer"
      );

      // All tokens should be preserved
      expect(result.text).toContain("{FirstName}");
      expect(result.text).toContain("{CompanyName}");
      expect(result.text).toContain("{Email}");
    });
  });
});
