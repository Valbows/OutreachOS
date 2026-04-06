import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockAccount, createMockRequest } from "@/test/api-helpers";

vi.mock("@/lib/auth/session", () => ({
  getAuthAccount: vi.fn(),
}));

vi.mock("@outreachos/services", () => ({
  WebhookService: {
    list: vi.fn(),
    create: vi.fn(),
  },
}));

import { getAuthAccount } from "@/lib/auth/session";
import { WebhookService } from "@outreachos/services";
import { GET, POST } from "./route";

describe("GET /api/developer/webhooks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    vi.mocked(getAuthAccount).mockResolvedValueOnce(null);

    const response = await GET();

    expect(response.status).toBe(401);
  });

  it("returns webhooks for the account", async () => {
    vi.mocked(getAuthAccount).mockResolvedValueOnce(createMockAccount());
    vi.mocked(WebhookService.list).mockResolvedValueOnce([{ id: "w1", url: "https://example.com" }] as any);

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(WebhookService.list).toHaveBeenCalledWith("acc-123");
    expect(data.webhooks[0].id).toBe("w1");
  });

  it("returns 500 on list errors", async () => {
    vi.mocked(getAuthAccount).mockResolvedValueOnce(createMockAccount());
    vi.mocked(WebhookService.list).mockRejectedValueOnce(new Error("boom"));

    const response = await GET();

    expect(response.status).toBe(500);
  });
});

describe("POST /api/developer/webhooks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    vi.mocked(getAuthAccount).mockResolvedValueOnce(null);
    const request = createMockRequest("http://localhost/api/developer/webhooks", {
      method: "POST",
      body: JSON.stringify({ url: "https://example.com", events: ["email.sent"] }),
    });

    const response = await POST(request);

    expect(response.status).toBe(401);
  });

  it("returns 400 on invalid json", async () => {
    vi.mocked(getAuthAccount).mockResolvedValueOnce(createMockAccount());
    const request = createMockRequest("http://localhost/api/developer/webhooks", { method: "POST" });
    vi.mocked(request.json).mockRejectedValueOnce(new Error("bad json"));

    const response = await POST(request);

    expect(response.status).toBe(400);
  });

  it("returns 400 on invalid input", async () => {
    vi.mocked(getAuthAccount).mockResolvedValueOnce(createMockAccount());
    const request = createMockRequest("http://localhost/api/developer/webhooks", {
      method: "POST",
      body: JSON.stringify({ url: "invalid-url", events: [] }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("Invalid input");
  });

  it("creates a webhook", async () => {
    vi.mocked(getAuthAccount).mockResolvedValueOnce(createMockAccount());
    vi.mocked(WebhookService.create).mockResolvedValueOnce({ id: "w1", url: "https://example.com" } as any);
    const request = createMockRequest("http://localhost/api/developer/webhooks", {
      method: "POST",
      body: JSON.stringify({ url: "https://example.com", events: ["email.sent", "campaign.completed"] }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(WebhookService.create).toHaveBeenCalledWith({
      accountId: "acc-123",
      url: "https://example.com",
      events: ["email.sent", "campaign.completed"],
    });
    expect(data.webhook.id).toBe("w1");
  });

  it("returns 500 on create errors", async () => {
    vi.mocked(getAuthAccount).mockResolvedValueOnce(createMockAccount());
    vi.mocked(WebhookService.create).mockRejectedValueOnce(new Error("boom"));
    const request = createMockRequest("http://localhost/api/developer/webhooks", {
      method: "POST",
      body: JSON.stringify({ url: "https://example.com", events: ["email.sent"] }),
    });

    const response = await POST(request);

    expect(response.status).toBe(500);
  });
});
