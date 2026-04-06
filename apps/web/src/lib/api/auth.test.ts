import { NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockRequest } from "@/test/api-helpers";

const {
  mockDbSelect,
  mockSelectFrom,
  mockSelectWhere,
  mockSelectLimit,
  mockDbUpdate,
  mockUpdateSet,
  mockUpdateWhere,
  mockDbInsert,
  mockInsertValues,
  mockEq,
  mockAnd,
  mockIsNull,
  mockCheckRateLimit,
} = vi.hoisted(() => {
  const mockSelectLimit = vi.fn();
  const mockSelectWhere = vi.fn(() => ({ limit: mockSelectLimit }));
  const mockSelectFrom = vi.fn(() => ({ where: mockSelectWhere }));
  const mockDbSelect = vi.fn(() => ({ from: mockSelectFrom }));
  const mockUpdateWhere = vi.fn();
  const mockUpdateSet = vi.fn(() => ({ where: mockUpdateWhere }));
  const mockDbUpdate = vi.fn(() => ({ set: mockUpdateSet }));
  const mockInsertValues = vi.fn();
  const mockDbInsert = vi.fn(() => ({ values: mockInsertValues }));
  const mockEq = vi.fn(() => "eq");
  const mockAnd = vi.fn(() => "and");
  const mockIsNull = vi.fn(() => "isNull");
  const mockCheckRateLimit = vi.fn();
  return {
    mockDbSelect,
    mockSelectFrom,
    mockSelectWhere,
    mockSelectLimit,
    mockDbUpdate,
    mockUpdateSet,
    mockUpdateWhere,
    mockDbInsert,
    mockInsertValues,
    mockEq,
    mockAnd,
    mockIsNull,
    mockCheckRateLimit,
  };
});

vi.mock("@outreachos/db", () => ({
  db: {
    select: mockDbSelect,
    update: mockDbUpdate,
    insert: mockDbInsert,
  },
  apiKeys: {
    id: "id",
    accountId: "accountId",
    scopes: "scopes",
    keyHash: "keyHash",
    revokedAt: "revokedAt",
    lastUsedAt: "lastUsedAt",
  },
  apiUsage: {
    apiKeyId: "apiKeyId",
    endpoint: "endpoint",
    method: "method",
    statusCode: "statusCode",
    responseTimeMs: "responseTimeMs",
  },
}));

vi.mock("drizzle-orm", () => ({
  eq: mockEq,
  and: mockAnd,
  isNull: mockIsNull,
}));

vi.mock("./rate-limiter.js", () => ({
  checkRateLimit: mockCheckRateLimit,
}));

import { recordApiUsage, validateApiKey, withApiAuth, withRateLimit } from "./auth";

describe("validateApiKey", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSelectLimit.mockResolvedValue([]);
    mockUpdateWhere.mockResolvedValue(undefined);
    mockInsertValues.mockResolvedValue(undefined);
  });

  it("returns null when the authorization header is missing or invalid", async () => {
    const missing = await validateApiKey(createMockRequest("http://localhost/api/v1/contacts"));
    const wrongPrefix = await validateApiKey(
      createMockRequest("http://localhost/api/v1/contacts", {
        headers: { authorization: "Bearer not_outreach_key" },
      }),
    );

    expect(missing).toBeNull();
    expect(wrongPrefix).toBeNull();
  });

  it("returns null when the api key is not found", async () => {
    const result = await validateApiKey(
      createMockRequest("http://localhost/api/v1/contacts", {
        headers: { authorization: "Bearer osk_missing" },
      }),
    );

    expect(result).toBeNull();
  });

  it("returns context and updates lastUsedAt", async () => {
    mockSelectLimit.mockResolvedValueOnce([{ id: "key1", accountId: "acc_1", scopes: ["read"] }]);

    const result = await validateApiKey(
      createMockRequest("http://localhost/api/v1/contacts", {
        headers: { authorization: "Bearer osk_valid" },
      }),
    );

    expect(result).toEqual({ accountId: "acc_1", apiKeyId: "key1", scopes: ["read"] });
    expect(mockDbUpdate).toHaveBeenCalled();
    expect(mockUpdateSet).toHaveBeenCalledWith({ lastUsedAt: expect.any(Date) });
  });

  it("still returns context when lastUsedAt update fails", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    mockSelectLimit.mockResolvedValueOnce([{ id: "key1", accountId: "acc_1", scopes: [] }]);
    mockUpdateWhere.mockRejectedValueOnce(new Error("update failed"));

    const result = await validateApiKey(
      createMockRequest("http://localhost/api/v1/contacts", {
        headers: { authorization: "Bearer osk_valid" },
      }),
    );

    expect(result).toEqual({ accountId: "acc_1", apiKeyId: "key1", scopes: [] });
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});

