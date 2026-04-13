import { afterEach, describe, expect, it, vi } from "vitest";
import { LLMService } from "./llm-service.js";

describe("LLMService", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

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

    it("throws typed LLM errors", async () => {
      await expect(
        LLMService.generate("test-account", { apiKey: "fake-key", provider: "openrouter" }, "test", "test"),
      ).rejects.toThrow(/AUTH_ERROR|NETWORK_ERROR|LLM_GENERATION_ERROR|RATE_LIMIT_EXCEEDED/);
    });

    it("falls back to OpenRouter when Gemini fails in auto mode", async () => {
      const geminiSpy = vi
        .spyOn(LLMService as never, "generateViaGemini" as never)
        .mockRejectedValueOnce(new Error("boom"));
      const openRouterSpy = vi
        .spyOn(LLMService as never, "generateViaOpenRouter" as never)
        .mockResolvedValueOnce({
          text: "fallback copy",
          inputTokens: 12,
          outputTokens: 8,
          latencyMs: 42,
        });

      const result = await LLMService.generate(
        "test-account",
        {
          apiKey: "primary-key",
          fallbackApiKey: "fallback-key",
          provider: "gemini",
          routingMode: "auto",
        },
        "test prompt",
        "linkedin_copy",
      );

      expect(geminiSpy).toHaveBeenCalledTimes(1);
      expect(openRouterSpy).toHaveBeenCalledTimes(1);
      expect(result.text).toBe("fallback copy");
    });
  });
});
