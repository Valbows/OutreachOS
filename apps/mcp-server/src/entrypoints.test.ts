import { describe, expect, it } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerTools } from "./tools.js";
import { registerResources } from "./resources.js";
import { registerPrompts } from "./prompts.js";

describe("@outreachos/mcp-server", () => {
  it("creates a valid McpServer instance", () => {
    const server = new McpServer({
      name: "outreachos-mcp",
      version: "1.0.0",
    });
    expect(server).toBeDefined();
  });

  it("registers tools without throwing", () => {
    const server = new McpServer({ name: "test", version: "0.0.1" });
    expect(() => registerTools(server, "test-session")).not.toThrow();
  });

  it("registers resources without throwing", () => {
    const server = new McpServer({ name: "test", version: "0.0.1" });
    expect(() => registerResources(server)).not.toThrow();
  });

  it("registers prompts without throwing", () => {
    const server = new McpServer({ name: "test", version: "0.0.1" });
    expect(() => registerPrompts(server)).not.toThrow();
  });

  it("registers all tools, resources, and prompts together", () => {
    const server = new McpServer({ name: "test", version: "0.0.1" });
    expect(() => {
      registerTools(server, "test-session");
      registerResources(server);
      registerPrompts(server);
    }).not.toThrow();
  });
});
