import { describe, expect, it, vi, beforeEach } from "vitest";
import { GET } from "./route";
import { createMockRequest, createMockAccount } from "@/test/api-helpers";

vi.mock("@/lib/auth/session", () => ({
  getAuthAccount: vi.fn(),
}));

vi.mock("@outreachos/services", () => ({
  ContactService: {
    exportCSV: vi.fn(),
  },
}));

import { getAuthAccount } from "@/lib/auth/session";
import { ContactService } from "@outreachos/services";

describe("GET /api/contacts/export", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    vi.mocked(getAuthAccount).mockResolvedValueOnce(null);

    const request = createMockRequest("http://localhost/api/contacts/export");
    const response = await GET(request);

    expect(response.status).toBe(401);
    const data = await response.json();
    expect(data.error).toBe("Unauthorized");
  });

  it("returns CSV with cache-control headers preventing PII caching", async () => {
    vi.mocked(getAuthAccount).mockResolvedValueOnce(createMockAccount());
    vi.mocked(ContactService.exportCSV).mockResolvedValueOnce(
      "First Name,Last Name\nJohn,Doe",
    );

    const request = createMockRequest("http://localhost/api/contacts/export");
    const response = await GET(request);

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("text/csv; charset=utf-8");
    expect(response.headers.get("Content-Disposition")).toMatch(/^attachment; filename="?contacts-export-\d+\.csv"?$/);

    // Verify cache-control headers prevent caching of PII
    expect(response.headers.get("Cache-Control")).toBe(
      "no-store, no-cache, must-revalidate, private",
    );
    expect(response.headers.get("Pragma")).toBe("no-cache");
    expect(response.headers.get("Expires")).toBe("0");

    const body = await response.text();
    expect(body).toBe("First Name,Last Name\nJohn,Doe");
  });

  it("passes group_id and ids query params to exportCSV", async () => {
    vi.mocked(getAuthAccount).mockResolvedValueOnce(createMockAccount());
    vi.mocked(ContactService.exportCSV).mockResolvedValueOnce("First Name\nJane");

    const request = createMockRequest(
      "http://localhost/api/contacts/export?group_id=grp-1&ids=c1,c2,c3",
    );
    await GET(request);

    expect(ContactService.exportCSV).toHaveBeenCalledWith(
      "acc-123",
      "grp-1",
      ["c1", "c2", "c3"],
    );
  });

  it("returns 500 on export error", async () => {
    vi.mocked(getAuthAccount).mockResolvedValueOnce(createMockAccount());
    vi.mocked(ContactService.exportCSV).mockRejectedValueOnce(
      new Error("Database error"),
    );

    const request = createMockRequest("http://localhost/api/contacts/export");
    const response = await GET(request);

    expect(response.status).toBe(500);
    const data = await response.json();
    expect(data.error).toBe("Internal server error");
  });
});
