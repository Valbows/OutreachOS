import { describe, expect, it, vi, beforeEach } from "vitest";
import { GET, PATCH } from "./route";
import { createMockRequest, createMockAccount } from "@/test/api-helpers";

vi.mock("@/lib/auth/session", () => ({
  getAuthAccount: vi.fn(),
}));

vi.mock("@outreachos/services", () => ({
  ContactService: {
    getById: vi.fn(),
    update: vi.fn(),
  },
}));

import { getAuthAccount } from "@/lib/auth/session";
import { ContactService } from "@outreachos/services";

function createParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

describe("GET /api/contacts/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    vi.mocked(getAuthAccount).mockResolvedValueOnce(null);
    const request = createMockRequest("http://localhost/api/contacts/c1");
    const response = await GET(request, createParams("c1"));
    expect(response.status).toBe(401);
  });

  it("returns 404 when contact not found", async () => {
    vi.mocked(getAuthAccount).mockResolvedValueOnce(createMockAccount());
    vi.mocked(ContactService.getById).mockResolvedValueOnce(null as any);

    const request = createMockRequest("http://localhost/api/contacts/c1");
    const response = await GET(request, createParams("c1"));

    expect(response.status).toBe(404);
  });

  it("returns the contact on success", async () => {
    vi.mocked(getAuthAccount).mockResolvedValueOnce(createMockAccount());
    vi.mocked(ContactService.getById).mockResolvedValueOnce({
      id: "c1",
      firstName: "John",
      lastName: "Doe",
    } as any);

    const request = createMockRequest("http://localhost/api/contacts/c1");
    const response = await GET(request, createParams("c1"));

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.id).toBe("c1");
    expect(ContactService.getById).toHaveBeenCalledWith("acc-123", "c1");
  });

  it("returns 500 on service error", async () => {
    vi.mocked(getAuthAccount).mockResolvedValueOnce(createMockAccount());
    vi.mocked(ContactService.getById).mockRejectedValueOnce(new Error("DB error"));

    const request = createMockRequest("http://localhost/api/contacts/c1");
    const response = await GET(request, createParams("c1"));

    expect(response.status).toBe(500);
  });
});

describe("PATCH /api/contacts/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    vi.mocked(getAuthAccount).mockResolvedValueOnce(null);
    const request = createMockRequest("http://localhost/api/contacts/c1", {
      method: "PATCH",
      body: JSON.stringify({ firstName: "Jane" }),
    });
    const response = await PATCH(request, createParams("c1"));
    expect(response.status).toBe(401);
  });

  it("returns 400 on invalid JSON body", async () => {
    vi.mocked(getAuthAccount).mockResolvedValueOnce(createMockAccount());
    const request = createMockRequest("http://localhost/api/contacts/c1", {
      method: "PATCH",
    });
    vi.mocked(request.json as any).mockRejectedValueOnce(new Error("Bad JSON"));
    const response = await PATCH(request, createParams("c1"));
    expect(response.status).toBe(400);
  });

  it("returns 400 on invalid schema (empty firstName)", async () => {
    vi.mocked(getAuthAccount).mockResolvedValueOnce(createMockAccount());
    const request = createMockRequest("http://localhost/api/contacts/c1", {
      method: "PATCH",
      body: JSON.stringify({ firstName: "" }),
    });
    const response = await PATCH(request, createParams("c1"));
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toBe("Invalid request body");
  });

  it("returns 404 when contact not found", async () => {
    vi.mocked(getAuthAccount).mockResolvedValueOnce(createMockAccount());
    vi.mocked(ContactService.update).mockResolvedValueOnce(null as any);

    const request = createMockRequest("http://localhost/api/contacts/c1", {
      method: "PATCH",
      body: JSON.stringify({ firstName: "Jane" }),
    });
    const response = await PATCH(request, createParams("c1"));
    expect(response.status).toBe(404);
  });

  it("updates and returns the contact on success", async () => {
    vi.mocked(getAuthAccount).mockResolvedValueOnce(createMockAccount());
    vi.mocked(ContactService.update).mockResolvedValueOnce({
      id: "c1",
      firstName: "Jane",
      lastName: "Doe",
    } as any);

    const request = createMockRequest("http://localhost/api/contacts/c1", {
      method: "PATCH",
      body: JSON.stringify({ firstName: "Jane" }),
    });
    const response = await PATCH(request, createParams("c1"));

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.firstName).toBe("Jane");
    expect(ContactService.update).toHaveBeenCalledWith(
      "acc-123",
      "c1",
      expect.objectContaining({ firstName: "Jane" }),
    );
  });

  it("returns 500 on service error", async () => {
    vi.mocked(getAuthAccount).mockResolvedValueOnce(createMockAccount());
    vi.mocked(ContactService.update).mockRejectedValueOnce(new Error("DB error"));

    const request = createMockRequest("http://localhost/api/contacts/c1", {
      method: "PATCH",
      body: JSON.stringify({ firstName: "Jane" }),
    });
    const response = await PATCH(request, createParams("c1"));
    expect(response.status).toBe(500);
  });
});