describe("recordApiUsage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockInsertValues.mockResolvedValue(undefined);
  });

  it("records usage data", async () => {
    await recordApiUsage("key1", "/api/v1/contacts", "GET", 200, 45);

    expect(mockDbInsert).toHaveBeenCalled();
    expect(mockInsertValues).toHaveBeenCalledWith({
      apiKeyId: "key1",
      endpoint: "/api/v1/contacts",
      method: "GET",
      statusCode: 200,
      responseTimeMs: 45,
    });
  });

  it("logs insert failures without throwing", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    mockInsertValues.mockRejectedValueOnce(new Error("insert failed"));

    await expect(recordApiUsage("key1", "/api/v1/contacts", "GET", 200, 45)).resolves.toBeUndefined();

    expect(consoleErrorSpy).toHaveBeenCalled();
    consoleErrorSpy.mockRestore();
  });
});

describe("withApiAuth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSelectLimit.mockResolvedValue([]);
    mockUpdateWhere.mockResolvedValue(undefined);
    mockInsertValues.mockResolvedValue(undefined);
  });

  it("returns 401 when the api key is invalid", async () => {
    const handler = vi.fn();
    const wrapped = withApiAuth(handler);

    const response = await wrapped(createMockRequest("http://localhost/api/v1/contacts"));
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe("Unauthorized");
    expect(handler).not.toHaveBeenCalled();
  });

  it("returns 403 when required scopes are missing and records usage", async () => {
    mockSelectLimit.mockResolvedValueOnce([{ id: "key1", accountId: "acc_1", scopes: ["read"] }]);
    const wrapped = withApiAuth(vi.fn(), { requiredScopes: ["admin"] });

    const response = await wrapped(
      createMockRequest("http://localhost/api/v1/contacts", {
        method: "POST",
        headers: { authorization: "Bearer osk_valid" },
      }),
    );

    expect(response.status).toBe(403);
    expect(mockInsertValues).toHaveBeenCalledWith(
      expect.objectContaining({ apiKeyId: "key1", statusCode: 403, method: "POST" }),
    );
  });

  it("passes prevalidated context and params to the handler and records usage", async () => {
    const handler = vi.fn(async (_req, ctx, params) => NextResponse.json({ ok: true, accountId: ctx.accountId, params }));
    const wrapped = withApiAuth(handler, { requiredScopes: ["read"] });

    const response = await wrapped(createMockRequest("http://localhost/api/v1/contacts/123"), {
      apiContext: { accountId: "acc_1", apiKeyId: "key1", scopes: ["read"] },
      params: Promise.resolve({ id: "123" }),
    });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(handler).toHaveBeenCalled();
    expect(data).toEqual({ ok: true, accountId: "acc_1", params: { id: "123" } });
    expect(mockInsertValues).toHaveBeenCalledWith(
      expect.objectContaining({ apiKeyId: "key1", statusCode: 200, endpoint: "/api/v1/contacts/123" }),
    );
  });

  it("returns 500 and records usage when the handler throws", async () => {
    mockSelectLimit.mockResolvedValueOnce([{ id: "key1", accountId: "acc_1", scopes: ["read"] }]);
    const wrapped = withApiAuth(async () => {
      throw new Error("boom");
    });

    const response = await wrapped(
      createMockRequest("http://localhost/api/v1/contacts", {
        headers: { authorization: "Bearer osk_valid" },
      }),
    );

    expect(response.status).toBe(500);
    expect(mockInsertValues).toHaveBeenCalledWith(expect.objectContaining({ apiKeyId: "key1", statusCode: 500 }));
  });
});

describe("withRateLimit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSelectLimit.mockResolvedValue([]);
    mockUpdateWhere.mockResolvedValue(undefined);
    mockCheckRateLimit.mockResolvedValue({ allowed: true, remaining: 42, resetAt: 1700000000000 });
  });

  it("passes through when no api context is available", async () => {
    const handler = vi.fn(async () => NextResponse.json({ ok: true }));
    const wrapped = withRateLimit(handler);

    const response = await wrapped(createMockRequest("http://localhost/api/v1/contacts"));

    expect(response.status).toBe(200);
    expect(handler).toHaveBeenCalled();
    expect(mockCheckRateLimit).not.toHaveBeenCalled();
  });

  it("returns 429 when the rate limit is exceeded", async () => {
    mockCheckRateLimit.mockResolvedValueOnce({ allowed: false, remaining: 0, resetAt: Date.now() + 9000 });
    const handler = vi.fn(async () => NextResponse.json({ ok: true }));
    const wrapped = withRateLimit(handler);

    const response = await wrapped(createMockRequest("http://localhost/api/v1/contacts"), {
      apiContext: { accountId: "acc_1", apiKeyId: "key1", scopes: ["read"] },
    });
    const data = await response.json();

    expect(response.status).toBe(429);
    expect(data.error).toBe("Rate limit exceeded");
    expect(response.headers.get("X-RateLimit-Remaining")).toBe("0");
    expect(handler).not.toHaveBeenCalled();
  });

  it("adds rate limit headers to successful responses", async () => {
    const handler = vi.fn(async () => NextResponse.json({ ok: true }));
    const wrapped = withRateLimit(handler);

    const response = await wrapped(createMockRequest("http://localhost/api/v1/contacts"), {
      apiContext: { accountId: "acc_1", apiKeyId: "key1", scopes: ["read"] },
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("X-RateLimit-Remaining")).toBe("42");
    expect(response.headers.get("X-RateLimit-Reset")).toBe(String(Math.ceil(1700000000000 / 1000)));
  });
});
