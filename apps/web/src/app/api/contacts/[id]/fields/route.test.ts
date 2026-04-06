import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockAccount, createMockRequest } from "@/test/api-helpers";

vi.mock("@/lib/auth/session", () => ({
  getAuthAccount: vi.fn(),
}));

vi.mock("@outreachos/services", () => ({
  ContactService: {
    getById: vi.fn(),
    mergeCustomField: vi.fn(),
    deleteCustomField: vi.fn(),
  },
}));

import { getAuthAccount } from "@/lib/auth/session";
import { ContactService } from "@outreachos/services";
import { DELETE, GET, PUT } from "./route";

const params = Promise.resolve({ id: "contact_1" });

describe("GET /api/contacts/[id]/fields", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    vi.mocked(getAuthAccount).mockResolvedValueOnce(null);

    const response = await GET(createMockRequest("http://localhost/api/contacts/contact_1/fields"), { params });

    expect(response.status).toBe(401);
  });

  it("returns 404 when the contact does not exist", async () => {
    vi.mocked(getAuthAccount).mockResolvedValueOnce(createMockAccount());
    vi.mocked(ContactService.getById).mockResolvedValueOnce(null as any);

    const response = await GET(createMockRequest("http://localhost/api/contacts/contact_1/fields"), { params });

    expect(response.status).toBe(404);
  });

  it("returns custom fields", async () => {
    vi.mocked(getAuthAccount).mockResolvedValueOnce(createMockAccount());
    vi.mocked(ContactService.getById).mockResolvedValueOnce({ customFields: { role: "Founder" } } as any);

    const response = await GET(createMockRequest("http://localhost/api/contacts/contact_1/fields"), { params });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.customFields.role).toBe("Founder");
  });
});

describe("PUT /api/contacts/[id]/fields", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 400 on reserved field names", async () => {
    vi.mocked(getAuthAccount).mockResolvedValueOnce(createMockAccount());
    const request = createMockRequest("http://localhost/api/contacts/contact_1/fields", {
      method: "PUT",
      body: JSON.stringify({ fieldName: "__proto__", fieldValue: "x" }),
    });

    const response = await PUT(request, { params });

    expect(response.status).toBe(400);
  });

  it("returns 404 when merge returns null", async () => {
    vi.mocked(getAuthAccount).mockResolvedValueOnce(createMockAccount());
    vi.mocked(ContactService.mergeCustomField).mockResolvedValueOnce(null as any);
    const request = createMockRequest("http://localhost/api/contacts/contact_1/fields", {
      method: "PUT",
      body: JSON.stringify({ fieldName: "role", fieldValue: "Founder" }),
    });

    const response = await PUT(request, { params });

    expect(response.status).toBe(404);
  });

  it("merges a custom field", async () => {
    vi.mocked(getAuthAccount).mockResolvedValueOnce(createMockAccount());
    vi.mocked(ContactService.mergeCustomField).mockResolvedValueOnce({ customFields: { role: "Founder" } } as any);
    const request = createMockRequest("http://localhost/api/contacts/contact_1/fields", {
      method: "PUT",
      body: JSON.stringify({ fieldName: "role", fieldValue: "Founder" }),
    });

    const response = await PUT(request, { params });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(ContactService.mergeCustomField).toHaveBeenCalledWith("acc-123", "contact_1", "role", "Founder");
    expect(data.customFields.role).toBe("Founder");
  });
});

describe("DELETE /api/contacts/[id]/fields", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 400 on reserved field names", async () => {
    vi.mocked(getAuthAccount).mockResolvedValueOnce(createMockAccount());
    const request = createMockRequest("http://localhost/api/contacts/contact_1/fields", {
      method: "DELETE",
      body: JSON.stringify({ fieldName: "constructor" }),
    });

    const response = await DELETE(request, { params });

    expect(response.status).toBe(400);
  });

  it("returns 404 when delete returns null", async () => {
    vi.mocked(getAuthAccount).mockResolvedValueOnce(createMockAccount());
    vi.mocked(ContactService.deleteCustomField).mockResolvedValueOnce(null as any);
    const request = createMockRequest("http://localhost/api/contacts/contact_1/fields", {
      method: "DELETE",
      body: JSON.stringify({ fieldName: "role" }),
    });

    const response = await DELETE(request, { params });

    expect(response.status).toBe(404);
  });

  it("deletes a custom field", async () => {
    vi.mocked(getAuthAccount).mockResolvedValueOnce(createMockAccount());
    vi.mocked(ContactService.deleteCustomField).mockResolvedValueOnce({ customFields: {} } as any);
    const request = createMockRequest("http://localhost/api/contacts/contact_1/fields", {
      method: "DELETE",
      body: JSON.stringify({ fieldName: "role" }),
    });

    const response = await DELETE(request, { params });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(ContactService.deleteCustomField).toHaveBeenCalledWith("acc-123", "contact_1", "role");
    expect(data.customFields).toEqual({});
  });
});
