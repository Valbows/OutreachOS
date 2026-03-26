import { describe, expect, it, vi, beforeEach } from "vitest";
import { GET, POST, DELETE } from "./route";
import { createMockRequest, createMockAccount } from "@/test/api-helpers";

vi.mock("@/lib/auth/session", () => ({
  getAuthAccount: vi.fn(),
}));

vi.mock("@outreachos/services", () => ({
  ContactService: {
    list: vi.fn(),
    create: vi.fn(),
    delete: vi.fn(),
  },
}));

import { getAuthAccount } from "@/lib/auth/session";
import { ContactService } from "@outreachos/services";

describe("GET /api/contacts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    vi.mocked(getAuthAccount).mockResolvedValueOnce(null);
    const request = createMockRequest("http://localhost/api/contacts");
    const response = await GET(request);
    expect(response.status).toBe(401);
  });

  it("returns contacts with default pagination", async () => {
    vi.mocked(getAuthAccount).mockResolvedValueOnce(createMockAccount());
    vi.mocked(ContactService.list).mockResolvedValueOnce({
      data: [{ id: "c1", firstName: "John", lastName: "Doe" }],
      total: 1,
    } as any);

    const request = createMockRequest("http://localhost/api/contacts");
    const response = await GET(request);

    expect(response.status).toBe(200);
    expect(ContactService.list).toHaveBeenCalledWith(
      expect.objectContaining({
        accountId: "acc-123",
        limit: 50,
        offset: 0,
        sortBy: "createdAt",
        sortDir: "desc",
      }),
    );
  });

  it("passes search and group_id params", async () => {
    vi.mocked(getAuthAccount).mockResolvedValueOnce(createMockAccount());
    vi.mocked(ContactService.list).mockResolvedValueOnce({ data: [], total: 0 });

    const request = createMockRequest(
      "http://localhost/api/contacts?search=john&group_id=grp-1&sort_by=name&sort_dir=asc&limit=10&offset=20",
    );
    const response = await GET(request);

    expect(response.status).toBe(200);
    expect(ContactService.list).toHaveBeenCalledWith(
      expect.objectContaining({
        search: "john",
        groupId: "grp-1",
        sortBy: "name",
        sortDir: "asc",
        limit: 10,
        offset: 20,
      }),
    );
  });

  it("clamps limit to valid range", async () => {
    vi.mocked(getAuthAccount).mockResolvedValueOnce(createMockAccount());
    vi.mocked(ContactService.list).mockResolvedValueOnce({ data: [], total: 0 });

    const request = createMockRequest("http://localhost/api/contacts?limit=999");
    await GET(request);

    expect(ContactService.list).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 200 }),
    );
  });

  it("rejects invalid sortBy with default", async () => {
    vi.mocked(getAuthAccount).mockResolvedValueOnce(createMockAccount());
    vi.mocked(ContactService.list).mockResolvedValueOnce({ data: [], total: 0 });

    const request = createMockRequest("http://localhost/api/contacts?sort_by=invalid");
    await GET(request);

    expect(ContactService.list).toHaveBeenCalledWith(
      expect.objectContaining({ sortBy: "createdAt" }),
    );
  });

  it("returns 500 on service error", async () => {
    vi.mocked(getAuthAccount).mockResolvedValueOnce(createMockAccount());
    vi.mocked(ContactService.list).mockRejectedValueOnce(new Error("DB error"));

    const request = createMockRequest("http://localhost/api/contacts");
    const response = await GET(request);

    expect(response.status).toBe(500);
  });
});

