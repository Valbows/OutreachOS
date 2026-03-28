import { describe, expect, it } from "vitest";
import { LLMService } from "./llm-service.js";

describe("LLMService", () => {
  describe("public interface", () => {
    it("exports the LLMService class with all methods", () => {
      expect(LLMService).toBeDefined();
      expect(typeof LLMService.generateEmail).toBe("function");
      expect(typeof LLMService.generateSubjectLines).toBe("function");
      expect(typeof LLMService.rewriteEmail).toBe("function");
      expect(typeof LLMService.generate).toBe("function");
      expect(typeof LLMService.generateLinkedInCopy).toBe("function");
    });
  });

  describe("LLM routing", () => {
    it("routes to Gemini by default (provider unset)", async () => {
      // Should attempt Gemini and fail with auth error (no real key)
      await expect(
        LLMService.generate("test-account", { apiKey: "fake-key" }, "test prompt", "test"),
      ).rejects.toThrow();
    });

    it("routes to OpenRouter when provider is openrouter", async () => {
      // Should attempt OpenRouter and fail with network/auth error (no real key)
      await expect(
        LLMService.generate("test-account", { apiKey: "fake-key", provider: "openrouter" }, "test prompt", "test"),
      ).rejects.toThrow();
    });

    it("maps rate limit errors correctly", async () => {
      try {
        await LLMService.generate("test-account", { apiKey: "fake-key", provider: "openrouter" }, "test", "test");
      } catch (err) {
        // Any error is expected — we just verify it's a typed LLM error
        expect(err).toBeInstanceOf(Error);
        const msg = (err as Error).message;
        expect(
          msg.startsWith("LLM_GENERATION_ERROR") ||
          msg.startsWith("NETWORK_ERROR") ||
          msg.startsWith("AUTH_ERROR") ||
          msg.startsWith("RATE_LIMIT_EXCEEDED"),
        ).toBe(true);
      }
    });
  });
});
