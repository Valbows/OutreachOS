import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockRequest } from "@/test/api-helpers";

const { mockList, mockCreate } = vi.hoisted(() => ({
  mockList: vi.fn(),
  mockCreate: vi.fn(),
}));

vi.mock("@/lib/api/auth", () => ({
  withApiAuth: (handler: any) => async (req: Request) =>
    handler(req, { accountId: "acc-123", apiKeyId: "key-1", scopes: ["read", "write", "admin"] }),
  withRateLimit: (handler: any) => handler,
}));

vi.mock("@outreachos/services", () => ({
  ContactService: {
    list: mockList,
    create: mockCreate,
  },
}));

import { ContactService } from "@outreachos/services";
import { GET, POST } from "./route";

describe("GET /api/v1/contacts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("lists contacts with default pagination", async () => {
    mockList.mockResolvedValueOnce({ contacts: [{ id: "c1" }], total: 1 });

    const response = await GET(createMockRequest("http://localhost/api/v1/contacts"));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(ContactService.list).toHaveBeenCalledWith({
      accountId: "acc-123",
      limit: 50,
      offset: 0,
      search: undefined,
    });
    expect(data.contacts).toHaveLength(1);
  });

  it("respects limit and offset params", async () => {
    mockList.mockResolvedValueOnce({ contacts: [], total: 0 });

    await GET(createMockRequest("http://localhost/api/v1/contacts?limit=10&offset=20"));

    expect(ContactService.list).toHaveBeenCalledWith({
      accountId: "acc-123",
      limit: 10,
      offset: 20,
      search: undefined,
    });
  });

  it("clamps limit to max 100", async () => {
    mockList.mockResolvedValueOnce({ contacts: [], total: 0 });

    await GET(createMockRequest("http://localhost/api/v1/contacts?limit=200"));

    expect(ContactService.list).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 100 }),
    );
  });

  it("passes search param", async () => {
    mockList.mockResolvedValueOnce({ contacts: [], total: 0 });

    await GET(createMockRequest("http://localhost/api/v1/contacts?search=ada"));

    expect(ContactService.list).toHaveBeenCalledWith(
      expect.objectContaining({ search: "ada" }),
    );
  });
});

describe("POST /api/v1/contacts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 400 on invalid json", async () => {
    const request = createMockRequest("http://localhost/api/v1/contacts", { method: "POST" });
    vi.mocked(request.json).mockRejectedValueOnce(new Error("bad json"));

    const response = await POST(request);

    expect(response.status).toBe(400);
  });

  it("returns 400 on validation failure", async () => {
    const response = await POST(
      createMockRequest("http://localhost/api/v1/contacts", {
        method: "POST",
        body: JSON.stringify({ firstName: "" }),
      }),
    );

    expect(response.status).toBe(400);
  });

  it("creates a contact", async () => {
    mockCreate.mockResolvedValueOnce({ id: "c1", firstName: "Ada", lastName: "Lovelace" });

    const response = await POST(
      createMockRequest("http://localhost/api/v1/contacts", {
        method: "POST",
        body: JSON.stringify({ firstName: "Ada", lastName: "Lovelace", email: "ada@example.com" }),
      }),
    );
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(ContactService.create).toHaveBeenCalledWith({
      accountId: "acc-123",
      firstName: "Ada",
      lastName: "Lovelace",
      email: "ada@example.com",
      companyName: undefined,
      linkedinUrl: undefined,
      customFields: undefined,
    });
    expect(data.contact.id).toBe("c1");
  });
});
