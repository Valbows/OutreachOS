import { describe, expect, it, vi, beforeEach } from "vitest";
import { GET, POST } from "./route";
import { createMockRequest, createMockAccount } from "@/test/api-helpers";

vi.mock("@/lib/auth/session", () => ({
  getAuthAccount: vi.fn(),
}));

vi.mock("@outreachos/services", () => ({
  ContactService: {
    listGroups: vi.fn(),
    createGroup: vi.fn(),
  },
}));

import { getAuthAccount } from "@/lib/auth/session";
import { ContactService } from "@outreachos/services";

describe("GET /api/contacts/groups", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    vi.mocked(getAuthAccount).mockResolvedValueOnce(null);
    const response = await GET();
    expect(response.status).toBe(401);
  });

  it("returns groups on success", async () => {
    vi.mocked(getAuthAccount).mockResolvedValueOnce(createMockAccount());
    vi.mocked(ContactService.listGroups).mockResolvedValueOnce([
      { id: "g1", name: "VIP", description: null, accountId: "acc-123", createdAt: new Date() },
    ] as any);

    const response = await GET();

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data).toHaveLength(1);
    expect(data[0].name).toBe("VIP");
    expect(ContactService.listGroups).toHaveBeenCalledWith("acc-123");
  });

  it("returns 500 on service error", async () => {
    vi.mocked(getAuthAccount).mockResolvedValueOnce(createMockAccount());
    vi.mocked(ContactService.listGroups).mockRejectedValueOnce(new Error("DB error"));

    const response = await GET();
    expect(response.status).toBe(500);
  });
});

describe("POST /api/contacts/groups", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    vi.mocked(getAuthAccount).mockResolvedValueOnce(null);
    const request = createMockRequest("http://localhost/api/contacts/groups", {
      method: "POST",
      body: JSON.stringify({ name: "VIP" }),
    });
    const response = await POST(request);
    expect(response.status).toBe(401);
  });

  it("returns 400 when name is missing", async () => {
    vi.mocked(getAuthAccount).mockResolvedValueOnce(createMockAccount());
    const request = createMockRequest("http://localhost/api/contacts/groups", {
      method: "POST",
      body: JSON.stringify({ name: "" }),
    });
    const response = await POST(request);
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toMatch(/name/i);
  });

  it("creates a group successfully", async () => {
    vi.mocked(getAuthAccount).mockResolvedValueOnce(createMockAccount());
    vi.mocked(ContactService.createGroup).mockResolvedValueOnce({
      id: "g-new",
      name: "VIP",
      description: "Top clients",
      accountId: "acc-123",
      createdAt: new Date(),
    } as any);

    const request = createMockRequest("http://localhost/api/contacts/groups", {
      method: "POST",
      body: JSON.stringify({ name: "VIP", description: "Top clients" }),
    });
    const response = await POST(request);

    expect(response.status).toBe(201);
    expect(ContactService.createGroup).toHaveBeenCalledWith(
      "acc-123",
      "VIP",
      "Top clients",
    );
  });

  it("returns 400 on invalid JSON body", async () => {
    vi.mocked(getAuthAccount).mockResolvedValueOnce(createMockAccount());
    const request = createMockRequest("http://localhost/api/contacts/groups", {
      method: "POST",
    });
    vi.mocked(request.json as any).mockRejectedValueOnce(new Error("Bad JSON"));
    const response = await POST(request);
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toBe("Invalid JSON body");
  });

  it("returns 500 on service error", async () => {
    vi.mocked(getAuthAccount).mockResolvedValueOnce(createMockAccount());
    vi.mocked(ContactService.createGroup).mockRejectedValueOnce(new Error("DB error"));

    const request = createMockRequest("http://localhost/api/contacts/groups", {
      method: "POST",
      body: JSON.stringify({ name: "VIP" }),
    });
    const response = await POST(request);
    expect(response.status).toBe(500);
  });
});
