import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createMockAccount, createMockRequest } from "@/test/api-helpers";

vi.mock("@/lib/auth/session", () => ({
  getAuthAccount: vi.fn(),
}));

vi.mock("@outreachos/services", () => ({
  CampaignService: {
    sendCampaign: vi.fn(),
  },
}));

const { dbSelectMock } = vi.hoisted(() => {
  const limitMock = vi.fn().mockResolvedValue([{ gmailAddress: null }]);
  const whereMock = vi.fn(() => ({ limit: limitMock }));
  const fromMock = vi.fn(() => ({ where: whereMock }));
  const selectMock = vi.fn(() => ({ from: fromMock }));
  return { dbSelectMock: selectMock };
});

vi.mock("@outreachos/db", () => ({
  db: { select: dbSelectMock },
  accounts: { id: "id", gmailAddress: "gmail_address" },
  eq: vi.fn(),
}));

import { getAuthAccount } from "@/lib/auth/session";
import { CampaignService } from "@outreachos/services";
import { POST } from "./route";

const params = Promise.resolve({ id: "cmp_1" });

describe("POST /api/campaigns/[id]/send", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.RESEND_API_KEY = "resend_test_key";
  });

  afterEach(() => {
    delete process.env.RESEND_API_KEY;
  });

  it("returns 401 when not authenticated", async () => {
    vi.mocked(getAuthAccount).mockResolvedValueOnce(null);

    const response = await POST(createMockRequest("http://localhost/api/campaigns/cmp_1/send", { method: "POST" }), { params });

    expect(response.status).toBe(401);
  });

  it("returns 400 on validation failures", async () => {
    vi.mocked(getAuthAccount).mockResolvedValueOnce(createMockAccount());

    const response = await POST(
      createMockRequest("http://localhost/api/campaigns/cmp_1/send", {
        method: "POST",
        body: JSON.stringify({ fromEmail: "not-an-email" }),
      }),
      { params },
    );

    expect(response.status).toBe(400);
  });

  it("returns 500 when resend key is missing", async () => {
    delete process.env.RESEND_API_KEY;
    vi.mocked(getAuthAccount).mockResolvedValueOnce(createMockAccount());

    const response = await POST(
      createMockRequest("http://localhost/api/campaigns/cmp_1/send", {
        method: "POST",
        body: JSON.stringify({ fromEmail: "sender@example.com" }),
      }),
      { params },
    );

    expect(response.status).toBe(500);
  });

  it("streams progress and final result", async () => {
    vi.mocked(getAuthAccount).mockResolvedValueOnce(createMockAccount());
    vi.mocked(CampaignService.sendCampaign).mockImplementationOnce(async (_accountId, _id, _config, onProgress) => {
      onProgress?.({ sent: 1, failed: 0, total: 3 });
      return { sent: 3, failed: 0, total: 3 };
    });

    const response = await POST(
      createMockRequest("http://localhost/api/campaigns/cmp_1/send", {
        method: "POST",
        body: JSON.stringify({ fromEmail: "sender@example.com", replyTo: "reply@example.com" }),
      }),
      { params },
    );
    const text = await response.text();

    expect(response.headers.get("Content-Type")).toBe("text/event-stream");
    expect(CampaignService.sendCampaign).toHaveBeenCalledWith(
      "acc-123",
      "cmp_1",
      expect.objectContaining({
        resendApiKey: "resend_test_key",
        fromEmail: "sender@example.com",
        fromName: "Test User",
        replyTo: "reply@example.com",
      }),
      expect.any(Function),
    );
    expect(text).toContain('"sent":1');
    expect(text).toContain('"done":true');
  });

  it("streams errors from send failures", async () => {
    vi.mocked(getAuthAccount).mockResolvedValueOnce(createMockAccount());
    vi.mocked(CampaignService.sendCampaign).mockRejectedValueOnce(new Error("Send failed"));

    const response = await POST(
      createMockRequest("http://localhost/api/campaigns/cmp_1/send", {
        method: "POST",
        body: JSON.stringify({ fromEmail: "sender@example.com" }),
      }),
      { params },
    );
    const text = await response.text();

    expect(text).toContain('"error":"Send failed"');
  });
});
