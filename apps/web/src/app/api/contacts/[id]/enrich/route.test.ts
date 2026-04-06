/**
 * Tests for single contact re-enrichment API
 * POST /api/contacts/[id]/enrich
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "./route";
import { createMockRequest, createMockAccount } from "@/test/api-helpers";

vi.mock("@/lib/auth/session", () => ({
  getAuthAccount: vi.fn(),
}));

vi.mock("@outreachos/services", () => ({
  EnrichmentService: {
    reEnrich: vi.fn(),
  },
}));

import { getAuthAccount } from "@/lib/auth/session";
import { EnrichmentService } from "@outreachos/services";

describe("POST /api/contacts/[id]/enrich", () => {
  const mockAccount = createMockAccount();
  const contactId = "contact_123";

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("HUNTER_API_KEY", "test_hunter_key");
  });

  const createRequest = (method: string = "POST") => createMockRequest("http://localhost:3000/api/contacts/contact_123/enrich", { method });

  it("returns 401 if not authenticated", async () => {
    vi.mocked(getAuthAccount).mockResolvedValueOnce(null);

    const req = createRequest();
    const res = await POST(req, { params: Promise.resolve({ id: contactId }) });

    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toBe("Unauthorized");
  });

  it("returns 503 if Hunter API key not configured", async () => {
    vi.mocked(getAuthAccount).mockResolvedValueOnce(mockAccount);
    vi.stubEnv("HUNTER_API_KEY", "");

    const req = createRequest();
    const res = await POST(req, { params: Promise.resolve({ id: contactId }) });

    expect(res.status).toBe(503);
    const data = await res.json();
    expect(data.error).toBe("Hunter.io API key not configured");
  });

  it("returns 404 if contact not found", async () => {
    vi.mocked(getAuthAccount).mockResolvedValueOnce(mockAccount);
    vi.mocked(EnrichmentService.reEnrich).mockResolvedValueOnce({
      contactId,
      error: "Contact not found",
      errorCode: "NOT_FOUND",
    });

    const req = createRequest();
    const res = await POST(req, { params: Promise.resolve({ id: contactId }) });

    expect(res.status).toBe(404);
    const data = await res.json();
    expect(data.error).toBe("Contact not found");
  });

  it("returns success with enrichment data", async () => {
    vi.mocked(getAuthAccount).mockResolvedValueOnce(mockAccount);
    vi.mocked(EnrichmentService.reEnrich).mockResolvedValueOnce({
      contactId,
      email: "john@example.com",
      score: 95,
      status: "valid",
      linkedinUrl: "https://linkedin.com/in/johndoe",
    });

    const req = createRequest();
    const res = await POST(req, { params: Promise.resolve({ id: contactId }) });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.email).toBe("john@example.com");
    expect(data.score).toBe(95);
    expect(data.status).toBe("valid");
    expect(data.linkedinUrl).toBe("https://linkedin.com/in/johndoe");
  });

  it("returns 422 with error message on enrichment failure", async () => {
    vi.mocked(getAuthAccount).mockResolvedValueOnce(mockAccount);
    vi.mocked(EnrichmentService.reEnrich).mockResolvedValueOnce({
      contactId,
      error: "No business website to derive domain",
      errorCode: "NO_DOMAIN",
    });

    const req = createRequest();
    const res = await POST(req, { params: Promise.resolve({ id: contactId }) });

    expect(res.status).toBe(422);
    const data = await res.json();
    expect(data.success).toBe(false);
    expect(data.error).toBe("No business website to derive domain");
    expect(data.errorCode).toBe("NO_DOMAIN");
  });

  it("calls EnrichmentService.reEnrich with correct params", async () => {
    vi.mocked(getAuthAccount).mockResolvedValueOnce(mockAccount);
    vi.mocked(EnrichmentService.reEnrich).mockResolvedValueOnce({
      contactId,
      email: "test@example.com",
    });

    const req = createRequest();
    await POST(req, { params: Promise.resolve({ id: contactId }) });

    expect(EnrichmentService.reEnrich).toHaveBeenCalledWith(
      mockAccount.id,
      contactId,
      expect.objectContaining({
        hunterApiKey: "test_hunter_key",
        confidenceThreshold: 80,
        retrieveLinkedIn: true,
      })
    );
  });
});
