import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { EnrichmentService } from "./enrichment-service.js";

describe("EnrichmentService", () => {
  describe("extractDomain", () => {
    it("extracts domain from full URL", () => {
      expect(EnrichmentService.extractDomain("https://www.example.com/page")).toBe(
        "example.com",
      );
    });

    it("extracts domain from URL without www", () => {
      expect(EnrichmentService.extractDomain("https://example.com")).toBe(
        "example.com",
      );
    });

    it("extracts domain from http URL", () => {
      expect(EnrichmentService.extractDomain("http://example.com")).toBe(
        "example.com",
      );
    });

    it("extracts domain from bare domain string", () => {
      expect(EnrichmentService.extractDomain("example.com")).toBe(
        "example.com",
      );
    });

    it("strips www from bare domain", () => {
      expect(EnrichmentService.extractDomain("www.example.com")).toBe(
        "example.com",
      );
    });

    it("handles domain with path", () => {
      expect(EnrichmentService.extractDomain("example.com/about")).toBe(
        "example.com",
      );
    });

    it("returns null for null input", () => {
      expect(EnrichmentService.extractDomain(null)).toBeNull();
    });

    it("returns null for undefined input", () => {
      expect(EnrichmentService.extractDomain(undefined)).toBeNull();
    });

    it("returns null for empty string", () => {
      expect(EnrichmentService.extractDomain("")).toBeNull();
    });

    it("returns the hostname for a single-label domain like localhost", () => {
      // Node's URL constructor accepts 'https://localhost' as valid
      expect(EnrichmentService.extractDomain("localhost")).toBe("localhost");
    });

    it("handles subdomain correctly", () => {
      expect(EnrichmentService.extractDomain("https://blog.example.com")).toBe(
        "blog.example.com",
      );
    });
  });

  describe("delay", () => {
    afterEach(() => {
      vi.useRealTimers();
    });

    it("resolves after the specified time", async () => {
      vi.useFakeTimers();
      const promise = EnrichmentService.delay(100);
      vi.advanceTimersByTime(100);
      await expect(promise).resolves.toBeUndefined();
    });
  });

  describe("fetchWithRetry", () => {
    beforeEach(() => {
      vi.restoreAllMocks();
    });

    it("returns data on successful response", async () => {
      const mockData = { data: { email: "test@example.com" } };
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response(JSON.stringify(mockData), { status: 200 }),
      );

      const result = await EnrichmentService.fetchWithRetry("https://api.test.com/endpoint");
      expect(result).toEqual(mockData);
    });

    it("retries on 429 with exponential backoff", async () => {
      vi.spyOn(EnrichmentService, "delay").mockResolvedValue(undefined);
      const fetchSpy = vi.spyOn(globalThis, "fetch")
        .mockResolvedValueOnce(new Response("", { status: 429 }))
        .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }));

      const result = await EnrichmentService.fetchWithRetry("https://api.test.com/endpoint");
      expect(result).toEqual({ ok: true });
      expect(fetchSpy).toHaveBeenCalledTimes(2);
    });

    it("throws after max retries on persistent 429", async () => {
      vi.spyOn(EnrichmentService, "delay").mockResolvedValue(undefined);
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response("Rate limited", { status: 429 }),
      );

      // With retries=2, attempts are 0,1,2. On attempt 2 (== retries), the 429
      // branch doesn't continue, so it falls through to the error throw.
      await expect(
        EnrichmentService.fetchWithRetry("https://api.test.com/endpoint", 2),
      ).rejects.toThrow("Hunter.io API error 429");
    });

    it("throws immediately on non-429 error", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response("Forbidden", { status: 403 }),
      );

      await expect(
        EnrichmentService.fetchWithRetry("https://api.test.com/endpoint"),
      ).rejects.toThrow("Hunter.io API error 403");
    });

    it("calls delay with exponential backoff values", async () => {
      const delaySpy = vi.spyOn(EnrichmentService, "delay").mockResolvedValue(undefined);
      vi.spyOn(globalThis, "fetch")
        .mockResolvedValueOnce(new Response("", { status: 429 }))
        .mockResolvedValueOnce(new Response("", { status: 429 }))
        .mockResolvedValueOnce(new Response(JSON.stringify({}), { status: 200 }));

      await EnrichmentService.fetchWithRetry("https://api.test.com/endpoint");
      expect(delaySpy).toHaveBeenCalledTimes(2);
      expect(delaySpy).toHaveBeenNthCalledWith(1, 1000); // BASE_DELAY * 2^0
      expect(delaySpy).toHaveBeenNthCalledWith(2, 2000); // BASE_DELAY * 2^1
    });
  });

  describe("enrichContact", () => {
    beforeEach(() => {
      vi.restoreAllMocks();
    });

    it("returns error when no email found", async () => {
      vi.spyOn(EnrichmentService, "emailFinder").mockResolvedValueOnce({
        data: {
          email: "",
          score: 0,
          sources: [],
        },
      });

      const result = await EnrichmentService.enrichContact(
        "contact-1",
        "John",
        "Doe",
        "example.com",
        { hunterApiKey: "test-key" },
      );

      expect(result.error).toBe("No email found");
    });

    it("returns error when score below threshold", async () => {
      vi.spyOn(EnrichmentService, "emailFinder").mockResolvedValueOnce({
        data: {
          email: "john@example.com",
          score: 40,
          sources: [],
        },
      });

      const result = await EnrichmentService.enrichContact(
        "contact-1",
        "John",
        "Doe",
        "example.com",
        { hunterApiKey: "test-key", confidenceThreshold: 80 },
      );

      expect(result.error).toContain("below threshold");
      expect(result.email).toBe("john@example.com");
      expect(result.score).toBe(40);
    });

    it("returns error when verifier status is not valid/accept_all", async () => {
      vi.spyOn(EnrichmentService, "emailFinder").mockResolvedValueOnce({
        data: {
          email: "john@example.com",
          score: 95,
          sources: [],
        },
      });
      vi.spyOn(EnrichmentService, "emailVerifier").mockResolvedValueOnce({
        data: {
          result: "undeliverable",
          score: 20,
          status: "invalid",
        },
      });

      const result = await EnrichmentService.enrichContact(
        "contact-1",
        "John",
        "Doe",
        "example.com",
        { hunterApiKey: "test-key" },
      );

      expect(result.error).toContain("not in accepted set");
      expect(result.status).toBe("invalid");
    });

    it("returns enrichment data when verifier status is accept_all", async () => {
      vi.spyOn(EnrichmentService, "emailFinder").mockResolvedValueOnce({
        data: {
          email: "john@example.com",
          score: 85,
          sources: [],
        },
      });
      vi.spyOn(EnrichmentService, "emailVerifier").mockResolvedValueOnce({
        data: {
          result: "risky",
          score: 75,
          status: "accept_all",
        },
      });

      const result = await EnrichmentService.enrichContact(
        "contact-1",
        "John",
        "Doe",
        "example.com",
        { hunterApiKey: "test-key" },
      );

      expect(result.error).toBeUndefined();
      expect(result.status).toBe("accept_all");
      expect(result.email).toBe("john@example.com");
    });

    it("returns full enrichment data on success", async () => {
      vi.spyOn(EnrichmentService, "emailFinder").mockResolvedValueOnce({
        data: {
          email: "john@example.com",
          score: 95,
          sources: [{ domain: "example.com", uri: "https://example.com/team", extracted_on: "2024-01-01" }],
          linkedin_url: "https://linkedin.com/in/johndoe",
        },
      });
      vi.spyOn(EnrichmentService, "emailVerifier").mockResolvedValueOnce({
        data: {
          result: "deliverable",
          score: 98,
          status: "valid",
        },
      });

      const result = await EnrichmentService.enrichContact(
        "contact-1",
        "John",
        "Doe",
        "example.com",
        { hunterApiKey: "test-key", retrieveLinkedIn: true },
      );

      expect(result.email).toBe("john@example.com");
      expect(result.score).toBe(98);
      expect(result.status).toBe("valid");
      expect(result.sources).toEqual(["https://example.com/team"]);
      expect(result.linkedinUrl).toBe("https://linkedin.com/in/johndoe");
      expect(result.error).toBeUndefined();
    });

    it("does not include linkedin when retrieveLinkedIn is false", async () => {
      vi.spyOn(EnrichmentService, "emailFinder").mockResolvedValueOnce({
        data: {
          email: "john@example.com",
          score: 95,
          sources: [],
          linkedin_url: "https://linkedin.com/in/johndoe",
        },
      });
      vi.spyOn(EnrichmentService, "emailVerifier").mockResolvedValueOnce({
        data: {
          result: "deliverable",
          score: 98,
          status: "valid",
        },
      });

      const result = await EnrichmentService.enrichContact(
        "contact-1",
        "John",
        "Doe",
        "example.com",
        { hunterApiKey: "test-key", retrieveLinkedIn: false },
      );

      expect(result.linkedinUrl).toBeUndefined();
    });

    it("catches and returns error from API failure", async () => {
      vi.spyOn(EnrichmentService, "emailFinder").mockRejectedValueOnce(
        new Error("Network error"),
      );

      const result = await EnrichmentService.enrichContact(
        "contact-1",
        "John",
        "Doe",
        "example.com",
        { hunterApiKey: "test-key" },
      );

      expect(result.error).toBe("Network error");
    });
  });
});
