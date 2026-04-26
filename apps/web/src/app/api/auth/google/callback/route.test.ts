import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "./route";
import { NextRequest } from "next/server";
import { db, accounts } from "@outreachos/db";
import { eq } from "drizzle-orm";

// Mock dependencies
const mockCookiesDelete = vi.fn();
const mockCookiesGet = vi.fn();

vi.mock("next/headers", () => ({
  cookies: () => ({
    delete: mockCookiesDelete,
    get: mockCookiesGet,
  }),
}));

vi.mock("@outreachos/db", () => ({
  db: {
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn().mockResolvedValue(undefined),
      })),
    })),
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn().mockResolvedValue([{ id: "account-123" }]),
        })),
      })),
    })),
  },
  accounts: {
    id: "id",
    neonAuthId: "neonAuthId",
    gmailAddress: "gmailAddress",
    gmailRefreshTokenEncrypted: "gmailRefreshTokenEncrypted",
    updatedAt: "updatedAt",
  },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn(),
}));

vi.mock("@outreachos/services", () => ({
  CryptoService: {
    encrypt: vi.fn((v: string) => `encrypted:${v}`),
    decrypt: vi.fn((v: string) => v.replace("encrypted:", "")),
  },
}));

describe("GET /api/auth/google/callback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.GOOGLE_CLIENT_ID = "test-client-id";
    process.env.GOOGLE_CLIENT_SECRET = "test-client-secret";
    process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";
  });

  it("should redirect with error when OAuth returns an error", async () => {
    mockCookiesGet.mockReturnValue(undefined);

    const request = new NextRequest(
      "http://localhost:3000/api/auth/google/callback?error=access_denied"
    );

    const response = await GET(request);

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain("oauth_error=access_denied");
  });

  it("should redirect with error when state parameter is invalid", async () => {
    mockCookiesGet.mockImplementation((name: string) => {
      if (name === "google_oauth_state") return { value: "valid-state" };
      return undefined;
    });

    const request = new NextRequest(
      "http://localhost:3000/api/auth/google/callback?code=abc123&state=invalid-state"
    );

    const response = await GET(request);

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain("oauth_error=invalid_state");
    expect(mockCookiesDelete).toHaveBeenCalledWith("google_oauth_state");
    expect(mockCookiesDelete).toHaveBeenCalledWith("google_oauth_user_id");
  });

  it("should redirect with error when no authorization code is provided", async () => {
    mockCookiesGet.mockImplementation((name: string) => {
      if (name === "google_oauth_state") return { value: "test-state" };
      if (name === "google_oauth_user_id") return { value: "user-123" };
      return undefined;
    });

    const request = new NextRequest(
      "http://localhost:3000/api/auth/google/callback?state=test-state"
    );

    const response = await GET(request);

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain("oauth_error=no_code");
  });

  it("should redirect with error when user ID is missing from cookies", async () => {
    mockCookiesGet.mockImplementation((name: string) => {
      if (name === "google_oauth_state") return { value: "test-state" };
      return undefined;
    });

    const request = new NextRequest(
      "http://localhost:3000/api/auth/google/callback?code=abc123&state=test-state"
    );

    const response = await GET(request);

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain("oauth_error=no_user");
  });

  it("should successfully complete OAuth and store tokens", async () => {
    // Mock cookies
    mockCookiesGet.mockImplementation((name: string) => {
      if (name === "google_oauth_state") return { value: "test-state" };
      if (name === "google_oauth_user_id") return { value: "user-123" };
      return undefined;
    });

    // Mock token exchange
    global.fetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: "test-access-token",
          refresh_token: "test-refresh-token",
          expires_in: 3600,
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          email: "user@gmail.com",
          verified_email: true,
          name: "Test User",
        }),
      } as Response);

    const request = new NextRequest(
      "http://localhost:3000/api/auth/google/callback?code=abc123&state=test-state"
    );

    const response = await GET(request);

    expect(response.status).toBe(307);
    const location = response.headers.get("location");
    expect(location).toContain("gmail_connected=true");
    expect(location).toContain("gmail_email=user%40gmail.com");
    expect(location).not.toContain("oauth_error");
  });

  it("should handle token exchange failure", async () => {
    mockCookiesGet.mockImplementation((name: string) => {
      if (name === "google_oauth_state") return { value: "test-state" };
      if (name === "google_oauth_user_id") return { value: "user-123" };
      return undefined;
    });

    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      text: async () => "invalid_grant",
    } as Response);

    const request = new NextRequest(
      "http://localhost:3000/api/auth/google/callback?code=invalid&state=test-state"
    );

    const response = await GET(request);

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain("oauth_error=token_exchange_failed");
  });

  it("should handle userinfo fetch failure", async () => {
    mockCookiesGet.mockImplementation((name: string) => {
      if (name === "google_oauth_state") return { value: "test-state" };
      if (name === "google_oauth_user_id") return { value: "user-123" };
      return undefined;
    });

    global.fetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: "test-access-token",
          refresh_token: "test-refresh-token",
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: false,
        status: 401,
      } as Response);

    const request = new NextRequest(
      "http://localhost:3000/api/auth/google/callback?code=abc123&state=test-state"
    );

    const response = await GET(request);

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain("oauth_error=userinfo_failed");
  });
});
