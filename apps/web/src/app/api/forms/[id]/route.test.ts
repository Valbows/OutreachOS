import { beforeEach, describe, expect, it, vi } from "vitest";
import { DELETE, GET, PATCH } from "./route";
import { createMockAccount, createMockRequest } from "@/test/api-helpers";

vi.mock("@/lib/auth/session", () => ({
  getAuthAccount: vi.fn(),
}));

vi.mock("@outreachos/services", () => ({
  FormService: {
    getById: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

import { getAuthAccount } from "@/lib/auth/session";
import { FormService } from "@outreachos/services";

const params = Promise.resolve({ id: "form_1" });

describe("GET /api/forms/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    vi.mocked(getAuthAccount).mockResolvedValueOnce(null);

    const response = await GET(createMockRequest("http://localhost/api/forms/form_1"), { params });

    expect(response.status).toBe(401);
  });

  it("returns 404 when the form does not exist", async () => {
    vi.mocked(getAuthAccount).mockResolvedValueOnce(createMockAccount());
    vi.mocked(FormService.getById).mockResolvedValueOnce(null as any);

    const response = await GET(createMockRequest("http://localhost/api/forms/form_1"), { params });

    expect(response.status).toBe(404);
  });

  it("returns the form when found", async () => {
    vi.mocked(getAuthAccount).mockResolvedValueOnce(createMockAccount());
    vi.mocked(FormService.getById).mockResolvedValueOnce({ id: "form_1", name: "Signup" } as any);

    const response = await GET(createMockRequest("http://localhost/api/forms/form_1"), { params });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data.name).toBe("Signup");
  });
});

describe("PATCH /api/forms/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 400 on invalid json", async () => {
    vi.mocked(getAuthAccount).mockResolvedValueOnce(createMockAccount());
    const request = createMockRequest("http://localhost/api/forms/form_1", { method: "PATCH" });
    vi.mocked(request.json).mockRejectedValueOnce(new Error("Bad JSON"));

    const response = await PATCH(request, { params });

    expect(response.status).toBe(400);
  });

  it("rejects redirect urls outside the allowlist", async () => {
    vi.mocked(getAuthAccount).mockResolvedValueOnce(createMockAccount());
    const request = createMockRequest("http://localhost/api/forms/form_1", {
      method: "PATCH",
      body: JSON.stringify({ redirectUrl: "https://evil.example.com/phish" }),
    });

    const response = await PATCH(request, { params });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("Validation failed");
  });

  it("returns 404 when updating a missing form", async () => {
    vi.mocked(getAuthAccount).mockResolvedValueOnce(createMockAccount());
    vi.mocked(FormService.update).mockResolvedValueOnce(null as any);
    const request = createMockRequest("http://localhost/api/forms/form_1", {
      method: "PATCH",
      body: JSON.stringify({ name: "Updated" }),
    });

    const response = await PATCH(request, { params });

    expect(response.status).toBe(404);
  });

  it("updates the form when payload is valid", async () => {
    vi.mocked(getAuthAccount).mockResolvedValueOnce(createMockAccount());
    vi.mocked(FormService.update).mockResolvedValueOnce({ id: "form_1", name: "Updated" } as any);
    const request = createMockRequest("http://localhost/api/forms/form_1", {
      method: "PATCH",
      body: JSON.stringify({ name: "Updated", redirectUrl: "http://localhost/thanks" }),
    });

    const response = await PATCH(request, { params });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(FormService.update).toHaveBeenCalledWith("acc-123", "form_1", expect.objectContaining({ name: "Updated" }));
    expect(data.data.id).toBe("form_1");
  });
});

describe("DELETE /api/forms/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    vi.mocked(getAuthAccount).mockResolvedValueOnce(null);

    const response = await DELETE(createMockRequest("http://localhost/api/forms/form_1", { method: "DELETE" }), { params });

    expect(response.status).toBe(401);
  });

  it("deletes the form and returns 204", async () => {
    vi.mocked(getAuthAccount).mockResolvedValueOnce(createMockAccount());
    vi.mocked(FormService.delete).mockResolvedValueOnce(undefined);

    const response = await DELETE(createMockRequest("http://localhost/api/forms/form_1", { method: "DELETE" }), { params });

    expect(FormService.delete).toHaveBeenCalledWith("acc-123", "form_1");
    expect(response.status).toBe(204);
  });
});
