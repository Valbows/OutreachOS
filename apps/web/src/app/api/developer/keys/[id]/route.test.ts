import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockAccount, createMockRequest } from "@/test/api-helpers";

const {
  mockGetAuthAccount,
  mockDbUpdate,
  mockUpdateSet,
  mockUpdateWhere,
  mockUpdateReturning,
  mockEq,
  mockAnd,
} = vi.hoisted(() => {
  const mockGetAuthAccount = vi.fn();
  const mockUpdateReturning = vi.fn();
  const mockUpdateWhere = vi.fn(() => ({ returning: mockUpdateReturning }));
  const mockUpdateSet = vi.fn(() => ({ where: mockUpdateWhere }));
  const mockDbUpdate = vi.fn(() => ({ set: mockUpdateSet }));
  const mockEq = vi.fn(() => "eq");
  const mockAnd = vi.fn(() => "and");
  return { mockGetAuthAccount, mockDbUpdate, mockUpdateSet, mockUpdateWhere, mockUpdateReturning, mockEq, mockAnd };
});

vi.mock("@/lib/auth/session", () => ({
  getAuthAccount: mockGetAuthAccount,
}));

vi.mock("@outreachos/db", () => ({
  db: {
    update: mockDbUpdate,
  },
  apiKeys: {
    id: "id",
    accountId: "accountId",
    revokedAt: "revokedAt",
  },
}));

vi.mock("drizzle-orm", () => ({
  eq: mockEq,
  and: mockAnd,
}));

import { DELETE } from "./route";

const params = Promise.resolve({ id: "key1" });

describe("DELETE /api/developer/keys/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    mockGetAuthAccount.mockResolvedValueOnce(null);

    const response = await DELETE(createMockRequest("http://localhost/api/developer/keys/key1", { method: "DELETE" }), { params });

    expect(response.status).toBe(401);
  });

  it("returns 404 when the key is not found", async () => {
    mockGetAuthAccount.mockResolvedValueOnce(createMockAccount());
    mockUpdateReturning.mockResolvedValueOnce([]);

    const response = await DELETE(createMockRequest("http://localhost/api/developer/keys/key1", { method: "DELETE" }), { params });

    expect(response.status).toBe(404);
  });

  it("revokes the key when found", async () => {
    mockGetAuthAccount.mockResolvedValueOnce(createMockAccount());
    mockUpdateReturning.mockResolvedValueOnce([{ id: "key1" }]);

    const response = await DELETE(createMockRequest("http://localhost/api/developer/keys/key1", { method: "DELETE" }), { params });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(mockUpdateSet).toHaveBeenCalledWith(expect.objectContaining({ revokedAt: expect.any(Date) }));
    expect(mockEq).toHaveBeenCalledWith("id", "key1");
    expect(mockEq).toHaveBeenCalledWith("accountId", "acc-123");
    expect(data.success).toBe(true);
  });

  it("returns 500 on unexpected errors", async () => {
    mockGetAuthAccount.mockResolvedValueOnce(createMockAccount());
    mockUpdateReturning.mockRejectedValueOnce(new Error("db failed"));

    const response = await DELETE(createMockRequest("http://localhost/api/developer/keys/key1", { method: "DELETE" }), { params });

    expect(response.status).toBe(500);
  });
});
