import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockRequest, createMockAccount } from "@/test/api-helpers";

const { mockGetAuthAccount, mockList, mockGenerateCopy } = vi.hoisted(() => {
  const mockGetAuthAccount = vi.fn();
  const mockList = vi.fn().mockResolvedValue({ entries: [], total: 0 });
  const mockGenerateCopy = vi.fn().mockResolvedValue({
    id: "pb-1",
    accountId: "acc-123",
    contactId: null,
    groupId: null,
    prompt: "test prompt",
    generatedCopy: "Generated LinkedIn message",
    status: "generated",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
  return { mockGetAuthAccount, mockList, mockGenerateCopy };
});

vi.mock("@/lib/auth/session", () => ({
  getAuthAccount: mockGetAuthAccount,
}));

vi.mock("@outreachos/services", () => ({
  LinkedInService: {
    list: mockList,
    generateCopy: mockGenerateCopy,
  },
}));

import { GET, POST } from "./route";
import { LinkedInService } from "@outreachos/services";

describe("GET /api/linkedin", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAuthAccount.mockResolvedValue(createMockAccount());
  });

  it("returns 401 when not authenticated", async () => {
    mockGetAuthAccount.mockResolvedValueOnce(null);
    const req = createMockRequest("http://localhost:3000/api/linkedin");
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it("returns playbook entries for authenticated user", async () => {
    const req = createMockRequest("http://localhost:3000/api/linkedin");
    const res = await GET(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveProperty("entries");
    expect(data).toHaveProperty("total");
  });

  it("passes status filter to service", async () => {
    const req = createMockRequest("http://localhost:3000/api/linkedin?status=generated");
    await GET(req);
    expect(LinkedInService.list).toHaveBeenCalledWith(
      expect.objectContaining({ status: "generated" }),
    );
  });

  it("clamps limit and offset params", async () => {
    const req = createMockRequest("http://localhost:3000/api/linkedin?limit=999&offset=-5");
    await GET(req);
    expect(LinkedInService.list).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 100, offset: 0 }),
    );
  });
});

describe("POST /api/linkedin", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAuthAccount.mockResolvedValue(createMockAccount());
  });

  it("returns 401 when not authenticated", async () => {
    mockGetAuthAccount.mockResolvedValueOnce(null);
    const req = createMockRequest("http://localhost:3000/api/linkedin", {
      method: "POST",
      body: JSON.stringify({ prompt: "test" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("returns 400 for missing prompt", async () => {
    const req = createMockRequest("http://localhost:3000/api/linkedin", {
      method: "POST",
      body: JSON.stringify({}),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("generates copy with valid input", async () => {
    const req = createMockRequest("http://localhost:3000/api/linkedin", {
      method: "POST",
      body: JSON.stringify({ prompt: "Write a friendly intro" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.generatedCopy).toBe("Generated LinkedIn message");
    expect(data.status).toBe("generated");
  });

  it("calls service with correct account ID", async () => {
    const req = createMockRequest("http://localhost:3000/api/linkedin", {
      method: "POST",
      body: JSON.stringify({ prompt: "test prompt" }),
    });
    await POST(req);
    expect(LinkedInService.generateCopy).toHaveBeenCalledWith(
      expect.objectContaining({ accountId: "acc-123", prompt: "test prompt" }),
    );
  });
});
