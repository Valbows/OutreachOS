import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockAccount, createMockRequest } from "@/test/api-helpers";

vi.mock("@/lib/auth/session", () => ({
  getAuthAccount: vi.fn(),
}));

vi.mock("@outreachos/services", () => ({
  McpService: {
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

import { getAuthAccount } from "@/lib/auth/session";
import { McpService } from "@outreachos/services";
import { PATCH, DELETE } from "./route";

const params = Promise.resolve({ id: "s1" });

describe("PATCH /api/mcp-servers/[id]", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when not authenticated", async () => {
    vi.mocked(getAuthAccount).mockResolvedValueOnce(null);
    const res = await PATCH(
      createMockRequest("http://localhost/api/mcp-servers/s1", { method: "PATCH" }),
      { params },
    );
    expect(res.status).toBe(401);
  });

  it("returns 400 on validation failure", async () => {
    vi.mocked(getAuthAccount).mockResolvedValueOnce(createMockAccount());
    const res = await PATCH(
      createMockRequest("http://localhost/api/mcp-servers/s1", {
        method: "PATCH",
        body: JSON.stringify({ url: "not-a-url" }),
      }),
      { params },
    );
    expect(res.status).toBe(400);
  });

  it("returns 404 when server not found", async () => {
    vi.mocked(getAuthAccount).mockResolvedValueOnce(createMockAccount());
    vi.mocked(McpService.update).mockResolvedValueOnce(null as any);

    const res = await PATCH(
      createMockRequest("http://localhost/api/mcp-servers/s1", {
        method: "PATCH",
        body: JSON.stringify({ name: "Updated" }),
      }),
      { params },
    );
    expect(res.status).toBe(404);
  });

  it("updates an MCP server", async () => {
    vi.mocked(getAuthAccount).mockResolvedValueOnce(createMockAccount());
    vi.mocked(McpService.update).mockResolvedValueOnce({ id: "s1", name: "Updated" } as any);

    const res = await PATCH(
      createMockRequest("http://localhost/api/mcp-servers/s1", {
        method: "PATCH",
        body: JSON.stringify({ name: "Updated", enabled: false }),
      }),
      { params },
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(McpService.update).toHaveBeenCalledWith("acc-123", "s1", {
      name: "Updated",
      enabled: false,
    });
    expect(body.data.name).toBe("Updated");
  });
});

describe("DELETE /api/mcp-servers/[id]", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when not authenticated", async () => {
    vi.mocked(getAuthAccount).mockResolvedValueOnce(null);
    const res = await DELETE(
      createMockRequest("http://localhost/api/mcp-servers/s1", { method: "DELETE" }),
      { params },
    );
    expect(res.status).toBe(401);
  });

  it("deletes an MCP server", async () => {
    vi.mocked(getAuthAccount).mockResolvedValueOnce(createMockAccount());
    vi.mocked(McpService.delete).mockResolvedValueOnce(undefined);

    const res = await DELETE(
      createMockRequest("http://localhost/api/mcp-servers/s1", { method: "DELETE" }),
      { params },
    );

    expect(res.status).toBe(204);
    expect(McpService.delete).toHaveBeenCalledWith("acc-123", "s1");
  });
});
