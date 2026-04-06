import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockAccount, createMockRequest } from "@/test/api-helpers";

vi.mock("@/lib/auth/session", () => ({
  getAuthAccount: vi.fn(),
}));

vi.mock("@outreachos/db", () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(),
        })),
      })),
    })),
  },
  experimentBatches: { id: "id", experimentId: "experimentId" },
  experiments: { id: "id", accountId: "accountId" },
  eq: vi.fn(),
  and: vi.fn(),
}));

vi.mock("@outreachos/services", () => ({
  ExperimentService: {
    evaluateBatch: vi.fn(),
    checkForChampion: vi.fn(),
  },
}));

import { getAuthAccount } from "@/lib/auth/session";
import { POST } from "./route";

const params = Promise.resolve({ id: "exp_1" });

describe("POST /api/experiments/[id]/evaluate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    vi.mocked(getAuthAccount).mockResolvedValueOnce(null);

    const response = await POST(createMockRequest("http://localhost/api/experiments/exp_1/evaluate", { method: "POST" }), { params });

    expect(response.status).toBe(401);
  });

  it("returns 400 on validation failure", async () => {
    vi.mocked(getAuthAccount).mockResolvedValueOnce(createMockAccount());

    const response = await POST(
      createMockRequest("http://localhost/api/experiments/exp_1/evaluate", {
        method: "POST",
        body: JSON.stringify({ batchId: "not-a-uuid" }),
      }),
      { params },
    );

    expect(response.status).toBe(400);
  });
});
