import { describe, expect, it } from "vitest";
import { ContactService } from "./contact-service.js";

describe("ContactService", () => {
  describe("parseCSVLine", () => {
    it("parses a simple comma-separated line", () => {
      expect(ContactService.parseCSVLine("a,b,c")).toEqual(["a", "b", "c"]);
    });

    it("handles quoted values with commas", () => {
      expect(ContactService.parseCSVLine('"hello, world",b,c')).toEqual([
        "hello, world",
        "b",
        "c",
      ]);
    });

    it("handles escaped double quotes inside quoted values", () => {
      expect(ContactService.parseCSVLine('"say ""hi""",b')).toEqual([
        'say "hi"',
        "b",
      ]);
    });

    it("handles empty values", () => {
      expect(ContactService.parseCSVLine(",b,")).toEqual(["", "b", ""]);
    });

    it("handles single value", () => {
      expect(ContactService.parseCSVLine("only")).toEqual(["only"]);
    });

    it("handles newlines inside quoted values", () => {
      expect(ContactService.parseCSVLine('"line1\nline2",b')).toEqual([
        "line1\nline2",
        "b",
      ]);
    });

    it("gracefully handles unterminated quoted field", () => {
      // Unterminated quote: treats content as quoted value without closing delimiter
      expect(ContactService.parseCSVLine('"hello,world')).toEqual(["hello,world"]);
    });
  });

  describe("parseCSV", () => {
    it("parses a valid CSV string with standard headers", () => {
      const csv = [
        "First Name,Last Name,Business Website,Company Name,Email",
        "John,Doe,example.com,Acme Inc,john@example.com",
        "Jane,Smith,test.com,Test Corp,jane@test.com",
      ].join("\n");

      const rows = ContactService.parseCSV(csv);
      expect(rows).toHaveLength(2);
      expect(rows[0].firstName).toBe("John");
      expect(rows[0].lastName).toBe("Doe");
      expect(rows[0].businessWebsite).toBe("example.com");
      expect(rows[0].companyName).toBe("Acme Inc");
      expect(rows[0].email).toBe("john@example.com");
    });

    it("maps alternative header names correctly", () => {
      const csv = [
        "first_name,last_name,website,company,email address",
        "John,Doe,example.com,Acme,john@example.com",
      ].join("\n");

      const rows = ContactService.parseCSV(csv);
      expect(rows).toHaveLength(1);
      expect(rows[0].firstName).toBe("John");
      expect(rows[0].lastName).toBe("Doe");
      expect(rows[0].businessWebsite).toBe("example.com");
      expect(rows[0].companyName).toBe("Acme");
      expect(rows[0].email).toBe("john@example.com");
    });

    it("maps LinkedIn header variations", () => {
      const csv = [
        "First Name,Last Name,Business Website,Company Name,linkedin_url",
        "John,Doe,example.com,Acme,https://linkedin.com/in/johndoe",
      ].join("\n");

      const rows = ContactService.parseCSV(csv);
      expect(rows[0].linkedinUrl).toBe("https://linkedin.com/in/johndoe");
    });

    it("returns empty array for header-only CSV", () => {
      const csv = "First Name,Last Name,Business Website,Company Name";
      const rows = ContactService.parseCSV(csv);
      expect(rows).toHaveLength(0);
    });

    it("returns empty array for empty string", () => {
      expect(ContactService.parseCSV("")).toHaveLength(0);
    });

    it("throws for missing required columns", () => {
      const csv = [
        "First Name,Last Name,Email",
        "John,Doe,john@example.com",
      ].join("\n");

      expect(() => ContactService.parseCSV(csv)).toThrow(
        /Missing required column/,
      );
    });

    it("handles Windows-style line endings", () => {
      const csv =
        "First Name,Last Name,Business Website,Company Name\r\nJohn,Doe,example.com,Acme";
      const rows = ContactService.parseCSV(csv);
      expect(rows).toHaveLength(1);
      expect(rows[0].firstName).toBe("John");
    });

    it("handles quoted headers", () => {
      const csv = [
        '"First Name","Last Name","Business Website","Company Name"',
        "John,Doe,example.com,Acme",
      ].join("\n");

      const rows = ContactService.parseCSV(csv);
      expect(rows).toHaveLength(1);
      expect(rows[0].firstName).toBe("John");
    });

    it("trims whitespace from values", () => {
      const csv = [
        "First Name,Last Name,Business Website,Company Name",
        " John , Doe , example.com , Acme Inc ",
      ].join("\n");

      const rows = ContactService.parseCSV(csv);
      expect(rows[0].firstName).toBe("John");
      expect(rows[0].lastName).toBe("Doe");
    });

    it("handles rows with fewer columns than header (pads missing fields)", () => {
      const csv = [
        "First Name,Last Name,Business Website,Company Name",
        "John,Doe,example.com", // Missing Company Name
      ].join("\n");

      const rows = ContactService.parseCSV(csv);
      expect(rows).toHaveLength(1);
      expect(rows[0].firstName).toBe("John");
      expect(rows[0].lastName).toBe("Doe");
      expect(rows[0].businessWebsite).toBe("example.com");
      expect(rows[0].companyName).toBe(""); // Padded as empty string
    });

    it("handles rows with more columns than header (ignores extra columns)", () => {
      const csv = [
        "First Name,Last Name,Business Website,Company Name",
        "John,Doe,example.com,Acme Inc,Extra Field1,Extra Field2", // Extra columns
      ].join("\n");

      const rows = ContactService.parseCSV(csv);
      expect(rows).toHaveLength(1);
      expect(rows[0].firstName).toBe("John");
      expect(rows[0].lastName).toBe("Doe");
      expect(rows[0].businessWebsite).toBe("example.com");
      expect(rows[0].companyName).toBe("Acme Inc");
    });
  });

  describe("escapeCSV", () => {
    it("returns plain value unchanged", () => {
      expect(ContactService.escapeCSV("hello")).toBe("hello");
    });

    it("wraps value with commas in double quotes", () => {
      expect(ContactService.escapeCSV("hello, world")).toBe('"hello, world"');
    });

    it("wraps value with double quotes and escapes them", () => {
      expect(ContactService.escapeCSV('say "hi"')).toBe('"say ""hi"""');
    });

    it("wraps value with newlines in double quotes", () => {
      expect(ContactService.escapeCSV("line1\nline2")).toBe('"line1\nline2"');
    });

    it("returns empty string for empty input", () => {
      expect(ContactService.escapeCSV("")).toBe("");
    });

    it("handles combined special characters (commas, newlines, quotes)", () => {
      const input = 'a,b\n"c"';
      const expected = '"a,b\n""c"""';
      expect(ContactService.escapeCSV(input)).toBe(expected);
    });
  });
});
