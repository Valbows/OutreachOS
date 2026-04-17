import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockAccount, createMockRequest } from "@/test/api-helpers";

vi.mock("@/lib/auth/session", () => ({
  getAuthAccount: vi.fn(),
}));

vi.mock("@outreachos/services", () => ({
  McpService: {
    test: vi.fn(),
  },
}));

import { getAuthAccount } from "@/lib/auth/session";
import { McpService } from "@outreachos/services";
import { POST } from "./route";

const params = Promise.resolve({ id: "s1" });

describe("POST /api/mcp-servers/[id]/test", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when not authenticated", async () => {
    vi.mocked(getAuthAccount).mockResolvedValueOnce(null);
    const res = await POST(
      createMockRequest("http://localhost/api/mcp-servers/s1/test", { method: "POST" }),
      { params },
    );
    expect(res.status).toBe(401);
  });

  it("returns 404 when server not found", async () => {
    vi.mocked(getAuthAccount).mockResolvedValueOnce(createMockAccount());
    vi.mocked(McpService.test).mockResolvedValueOnce({ ok: false, error: "Server not found" });

    const res = await POST(
      createMockRequest("http://localhost/api/mcp-servers/s1/test", { method: "POST" }),
      { params },
    );
    expect(res.status).toBe(404);
  });

  it("returns test result when connection succeeds", async () => {
    vi.mocked(getAuthAccount).mockResolvedValueOnce(createMockAccount());
    vi.mocked(McpService.test).mockResolvedValueOnce({ ok: true, latencyMs: 42 });

    const res = await POST(
      createMockRequest("http://localhost/api/mcp-servers/s1/test", { method: "POST" }),
      { params },
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(McpService.test).toHaveBeenCalledWith("acc-123", "s1");
    expect(body.data.ok).toBe(true);
    expect(body.data.latencyMs).toBe(42);
  });

  it("returns 502 error when connection fails", async () => {
    vi.mocked(getAuthAccount).mockResolvedValueOnce(createMockAccount());
    vi.mocked(McpService.test).mockResolvedValueOnce({ ok: false, error: "Connection refused" });

    const res = await POST(
      createMockRequest("http://localhost/api/mcp-servers/s1/test", { method: "POST" }),
      { params },
    );
    const body = await res.json();

    expect(res.status).toBe(502);
    expect(body.error).toBe("Connection refused");
  });
});
