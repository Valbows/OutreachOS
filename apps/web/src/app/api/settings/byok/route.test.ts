import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockRequest, createMockAccount } from "@/test/api-helpers";

const { mockGetAuthAccount, mockEncrypt, mockDbSelect, mockDbUpdate } = vi.hoisted(() => {
  const mockGetAuthAccount = vi.fn();
  const mockEncrypt = vi.fn((val: string) => `encrypted:${val}`);

  // Mock for db.select (used by getAccountByokKeys)
  const mockLimit = vi.fn().mockResolvedValue([{ byokKeys: null }]);
  const mockWhereSelect = vi.fn().mockReturnValue({ limit: mockLimit });
  const mockFrom = vi.fn().mockReturnValue({ where: mockWhereSelect });
  const mockDbSelect = vi.fn().mockReturnValue({ from: mockFrom });

  // Mock for db.update
  const mockWhereUpdate = vi.fn().mockResolvedValue(undefined);
  const mockSet = vi.fn().mockReturnValue({ where: mockWhereUpdate });
  const mockDbUpdate = vi.fn().mockReturnValue({ set: mockSet });

  return { mockGetAuthAccount, mockEncrypt, mockDbSelect, mockDbUpdate };
});

vi.mock("@/lib/auth/session", () => ({
  getAuthAccount: mockGetAuthAccount,
}));

vi.mock("@outreachos/services", () => ({
  CryptoService: {
    encrypt: mockEncrypt,
    decrypt: vi.fn((val: string) => val.replace("encrypted:", "")),
  },
}));

vi.mock("@outreachos/db", () => ({
  db: { select: mockDbSelect, update: mockDbUpdate },
  accounts: { id: "id", byokKeys: "byokKeys" },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn(),
}));

import { GET, PUT } from "./route";

describe("GET /api/settings/byok", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAuthAccount.mockResolvedValue(createMockAccount({ byokKeys: null } as any));
    // Reset select mock to return empty byokKeys by default
    const mockLimit = vi.fn().mockResolvedValue([{ byokKeys: null }]);
    const mockWhereSelect = vi.fn().mockReturnValue({ limit: mockLimit });
    const mockFrom = vi.fn().mockReturnValue({ where: mockWhereSelect });
    mockDbSelect.mockReturnValue({ from: mockFrom });
  });

  it("returns 401 when not authenticated", async () => {
    mockGetAuthAccount.mockResolvedValueOnce(null);
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("returns empty providers when no BYOK keys configured", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.providers).toEqual({});
  });

  it("returns configured providers without exposing raw keys", async () => {
    mockGetAuthAccount.mockResolvedValueOnce(createMockAccount());

    // Configure mockDbSelect to return byokKeys (route uses getAccountByokKeys which calls db.select)
    const mockLimit = vi.fn().mockResolvedValue([
      { byokKeys: { gemini: "encrypted-val", openrouter: "encrypted-val2" } },
    ]);
    const mockWhereSelect = vi.fn().mockReturnValue({ limit: mockLimit });
    const mockFrom = vi.fn().mockReturnValue({ where: mockWhereSelect });
    mockDbSelect.mockReturnValue({ from: mockFrom });

    const res = await GET();
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.providers.gemini).toBe(true);
    expect(data.providers.openrouter).toBe(true);
    expect(JSON.stringify(data)).not.toContain("encrypted-val");
  });
});

describe("PUT /api/settings/byok", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAuthAccount.mockResolvedValue(createMockAccount({ byokKeys: null } as any));
    // Reset select mock to return empty byokKeys by default
    const mockLimit = vi.fn().mockResolvedValue([{ byokKeys: null }]);
    const mockWhereSelect = vi.fn().mockReturnValue({ limit: mockLimit });
    const mockFrom = vi.fn().mockReturnValue({ where: mockWhereSelect });
    mockDbSelect.mockReturnValue({ from: mockFrom });
  });

  it("returns 401 when not authenticated", async () => {
    mockGetAuthAccount.mockResolvedValueOnce(null);
    const req = createMockRequest("http://localhost:3000/api/settings/byok", {
      method: "PUT",
      body: JSON.stringify({ gemini: "test-key" }),
    });
    const res = await PUT(req);
    expect(res.status).toBe(401);
  });

  it("ignores unknown providers and returns 200", async () => {
    const req = createMockRequest("http://localhost:3000/api/settings/byok", {
      method: "PUT",
      body: JSON.stringify({ invalid_provider: 12345 }),
    });
    const res = await PUT(req);
    expect(res.status).toBe(200);
  });

  it("encrypts and stores BYOK keys", async () => {
    const req = createMockRequest("http://localhost:3000/api/settings/byok", {
      method: "PUT",
      body: JSON.stringify({ gemini: "AIzaSyB-test-key" }),
    });
    const res = await PUT(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.providers.gemini).toBe(true);
    expect(data.message).toBe("BYOK keys updated");
  });
});
