import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockAccount, createMockRequest } from "@/test/api-helpers";

vi.mock("@/lib/auth/session", () => ({
  getAuthAccount: vi.fn(),
}));

vi.mock("@outreachos/services", () => ({
  TemplateService: {
    list: vi.fn(),
    create: vi.fn(),
  },
}));

import { getAuthAccount } from "@/lib/auth/session";
import { TemplateService } from "@outreachos/services";
import { GET, POST } from "./route";

describe("GET /api/templates", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    vi.mocked(getAuthAccount).mockResolvedValueOnce(null);

    const response = await GET();

    expect(response.status).toBe(401);
  });

  it("lists templates", async () => {
    vi.mocked(getAuthAccount).mockResolvedValueOnce(createMockAccount());
    vi.mocked(TemplateService.list).mockResolvedValueOnce([{ id: "tpl1", name: "Welcome" }] as any);

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(TemplateService.list).toHaveBeenCalledWith("acc-123");
    expect(data.data).toHaveLength(1);
  });
});

describe("POST /api/templates", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    vi.mocked(getAuthAccount).mockResolvedValueOnce(null);

    const response = await POST(createMockRequest("http://localhost/api/templates", { method: "POST" }));

    expect(response.status).toBe(401);
  });

  it("returns 400 on malformed json", async () => {
    vi.mocked(getAuthAccount).mockResolvedValueOnce(createMockAccount());
    const request = createMockRequest("http://localhost/api/templates", { method: "POST" });
    vi.mocked(request.json).mockRejectedValueOnce(new SyntaxError("bad json"));

    const response = await POST(request);

    expect(response.status).toBe(400);
    expect((await response.json()).error).toBe("Malformed JSON");
  });

  it("returns 400 on validation failure", async () => {
    vi.mocked(getAuthAccount).mockResolvedValueOnce(createMockAccount());

    const response = await POST(
      createMockRequest("http://localhost/api/templates", {
        method: "POST",
        body: JSON.stringify({ name: "" }),
      }),
    );

    expect(response.status).toBe(400);
  });

  it("creates a template", async () => {
    vi.mocked(getAuthAccount).mockResolvedValueOnce(createMockAccount());
    vi.mocked(TemplateService.create).mockResolvedValueOnce({ id: "tpl1", name: "Welcome" } as any);

    const response = await POST(
      createMockRequest("http://localhost/api/templates", {
        method: "POST",
        body: JSON.stringify({ name: "Welcome", subject: "Hello!", bodyHtml: "<p>Hi</p>" }),
      }),
    );
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(TemplateService.create).toHaveBeenCalledWith({
      accountId: "acc-123",
      name: "Welcome",
      subject: "Hello!",
      bodyHtml: "<p>Hi</p>",
    });
    expect(data.data.id).toBe("tpl1");
  });
});
