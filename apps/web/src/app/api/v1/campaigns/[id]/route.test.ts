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
  CampaignService: {
    getById: mockGetById,
    update: mockUpdate,
    delete: mockDelete,
  },
}));

import { CampaignService } from "@outreachos/services";
import { DELETE, GET, PATCH } from "./route";

describe("GET /api/v1/campaigns/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 400 when id is missing", async () => {
    const response = await GET(createMockRequest("http://localhost/api/v1/campaigns"), { params: Promise.resolve({}) } as any);
    expect(response.status).toBe(400);
  });

  it("returns 404 when the campaign is missing", async () => {
    mockGetById.mockResolvedValueOnce(null);

    const response = await GET(createMockRequest("http://localhost/api/v1/campaigns/c1"), { params: Promise.resolve({ id: "c1" }) });

    expect(response.status).toBe(404);
  });

  it("returns the campaign", async () => {
    mockGetById.mockResolvedValueOnce({ id: "c1", name: "Launch" });

    const response = await GET(createMockRequest("http://localhost/api/v1/campaigns/c1"), { params: Promise.resolve({ id: "c1" }) });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(CampaignService.getById).toHaveBeenCalledWith("acc-123", "c1");
    expect(data.campaign.name).toBe("Launch");
  });
});

describe("PATCH /api/v1/campaigns/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 400 on invalid json", async () => {
    const request = createMockRequest("http://localhost/api/v1/campaigns/c1", { method: "PATCH" });
    vi.mocked(request.json).mockRejectedValueOnce(new Error("bad json"));

    const response = await PATCH(request, { params: Promise.resolve({ id: "c1" }) });

    expect(response.status).toBe(400);
  });

  it("returns 400 on invalid input", async () => {
    const response = await PATCH(
      createMockRequest("http://localhost/api/v1/campaigns/c1", {
        method: "PATCH",
        body: JSON.stringify({ status: "bad-status" }),
      }),
      { params: Promise.resolve({ id: "c1" }) },
    );

    expect(response.status).toBe(400);
  });

  it("returns 404 when update misses", async () => {
    mockUpdate.mockResolvedValueOnce(null);

    const response = await PATCH(
      createMockRequest("http://localhost/api/v1/campaigns/c1", {
        method: "PATCH",
        body: JSON.stringify({ name: "Launch" }),
      }),
      { params: Promise.resolve({ id: "c1" }) },
    );

    expect(response.status).toBe(404);
  });

  it("updates the campaign", async () => {
    mockUpdate.mockResolvedValueOnce({ id: "c1", name: "Launch" });

    const response = await PATCH(
      createMockRequest("http://localhost/api/v1/campaigns/c1", {
        method: "PATCH",
        body: JSON.stringify({ name: "Launch", status: "active" }),
      }),
      { params: Promise.resolve({ id: "c1" }) },
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(CampaignService.update).toHaveBeenCalledWith("acc-123", "c1", { name: "Launch", status: "active" });
    expect(data.campaign.name).toBe("Launch");
  });
});

describe("DELETE /api/v1/campaigns/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 404 when delete misses", async () => {
    mockDelete.mockResolvedValueOnce(false);

    const response = await DELETE(createMockRequest("http://localhost/api/v1/campaigns/c1", { method: "DELETE" }), {
      params: Promise.resolve({ id: "c1" }),
    });

    expect(response.status).toBe(404);
  });

  it("deletes the campaign", async () => {
    mockDelete.mockResolvedValueOnce(true);

    const response = await DELETE(createMockRequest("http://localhost/api/v1/campaigns/c1", { method: "DELETE" }), {
      params: Promise.resolve({ id: "c1" }),
    });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(CampaignService.delete).toHaveBeenCalledWith("acc-123", "c1");
    expect(data.success).toBe(true);
  });
});
