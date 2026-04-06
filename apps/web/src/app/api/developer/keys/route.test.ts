import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockAccount, createMockRequest } from "@/test/api-helpers";

const {
  mockGetAuthAccount,
  mockDbSelect,
  mockSelectFrom,
  mockSelectWhere,
  mockSelectOrderBy,
  mockDbInsert,
  mockInsertValues,
  mockInsertReturning,
  mockEq,
  mockAnd,
  mockIsNull,
  mockRandomBytes,
  mockHashUpdate,
  mockHashDigest,
  mockCreateHash,
} = vi.hoisted(() => {
  const mockGetAuthAccount = vi.fn();
  const mockSelectOrderBy = vi.fn();
  const mockSelectWhere = vi.fn(() => ({ orderBy: mockSelectOrderBy }));
  const mockSelectFrom = vi.fn(() => ({ where: mockSelectWhere }));
  const mockDbSelect = vi.fn(() => ({ from: mockSelectFrom }));
  const mockInsertReturning = vi.fn();
  const mockInsertValues = vi.fn(() => ({ returning: mockInsertReturning }));
  const mockDbInsert = vi.fn(() => ({ values: mockInsertValues }));
  const mockEq = vi.fn(() => "eq");
  const mockAnd = vi.fn(() => "and");
  const mockIsNull = vi.fn(() => "isNull");
  const mockRandomBytes = vi.fn(() => Buffer.from("a".repeat(64), "hex"));
  const mockHashDigest = vi.fn(() => "hash-value");
  const mockHashUpdate = vi.fn(() => ({ digest: mockHashDigest }));
  const mockCreateHash = vi.fn(() => ({ update: mockHashUpdate }));
  return {
    mockGetAuthAccount,
    mockDbSelect,
    mockSelectFrom,
    mockSelectWhere,
    mockSelectOrderBy,
    mockDbInsert,
    mockInsertValues,
    mockInsertReturning,
    mockEq,
    mockAnd,
    mockIsNull,
    mockRandomBytes,
    mockHashUpdate,
    mockHashDigest,
    mockCreateHash,
  };
});

vi.mock("@/lib/auth/session", () => ({
  getAuthAccount: mockGetAuthAccount,
}));

vi.mock("@outreachos/db", () => ({
  db: {
    select: mockDbSelect,
    insert: mockDbInsert,
  },
  apiKeys: {
    id: "id",
    label: "label",
    keyPrefix: "keyPrefix",
    scopes: "scopes",
    createdAt: "createdAt",
    lastUsedAt: "lastUsedAt",
    accountId: "accountId",
    revokedAt: "revokedAt",
    keyHash: "keyHash",
  },
}));

vi.mock("drizzle-orm", () => ({
  eq: mockEq,
  and: mockAnd,
  isNull: mockIsNull,
}));

vi.mock("crypto", async (importOriginal) => {
  const actual = await importOriginal<typeof import("crypto")>();
  return {
    ...actual,
    randomBytes: mockRandomBytes,
    createHash: mockCreateHash,
  };
});

import { GET, POST } from "./route";

describe("GET /api/developer/keys", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    mockGetAuthAccount.mockResolvedValueOnce(null);

    const response = await GET();

    expect(response.status).toBe(401);
  });

  it("returns active api keys for the account", async () => {
    mockGetAuthAccount.mockResolvedValueOnce(createMockAccount());
    mockSelectOrderBy.mockResolvedValueOnce([
      {
        id: "key1",
        name: "Primary",
        prefix: "osk_test_123",
        scopes: ["read"],
        createdAt: "2024-01-01T00:00:00.000Z",
        lastUsedAt: null,
      },
    ]);

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.keys[0].name).toBe("Primary");
    expect(mockDbSelect).toHaveBeenCalled();
    expect(mockEq).toHaveBeenCalledWith("accountId", "acc-123");
    expect(mockIsNull).toHaveBeenCalledWith("revokedAt");
  });

  it("returns 500 on query failure", async () => {
    mockGetAuthAccount.mockResolvedValueOnce(createMockAccount());
    mockSelectOrderBy.mockRejectedValueOnce(new Error("DB failed"));

    const response = await GET();

    expect(response.status).toBe(500);
  });
});

describe("POST /api/developer/keys", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    mockGetAuthAccount.mockResolvedValueOnce(null);
    const request = createMockRequest("http://localhost/api/developer/keys", {
      method: "POST",
      body: JSON.stringify({ name: "Primary", scopes: ["read"] }),
    });

    const response = await POST(request);

    expect(response.status).toBe(401);
  });

  it("returns 400 on invalid json", async () => {
    mockGetAuthAccount.mockResolvedValueOnce(createMockAccount());
    const request = createMockRequest("http://localhost/api/developer/keys", { method: "POST" });
    vi.mocked(request.json).mockRejectedValueOnce(new Error("bad json"));

    const response = await POST(request);

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Invalid JSON body" });
  });

  it("returns 400 on invalid input", async () => {
    mockGetAuthAccount.mockResolvedValueOnce(createMockAccount());
    const request = createMockRequest("http://localhost/api/developer/keys", {
      method: "POST",
      body: JSON.stringify({ name: "", scopes: [] }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("Invalid input");
  });

  it("creates an api key and returns the secret once", async () => {
    mockGetAuthAccount.mockResolvedValueOnce(createMockAccount());
    mockInsertReturning.mockResolvedValueOnce([
      {
        id: "key1",
        name: "Primary",
        prefix: "osk_aaaaaaaa",
        scopes: ["read", "write"],
        createdAt: "2024-01-01T00:00:00.000Z",
        lastUsedAt: null,
      },
    ]);
    const request = createMockRequest("http://localhost/api/developer/keys", {
      method: "POST",
      body: JSON.stringify({ name: "Primary", scopes: ["read", "write"] }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(mockInsertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        accountId: "acc-123",
        label: "Primary",
        keyHash: expect.any(String),
        keyPrefix: expect.stringMatching(/^osk_/),
        scopes: ["read", "write"],
      }),
    );
    expect(data.key).toMatch(/^osk_/);
    expect(data.apiKey.id).toBe("key1");
  });

  it("returns 500 on insert failure", async () => {
    mockGetAuthAccount.mockResolvedValueOnce(createMockAccount());
    mockInsertReturning.mockRejectedValueOnce(new Error("insert failed"));
    const request = createMockRequest("http://localhost/api/developer/keys", {
      method: "POST",
      body: JSON.stringify({ name: "Primary", scopes: ["read"] }),
    });

    const response = await POST(request);

    expect(response.status).toBe(500);
  });
});
