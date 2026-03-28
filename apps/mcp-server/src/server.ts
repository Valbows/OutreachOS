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
import { registerTools, cleanupSession } from "./tools.js";
import { registerResources } from "./resources.js";
import { registerPrompts } from "./prompts.js";

export { McpServer };

const PORT = parseInt(process.env.MCP_PORT || "3001", 10);

function createServer(sessionId: string): McpServer {
  const server = new McpServer({
    name: "outreachos-mcp",
    version: "1.0.0",
  });

  registerTools(server, sessionId);
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
  const cleanedUpSessions = new Set<string>();
  const CLEANUP_TTL_MS = 5 * 60 * 1000; // 5 minutes

  function safeCleanup(sessionId: string, res?: express.Response): void {
    if (cleanedUpSessions.has(sessionId)) return;
    cleanedUpSessions.add(sessionId);
    transports.delete(sessionId);
    cleanupSession(sessionId);
    // Schedule cleanup of the guard entry after TTL
    setTimeout(() => cleanedUpSessions.delete(sessionId), CLEANUP_TTL_MS);
    if (res && !res.writableEnded) {
      if (res.headersSent) {
        // Headers already sent by SSE transport, just end the response
        res.end();
      } else {
        res.status(500).end("Server connection failed");
      }
    }
  }

  app.get("/sse", async (_req, res) => {
    const transport = new SSEServerTransport("/messages", res);
    const sessionId = transport.sessionId;
    transports.set(sessionId, transport);

    const server = createServer(sessionId);

    res.on("close", () => {
      safeCleanup(sessionId);
      console.log(`[MCP Server] SSE session ${sessionId} closed`);
    });

    try {
      await server.connect(transport);
      console.log(`[MCP Server] SSE session ${sessionId} connected`);
    } catch (err) {
      console.error(`[MCP Server] Failed to connect session ${sessionId}:`, err instanceof Error ? err.message : err);
      // Clean up orphaned transport
      safeCleanup(sessionId, res);
    }
  });

  app.post("/messages", async (req, res) => {
    // Validate and normalize sessionId from query
    const rawSessionId = req.query.sessionId;
    let sessionId: string;
    if (typeof rawSessionId === "string") {
      sessionId = rawSessionId;
    } else if (Array.isArray(rawSessionId) && rawSessionId.length > 0 && typeof rawSessionId[0] === "string") {
      sessionId = rawSessionId[0];
    } else {
      res.status(400).json({ error: "Invalid or missing sessionId query parameter" });
      return;
    }

    const transport = transports.get(sessionId);
    if (!transport) {
      res.status(404).json({ error: "Session not found" });
      return;
    }

    try {
      await transport.handlePostMessage(req, res);
    } catch (err) {
      console.error(`[MCP Server] Error handling message for session ${sessionId}:`, err instanceof Error ? err.message : err);
      // If response hasn't been sent yet, send 500
      if (!res.headersSent) {
        res.status(500).json({ error: "Failed to process message" });
      }
    }
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
