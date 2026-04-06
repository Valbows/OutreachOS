import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockAccount, createMockRequest } from "@/test/api-helpers";

vi.mock("@/lib/auth/session", () => ({
  getAuthAccount: vi.fn(),
}));

vi.mock("@outreachos/services", () => ({
  WebhookService: {
    get: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

import { getAuthAccount } from "@/lib/auth/session";
import { WebhookService } from "@outreachos/services";
import { PATCH, DELETE } from "./route";

const params = Promise.resolve({ id: "w1" });

describe("PATCH /api/developer/webhooks/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    vi.mocked(getAuthAccount).mockResolvedValueOnce(null);

    const response = await PATCH(createMockRequest("http://localhost/api/developer/webhooks/w1", { method: "PATCH" }), { params });

    expect(response.status).toBe(401);
  });

  it("returns 400 on invalid json", async () => {
    vi.mocked(getAuthAccount).mockResolvedValueOnce(createMockAccount());
    const request = createMockRequest("http://localhost/api/developer/webhooks/w1", { method: "PATCH" });
    vi.mocked(request.json).mockRejectedValueOnce(new Error("bad json"));

    const response = await PATCH(request, { params });

    expect(response.status).toBe(400);
  });

  it("returns 400 on invalid input", async () => {
    vi.mocked(getAuthAccount).mockResolvedValueOnce(createMockAccount());
    const request = createMockRequest("http://localhost/api/developer/webhooks/w1", {
      method: "PATCH",
      body: JSON.stringify({ url: "not-a-url" }),
    });

    const response = await PATCH(request, { params });

    expect(response.status).toBe(400);
  });

  it("returns 404 when the webhook does not exist", async () => {
    vi.mocked(getAuthAccount).mockResolvedValueOnce(createMockAccount());
    vi.mocked(WebhookService.update).mockResolvedValueOnce(null as any);
    const request = createMockRequest("http://localhost/api/developer/webhooks/w1", {
      method: "PATCH",
      body: JSON.stringify({ enabled: false }),
    });

    const response = await PATCH(request, { params });

    expect(response.status).toBe(404);
  });

  it("updates the webhook", async () => {
    vi.mocked(getAuthAccount).mockResolvedValueOnce(createMockAccount());
    vi.mocked(WebhookService.update).mockResolvedValueOnce({ id: "w1", enabled: false } as any);
    const request = createMockRequest("http://localhost/api/developer/webhooks/w1", {
      method: "PATCH",
      body: JSON.stringify({ enabled: false }),
    });

    const response = await PATCH(request, { params });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(WebhookService.update).toHaveBeenCalledWith("acc-123", "w1", { enabled: false });
    expect(data.webhook.id).toBe("w1");
  });
});

describe("DELETE /api/developer/webhooks/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    vi.mocked(getAuthAccount).mockResolvedValueOnce(null);

    const response = await DELETE(createMockRequest("http://localhost/api/developer/webhooks/w1", { method: "DELETE" }), { params });

    expect(response.status).toBe(401);
  });

  it("returns 404 when the webhook does not exist", async () => {
    vi.mocked(getAuthAccount).mockResolvedValueOnce(createMockAccount());
    vi.mocked(WebhookService.get).mockResolvedValueOnce(null as any);

    const response = await DELETE(createMockRequest("http://localhost/api/developer/webhooks/w1", { method: "DELETE" }), { params });

    expect(response.status).toBe(404);
  });

  it("deletes the webhook", async () => {
    vi.mocked(getAuthAccount).mockResolvedValueOnce(createMockAccount());
    vi.mocked(WebhookService.get).mockResolvedValueOnce({ id: "w1" } as any);
    vi.mocked(WebhookService.delete).mockResolvedValueOnce(undefined as any);

    const response = await DELETE(createMockRequest("http://localhost/api/developer/webhooks/w1", { method: "DELETE" }), { params });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(WebhookService.delete).toHaveBeenCalledWith("acc-123", "w1");
    expect(data.success).toBe(true);
  });

  it("returns 500 on delete errors", async () => {
    vi.mocked(getAuthAccount).mockResolvedValueOnce(createMockAccount());
    vi.mocked(WebhookService.get).mockRejectedValueOnce(new Error("boom"));

    const response = await DELETE(createMockRequest("http://localhost/api/developer/webhooks/w1", { method: "DELETE" }), { params });

    expect(response.status).toBe(500);
  });
});
