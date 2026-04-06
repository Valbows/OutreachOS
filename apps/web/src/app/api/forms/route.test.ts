import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET, POST } from "./route";
import { createMockAccount, createMockRequest } from "@/test/api-helpers";

vi.mock("@/lib/auth/session", () => ({
  getAuthAccount: vi.fn(),
}));

vi.mock("@outreachos/services", () => ({
  FormService: {
    list: vi.fn(),
    create: vi.fn(),
  },
}));

import { getAuthAccount } from "@/lib/auth/session";
import { FormService } from "@outreachos/services";

describe("GET /api/forms", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    vi.mocked(getAuthAccount).mockResolvedValueOnce(null);

    const response = await GET();

    expect(response.status).toBe(401);
  });

  it("returns forms for the authenticated account", async () => {
    vi.mocked(getAuthAccount).mockResolvedValueOnce(createMockAccount());
    vi.mocked(FormService.list).mockResolvedValueOnce([{ id: "form_1", name: "Signup" }] as any);

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(FormService.list).toHaveBeenCalledWith("acc-123");
    expect(data.data).toEqual([{ id: "form_1", name: "Signup" }]);
  });

  it("returns 500 on service failure", async () => {
    vi.mocked(getAuthAccount).mockResolvedValueOnce(createMockAccount());
    vi.mocked(FormService.list).mockRejectedValueOnce(new Error("DB down"));

    const response = await GET();

    expect(response.status).toBe(500);
  });
});

describe("POST /api/forms", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    vi.mocked(getAuthAccount).mockResolvedValueOnce(null);
    const request = createMockRequest("http://localhost/api/forms", {
      method: "POST",
      body: JSON.stringify({ name: "Signup", type: "minimal", fields: [] }),
    });

    const response = await POST(request);

    expect(response.status).toBe(401);
  });

  it("returns 400 on invalid json", async () => {
    vi.mocked(getAuthAccount).mockResolvedValueOnce(createMockAccount());
    const request = createMockRequest("http://localhost/api/forms", { method: "POST" });
    vi.mocked(request.json).mockRejectedValueOnce(new Error("Bad JSON"));

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("Invalid JSON");
  });

  it("returns 400 when validation fails", async () => {
    vi.mocked(getAuthAccount).mockResolvedValueOnce(createMockAccount());
    const request = createMockRequest("http://localhost/api/forms", {
      method: "POST",
      body: JSON.stringify({ name: "", type: "minimal", fields: [] }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("Validation failed");
  });

  it("creates a form when payload is valid", async () => {
    vi.mocked(getAuthAccount).mockResolvedValueOnce(createMockAccount());
    vi.mocked(FormService.create).mockResolvedValueOnce({ id: "form_1", name: "Signup" } as any);
    const request = createMockRequest("http://localhost/api/forms", {
      method: "POST",
      body: JSON.stringify({
        name: "Signup",
        type: "minimal",
        fields: [{ name: "email", type: "email", required: true, label: "Email" }],
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(FormService.create).toHaveBeenCalledWith(
      expect.objectContaining({ accountId: "acc-123", name: "Signup", type: "minimal" }),
    );
    expect(data.data.id).toBe("form_1");
  });

  it("returns 500 on create failure", async () => {
    vi.mocked(getAuthAccount).mockResolvedValueOnce(createMockAccount());
    vi.mocked(FormService.create).mockRejectedValueOnce(new Error("Create failed"));
    const request = createMockRequest("http://localhost/api/forms", {
      method: "POST",
      body: JSON.stringify({
        name: "Signup",
        type: "minimal",
        fields: [{ name: "email", type: "email", required: true, label: "Email" }],
      }),
    });

    const response = await POST(request);

    expect(response.status).toBe(500);
  });
});
