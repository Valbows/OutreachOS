import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createMockAccount, createMockRequest } from "@/test/api-helpers";

vi.mock("@/lib/auth/session", () => ({
  getAuthAccount: vi.fn(),
}));

vi.mock("@outreachos/services", () => ({
  EnrichmentService: {
    batchEnrich: vi.fn(),
  },
}));

import { getAuthAccount } from "@/lib/auth/session";
import { EnrichmentService } from "@outreachos/services";
import { POST } from "./route";

describe("POST /api/enrichment/batch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.HUNTER_API_KEY = "hunter_test_key";
  });

  afterEach(() => {
    delete process.env.HUNTER_API_KEY;
  });

  it("returns 401 when not authenticated", async () => {
    vi.mocked(getAuthAccount).mockResolvedValueOnce(null);

    const response = await POST(createMockRequest("http://localhost/api/enrichment/batch", { method: "POST" }));

    expect(response.status).toBe(401);
  });

  it("returns 400 on invalid json", async () => {
    vi.mocked(getAuthAccount).mockResolvedValueOnce(createMockAccount());
    const request = createMockRequest("http://localhost/api/enrichment/batch", { method: "POST" });
    vi.mocked(request.json).mockRejectedValueOnce(new Error("bad json"));

    const response = await POST(request);

    expect(response.status).toBe(400);
  });

  it("returns 400 when no hunter api key", async () => {
    delete process.env.HUNTER_API_KEY;
    vi.mocked(getAuthAccount).mockResolvedValueOnce(createMockAccount());

    const response = await POST(
      createMockRequest("http://localhost/api/enrichment/batch", {
        method: "POST",
        body: JSON.stringify({}),
      }),
    );

    expect(response.status).toBe(400);
    expect((await response.json()).error).toContain("Hunter.io API key");
  });

  it("streams progress and final result", async () => {
    vi.mocked(getAuthAccount).mockResolvedValueOnce(createMockAccount());
    vi.mocked(EnrichmentService.batchEnrich).mockImplementationOnce(async (_accountId, _config, _groupId, onProgress) => {
      onProgress?.({ processed: 1, total: 2, found: 1, verified: 1 });
      return { enriched: 2, skipped: 0 } as any;
    });

    const response = await POST(
      createMockRequest("http://localhost/api/enrichment/batch", {
        method: "POST",
        body: JSON.stringify({ confidenceThreshold: 90 }),
      }),
    );
    const text = await response.text();

    expect(response.headers.get("Content-Type")).toBe("application/x-ndjson");
    expect(EnrichmentService.batchEnrich).toHaveBeenCalledWith(
      "acc-123",
      expect.objectContaining({ hunterApiKey: "hunter_test_key", confidenceThreshold: 90 }),
      undefined,
      expect.any(Function),
    );
    expect(text).toContain('"processed":1');
    expect(text).toContain('"done":true');
  });

  it("uses BYOK hunter key when provided", async () => {
    delete process.env.HUNTER_API_KEY;
    vi.mocked(getAuthAccount).mockResolvedValueOnce(createMockAccount());
    vi.mocked(EnrichmentService.batchEnrich).mockResolvedValueOnce({ enriched: 0 } as any);

    await POST(
      createMockRequest("http://localhost/api/enrichment/batch", {
        method: "POST",
        body: JSON.stringify({ hunterApiKey: "user_key" }),
      }),
    );

    expect(EnrichmentService.batchEnrich).toHaveBeenCalledWith(
      "acc-123",
      expect.objectContaining({ hunterApiKey: "user_key" }),
      undefined,
      expect.any(Function),
    );
  });

  it("streams error from service failure", async () => {
    vi.mocked(getAuthAccount).mockResolvedValueOnce(createMockAccount());
    vi.mocked(EnrichmentService.batchEnrich).mockRejectedValueOnce(new Error("Enrich failed"));

    const response = await POST(
      createMockRequest("http://localhost/api/enrichment/batch", {
        method: "POST",
        body: JSON.stringify({}),
      }),
    );
    const text = await response.text();

    expect(text).toContain('"error":"Enrich failed"');
  });
});
