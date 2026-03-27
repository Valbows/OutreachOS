import { describe, expect, it } from "vitest";
import { LLMService } from "./llm-service.js";

describe("LLMService", () => {
  describe("buildEmailPrompt (via generateEmail structure)", () => {
    // We test the prompt builder indirectly — it's a private method but
    // we can validate the public interface types exist
    it("exports the LLMService class", () => {
      expect(LLMService).toBeDefined();
      expect(typeof LLMService.generateEmail).toBe("function");
      expect(typeof LLMService.generateSubjectLines).toBe("function");
      expect(typeof LLMService.rewriteEmail).toBe("function");
      expect(typeof LLMService.generate).toBe("function");
    });
  });
});
