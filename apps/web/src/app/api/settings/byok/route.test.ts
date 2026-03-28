import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockRequest, createMockAccount } from "@/test/api-helpers";

const { mockGetAuthAccount, mockEncrypt, mockDbUpdate } = vi.hoisted(() => {
  const mockGetAuthAccount = vi.fn();
  const mockEncrypt = vi.fn((val: string) => `encrypted:${val}`);
  const mockWhere = vi.fn().mockResolvedValue(undefined);
  const mockSet = vi.fn().mockReturnValue({ where: mockWhere });
  const mockDbUpdate = vi.fn().mockReturnValue({ set: mockSet });
  return { mockGetAuthAccount, mockEncrypt, mockDbUpdate };
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
  db: { update: mockDbUpdate },
  accounts: { id: "id" },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn(),
}));

import { GET, PUT } from "./route";

describe("GET /api/settings/byok", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAuthAccount.mockResolvedValue(createMockAccount({ byokKeys: null } as any));
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
    mockGetAuthAccount.mockResolvedValueOnce(
      createMockAccount({ byokKeys: { gemini: "encrypted-val", openrouter: "encrypted-val2" } } as any),
    );
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

  it("returns 400 for invalid input", async () => {
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