describe("POST /api/contacts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    vi.mocked(getAuthAccount).mockResolvedValueOnce(null);
    const request = createMockRequest("http://localhost/api/contacts", {
      method: "POST",
      body: JSON.stringify({ firstName: "Jane", lastName: "Doe" }),
    });
    const response = await POST(request);
    expect(response.status).toBe(401);
  });

  it("returns 400 when first/last name missing", async () => {
    vi.mocked(getAuthAccount).mockResolvedValueOnce(createMockAccount());
    const request = createMockRequest("http://localhost/api/contacts", {
      method: "POST",
      body: JSON.stringify({ firstName: "", lastName: "" }),
    });
    const response = await POST(request);
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toMatch(/first name/i);
  });

  it("creates a contact successfully", async () => {
    vi.mocked(getAuthAccount).mockResolvedValueOnce(createMockAccount());
    vi.mocked(ContactService.create).mockResolvedValueOnce({
      id: "c-new",
      firstName: "Jane",
      lastName: "Doe",
    } as any);

    const request = createMockRequest("http://localhost/api/contacts", {
      method: "POST",
      body: JSON.stringify({ firstName: "Jane", lastName: "Doe" }),
    });
    const response = await POST(request);

    expect(response.status).toBe(201);
    expect(ContactService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        accountId: "acc-123",
        firstName: "Jane",
        lastName: "Doe",
      }),
    );
  });

  it("validates customFields is an object", async () => {
    vi.mocked(getAuthAccount).mockResolvedValueOnce(createMockAccount());
    const request = createMockRequest("http://localhost/api/contacts", {
      method: "POST",
      body: JSON.stringify({
        firstName: "Jane",
        lastName: "Doe",
        customFields: "not-an-object",
      }),
    });
    const response = await POST(request);
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toMatch(/customFields/i);
  });

  it("rejects customFields with more than 20 keys", async () => {
    vi.mocked(getAuthAccount).mockResolvedValueOnce(createMockAccount());
    const tooManyKeys: Record<string, string> = {};
    for (let i = 0; i < 21; i++) tooManyKeys[`key${i}`] = "val";

    const request = createMockRequest("http://localhost/api/contacts", {
      method: "POST",
      body: JSON.stringify({
        firstName: "Jane",
        lastName: "Doe",
        customFields: tooManyKeys,
      }),
    });
    const response = await POST(request);
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toMatch(/20 keys/);
  });

  it("returns 400 on invalid JSON body", async () => {
    vi.mocked(getAuthAccount).mockResolvedValueOnce(createMockAccount());
    const request = createMockRequest("http://localhost/api/contacts", {
      method: "POST",
    });
    vi.mocked(request.json as any).mockRejectedValueOnce(new Error("Bad JSON"));
    const response = await POST(request);
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toBe("Invalid JSON body");
  });
});

describe("DELETE /api/contacts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    vi.mocked(getAuthAccount).mockResolvedValueOnce(null);
    const request = createMockRequest("http://localhost/api/contacts", {
      method: "DELETE",
      body: JSON.stringify({ ids: ["c1"] }),
    });
    const response = await DELETE(request);
    expect(response.status).toBe(401);
  });

  it("deletes contacts successfully", async () => {
    vi.mocked(getAuthAccount).mockResolvedValueOnce(createMockAccount());
    vi.mocked(ContactService.delete).mockResolvedValueOnce(2);

    const request = createMockRequest("http://localhost/api/contacts", {
      method: "DELETE",
      body: JSON.stringify({ ids: ["c1", "c2"] }),
    });
    const response = await DELETE(request);

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.deleted).toBe(2);
  });

  it("returns 400 when ids is not an array", async () => {
    vi.mocked(getAuthAccount).mockResolvedValueOnce(createMockAccount());
    const request = createMockRequest("http://localhost/api/contacts", {
      method: "DELETE",
      body: JSON.stringify({ ids: "not-array" }),
    });
    const response = await DELETE(request);
    expect(response.status).toBe(400);
  });

  it("returns 400 when ids array is empty", async () => {
    vi.mocked(getAuthAccount).mockResolvedValueOnce(createMockAccount());
    const request = createMockRequest("http://localhost/api/contacts", {
      method: "DELETE",
      body: JSON.stringify({ ids: [] }),
    });
    const response = await DELETE(request);
    expect(response.status).toBe(400);
  });

  it("returns 413 when batch exceeds max size", async () => {
    vi.mocked(getAuthAccount).mockResolvedValueOnce(createMockAccount());
    const ids = Array.from({ length: 101 }, (_, i) => `c${i}`);
    const request = createMockRequest("http://localhost/api/contacts", {
      method: "DELETE",
      body: JSON.stringify({ ids }),
    });
    const response = await DELETE(request);
    expect(response.status).toBe(413);
  });

  it("filters out non-string ids", async () => {
    vi.mocked(getAuthAccount).mockResolvedValueOnce(createMockAccount());
    vi.mocked(ContactService.delete).mockResolvedValueOnce(1);

    const request = createMockRequest("http://localhost/api/contacts", {
      method: "DELETE",
      body: JSON.stringify({ ids: ["c1", 123, "", null] }),
    });
    const response = await DELETE(request);

    expect(response.status).toBe(200);
    expect(ContactService.delete).toHaveBeenCalledWith("acc-123", ["c1"]);
  });
});
