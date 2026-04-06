import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockAccount, createMockRequest } from "@/test/api-helpers";

vi.mock("@/lib/auth/session", () => ({
  getAuthAccount: vi.fn(),
}));

vi.mock("@outreachos/services", () => ({
  CampaignService: {
    getById: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

import { getAuthAccount } from "@/lib/auth/session";
import { CampaignService } from "@outreachos/services";
import { DELETE, GET, PATCH } from "./route";

const params = Promise.resolve({ id: "cmp_1" });

describe("GET /api/campaigns/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    vi.mocked(getAuthAccount).mockResolvedValueOnce(null);

    const response = await GET(createMockRequest("http://localhost/api/campaigns/cmp_1"), { params });

    expect(response.status).toBe(401);
  });

  it("returns 404 when the campaign does not exist", async () => {
    vi.mocked(getAuthAccount).mockResolvedValueOnce(createMockAccount());
    vi.mocked(CampaignService.getById).mockResolvedValueOnce(null as any);

    const response = await GET(createMockRequest("http://localhost/api/campaigns/cmp_1"), { params });

    expect(response.status).toBe(404);
  });

  it("returns the campaign", async () => {
    vi.mocked(getAuthAccount).mockResolvedValueOnce(createMockAccount());
    vi.mocked(CampaignService.getById).mockResolvedValueOnce({ id: "cmp_1", name: "Launch" } as any);

    const response = await GET(createMockRequest("http://localhost/api/campaigns/cmp_1"), { params });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(CampaignService.getById).toHaveBeenCalledWith("acc-123", "cmp_1");
    expect(data.data.name).toBe("Launch");
  });
});

describe("PATCH /api/campaigns/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    vi.mocked(getAuthAccount).mockResolvedValueOnce(null);

    const request = createMockRequest("http://localhost/api/campaigns/cmp_1", {
      method: "PATCH",
      body: JSON.stringify({ name: "Updated" }),
    });

    const response = await PATCH(request, { params });

    expect(response.status).toBe(401);
  });

  it("returns 400 on invalid input", async () => {
    vi.mocked(getAuthAccount).mockResolvedValueOnce(createMockAccount());
    const request = createMockRequest("http://localhost/api/campaigns/cmp_1", {
      method: "PATCH",
      body: JSON.stringify({ status: "not-valid" }),
    });

    const response = await PATCH(request, { params });

    expect(response.status).toBe(400);
  });

  it("returns 404 when update returns null", async () => {
    vi.mocked(getAuthAccount).mockResolvedValueOnce(createMockAccount());
    vi.mocked(CampaignService.update).mockResolvedValueOnce(null as any);
    const request = createMockRequest("http://localhost/api/campaigns/cmp_1", {
      method: "PATCH",
      body: JSON.stringify({ name: "Updated" }),
    });

    const response = await PATCH(request, { params });

    expect(response.status).toBe(404);
  });

  it("updates the campaign and converts scheduledAt to Date", async () => {
    vi.mocked(getAuthAccount).mockResolvedValueOnce(createMockAccount());
    vi.mocked(CampaignService.update).mockResolvedValueOnce({ id: "cmp_1", name: "Updated" } as any);
    const request = createMockRequest("http://localhost/api/campaigns/cmp_1", {
      method: "PATCH",
      body: JSON.stringify({
        name: "Updated",
        status: "active",
        scheduledAt: "2026-01-01T12:00:00.000Z",
      }),
    });

    const response = await PATCH(request, { params });

    expect(response.status).toBe(200);
    expect(CampaignService.update).toHaveBeenCalledWith(
      "acc-123",
      "cmp_1",
      expect.objectContaining({
        name: "Updated",
        status: "active",
        scheduledAt: new Date("2026-01-01T12:00:00.000Z"),
      }),
    );
  });
});

describe("DELETE /api/campaigns/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    vi.mocked(getAuthAccount).mockResolvedValueOnce(null);

    const response = await DELETE(createMockRequest("http://localhost/api/campaigns/cmp_1", { method: "DELETE" }), { params });

    expect(response.status).toBe(401);
  });

  it("deletes the campaign", async () => {
    vi.mocked(getAuthAccount).mockResolvedValueOnce(createMockAccount());
    vi.mocked(CampaignService.delete).mockResolvedValueOnce(undefined as any);

    const response = await DELETE(createMockRequest("http://localhost/api/campaigns/cmp_1", { method: "DELETE" }), { params });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(CampaignService.delete).toHaveBeenCalledWith("acc-123", "cmp_1");
    expect(data.success).toBe(true);
  });
});
