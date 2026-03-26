import { describe, expect, it, vi, beforeEach } from "vitest";
import { POST } from "./route";
import { NextRequest } from "next/server";
import { createMockAccount } from "@/test/api-helpers";

vi.mock("@/lib/auth/session", () => ({
  getAuthAccount: vi.fn(),
}));

vi.mock("@outreachos/services", () => ({
  ContactService: {
    parseCSV: vi.fn(),
    bulkCreate: vi.fn(),
  },
}));

import { getAuthAccount } from "@/lib/auth/session";
import { ContactService } from "@outreachos/services";

function createUploadRequest(
  fileName: string,
  content: string,
  size?: number,
): NextRequest {
  const file = new File([content], fileName, { type: "text/csv" });
  // Override size if needed for testing limits
  if (size !== undefined) {
    Object.defineProperty(file, "size", { value: size });
  }
  const formData = new FormData();
  formData.append("file", file);

  return {
    url: "http://localhost/api/contacts/upload",
    nextUrl: new URL("http://localhost/api/contacts/upload"),
    headers: new Headers(),
    method: "POST",
    formData: vi.fn().mockResolvedValue(formData),
    json: vi.fn(),
    text: vi.fn(),
    blob: vi.fn(),
    arrayBuffer: vi.fn(),
    clone: vi.fn(),
    body: null,
    bodyUsed: false,
    cache: "default",
    credentials: "same-origin",
    destination: "",
    integrity: "",
    keepalive: false,
    mode: "cors",
    redirect: "follow",
    referrer: "",
    referrerPolicy: "",
    signal: new AbortController().signal,
  } as unknown as NextRequest;
}

function createEmptyFormRequest(): NextRequest {
  const formData = new FormData();
  return {
    url: "http://localhost/api/contacts/upload",
    nextUrl: new URL("http://localhost/api/contacts/upload"),
    headers: new Headers(),
    method: "POST",
    formData: vi.fn().mockResolvedValue(formData),
    json: vi.fn(),
    text: vi.fn(),
    blob: vi.fn(),
    arrayBuffer: vi.fn(),
    clone: vi.fn(),
    body: null,
    bodyUsed: false,
    cache: "default",
    credentials: "same-origin",
    destination: "",
    integrity: "",
    keepalive: false,
    mode: "cors",
    redirect: "follow",
    referrer: "",
    referrerPolicy: "",
    signal: new AbortController().signal,
  } as unknown as NextRequest;
}

describe("POST /api/contacts/upload", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    vi.mocked(getAuthAccount).mockResolvedValueOnce(null);
    const request = createUploadRequest("contacts.csv", "data");
    const response = await POST(request);
    expect(response.status).toBe(401);
  });

  it("returns 400 when no file provided", async () => {
    vi.mocked(getAuthAccount).mockResolvedValueOnce(createMockAccount());
    const request = createEmptyFormRequest();
    const response = await POST(request);
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toMatch(/no file/i);
  });

  it("returns 400 for invalid file type", async () => {
    vi.mocked(getAuthAccount).mockResolvedValueOnce(createMockAccount());
    const request = createUploadRequest("contacts.pdf", "data");
    const response = await POST(request);
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toMatch(/invalid file type/i);
  });

  it("returns 400 when file exceeds size limit", async () => {
    vi.mocked(getAuthAccount).mockResolvedValueOnce(createMockAccount());
    const request = createUploadRequest("contacts.csv", "data", 26 * 1024 * 1024);
    const response = await POST(request);
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toMatch(/25MB/i);
  });

  it("returns 400 when CSV has no data rows", async () => {
    vi.mocked(getAuthAccount).mockResolvedValueOnce(createMockAccount());
    vi.mocked(ContactService.parseCSV).mockReturnValueOnce([]);

    const request = createUploadRequest("contacts.csv", "header\n");
    const response = await POST(request);
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toMatch(/no data rows/i);
  });

  it("returns 400 when CSV parsing fails", async () => {
    vi.mocked(getAuthAccount).mockResolvedValueOnce(createMockAccount());
    vi.mocked(ContactService.parseCSV).mockImplementationOnce(() => {
      throw new Error("Missing required column: first name");
    });

    const request = createUploadRequest("contacts.csv", "bad,data\n1,2");
    const response = await POST(request);
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toMatch(/missing required column/i);
  });

  it("uploads CSV successfully and returns count and errors", async () => {
    vi.mocked(getAuthAccount).mockResolvedValueOnce(createMockAccount());
    vi.mocked(ContactService.parseCSV).mockReturnValueOnce([
      { firstName: "John", lastName: "Doe", businessWebsite: "example.com" },
    ] as any);
    vi.mocked(ContactService.bulkCreate).mockResolvedValueOnce({
      count: 1,
      errors: [],
    });

    const request = createUploadRequest(
      "contacts.csv",
      "first name,last name,business website\nJohn,Doe,example.com",
    );
    const response = await POST(request);

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.count).toBe(1);
    expect(data.errors).toEqual([]);
    expect(ContactService.bulkCreate).toHaveBeenCalledWith("acc-123", expect.any(Array));
  });

  it("returns validation errors from bulkCreate", async () => {
    vi.mocked(getAuthAccount).mockResolvedValueOnce(createMockAccount());
    vi.mocked(ContactService.parseCSV).mockReturnValueOnce([
      { firstName: "", lastName: "Doe" },
    ] as any);
    vi.mocked(ContactService.bulkCreate).mockResolvedValueOnce({
      count: 0,
      errors: [{ row: 2, message: "Missing first name or last name" }],
    });

    const request = createUploadRequest("contacts.csv", "first name,last name\n,Doe");
    const response = await POST(request);

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.count).toBe(0);
    expect(data.errors).toHaveLength(1);
    expect(data.errors[0].row).toBe(2);
  });

  it("returns 500 on unexpected error", async () => {
    vi.mocked(getAuthAccount).mockResolvedValueOnce(createMockAccount());
    vi.mocked(ContactService.parseCSV).mockReturnValueOnce([{ firstName: "J", lastName: "D", businessWebsite: "x.com" }] as any);
    vi.mocked(ContactService.bulkCreate).mockRejectedValueOnce(new Error("DB error"));

    const request = createUploadRequest("contacts.csv", "first name,last name\nJ,D");
    const response = await POST(request);
    expect(response.status).toBe(500);
  });
});
