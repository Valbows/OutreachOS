/**
 * OutreachOS MCP Server — STDIO Transport
 *
 * Implements the Model Context Protocol server with STDIO transport
 * for local development (e.g., direct pipe from IDE/CLI).
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerTools } from "./tools.js";

const STDIO_SESSION_ID = "stdio"; // Single session for STDIO transport
import { registerResources } from "./resources.js";
import { registerPrompts } from "./prompts.js";

async function main() {
  console.error("[MCP Server] Starting STDIO transport...");

  const server = new McpServer({
    name: "outreachos-mcp",
    version: "1.0.0",
  });

  const toolCount = registerTools(server, STDIO_SESSION_ID);
  const resourceCount = registerResources(server);
  const promptCount = registerPrompts(server);

  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error(`[MCP Server] STDIO transport connected — ${toolCount} tools, ${resourceCount} resources, ${promptCount} prompts`);
}

main().catch(console.error);
