import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockAccount, createMockRequest } from "@/test/api-helpers";

vi.mock("@/lib/auth/session", () => ({
  getAuthAccount: vi.fn(),
}));

vi.mock("@outreachos/services", () => ({
  McpService: {
    list: vi.fn(),
    create: vi.fn(),
  },
}));

import { getAuthAccount } from "@/lib/auth/session";
import { McpService } from "@outreachos/services";
import { GET, POST } from "./route";

describe("GET /api/mcp-servers", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when not authenticated", async () => {
    vi.mocked(getAuthAccount).mockResolvedValueOnce(null);
    const res = await GET(createMockRequest("http://localhost/api/mcp-servers"));
    expect(res.status).toBe(401);
  });

  it("returns list of servers", async () => {
    vi.mocked(getAuthAccount).mockResolvedValueOnce(createMockAccount());
    vi.mocked(McpService.list).mockResolvedValueOnce([{ id: "s1", name: "My MCP" }] as any);

    const res = await GET(createMockRequest("http://localhost/api/mcp-servers"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(McpService.list).toHaveBeenCalledWith("acc-123");
    expect(body.data).toHaveLength(1);
  });
});

describe("POST /api/mcp-servers", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when not authenticated", async () => {
    vi.mocked(getAuthAccount).mockResolvedValueOnce(null);
    const res = await POST(createMockRequest("http://localhost/api/mcp-servers", { method: "POST" }));
    expect(res.status).toBe(401);
  });

  it("returns 400 on invalid JSON", async () => {
    vi.mocked(getAuthAccount).mockResolvedValueOnce(createMockAccount());
    const req = createMockRequest("http://localhost/api/mcp-servers", { method: "POST" });
    vi.mocked(req.json).mockRejectedValueOnce(new Error("bad json"));
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 400 on validation failure", async () => {
    vi.mocked(getAuthAccount).mockResolvedValueOnce(createMockAccount());
    const res = await POST(
      createMockRequest("http://localhost/api/mcp-servers", {
        method: "POST",
        body: JSON.stringify({ name: "", url: "not-a-url" }),
      }),
    );
    expect(res.status).toBe(400);
  });

  it("creates and returns a new MCP server", async () => {
    vi.mocked(getAuthAccount).mockResolvedValueOnce(createMockAccount());
    vi.mocked(McpService.create).mockResolvedValueOnce({
      id: "s1",
      name: "My MCP",
      url: "https://mcp.example.com",
    } as any);

    const res = await POST(
      createMockRequest("http://localhost/api/mcp-servers", {
        method: "POST",
        body: JSON.stringify({ name: "My MCP", url: "https://mcp.example.com" }),
      }),
    );
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(McpService.create).toHaveBeenCalledWith({
      accountId: "acc-123",
      name: "My MCP",
      url: "https://mcp.example.com",
    });
    expect(body.data.id).toBe("s1");
  });
});
