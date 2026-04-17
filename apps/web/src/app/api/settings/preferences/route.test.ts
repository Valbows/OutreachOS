import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockAccount, createMockRequest } from "@/test/api-helpers";

const { mockGetAuthAccount, mockDbSelect, mockDbUpdate } = vi.hoisted(() => {
  const mockGetAuthAccount = vi.fn();

  // Mock for db.select (used by getAccountPreferences)
  const mockLimit = vi.fn().mockResolvedValue([{ llmProvider: "gemini", llmModel: null, senderDomain: null }]);
  const mockWhereSelect = vi.fn().mockReturnValue({ limit: mockLimit });
  const mockFrom = vi.fn().mockReturnValue({ where: mockWhereSelect });
  const mockDbSelect = vi.fn().mockReturnValue({ from: mockFrom });

  // Mock for db.update
  const mockWhereUpdate = vi.fn().mockResolvedValue(undefined);
  const mockSet = vi.fn().mockReturnValue({ where: mockWhereUpdate });
  const mockDbUpdate = vi.fn().mockReturnValue({ set: mockSet });

  return { mockGetAuthAccount, mockDbSelect, mockDbUpdate };
});

vi.mock("@/lib/auth/session", () => ({
  getAuthAccount: mockGetAuthAccount,
}));

vi.mock("@outreachos/db", () => ({
  db: { select: mockDbSelect, update: mockDbUpdate },
  accounts: { id: "id", llmProvider: "llmProvider", llmModel: "llmModel", senderDomain: "senderDomain" },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn(),
}));

import { GET, PUT } from "./route";

describe("GET /api/settings/preferences", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAuthAccount.mockResolvedValue(createMockAccount());
    // Reset select mock to return default preferences
    const mockLimit = vi.fn().mockResolvedValue([{ llmProvider: "gemini", llmModel: null, senderDomain: null }]);
    const mockWhereSelect = vi.fn().mockReturnValue({ limit: mockLimit });
    const mockFrom = vi.fn().mockReturnValue({ where: mockWhereSelect });
    mockDbSelect.mockReturnValue({ from: mockFrom });
  });

  it("returns 401 when not authenticated", async () => {
    mockGetAuthAccount.mockResolvedValueOnce(null);
    const response = await GET();
    expect(response.status).toBe(401);
  });

  it("returns current preference values", async () => {
    mockGetAuthAccount.mockResolvedValueOnce(createMockAccount());

    // Configure mockDbSelect to return custom preference values
    const mockLimit = vi.fn().mockResolvedValue([
      { llmProvider: "openrouter", llmModel: "openai/gpt-4o-mini", senderDomain: "mail.example.com" },
    ]);
    const mockWhereSelect = vi.fn().mockReturnValue({ limit: mockLimit });
    const mockFrom = vi.fn().mockReturnValue({ where: mockWhereSelect });
    mockDbSelect.mockReturnValue({ from: mockFrom });

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data).toEqual({
      llmProvider: "openrouter",
      llmModel: "openai/gpt-4o-mini",
      senderDomain: "mail.example.com",
      gmailAddress: "",
      gmailConnected: false,
    });
  });
});

describe("PUT /api/settings/preferences", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAuthAccount.mockResolvedValue(createMockAccount());
    // Reset select mock to return default preferences
    const mockLimit = vi.fn().mockResolvedValue([{ llmProvider: "gemini", llmModel: null, senderDomain: null }]);
    const mockWhereSelect = vi.fn().mockReturnValue({ limit: mockLimit });
    const mockFrom = vi.fn().mockReturnValue({ where: mockWhereSelect });
    mockDbSelect.mockReturnValue({ from: mockFrom });
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
      gmailAddress: "",
      gmailConnected: false,
    });
  });
});
