import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockAccount, createMockRequest } from "@/test/api-helpers";

vi.mock("@/lib/auth/session", () => ({
  getAuthAccount: vi.fn(),
}));

vi.mock("@outreachos/services", () => ({
  TemplateService: {
    getById: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

import { getAuthAccount } from "@/lib/auth/session";
import { TemplateService } from "@outreachos/services";
import { DELETE, GET, PATCH } from "./route";

const params = Promise.resolve({ id: "tpl_1" });

describe("GET /api/templates/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    vi.mocked(getAuthAccount).mockResolvedValueOnce(null);

    const response = await GET(createMockRequest("http://localhost/api/templates/tpl_1"), { params });

    expect(response.status).toBe(401);
  });

  it("returns 404 when the template does not exist", async () => {
    vi.mocked(getAuthAccount).mockResolvedValueOnce(createMockAccount());
    vi.mocked(TemplateService.getById).mockResolvedValueOnce(null as any);

    const response = await GET(createMockRequest("http://localhost/api/templates/tpl_1"), { params });

    expect(response.status).toBe(404);
  });

  it("returns the template", async () => {
    vi.mocked(getAuthAccount).mockResolvedValueOnce(createMockAccount());
    vi.mocked(TemplateService.getById).mockResolvedValueOnce({ id: "tpl_1", name: "Welcome" } as any);

    const response = await GET(createMockRequest("http://localhost/api/templates/tpl_1"), { params });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(TemplateService.getById).toHaveBeenCalledWith("acc-123", "tpl_1");
    expect(data.data.id).toBe("tpl_1");
  });
});

describe("PATCH /api/templates/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    vi.mocked(getAuthAccount).mockResolvedValueOnce(null);

    const request = createMockRequest("http://localhost/api/templates/tpl_1", {
      method: "PATCH",
      body: JSON.stringify({ name: "Updated" }),
    });

    const response = await PATCH(request, { params });

    expect(response.status).toBe(401);
  });

  it("returns 400 on malformed json", async () => {
    vi.mocked(getAuthAccount).mockResolvedValueOnce(createMockAccount());
    const request = createMockRequest("http://localhost/api/templates/tpl_1", { method: "PATCH" });
    vi.mocked(request.json).mockRejectedValueOnce(new SyntaxError("bad json"));

    const response = await PATCH(request, { params });

    expect(response.status).toBe(400);
  });

  it("returns 400 on invalid input", async () => {
    vi.mocked(getAuthAccount).mockResolvedValueOnce(createMockAccount());
    const request = createMockRequest("http://localhost/api/templates/tpl_1", {
      method: "PATCH",
      body: JSON.stringify({ name: "" }),
    });

    const response = await PATCH(request, { params });

    expect(response.status).toBe(400);
  });

  it("returns 404 when update returns null", async () => {
    vi.mocked(getAuthAccount).mockResolvedValueOnce(createMockAccount());
    vi.mocked(TemplateService.update).mockResolvedValueOnce(null as any);
    const request = createMockRequest("http://localhost/api/templates/tpl_1", {
      method: "PATCH",
      body: JSON.stringify({ name: "Updated" }),
    });

    const response = await PATCH(request, { params });

    expect(response.status).toBe(404);
  });

  it("updates and returns the template", async () => {
    vi.mocked(getAuthAccount).mockResolvedValueOnce(createMockAccount());
    vi.mocked(TemplateService.update).mockResolvedValueOnce({ id: "tpl_1", name: "Updated" } as any);
    const request = createMockRequest("http://localhost/api/templates/tpl_1", {
      method: "PATCH",
      body: JSON.stringify({ name: "Updated", subject: "Hello" }),
    });

    const response = await PATCH(request, { params });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(TemplateService.update).toHaveBeenCalledWith("acc-123", "tpl_1", { name: "Updated", subject: "Hello" });
    expect(data.data.name).toBe("Updated");
  });
});

describe("DELETE /api/templates/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    vi.mocked(getAuthAccount).mockResolvedValueOnce(null);

    const response = await DELETE(createMockRequest("http://localhost/api/templates/tpl_1", { method: "DELETE" }), { params });

    expect(response.status).toBe(401);
  });

  it("deletes the template", async () => {
    vi.mocked(getAuthAccount).mockResolvedValueOnce(createMockAccount());
    vi.mocked(TemplateService.delete).mockResolvedValueOnce(undefined as any);

    const response = await DELETE(createMockRequest("http://localhost/api/templates/tpl_1", { method: "DELETE" }), { params });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(TemplateService.delete).toHaveBeenCalledWith("acc-123", "tpl_1");
    expect(data.success).toBe(true);
  });
});
