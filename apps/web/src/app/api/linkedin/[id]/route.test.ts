import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockAccount, createMockRequest } from "@/test/api-helpers";

vi.mock("@/lib/auth/session", () => ({
  getAuthAccount: vi.fn(),
}));

vi.mock("@outreachos/services", () => ({
  LinkedInService: {
    getById: vi.fn(),
    updateStatus: vi.fn(),
    regenerateCopy: vi.fn(),
    delete: vi.fn(),
  },
}));

import { getAuthAccount } from "@/lib/auth/session";
import { LinkedInService } from "@outreachos/services";
import { DELETE, GET, PATCH } from "./route";

const params = Promise.resolve({ id: "li_1" });

describe("GET /api/linkedin/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    vi.mocked(getAuthAccount).mockResolvedValueOnce(null);

    const response = await GET(createMockRequest("http://localhost/api/linkedin/li_1"), { params });

    expect(response.status).toBe(401);
  });

  it("returns 404 when the entry is missing", async () => {
    vi.mocked(getAuthAccount).mockResolvedValueOnce(createMockAccount());
    vi.mocked(LinkedInService.getById).mockResolvedValueOnce(null as any);

    const response = await GET(createMockRequest("http://localhost/api/linkedin/li_1"), { params });

    expect(response.status).toBe(404);
  });

  it("returns the linkedin entry", async () => {
    vi.mocked(getAuthAccount).mockResolvedValueOnce(createMockAccount());
    vi.mocked(LinkedInService.getById).mockResolvedValueOnce({ id: "li_1", status: "draft" } as any);

    const response = await GET(createMockRequest("http://localhost/api/linkedin/li_1"), { params });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.id).toBe("li_1");
  });
});

describe("PATCH /api/linkedin/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 400 on invalid json", async () => {
    vi.mocked(getAuthAccount).mockResolvedValueOnce(createMockAccount());
    const request = createMockRequest("http://localhost/api/linkedin/li_1", { method: "PATCH" });
    vi.mocked(request.json).mockRejectedValueOnce(new Error("bad json"));

    const response = await PATCH(request, { params });

    expect(response.status).toBe(400);
  });

  it("updates status", async () => {
    vi.mocked(getAuthAccount).mockResolvedValueOnce(createMockAccount());
    vi.mocked(LinkedInService.updateStatus).mockResolvedValueOnce({ id: "li_1", status: "approved" } as any);

    const response = await PATCH(
      createMockRequest("http://localhost/api/linkedin/li_1", {
        method: "PATCH",
        body: JSON.stringify({ status: "approved" }),
      }),
      { params },
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(LinkedInService.updateStatus).toHaveBeenCalledWith("acc-123", "li_1", "approved");
    expect(data.status).toBe("approved");
  });

  it("regenerates copy", async () => {
    vi.mocked(getAuthAccount).mockResolvedValueOnce(createMockAccount());
    vi.mocked(LinkedInService.regenerateCopy).mockResolvedValueOnce({ id: "li_1", copy: "New copy" } as any);

    const response = await PATCH(
      createMockRequest("http://localhost/api/linkedin/li_1", {
        method: "PATCH",
        body: JSON.stringify({ regenerate: true }),
      }),
      { params },
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(LinkedInService.regenerateCopy).toHaveBeenCalledWith("acc-123", "li_1");
    expect(data.copy).toBe("New copy");
  });

  it("returns 404 for not-found service errors", async () => {
    vi.mocked(getAuthAccount).mockResolvedValueOnce(createMockAccount());
    vi.mocked(LinkedInService.updateStatus).mockRejectedValueOnce(new Error("PLAYBOOK_NOT_FOUND: li_1"));

    const response = await PATCH(
      createMockRequest("http://localhost/api/linkedin/li_1", {
        method: "PATCH",
        body: JSON.stringify({ status: "approved" }),
      }),
      { params },
    );

    expect(response.status).toBe(404);
  });
});

describe("DELETE /api/linkedin/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 404 for not-found service errors", async () => {
    vi.mocked(getAuthAccount).mockResolvedValueOnce(createMockAccount());
    vi.mocked(LinkedInService.delete).mockRejectedValueOnce(new Error("PLAYBOOK_NOT_FOUND: li_1"));

    const response = await DELETE(createMockRequest("http://localhost/api/linkedin/li_1", { method: "DELETE" }), { params });

    expect(response.status).toBe(404);
  });

  it("deletes the entry", async () => {
    vi.mocked(getAuthAccount).mockResolvedValueOnce(createMockAccount());
    vi.mocked(LinkedInService.delete).mockResolvedValueOnce(undefined as any);

    const response = await DELETE(createMockRequest("http://localhost/api/linkedin/li_1", { method: "DELETE" }), { params });

    expect(response.status).toBe(204);
  });
});
