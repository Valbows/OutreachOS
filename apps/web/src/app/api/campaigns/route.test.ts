import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockAccount, createMockRequest } from "@/test/api-helpers";

vi.mock("@/lib/auth/session", () => ({
  getAuthAccount: vi.fn(),
}));

vi.mock("@outreachos/services", () => ({
  CampaignService: {
    list: vi.fn(),
    create: vi.fn(),
  },
}));

import { getAuthAccount } from "@/lib/auth/session";
import { CampaignService } from "@outreachos/services";
import { GET, POST } from "./route";

describe("GET /api/campaigns", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    vi.mocked(getAuthAccount).mockResolvedValueOnce(null);

    const response = await GET(createMockRequest("http://localhost/api/campaigns"));

    expect(response.status).toBe(401);
  });

  it("lists campaigns without status filter", async () => {
    vi.mocked(getAuthAccount).mockResolvedValueOnce(createMockAccount());
    vi.mocked(CampaignService.list).mockResolvedValueOnce([{ id: "cmp1", name: "Launch" }] as any);

    const response = await GET(createMockRequest("http://localhost/api/campaigns"));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(CampaignService.list).toHaveBeenCalledWith("acc-123", undefined);
    expect(data.data).toHaveLength(1);
  });

  it("passes valid status filter", async () => {
    vi.mocked(getAuthAccount).mockResolvedValueOnce(createMockAccount());
    vi.mocked(CampaignService.list).mockResolvedValueOnce([]);

    await GET(createMockRequest("http://localhost/api/campaigns?status=active"));

    expect(CampaignService.list).toHaveBeenCalledWith("acc-123", "active");
  });

  it("ignores invalid status filter", async () => {
    vi.mocked(getAuthAccount).mockResolvedValueOnce(createMockAccount());
    vi.mocked(CampaignService.list).mockResolvedValueOnce([]);

    await GET(createMockRequest("http://localhost/api/campaigns?status=bogus"));

    expect(CampaignService.list).toHaveBeenCalledWith("acc-123", undefined);
  });
});

describe("POST /api/campaigns", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    vi.mocked(getAuthAccount).mockResolvedValueOnce(null);

    const response = await POST(createMockRequest("http://localhost/api/campaigns", { method: "POST" }));

    expect(response.status).toBe(401);
  });

  it("returns 400 on invalid json", async () => {
    vi.mocked(getAuthAccount).mockResolvedValueOnce(createMockAccount());
    const request = createMockRequest("http://localhost/api/campaigns", { method: "POST" });
    vi.mocked(request.json).mockRejectedValueOnce(new Error("bad json"));

    const response = await POST(request);

    expect(response.status).toBe(400);
  });

  it("returns 400 on validation failure", async () => {
    vi.mocked(getAuthAccount).mockResolvedValueOnce(createMockAccount());

    const response = await POST(
      createMockRequest("http://localhost/api/campaigns", {
        method: "POST",
        body: JSON.stringify({ name: "Launch", type: "invalid_type" }),
      }),
    );

    expect(response.status).toBe(400);
  });

  it("creates a campaign", async () => {
    vi.mocked(getAuthAccount).mockResolvedValueOnce(createMockAccount());
    vi.mocked(CampaignService.create).mockResolvedValueOnce({ id: "cmp1", name: "Launch" } as any);

    const response = await POST(
      createMockRequest("http://localhost/api/campaigns", {
        method: "POST",
        body: JSON.stringify({ name: "Launch", type: "one_time" }),
      }),
    );
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(CampaignService.create).toHaveBeenCalledWith({
      accountId: "acc-123",
      name: "Launch",
      type: "one_time",
      scheduledAt: undefined,
    });
    expect(data.data.id).toBe("cmp1");
  });
});
