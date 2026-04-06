import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockAccount, createMockRequest } from "@/test/api-helpers";

vi.mock("@/lib/auth/session", () => ({
  getAuthAccount: vi.fn(),
}));

vi.mock("@outreachos/services", () => ({
  JourneyService: {
    list: vi.fn(),
    create: vi.fn(),
  },
}));

import { getAuthAccount } from "@/lib/auth/session";
import { JourneyService } from "@outreachos/services";
import { GET, POST } from "./route";

describe("GET /api/journeys", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    vi.mocked(getAuthAccount).mockResolvedValueOnce(null);

    const response = await GET();

    expect(response.status).toBe(401);
  });

  it("lists journeys", async () => {
    vi.mocked(getAuthAccount).mockResolvedValueOnce(createMockAccount());
    vi.mocked(JourneyService.list).mockResolvedValueOnce([{ id: "j1", name: "Onboarding" }] as any);

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(JourneyService.list).toHaveBeenCalledWith("acc-123");
    expect(data.data).toHaveLength(1);
  });
});

describe("POST /api/journeys", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    vi.mocked(getAuthAccount).mockResolvedValueOnce(null);

    const response = await POST(createMockRequest("http://localhost/api/journeys", { method: "POST" }));

    expect(response.status).toBe(401);
  });

  it("returns 400 on invalid json", async () => {
    vi.mocked(getAuthAccount).mockResolvedValueOnce(createMockAccount());
    const request = createMockRequest("http://localhost/api/journeys", { method: "POST" });
    vi.mocked(request.json).mockRejectedValueOnce(new Error("bad json"));

    const response = await POST(request);

    expect(response.status).toBe(400);
  });

  it("returns 400 on validation failure", async () => {
    vi.mocked(getAuthAccount).mockResolvedValueOnce(createMockAccount());

    const response = await POST(
      createMockRequest("http://localhost/api/journeys", {
        method: "POST",
        body: JSON.stringify({ name: "" }),
      }),
    );

    expect(response.status).toBe(400);
  });

  it("creates a journey", async () => {
    vi.mocked(getAuthAccount).mockResolvedValueOnce(createMockAccount());
    vi.mocked(JourneyService.create).mockResolvedValueOnce({ id: "j1", name: "Onboarding" } as any);

    const response = await POST(
      createMockRequest("http://localhost/api/journeys", {
        method: "POST",
        body: JSON.stringify({ name: "Onboarding", removeOnReply: true }),
      }),
    );
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(JourneyService.create).toHaveBeenCalledWith({
      accountId: "acc-123",
      name: "Onboarding",
      removeOnReply: true,
    });
    expect(data.data.id).toBe("j1");
  });
});
