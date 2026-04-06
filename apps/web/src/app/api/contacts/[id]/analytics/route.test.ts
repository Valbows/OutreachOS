/**
 * Tests for contact analytics API
 * GET /api/contacts/[id]/analytics
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "./route";
import { createMockRequest, createMockAccount } from "@/test/api-helpers";

vi.mock("@/lib/auth/session", () => ({
  getAuthAccount: vi.fn(),
}));

vi.mock("@outreachos/services", () => ({
  ContactService: {
    getById: vi.fn(),
  },
}));

vi.mock("@outreachos/db", () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          orderBy: vi.fn(() => Promise.resolve([])),
        })),
        innerJoin: vi.fn(() => ({
          where: vi.fn(() => Promise.resolve([])),
        })),
      })),
    })),
  },
  messageInstances: {},
  emailEvents: {},
  replies: {},
  journeyEnrollments: {},
  campaigns: {},
}));

import { getAuthAccount } from "@/lib/auth/session";
import { ContactService } from "@outreachos/services";

describe("GET /api/contacts/[id]/analytics", () => {
  const mockAccount = createMockAccount();
  const contactId = "contact_123";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  const createRequest = (method: string = "GET") => createMockRequest("http://localhost:3000/api/contacts/contact_123/analytics", { method });

  it("returns 401 if not authenticated", async () => {
    vi.mocked(getAuthAccount).mockResolvedValueOnce(null);

    const req = createRequest();
    const res = await GET(req, { params: Promise.resolve({ id: contactId }) });

    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toBe("Unauthorized");
  });

  it("returns 404 if contact not found", async () => {
    vi.mocked(getAuthAccount).mockResolvedValueOnce(mockAccount);
    vi.mocked(ContactService.getById).mockResolvedValueOnce(null as never);

    const req = createRequest();
    const res = await GET(req, { params: Promise.resolve({ id: contactId }) });

    expect(res.status).toBe(404);
    const data = await res.json();
    expect(data.error).toBe("Contact not found");
  });

  it("returns analytics data for valid contact", async () => {
    vi.mocked(getAuthAccount).mockResolvedValueOnce(mockAccount);
    vi.mocked(ContactService.getById).mockResolvedValueOnce({
      id: contactId,
      accountId: mockAccount.id,
      firstName: "John",
      lastName: "Doe",
      email: "john@example.com",
      companyName: "Acme Inc",
      businessWebsite: "acme.com",
      city: null,
      state: null,
      hunterScore: 95,
      hunterStatus: "valid",
      hunterSources: [],
      linkedinUrl: null,
      enrichedAt: new Date(),
      unsubscribed: false,
      replied: false,
      repliedAt: null,
      customFields: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const req = createRequest();
    const res = await GET(req, { params: Promise.resolve({ id: contactId }) });

    expect(res.status).toBe(200);
    const data = await res.json();
    
    // Verify structure
    expect(data).toHaveProperty("emailsSent");
    expect(data).toHaveProperty("totalOpens");
    expect(data).toHaveProperty("uniqueOpens");
    expect(data).toHaveProperty("replies");
    expect(data).toHaveProperty("softBounces");
    expect(data).toHaveProperty("hardBounces");
    expect(data).toHaveProperty("complaints");
    expect(data).toHaveProperty("unsubscribes");
    expect(data).toHaveProperty("hourlyOpens");
    expect(data).toHaveProperty("dailyOpens");
    expect(data).toHaveProperty("messages");
    expect(data).toHaveProperty("activeJourneys");
    expect(data).toHaveProperty("replyHistory");
    
    // Verify hourly opens structure
    expect(data.hourlyOpens).toHaveLength(24);
    expect(data.hourlyOpens[0]).toHaveProperty("hour");
    expect(data.hourlyOpens[0]).toHaveProperty("count");
    
    // Verify daily opens structure
    expect(data.dailyOpens).toHaveLength(7);
    expect(data.dailyOpens[0]).toHaveProperty("day");
    expect(data.dailyOpens[0]).toHaveProperty("count");
  });

  it("verifies contact belongs to authenticated account", async () => {
    vi.mocked(getAuthAccount).mockResolvedValueOnce(mockAccount);
    vi.mocked(ContactService.getById).mockResolvedValueOnce(null as never);

    const req = createRequest();
    await GET(req, { params: Promise.resolve({ id: contactId }) });

    expect(ContactService.getById).toHaveBeenCalledWith(mockAccount.id, contactId);
  });
});
