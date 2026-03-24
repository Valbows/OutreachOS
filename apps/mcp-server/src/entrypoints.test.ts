import { beforeEach, describe, expect, it, vi } from "vitest";

describe("@outreachos/mcp-server entrypoints", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
    delete process.env.MCP_PORT;
  });

  it("logs HTTP startup with the default port", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    await import("./server");

    expect(logSpy).toHaveBeenNthCalledWith(
      1,
      "[MCP Server] Starting HTTP+SSE transport on port 3001...",
    );
    expect(logSpy).toHaveBeenNthCalledWith(
      2,
      "[MCP Server] Placeholder — awaiting Phase 6 implementation.",
    );
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it("logs HTTP startup with the configured port", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    process.env.MCP_PORT = "4123";
    await import("./server");

    expect(logSpy).toHaveBeenCalledWith(
      "[MCP Server] Starting HTTP+SSE transport on port 4123...",
    );
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it("logs STDIO startup to stderr", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    await import("./stdio");

    expect(errorSpy).toHaveBeenNthCalledWith(
      1,
      "[MCP Server] Starting STDIO transport...",
    );
    expect(errorSpy).toHaveBeenNthCalledWith(
      2,
      "[MCP Server] Placeholder — awaiting Phase 6 implementation.",
    );
  });
});
