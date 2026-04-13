import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockAccount, createMockRequest } from "@/test/api-helpers";

const { mockGetAuthAccount, mockDbUpdate } = vi.hoisted(() => {
  const mockGetAuthAccount = vi.fn();
  const mockWhere = vi.fn().mockResolvedValue(undefined);
  const mockSet = vi.fn().mockReturnValue({ where: mockWhere });
  const mockDbUpdate = vi.fn().mockReturnValue({ set: mockSet });
  return { mockGetAuthAccount, mockDbUpdate };
});

vi.mock("@/lib/auth/session", () => ({
  getAuthAccount: mockGetAuthAccount,
}));

vi.mock("@outreachos/db", () => ({
  db: { update: mockDbUpdate },
  accounts: { id: "id" },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn(),
}));

import { GET, PUT } from "./route";

describe("GET /api/settings/preferences", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAuthAccount.mockResolvedValue(createMockAccount());
  });

  it("returns 401 when not authenticated", async () => {
    mockGetAuthAccount.mockResolvedValueOnce(null);
    const response = await GET();
    expect(response.status).toBe(401);
  });

  it("returns current preference values", async () => {
    mockGetAuthAccount.mockResolvedValueOnce(
      createMockAccount({
        llmProvider: "openrouter",
        llmModel: "openai/gpt-4o-mini",
        senderDomain: "mail.example.com",
      } as any),
    );

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data).toEqual({
      llmProvider: "openrouter",
      llmModel: "openai/gpt-4o-mini",
      senderDomain: "mail.example.com",
    });
  });
});

describe("PUT /api/settings/preferences", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAuthAccount.mockResolvedValue(createMockAccount());
  });

  it("returns 401 when not authenticated", async () => {
    mockGetAuthAccount.mockResolvedValueOnce(null);
    const request = createMockRequest("http://localhost:3000/api/settings/preferences", {
      method: "PUT",
      body: JSON.stringify({ llmProvider: "gemini" }),
    });

    const response = await PUT(request);
    expect(response.status).toBe(401);
  });

  it("returns 400 for invalid payloads", async () => {
    const request = createMockRequest("http://localhost:3000/api/settings/preferences", {
      method: "PUT",
      body: JSON.stringify({ llmProvider: "invalid" }),
    });

    const response = await PUT(request);
    expect(response.status).toBe(400);
  });

  it("updates preference values", async () => {
    const request = createMockRequest("http://localhost:3000/api/settings/preferences", {
      method: "PUT",
      body: JSON.stringify({
        llmProvider: "openrouter",
        llmModel: "anthropic/claude-3.5-sonnet",
        senderDomain: "outreach.example.com",
      }),
    });

    const response = await PUT(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.message).toBe("Preferences updated");
    expect(data.data).toEqual({
      llmProvider: "openrouter",
      llmModel: "anthropic/claude-3.5-sonnet",
      senderDomain: "outreach.example.com",
    });
  });
});
