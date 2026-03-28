/**
 * OutreachOS MCP Server — HTTP+SSE Transport
 *
 * Implements the Model Context Protocol server with HTTP+SSE transport
 * for remote client connections (e.g., Claude Desktop, Cursor, etc.)
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import express from "express";
import cors from "cors";
import { registerTools } from "./tools.js";
import { registerResources } from "./resources.js";
import { registerPrompts } from "./prompts.js";

export { McpServer };

const PORT = parseInt(process.env.MCP_PORT || "3001", 10);

function createServer(): McpServer {
  const server = new McpServer({
    name: "outreachos-mcp",
    version: "1.0.0",
  });

  registerTools(server);
  registerResources(server);
  registerPrompts(server);

  return server;
}

async function main() {
  console.log(`[MCP Server] Starting HTTP+SSE transport on port ${PORT}...`);

  const app = express();
  app.use(cors());

  // Track active transports for cleanup
  const transports = new Map<string, SSEServerTransport>();

  app.get("/sse", async (_req, res) => {
    const transport = new SSEServerTransport("/messages", res);
    const sessionId = transport.sessionId;
    transports.set(sessionId, transport);

    const server = createServer();

    res.on("close", () => {
      transports.delete(sessionId);
      console.log(`[MCP Server] SSE session ${sessionId} closed`);
    });

    await server.connect(transport);
    console.log(`[MCP Server] SSE session ${sessionId} connected`);
  });

  app.post("/messages", async (req, res) => {
    const sessionId = req.query.sessionId as string;
    const transport = transports.get(sessionId);
    if (!transport) {
      res.status(404).json({ error: "Session not found" });
      return;
    }
    await transport.handlePostMessage(req, res);
  });

  app.get("/health", (_req, res) => {
    res.json({ status: "ok", sessions: transports.size });
  });

  app.listen(PORT, () => {
    console.log(`[MCP Server] HTTP+SSE listening on http://localhost:${PORT}`);
    console.log(`[MCP Server] 21 tools, 4 resources, 3 prompts registered`);
  });
}

main().catch(console.error);
