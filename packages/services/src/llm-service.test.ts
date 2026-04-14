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

    it("reserves platform quota once before provider execution", async () => {
      const reserveSpy = vi
        .spyOn(LLMService as never, "reservePlatformQuota" as never)
        .mockResolvedValueOnce("reservation-1");
      const geminiSpy = vi
        .spyOn(LLMService as never, "generateViaGemini" as never)
        .mockResolvedValueOnce({
          text: "reserved copy",
          inputTokens: 10,
          outputTokens: 5,
          latencyMs: 20,
        });

      const result = await LLMService.generate(
        "test-account",
        {
          apiKey: "platform-key",
          provider: "gemini",
          usingPlatformKey: true,
        },
        "reserved prompt",
        "linkedin_copy",
      );

      expect(reserveSpy).toHaveBeenCalledTimes(1);
      expect(reserveSpy).toHaveBeenCalledWith("test-account", "reserved prompt", "linkedin_copy");
      expect(geminiSpy).toHaveBeenCalledWith(
        "test-account",
        expect.objectContaining({ usingPlatformKey: true }),
        "reserved prompt",
        "linkedin_copy",
        "reservation-1",
      );
      expect(result.text).toBe("reserved copy");
    });

    it("releases platform quota reservation when provider execution ultimately fails", async () => {
      const reserveSpy = vi
        .spyOn(LLMService as never, "reservePlatformQuota" as never)
        .mockResolvedValueOnce("reservation-2");
      const releaseSpy = vi
        .spyOn(LLMService as never, "releasePlatformQuotaReservation" as never)
        .mockResolvedValueOnce(undefined);
      vi
        .spyOn(LLMService as never, "generateViaGemini" as never)
        .mockRejectedValueOnce(new Error("primary failed"));

      await expect(
        LLMService.generate(
          "test-account",
          {
            apiKey: "platform-key",
            provider: "gemini",
            usingPlatformKey: true,
          },
          "reserved prompt",
          "linkedin_copy",
        ),
      ).rejects.toThrow("primary failed");

      expect(reserveSpy).toHaveBeenCalledTimes(1);
      expect(releaseSpy).toHaveBeenCalledTimes(1);
      expect(releaseSpy).toHaveBeenCalledWith("reservation-2");
    });

    it("keeps a single reservation across Gemini fallback success", async () => {
      const reserveSpy = vi
        .spyOn(LLMService as never, "reservePlatformQuota" as never)
        .mockResolvedValueOnce("reservation-3");
      const releaseSpy = vi
        .spyOn(LLMService as never, "releasePlatformQuotaReservation" as never)
        .mockResolvedValue(undefined);
      const geminiSpy = vi
        .spyOn(LLMService as never, "generateViaGemini" as never)
        .mockRejectedValueOnce(new Error("boom"));
      const openRouterSpy = vi
        .spyOn(LLMService as never, "generateViaOpenRouter" as never)
        .mockResolvedValueOnce({
          text: "fallback reserved copy",
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
          usingPlatformKey: true,
        },
        "test prompt",
        "linkedin_copy",
      );

      expect(reserveSpy).toHaveBeenCalledTimes(1);
      expect(geminiSpy).toHaveBeenCalledTimes(1);
      expect(openRouterSpy).toHaveBeenCalledTimes(1);
      expect(openRouterSpy).toHaveBeenCalledWith(
        "test-account",
        expect.objectContaining({ provider: "openrouter" }),
        "test prompt",
        "linkedin_copy",
        "reservation-3",
      );
      expect(releaseSpy).not.toHaveBeenCalled();
      expect(result.text).toBe("fallback reserved copy");
    });
  });
});
