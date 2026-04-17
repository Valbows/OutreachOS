import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockAccount } from "@/test/api-helpers";

const { mockGetAuthAccount, mockListAccounts, mockDbUpdate, mockWhere, mockSet } = vi.hoisted(() => {
  const mockGetAuthAccount = vi.fn();
  const mockListAccounts = vi.fn();
  const mockWhere = vi.fn().mockResolvedValue(undefined);
  const mockSet = vi.fn().mockReturnValue({ where: mockWhere });
  const mockDbUpdate = vi.fn().mockReturnValue({ set: mockSet });
  return { mockGetAuthAccount, mockListAccounts, mockDbUpdate, mockWhere, mockSet };
});

vi.mock("@/lib/auth/session", () => ({
  getAuthAccount: mockGetAuthAccount,
}));

vi.mock("@/lib/auth/server", () => ({
  auth: {
    listAccounts: mockListAccounts,
  },
}));

vi.mock("@outreachos/db", () => ({
  db: { update: mockDbUpdate },
  accounts: { id: "id", gmailAddress: "gmailAddress", gmailRefreshToken: "gmailRefreshToken" },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn(),
}));

import { POST } from "./route";

describe("POST /api/auth/google/sync", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAuthAccount.mockResolvedValue(createMockAccount());
  });

  it("returns 401 when unauthenticated", async () => {
    mockGetAuthAccount.mockResolvedValueOnce(null);
    const res = await POST();
    expect(res.status).toBe(401);
  });

  it("returns linked=false and clears gmailAddress when no Google account is linked", async () => {
    mockListAccounts.mockResolvedValueOnce({ data: [], error: null });

    const res = await POST();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.linked).toBe(false);
    expect(body.debug).toBeDefined();
    expect(body.debug.accountCount).toBe(0);
    expect(body.debug.accounts).toEqual([]);
    expect(mockDbUpdate).toHaveBeenCalledOnce();
    expect(mockSet).toHaveBeenCalledWith(
      expect.objectContaining({ gmailAddress: null, gmailRefreshToken: null }),
    );
  });

  it("persists linked Google email and returns linked=true", async () => {
    mockListAccounts.mockResolvedValueOnce({
      data: [{ providerId: "google", email: "work@gmail.com" }],
      error: null,
    });

    const res = await POST();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.linked).toBe(true);
    expect(body.gmailAddress).toBe("work@gmail.com");
    expect(body.debug).toBeDefined();
    expect(mockSet).toHaveBeenCalledWith(
      expect.objectContaining({ gmailAddress: "work@gmail.com" }),
    );
  });

  it("extracts email from user.email when account.email is missing", async () => {
    mockListAccounts.mockResolvedValueOnce({
      data: [{ providerId: "google", user: { email: "user@gmail.com" } }],
      error: null,
    });

    const res = await POST();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.linked).toBe(true);
    expect(body.gmailAddress).toBe("user@gmail.com");
    expect(mockSet).toHaveBeenCalledWith(
      expect.objectContaining({ gmailAddress: "user@gmail.com" }),
    );
  });

  it("detects Google account by provider field when providerId is missing", async () => {
    mockListAccounts.mockResolvedValueOnce({
      data: [{ provider: "google", email: "provider@gmail.com" }],
      error: null,
    });

    const res = await POST();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.linked).toBe(true);
    expect(body.gmailAddress).toBe("provider@gmail.com");
  });

  it("detects Google account by id field containing 'google'", async () => {
    mockListAccounts.mockResolvedValueOnce({
      data: [{ id: "google-oauth2|123", email: "idtest@gmail.com" }],
      error: null,
    });

    const res = await POST();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.linked).toBe(true);
    expect(body.gmailAddress).toBe("idtest@gmail.com");
  });

  it("handles listAccounts error gracefully", async () => {
    mockListAccounts.mockResolvedValueOnce({
      data: null,
      error: { message: "Failed to fetch accounts" },
    });

    const res = await POST();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.linked).toBe(false);
    expect(body.debug.accountCount).toBe(0);
    expect(mockDbUpdate).toHaveBeenCalledOnce();
    expect(mockSet).toHaveBeenCalledWith(
      expect.objectContaining({ gmailAddress: null, gmailRefreshToken: null }),
    );
  });

  it("trims whitespace from extracted email addresses", async () => {
    mockListAccounts.mockResolvedValueOnce({
      data: [{ providerId: "google", email: "  spaced@gmail.com  " }],
      error: null,
    });

    const res = await POST();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.linked).toBe(true);
    expect(body.gmailAddress).toBe("spaced@gmail.com");
    expect(mockSet).toHaveBeenCalledWith(
      expect.objectContaining({ gmailAddress: "spaced@gmail.com" }),
    );
  });

  it("returns linked=false when only non-Google accounts exist", async () => {
    mockListAccounts.mockResolvedValueOnce({
      data: [
        { providerId: "github", email: "gh@example.com" },
        { providerId: "microsoft", email: "ms@example.com" },
      ],
      error: null,
    });

    const res = await POST();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.linked).toBe(false);
    expect(body.debug.accountCount).toBe(2);
    expect(mockSet).toHaveBeenCalledWith(
      expect.objectContaining({ gmailAddress: null, gmailRefreshToken: null }),
    );
  });

  it("uses first Google account when multiple are linked", async () => {
    mockListAccounts.mockResolvedValueOnce({
      data: [
        { providerId: "google", email: "first@gmail.com" },
        { providerId: "google", email: "second@gmail.com" },
      ],
      error: null,
    });

    const res = await POST();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.linked).toBe(true);
    expect(body.gmailAddress).toBe("first@gmail.com");
  });

  it("includes sanitized debug accounts in response when no Google account linked", async () => {
    mockListAccounts.mockResolvedValueOnce({
      data: [
        { providerId: "github", email: "gh@example.com", id: "456", someSecret: "should-not-appear" },
        { providerId: "microsoft", email: "ms@example.com", id: "789", anotherSecret: "hidden" },
      ],
      error: null,
    });

    const res = await POST();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.linked).toBe(false);
    expect(body.debug).toBeDefined();
    expect(body.debug.accounts).toHaveLength(2);
    expect(body.debug.accounts[0]).toHaveProperty("provider", "github");
    expect(body.debug.accounts[0]).toHaveProperty("id");
    expect(body.debug.accounts[0]).toHaveProperty("emailMask");
    expect(body.debug.accounts[0]).not.toHaveProperty("someSecret");
    expect(body.debug.accounts[0]).not.toHaveProperty("anotherSecret");
  });

  it("falls back to the session email when the linked account lacks an email field", async () => {
    mockListAccounts.mockResolvedValueOnce({
      data: [{ providerId: "google" }],
      error: null,
    });

    const res = await POST();
    const body = await res.json();

    expect(body.linked).toBe(true);
    expect(body.gmailAddress).toBe("test@example.com");
    expect(body.debug).toBeDefined();
  });
});
