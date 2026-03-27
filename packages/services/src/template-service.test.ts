import { describe, expect, it } from "vitest";
import { TemplateService } from "./template-service.js";

describe("TemplateService", () => {
  describe("extractTokens", () => {
    it("extracts single token from HTML", () => {
      expect(TemplateService.extractTokens("Hello {FirstName}!")).toEqual(["FirstName"]);
    });

    it("extracts multiple unique tokens", () => {
      const tokens = TemplateService.extractTokens(
        "Hi {FirstName} from {CompanyName}, your email is {Email}",
      );
      expect(tokens).toEqual(["FirstName", "CompanyName", "Email"]);
    });

    it("deduplicates repeated tokens", () => {
      const tokens = TemplateService.extractTokens(
        "{FirstName} and {FirstName} again",
      );
      expect(tokens).toEqual(["FirstName"]);
    });

    it("returns empty array when no tokens present", () => {
      expect(TemplateService.extractTokens("No tokens here")).toEqual([]);
    });

    it("handles tokens in HTML tags", () => {
      const tokens = TemplateService.extractTokens(
        '<p>Hello <strong>{FirstName}</strong> at {CompanyName}</p>',
      );
      expect(tokens).toEqual(["FirstName", "CompanyName"]);
    });

    it("ignores malformed tokens (no closing brace)", () => {
      expect(TemplateService.extractTokens("Hello {FirstName")).toEqual([]);
    });

    it("handles tokens with underscores and numbers", () => {
      const tokens = TemplateService.extractTokens("{Custom_Field1} and {another2}");
      expect(tokens).toEqual(["Custom_Field1", "another2"]);
    });
  });

  describe("render", () => {
    it("replaces tokens with context values", () => {
      const result = TemplateService.render(
        "Hello {FirstName}, welcome to {CompanyName}!",
        { firstName: "Alice", companyName: "Acme" },
      );
      expect(result).toBe("Hello Alice, welcome to Acme!");
    });

    it("uses fallback when context value is missing", () => {
      const result = TemplateService.render(
        "Hello {FirstName}!",
        {},
        { FirstName: "Friend" },
      );
      expect(result).toBe("Hello Friend!");
    });

    it("preserves original token when no value or fallback", () => {
      const result = TemplateService.render("Hello {FirstName}!", {});
      expect(result).toBe("Hello {FirstName}!");
    });

    it("handles mixed context values and fallbacks", () => {
      const result = TemplateService.render(
        "Hi {FirstName} from {CompanyName}, visit {BusinessWebsite}",
        { firstName: "Bob" },
        { CompanyName: "Unknown Co" },
      );
      expect(result).toBe("Hi Bob from Unknown Co, visit {BusinessWebsite}");
    });

    it("treats empty strings as missing and uses fallback", () => {
      // Empty string is falsy, so fallback is used
      const result = TemplateService.render(
        "Hello {FirstName}!",
        { firstName: "" },
        { FirstName: "Fallback" },
      );
      expect(result).toBe("Hello Fallback!");
    });

    it("handles HTML content with tokens", () => {
      const result = TemplateService.render(
        '<p>Dear <b>{FirstName}</b>,</p><p>From {CompanyName}</p>',
        { firstName: "Carol", companyName: "TechCo" },
      );
      expect(result).toBe('<p>Dear <b>Carol</b>,</p><p>From TechCo</p>');
    });
  });
});
