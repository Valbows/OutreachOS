/**
 * McpService — External MCP server registration, management and connectivity testing
 * API keys are encrypted at rest using AES-256-GCM.
 */

import { db, mcpServers } from "@outreachos/db";
import { eq, and } from "drizzle-orm";
import { CryptoService } from "./crypto-service";

export interface CreateMcpServerInput {
  accountId: string;
  name: string;
  url: string;
  apiKey?: string;
  description?: string;
}

export interface UpdateMcpServerInput {
  name?: string;
  url?: string;
  apiKey?: string | null;
  description?: string | null;
  enabled?: boolean;
}

export interface McpTestResult {
  ok: boolean;
  error?: string;
  latencyMs?: number;
}

export class McpService {
  /** List all registered MCP servers for an account */
  static async list(accountId: string) {
    return db
      .select()
      .from(mcpServers)
      .where(eq(mcpServers.accountId, accountId))
      .orderBy(mcpServers.createdAt);
  }

  /** Get a single MCP server by ID */
  static async getById(accountId: string, id: string) {
    const [server] = await db
      .select()
      .from(mcpServers)
      .where(and(eq(mcpServers.id, id), eq(mcpServers.accountId, accountId)))
      .limit(1);
    return server ?? null;
  }

  /** Register a new MCP server (apiKey is encrypted before storage) */
  static async create(input: CreateMcpServerInput) {
    const [server] = await db
      .insert(mcpServers)
      .values({
        accountId: input.accountId,
        name: input.name,
        url: input.url,
        apiKeyEncrypted: input.apiKey ? CryptoService.encrypt(input.apiKey) : null,
        description: input.description ?? null,
      })
      .returning();
    return server;
  }

  /** Update an existing MCP server (apiKey is encrypted before storage) */
  static async update(accountId: string, id: string, data: UpdateMcpServerInput) {
    const [updated] = await db
      .update(mcpServers)
      .set({
        ...(data.name !== undefined && { name: data.name }),
        ...(data.url !== undefined && { url: data.url }),
        ...(data.apiKey !== undefined && {
          apiKeyEncrypted: data.apiKey ? CryptoService.encrypt(data.apiKey) : null,
        }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.enabled !== undefined && { enabled: data.enabled ? 1 : 0 }),
        updatedAt: new Date(),
      })
      .where(and(eq(mcpServers.id, id), eq(mcpServers.accountId, accountId)))
      .returning();
    return updated ?? null;
  }

  /** Decrypt the API key for outbound calls (returns null if no key or decryption fails) */
  private static decryptApiKey(encryptedKey: string | null): string | null {
    if (!encryptedKey) return null;
    try {
      return CryptoService.decrypt(encryptedKey);
    } catch (error) {
      // Log decryption failure with context for diagnostics
      console.error("[McpService] API key decryption failed:", {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        encryptedKeyLength: encryptedKey.length,
      });
      return null;
    }
  }

  /** Delete an MCP server */
  static async delete(accountId: string, id: string) {
    await db
      .delete(mcpServers)
      .where(and(eq(mcpServers.id, id), eq(mcpServers.accountId, accountId)));
  }

  /**
   * Test connectivity to an MCP server.
   * Sends a GET request to /health; if that fails, falls back to GET /.
   * Records the final result.
   */
  static async test(
    accountId: string,
    id: string,
    fetchFn: typeof fetch = fetch,
  ): Promise<McpTestResult> {
    const server = await McpService.getById(accountId, id);
    if (!server) return { ok: false, error: "Server not found" };

    const start = Date.now();
    let ok = false;
    let error: string | undefined;

    try {
      const base = server.url.replace(/\/$/, "");
      const url = new URL(server.url);
      const isHttps = url.protocol === "https:";

      const headers: Record<string, string> = {};
      const apiKey = McpService.decryptApiKey(server.apiKeyEncrypted);
      if (apiKey) {
        if (!isHttps) {
          throw new Error("API key cannot be sent over non-HTTPS endpoint");
        }
        headers["Authorization"] = `Bearer ${apiKey}`;
      }

      // Try /health first
      let response = await fetchFn(`${base}/health`, {
        method: "GET",
        headers,
        signal: AbortSignal.timeout(8000),
      });

      // Fall back to / if /health fails
      if (!response.ok) {
        response = await fetchFn(`${base}/`, {
          method: "GET",
          headers,
          signal: AbortSignal.timeout(8000),
        });
      }

      ok = response.ok;
      if (!ok) error = `HTTP ${response.status}`;
    } catch (e) {
      error = e instanceof Error ? e.message : "Connection failed";
    }

    const latencyMs = Date.now() - start;

    await db
      .update(mcpServers)
      .set({
        lastTestedAt: new Date(),
        lastTestStatus: ok ? "ok" : "error",
        lastTestError: error ?? null,
        updatedAt: new Date(),
      })
      .where(and(eq(mcpServers.id, id), eq(mcpServers.accountId, accountId)));

    return { ok, error, latencyMs };
  }
}
