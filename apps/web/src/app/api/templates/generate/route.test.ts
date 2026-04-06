import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createMockAccount, createMockRequest } from "@/test/api-helpers";

vi.mock("@/lib/auth/session", () => ({
  getAuthAccount: vi.fn(),
}));

vi.mock("@outreachos/services", () => ({
  LLMService: {
    generateEmail: vi.fn(),
    generateSubjectLines: vi.fn(),
    rewriteEmail: vi.fn(),
  },
}));

import { getAuthAccount } from "@/lib/auth/session";
import { LLMService } from "@outreachos/services";
import { POST } from "./route";

describe("POST /api/templates/generate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.GEMINI_API_KEY = "test-gemini-key";
  });

  afterEach(() => {
    delete process.env.GEMINI_API_KEY;
  });

  it("returns 401 when not authenticated", async () => {
    vi.mocked(getAuthAccount).mockResolvedValueOnce(null);

    const response = await POST(createMockRequest("http://localhost/api/templates/generate", { method: "POST" }));

    expect(response.status).toBe(401);
  });

  it("returns 500 when the gemini key is missing", async () => {
    delete process.env.GEMINI_API_KEY;
    vi.mocked(getAuthAccount).mockResolvedValueOnce(createMockAccount());

    const response = await POST(createMockRequest("http://localhost/api/templates/generate", { method: "POST", body: JSON.stringify({ action: "generate_email" }) }));

    expect(response.status).toBe(500);
  });

  it("returns 400 on malformed json", async () => {
    vi.mocked(getAuthAccount).mockResolvedValueOnce(createMockAccount());
    const request = createMockRequest("http://localhost/api/templates/generate", { method: "POST" });
    vi.mocked(request.json).mockRejectedValueOnce(new SyntaxError("bad json"));

    const response = await POST(request);

    expect(response.status).toBe(400);
  });

  it("returns 400 on invalid action", async () => {
    vi.mocked(getAuthAccount).mockResolvedValueOnce(createMockAccount());
    const request = createMockRequest("http://localhost/api/templates/generate", {
      method: "POST",
      body: JSON.stringify({ action: "unknown" }),
    });

    const response = await POST(request);

    expect(response.status).toBe(400);
  });

  it("generates an email", async () => {
    vi.mocked(getAuthAccount).mockResolvedValueOnce(createMockAccount());
    vi.mocked(LLMService.generateEmail).mockResolvedValueOnce({ text: "Email body" } as any);
    const request = createMockRequest("http://localhost/api/templates/generate", {
      method: "POST",
      body: JSON.stringify({
        action: "generate_email",
        goal: "Book meetings",
        audience: "Founders",
        tone: "professional",
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(LLMService.generateEmail).toHaveBeenCalledWith(
      "acc-123",
      { apiKey: "test-gemini-key" },
      expect.objectContaining({ goal: "Book meetings", audience: "Founders", tone: "professional" }),
    );
    expect(data.data.text).toBe("Email body");
  });

  it("generates subject lines", async () => {
    vi.mocked(getAuthAccount).mockResolvedValueOnce(createMockAccount());
    vi.mocked(LLMService.generateSubjectLines).mockResolvedValueOnce({ text: '["A","B"]' } as any);
    const request = createMockRequest("http://localhost/api/templates/generate", {
      method: "POST",
      body: JSON.stringify({
        action: "generate_subjects",
        emailBody: "Hello there",
        tone: "professional",
      }),
    });

    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(LLMService.generateSubjectLines).toHaveBeenCalled();
  });

  it("rewrites an email", async () => {
    vi.mocked(getAuthAccount).mockResolvedValueOnce(createMockAccount());
    vi.mocked(LLMService.rewriteEmail).mockResolvedValueOnce({ text: "Rewritten" } as any);
    const request = createMockRequest("http://localhost/api/templates/generate", {
      method: "POST",
      body: JSON.stringify({
        action: "rewrite",
        currentBody: "Old body",
        instruction: "Make it shorter",
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(LLMService.rewriteEmail).toHaveBeenCalledWith(
      "acc-123",
      { apiKey: "test-gemini-key" },
      "Old body",
      "Make it shorter",
    );
    expect(data.data.text).toBe("Rewritten");
  });
});
