import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockRequest } from "@/test/api-helpers";

const { mockList, mockGenerateCopy } = vi.hoisted(() => ({
  mockList: vi.fn(),
  mockGenerateCopy: vi.fn(),
}));

vi.mock("@/lib/api/auth", () => ({
  withApiAuth: (handler: any) => async (req: Request) =>
    handler(req, { accountId: "acc-123", apiKeyId: "key-1", scopes: ["read", "write", "admin"] }),
  withRateLimit: (handler: any) => handler,
}));

vi.mock("@outreachos/services", () => ({
  LinkedInService: {
    list: mockList,
    generateCopy: mockGenerateCopy,
  },
}));

import { LinkedInService } from "@outreachos/services";
import { GET, POST } from "./route";

describe("GET /api/v1/linkedin", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("lists playbook entries with default pagination", async () => {
    mockList.mockResolvedValueOnce({ entries: [{ id: "pb1" }], total: 1 });

    const response = await GET(createMockRequest("http://localhost/api/v1/linkedin"));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(LinkedInService.list).toHaveBeenCalledWith({
      accountId: "acc-123",
      limit: 50,
      offset: 0,
      status: undefined,
    });
    expect(data.playbooks).toHaveLength(1);
  });

  it("respects pagination and status params", async () => {
    mockList.mockResolvedValueOnce({ entries: [], total: 0 });

    await GET(createMockRequest("http://localhost/api/v1/linkedin?limit=10&offset=5&status=approved"));

    expect(LinkedInService.list).toHaveBeenCalledWith({
      accountId: "acc-123",
      limit: 10,
      offset: 5,
      status: "approved",
    });
  });

  it("clamps limit to max 100", async () => {
    mockList.mockResolvedValueOnce({ entries: [], total: 0 });

    await GET(createMockRequest("http://localhost/api/v1/linkedin?limit=500"));

    expect(LinkedInService.list).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 100 }),
    );
  });
});

describe("POST /api/v1/linkedin", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 400 on invalid json", async () => {
    const request = createMockRequest("http://localhost/api/v1/linkedin", { method: "POST" });
    vi.mocked(request.json).mockRejectedValueOnce(new Error("bad json"));

    const response = await POST(request);

    expect(response.status).toBe(400);
  });

  it("returns 400 when neither contactId nor groupId provided", async () => {
    const response = await POST(
      createMockRequest("http://localhost/api/v1/linkedin", {
        method: "POST",
        body: JSON.stringify({ prompt: "Hi" }),
      }),
    );

    expect(response.status).toBe(400);
  });

  it("generates copy for contactId", async () => {
    mockGenerateCopy.mockResolvedValueOnce({ id: "pb1", copy: "Hello!" });

    const response = await POST(
      createMockRequest("http://localhost/api/v1/linkedin", {
        method: "POST",
        body: JSON.stringify({ contactId: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11" }),
      }),
    );
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(LinkedInService.generateCopy).toHaveBeenCalledWith({
      accountId: "acc-123",
      contactId: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
      groupId: undefined,
      prompt: "Write a professional LinkedIn connection request",
    });
    expect(data.playbook.copy).toBe("Hello!");
  });

  it("generates copy for groupId with custom prompt", async () => {
    mockGenerateCopy.mockResolvedValueOnce({ id: "pb1", copy: "Custom!" });

    const response = await POST(
      createMockRequest("http://localhost/api/v1/linkedin", {
        method: "POST",
        body: JSON.stringify({ groupId: "b1ffbc99-9c0b-4ef8-bb6d-6bb9bd380a22", prompt: "Be casual" }),
      }),
    );
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(LinkedInService.generateCopy).toHaveBeenCalledWith({
      accountId: "acc-123",
      contactId: undefined,
      groupId: "b1ffbc99-9c0b-4ef8-bb6d-6bb9bd380a22",
      prompt: "Be casual",
    });
    expect(data.playbook.copy).toBe("Custom!");
  });
});
