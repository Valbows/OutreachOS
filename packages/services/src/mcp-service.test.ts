import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { CryptoService } from "./crypto-service";

// Set encryption key for tests
beforeAll(() => {
  process.env.ENCRYPTION_KEY = "test-encryption-key-for-mcp-tests-only";
});

vi.mock("@outreachos/db", () => {
  const chain = {
    select: vi.fn(),
    from: vi.fn(),
    where: vi.fn(),
    limit: vi.fn(),
    orderBy: vi.fn(),
    insert: vi.fn(),
    values: vi.fn(),
    returning: vi.fn(),
    update: vi.fn(),
    set: vi.fn(),
    delete: vi.fn(),
  };
  // make every method return the chain itself for fluent API
  Object.keys(chain).forEach((k) => {
    (chain as any)[k].mockReturnValue(chain);
  });

  return {
    db: chain,
    mcpServers: {},
  };
});

import { db, mcpServers } from "@outreachos/db";
import { McpService } from "./mcp-service";

const mockDb = db as any;

const mockServer = {
  id: "s1",
  accountId: "acc-1",
  name: "My MCP",
  url: "https://mcp.example.com",
  apiKeyEncrypted: null,
  description: null,
  enabled: 1,
  lastTestedAt: null,
  lastTestStatus: null,
  lastTestError: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe("McpService.list", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns list of servers for account", async () => {
    mockDb.select.mockReturnValue(mockDb);
    mockDb.from.mockReturnValue(mockDb);
    mockDb.where.mockReturnValue(mockDb);
    mockDb.orderBy.mockResolvedValue([mockServer]);

    const result = await McpService.list("acc-1");

    expect(result).toEqual([mockServer]);
  });
});

describe("McpService.getById", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns server when found", async () => {
    mockDb.select.mockReturnValue(mockDb);
    mockDb.from.mockReturnValue(mockDb);
    mockDb.where.mockReturnValue(mockDb);
    mockDb.limit.mockResolvedValue([mockServer]);

    const result = await McpService.getById("acc-1", "s1");

    expect(result).toEqual(mockServer);
  });

  it("returns null when not found", async () => {
    mockDb.select.mockReturnValue(mockDb);
    mockDb.from.mockReturnValue(mockDb);
    mockDb.where.mockReturnValue(mockDb);
    mockDb.limit.mockResolvedValue([]);

    const result = await McpService.getById("acc-1", "missing");

    expect(result).toBeNull();
  });
});

describe("McpService.create", () => {
  beforeEach(() => vi.clearAllMocks());

  it("inserts and returns the new server", async () => {
    mockDb.insert.mockReturnValue(mockDb);
    mockDb.values.mockReturnValue(mockDb);
    mockDb.returning.mockResolvedValue([mockServer]);

    const result = await McpService.create({
      accountId: "acc-1",
      name: "My MCP",
      url: "https://mcp.example.com",
    });

    expect(result).toEqual(mockServer);
    expect(mockDb.insert).toHaveBeenCalledWith(mcpServers);
  });
});

describe("McpService.update", () => {
  beforeEach(() => vi.clearAllMocks());

  it("updates and returns the server", async () => {
    const updated = { ...mockServer, name: "Updated" };
    mockDb.update.mockReturnValue(mockDb);
    mockDb.set.mockReturnValue(mockDb);
    mockDb.where.mockReturnValue(mockDb);
    mockDb.returning.mockResolvedValue([updated]);

    const result = await McpService.update("acc-1", "s1", { name: "Updated" });

    expect(result?.name).toBe("Updated");
  });

  it("returns null when server not found", async () => {
    mockDb.update.mockReturnValue(mockDb);
    mockDb.set.mockReturnValue(mockDb);
    mockDb.where.mockReturnValue(mockDb);
    mockDb.returning.mockResolvedValue([]);

    const result = await McpService.update("acc-1", "missing", { name: "X" });

    expect(result).toBeNull();
  });

  it("converts enabled boolean to integer", async () => {
    mockDb.update.mockReturnValue(mockDb);
    mockDb.set.mockReturnValue(mockDb);
    mockDb.where.mockReturnValue(mockDb);
    mockDb.returning.mockResolvedValue([{ ...mockServer, enabled: 0 }]);

    await McpService.update("acc-1", "s1", { enabled: false });

    expect(mockDb.set).toHaveBeenCalledWith(
      expect.objectContaining({ enabled: 0 }),
    );
  });
});

