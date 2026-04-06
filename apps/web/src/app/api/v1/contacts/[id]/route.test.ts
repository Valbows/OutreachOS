import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockRequest } from "@/test/api-helpers";

const { mockGetById, mockUpdate, mockDelete } = vi.hoisted(() => ({
  mockGetById: vi.fn(),
  mockUpdate: vi.fn(),
  mockDelete: vi.fn(),
}));

vi.mock("@/lib/api/auth", () => ({
  withApiAuth: (handler: any) => async (req: Request, ctx?: { params?: Promise<Record<string, string>> }) =>
    handler(req, { accountId: "acc-123", apiKeyId: "key-1", scopes: ["read", "write", "admin"] }, ctx?.params ? await ctx.params : undefined),
  withRateLimit: (handler: any) => handler,
}));

vi.mock("@outreachos/services", () => ({
  ContactService: {
    getById: mockGetById,
    update: mockUpdate,
    delete: mockDelete,
  },
}));

import { ContactService } from "@outreachos/services";
import { DELETE, GET, PATCH } from "./route";

describe("GET /api/v1/contacts/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 400 when id is missing", async () => {
    const response = await GET(createMockRequest("http://localhost/api/v1/contacts"), { params: Promise.resolve({}) } as any);
    expect(response.status).toBe(400);
  });

  it("returns 404 when the contact is missing", async () => {
    mockGetById.mockResolvedValueOnce(null);

    const response = await GET(createMockRequest("http://localhost/api/v1/contacts/c1"), { params: Promise.resolve({ id: "c1" }) });

    expect(response.status).toBe(404);
  });

  it("returns the contact", async () => {
    mockGetById.mockResolvedValueOnce({ id: "c1", firstName: "Ada" });

    const response = await GET(createMockRequest("http://localhost/api/v1/contacts/c1"), { params: Promise.resolve({ id: "c1" }) });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(ContactService.getById).toHaveBeenCalledWith("acc-123", "c1");
    expect(data.contact.firstName).toBe("Ada");
  });
});

describe("PATCH /api/v1/contacts/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 400 on invalid json", async () => {
    const request = createMockRequest("http://localhost/api/v1/contacts/c1", { method: "PATCH" });
    vi.mocked(request.json).mockRejectedValueOnce(new Error("bad json"));

    const response = await PATCH(request, { params: Promise.resolve({ id: "c1" }) });

    expect(response.status).toBe(400);
  });

  it("returns 400 on invalid input", async () => {
    const response = await PATCH(
      createMockRequest("http://localhost/api/v1/contacts/c1", {
        method: "PATCH",
        body: JSON.stringify({ email: "not-an-email" }),
      }),
      { params: Promise.resolve({ id: "c1" }) },
    );

    expect(response.status).toBe(400);
  });

  it("returns 404 when update misses", async () => {
    mockUpdate.mockResolvedValueOnce(null);

    const response = await PATCH(
      createMockRequest("http://localhost/api/v1/contacts/c1", {
        method: "PATCH",
        body: JSON.stringify({ firstName: "Ada" }),
      }),
      { params: Promise.resolve({ id: "c1" }) },
    );

    expect(response.status).toBe(404);
  });

  it("updates the contact", async () => {
    mockUpdate.mockResolvedValueOnce({ id: "c1", firstName: "Ada" });

    const response = await PATCH(
      createMockRequest("http://localhost/api/v1/contacts/c1", {
        method: "PATCH",
        body: JSON.stringify({ firstName: "Ada", companyName: "Acme" }),
      }),
      { params: Promise.resolve({ id: "c1" }) },
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(ContactService.update).toHaveBeenCalledWith("acc-123", "c1", { firstName: "Ada", companyName: "Acme" });
    expect(data.contact.firstName).toBe("Ada");
  });
});

describe("DELETE /api/v1/contacts/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 404 when the contact does not exist", async () => {
    mockGetById.mockResolvedValueOnce(null);

    const response = await DELETE(createMockRequest("http://localhost/api/v1/contacts/c1", { method: "DELETE" }), {
      params: Promise.resolve({ id: "c1" }),
    });

    expect(response.status).toBe(404);
  });

  it("deletes the contact", async () => {
    mockGetById.mockResolvedValueOnce({ id: "c1" });
    mockDelete.mockResolvedValueOnce(undefined);

    const response = await DELETE(createMockRequest("http://localhost/api/v1/contacts/c1", { method: "DELETE" }), {
      params: Promise.resolve({ id: "c1" }),
    });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(ContactService.delete).toHaveBeenCalledWith("acc-123", ["c1"]);
    expect(data.success).toBe(true);
  });
});
