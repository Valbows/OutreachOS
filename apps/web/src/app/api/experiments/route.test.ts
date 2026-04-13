import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockAccount, createMockRequest } from "@/test/api-helpers";

vi.mock("@/lib/auth/session", () => ({
  getAuthAccount: vi.fn(),
}));

vi.mock("@outreachos/services", () => ({
  ExperimentService: {
    list: vi.fn(),
    create: vi.fn(),
  },
  CampaignService: {
    getById: vi.fn(),
  },
}));

import { getAuthAccount } from "@/lib/auth/session";
import { ExperimentService, CampaignService } from "@outreachos/services";
import { GET, POST } from "./route";

describe("GET /api/experiments", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    vi.mocked(getAuthAccount).mockResolvedValueOnce(null);

    const response = await GET();

    expect(response.status).toBe(401);
  });

  it("lists experiments", async () => {
    vi.mocked(getAuthAccount).mockResolvedValueOnce(createMockAccount());
    vi.mocked(ExperimentService.list).mockResolvedValueOnce([{ id: "exp1", name: "Subject Test" }] as any);

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(ExperimentService.list).toHaveBeenCalledWith("acc-123");
    expect(data.data).toHaveLength(1);
  });
});

describe("POST /api/experiments", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    vi.mocked(getAuthAccount).mockResolvedValueOnce(null);

    const response = await POST(createMockRequest("http://localhost/api/experiments", { method: "POST" }));

    expect(response.status).toBe(401);
  });

  it("returns 400 on malformed json", async () => {
    vi.mocked(getAuthAccount).mockResolvedValueOnce(createMockAccount());
    const request = createMockRequest("http://localhost/api/experiments", { method: "POST" });
    vi.mocked(request.json).mockRejectedValueOnce(new SyntaxError("bad json"));

    const response = await POST(request);

    expect(response.status).toBe(400);
    expect((await response.json()).error).toBe("Malformed JSON");
  });

  it("returns 400 on validation failure", async () => {
    vi.mocked(getAuthAccount).mockResolvedValueOnce(createMockAccount());

    const response = await POST(
      createMockRequest("http://localhost/api/experiments", {
        method: "POST",
        body: JSON.stringify({ name: "Test", type: "invalid_type" }),
      }),
    );

    expect(response.status).toBe(400);
  });

  it("returns 403 when campaign not found", async () => {
    vi.mocked(getAuthAccount).mockResolvedValueOnce(createMockAccount());
    vi.mocked(CampaignService.getById).mockResolvedValueOnce(null as any);

    const response = await POST(
      createMockRequest("http://localhost/api/experiments", {
        method: "POST",
        body: JSON.stringify({
          name: "Test",
          type: "subject_line",
          campaignId: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
        }),
      }),
    );

    expect(response.status).toBe(403);
  });

  it("creates an experiment", async () => {
    vi.mocked(getAuthAccount).mockResolvedValueOnce(createMockAccount());
    vi.mocked(CampaignService.getById).mockResolvedValueOnce({ id: "cmp1" } as any);
    vi.mocked(ExperimentService.create).mockResolvedValueOnce({ id: "exp1", name: "Subject Test" } as any);

    const response = await POST(
      createMockRequest("http://localhost/api/experiments", {
        method: "POST",
        body: JSON.stringify({
          name: "Subject Test",
          type: "subject_line",
          campaignId: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
        }),
      }),
    );
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(ExperimentService.create).toHaveBeenCalledWith({
      accountId: "acc-123",
      name: "Subject Test",
      type: "subject_line",
      campaignId: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
    });
    expect(data.data.id).toBe("exp1");
  });
});