describe("McpService.delete", () => {
  beforeEach(() => vi.clearAllMocks());

  it("deletes the server", async () => {
    mockDb.delete.mockReturnValue(mockDb);
    mockDb.where.mockResolvedValue(undefined);

    await McpService.delete("acc-1", "s1");

    expect(mockDb.delete).toHaveBeenCalledWith(mcpServers);
  });
});

describe("McpService.test", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns not found when server does not exist", async () => {
    // getById returns null
    mockDb.select.mockReturnValue(mockDb);
    mockDb.from.mockReturnValue(mockDb);
    mockDb.where.mockReturnValue(mockDb);
    mockDb.limit.mockResolvedValue([]);

    const result = await McpService.test("acc-1", "missing");

    expect(result.ok).toBe(false);
    expect(result.error).toBe("Server not found");
  });

  it("returns ok=true when health endpoint responds 200", async () => {
    // getById returns server
    mockDb.select.mockReturnValue(mockDb);
    mockDb.from.mockReturnValue(mockDb);
    mockDb.where.mockReturnValue(mockDb);
    mockDb.limit.mockResolvedValue([mockServer]);

    // update call after test
    mockDb.update.mockReturnValue(mockDb);
    mockDb.set.mockReturnValue(mockDb);
    mockDb.returning.mockResolvedValue([mockServer]);

    const mockFetch = vi.fn().mockResolvedValue({ ok: true, status: 200 });

    const result = await McpService.test("acc-1", "s1", mockFetch as any);

    expect(result.ok).toBe(true);
    expect(mockFetch).toHaveBeenCalledWith(
      "https://mcp.example.com/health",
      expect.objectContaining({ method: "GET" }),
    );
  });

  it("returns ok=false when health endpoint returns non-2xx", async () => {
    mockDb.select.mockReturnValue(mockDb);
    mockDb.from.mockReturnValue(mockDb);
    mockDb.where.mockReturnValue(mockDb);
    mockDb.limit.mockResolvedValue([mockServer]);
    mockDb.update.mockReturnValue(mockDb);
    mockDb.set.mockReturnValue(mockDb);
    mockDb.returning.mockResolvedValue([mockServer]);

    const mockFetch = vi.fn().mockResolvedValue({ ok: false, status: 503 });

    const result = await McpService.test("acc-1", "s1", mockFetch as any);

    expect(result.ok).toBe(false);
    expect(result.error).toBe("HTTP 503");
  });

  it("returns ok=false when fetch throws", async () => {
    mockDb.select.mockReturnValue(mockDb);
    mockDb.from.mockReturnValue(mockDb);
    mockDb.where.mockReturnValue(mockDb);
    mockDb.limit.mockResolvedValue([mockServer]);
    mockDb.update.mockReturnValue(mockDb);
    mockDb.set.mockReturnValue(mockDb);
    mockDb.returning.mockResolvedValue([mockServer]);

    const mockFetch = vi.fn().mockRejectedValue(new Error("ECONNREFUSED"));

    const result = await McpService.test("acc-1", "s1", mockFetch as any);

    expect(result.ok).toBe(false);
    expect(result.error).toBe("ECONNREFUSED");
  });

  it("adds Authorization header when server has apiKey", async () => {
    const encryptedKey = CryptoService.encrypt("sk-test-key");
    const serverWithKey = { ...mockServer, apiKeyEncrypted: encryptedKey };
    mockDb.select.mockReturnValue(mockDb);
    mockDb.from.mockReturnValue(mockDb);
    mockDb.where.mockReturnValue(mockDb);
    mockDb.limit.mockResolvedValue([serverWithKey]);
    mockDb.update.mockReturnValue(mockDb);
    mockDb.set.mockReturnValue(mockDb);
    mockDb.returning.mockResolvedValue([serverWithKey]);

    const mockFetch = vi.fn().mockResolvedValue({ ok: true, status: 200 });

    await McpService.test("acc-1", "s1", mockFetch as any);

    expect(mockFetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: { Authorization: "Bearer sk-test-key" },
      }),
    );
  });
});
