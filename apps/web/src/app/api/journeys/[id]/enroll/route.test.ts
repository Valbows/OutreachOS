import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockAccount, createMockRequest } from "@/test/api-helpers";

vi.mock("@/lib/auth/session", () => ({
  getAuthAccount: vi.fn(),
}));

vi.mock("@outreachos/services", () => ({
  JourneyService: {
    getById: vi.fn(),
    enrollGroup: vi.fn(),
  },
}));

import { getAuthAccount } from "@/lib/auth/session";
import { JourneyService } from "@outreachos/services";
import { POST } from "./route";

const params = Promise.resolve({ id: "journey-1" });

describe("POST /api/journeys/[id]/enroll", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    vi.mocked(getAuthAccount).mockResolvedValueOnce(null);

    const response = await POST(createMockRequest("http://localhost/api/journeys/journey-1/enroll", { method: "POST" }), { params });

    expect(response.status).toBe(401);
  });

  it("returns 400 on invalid json", async () => {
    vi.mocked(getAuthAccount).mockResolvedValueOnce(createMockAccount());
    const request = createMockRequest("http://localhost/api/journeys/journey-1/enroll", { method: "POST" });
    vi.mocked(request.json).mockRejectedValueOnce(new Error("bad json"));

    const response = await POST(request, { params });

    expect(response.status).toBe(400);
  });

  it("returns 400 on validation failure", async () => {
    vi.mocked(getAuthAccount).mockResolvedValueOnce(createMockAccount());

    const response = await POST(
      createMockRequest("http://localhost/api/journeys/journey-1/enroll", {
        method: "POST",
        body: JSON.stringify({ contactIds: [] }),
      }),
      { params },
    );

    expect(response.status).toBe(400);
  });

  it("returns 404 when journey not found", async () => {
    vi.mocked(getAuthAccount).mockResolvedValueOnce(createMockAccount());
    vi.mocked(JourneyService.getById).mockResolvedValueOnce(null);

    const response = await POST(
      createMockRequest("http://localhost/api/journeys/journey-1/enroll", {
        method: "POST",
        body: JSON.stringify({ contactIds: ["a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11"] }),
      }),
      { params },
    );

    expect(response.status).toBe(404);
  });

  it("enrolls contacts in journey", async () => {
    vi.mocked(getAuthAccount).mockResolvedValueOnce(createMockAccount());
    vi.mocked(JourneyService.getById).mockResolvedValueOnce({ id: "journey-1" } as any);
    vi.mocked(JourneyService.enrollGroup).mockResolvedValueOnce({ enrolled: 1 } as any);

    const response = await POST(
      createMockRequest("http://localhost/api/journeys/journey-1/enroll", {
        method: "POST",
        body: JSON.stringify({
          contactIds: ["a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11"],
          removeOnReply: true,
        }),
      }),
      { params },
    );
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(JourneyService.getById).toHaveBeenCalledWith("acc-123", "journey-1");
    expect(JourneyService.enrollGroup).toHaveBeenCalledWith(
      "journey-1",
      [{ id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11" }],
      { removeOnReply: true, removeOnUnsubscribe: undefined },
    );
    expect(data.data.enrolled).toBe(1);
  });
});
