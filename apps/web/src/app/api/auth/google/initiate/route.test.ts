import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { POST } from "./route";
import { NextRequest } from "next/server";

// Mock dependencies
const mockGetSession = vi.fn();
const mockCookiesSet = vi.fn();
const mockCookiesGet = vi.fn();

vi.mock("@/lib/auth/server", () => ({
  getAuth: () => ({
    getSession: mockGetSession,
  }),
}));

vi.mock("next/headers", () => ({
  cookies: () => ({
    set: mockCookiesSet,
    get: mockCookiesGet,
  }),
}));

describe("POST /api/auth/google/initiate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.GOOGLE_CLIENT_ID = "test-client-id.apps.googleusercontent.com";
    process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";
  });

  afterEach(() => {
    delete process.env.GOOGLE_CLIENT_ID;
    delete process.env.NEXT_PUBLIC_APP_URL;
  });

  it("should return 401 when user is not authenticated", async () => {
    mockGetSession.mockResolvedValue(null);

    const request = new NextRequest("http://localhost:3000/api/auth/google/initiate", {
      method: "POST",
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe("Unauthorized");
  });

  it("should return 500 when GOOGLE_CLIENT_ID is not configured", async () => {
    mockGetSession.mockResolvedValue({ data: { user: { id: "user-123" } } });
    delete process.env.GOOGLE_CLIENT_ID;

    const request = new NextRequest("http://localhost:3000/api/auth/google/initiate", {
      method: "POST",
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe("Google OAuth not configured");
  });

  it("should return OAuth URL when properly configured", async () => {
    mockGetSession.mockResolvedValue({ data: { user: { id: "user-123" } } });

    const request = new NextRequest("http://localhost:3000/api/auth/google/initiate", {
      method: "POST",
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.url).toBeDefined();
    expect(data.url).toContain("https://accounts.google.com/o/oauth2/v2/auth");
    expect(data.url).toContain("client_id=test-client-id");
    expect(data.url).toContain("response_type=code");
    expect(data.url).toContain("scope=");
    expect(data.url).toContain("access_type=offline");
    expect(data.url).toContain("prompt=consent");
    
    // Verify cookies were set
    expect(mockCookiesSet).toHaveBeenCalledWith(
      "google_oauth_state",
      expect.any(String),
      expect.objectContaining({
        httpOnly: true,
        secure: false,
        sameSite: "lax",
        maxAge: 600,
        path: "/",
      })
    );
    
    expect(mockCookiesSet).toHaveBeenCalledWith(
      "google_oauth_user_id",
      "user-123",
      expect.objectContaining({
        httpOnly: true,
        secure: false,
        sameSite: "lax",
        maxAge: 600,
        path: "/",
      })
    );
  });

  it("should include all required scopes", async () => {
    mockGetSession.mockResolvedValue({ data: { user: { id: "user-123" } } });

    const request = new NextRequest("http://localhost:3000/api/auth/google/initiate", {
      method: "POST",
    });

    const response = await POST(request);
    const data = await response.json();

    // Scopes are URL-encoded in the query string
    expect(data.url).toContain("gmail.send");
    expect(data.url).toContain("userinfo.email");
    expect(data.url).toContain("userinfo.profile");
  });
});
