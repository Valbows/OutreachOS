import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";
import { createMockAccount, createMockRequest } from "@/test/api-helpers";

vi.mock("@/lib/auth/session", () => ({
  getAuthAccount: vi.fn(),
}));

vi.mock("@outreachos/services", () => ({
  FormService: {
    getById: vi.fn(),
    generateEmbedCode: vi.fn(),
  },
}));

import { getAuthAccount } from "@/lib/auth/session";
import { FormService } from "@outreachos/services";

const params = Promise.resolve({ id: "form_1" });

describe("GET /api/forms/[id]/embed", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(FormService.generateEmbedCode)
      .mockReturnValueOnce("hosted-code")
      .mockReturnValueOnce("iframe-code")
      .mockReturnValueOnce("widget-code");
  });

  it("returns 401 when not authenticated", async () => {
    vi.mocked(getAuthAccount).mockResolvedValueOnce(null);

    const response = await GET(createMockRequest("http://localhost/api/forms/form_1/embed"), { params });

    expect(response.status).toBe(401);
  });

  it("returns 404 when the form does not exist", async () => {
    vi.mocked(getAuthAccount).mockResolvedValueOnce(createMockAccount());
    vi.mocked(FormService.getById).mockResolvedValueOnce(null);

    const response = await GET(createMockRequest("http://localhost/api/forms/form_1/embed"), { params });

    expect(response.status).toBe(404);
  });

  it("returns the generated embed codes", async () => {
    vi.mocked(getAuthAccount).mockResolvedValueOnce(createMockAccount());
    vi.mocked(FormService.getById).mockResolvedValueOnce({ id: "form_1" });

    const response = await GET(createMockRequest("http://localhost/api/forms/form_1/embed"), { params });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(FormService.generateEmbedCode).toHaveBeenNthCalledWith(1, "form_1", "http://localhost", "hosted");
    expect(FormService.generateEmbedCode).toHaveBeenNthCalledWith(2, "form_1", "http://localhost", "iframe");
    expect(FormService.generateEmbedCode).toHaveBeenNthCalledWith(3, "form_1", "http://localhost", "widget");
    expect(data.data).toEqual({ hosted: "hosted-code", iframe: "iframe-code", widget: "widget-code" });
  });

  it("returns 500 on unexpected failure", async () => {
    vi.mocked(getAuthAccount).mockResolvedValueOnce(createMockAccount());
    vi.mocked(FormService.getById).mockRejectedValueOnce(new Error("Unexpected"));

    const response = await GET(createMockRequest("http://localhost/api/forms/form_1/embed"), { params });

    expect(response.status).toBe(500);
  });
});
