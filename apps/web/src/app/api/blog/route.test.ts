import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockAccount, createMockRequest } from "@/test/api-helpers";

vi.mock("@/lib/auth/session", () => ({
  getAuthAccount: vi.fn(),
}));

vi.mock("@outreachos/services", () => ({
  BlogService: {
    list: vi.fn(),
    listPublished: vi.fn(),
    create: vi.fn(),
  },
}));

import { getAuthAccount } from "@/lib/auth/session";
import { BlogService } from "@outreachos/services";
import { GET, POST } from "./route";

describe("GET /api/blog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("lists published posts when public=true", async () => {
    vi.mocked(BlogService.listPublished).mockResolvedValueOnce([{ id: "p1", title: "Hello" }] as any);

    const response = await GET(createMockRequest("http://localhost/api/blog?public=true"));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(BlogService.listPublished).toHaveBeenCalledWith(20, 0);
    expect(data.data).toHaveLength(1);
  });

  it("respects limit and offset for public posts", async () => {
    vi.mocked(BlogService.listPublished).mockResolvedValueOnce([]);

    await GET(createMockRequest("http://localhost/api/blog?public=true&limit=10&offset=5"));

    expect(BlogService.listPublished).toHaveBeenCalledWith(10, 5);
  });

  it("clamps limit to max 100", async () => {
    vi.mocked(BlogService.listPublished).mockResolvedValueOnce([]);

    await GET(createMockRequest("http://localhost/api/blog?public=true&limit=500"));

    expect(BlogService.listPublished).toHaveBeenCalledWith(100, 0);
  });

  it("returns 401 when not authenticated for private list", async () => {
    vi.mocked(getAuthAccount).mockResolvedValueOnce(null);

    const response = await GET(createMockRequest("http://localhost/api/blog"));

    expect(response.status).toBe(401);
  });

  it("lists all posts for authenticated user", async () => {
    vi.mocked(getAuthAccount).mockResolvedValueOnce(createMockAccount());
    vi.mocked(BlogService.list).mockResolvedValueOnce([{ id: "p1" }] as any);

    const response = await GET(createMockRequest("http://localhost/api/blog"));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(BlogService.list).toHaveBeenCalledWith("acc-123");
    expect(data.data).toHaveLength(1);
  });
});

describe("POST /api/blog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    vi.mocked(getAuthAccount).mockResolvedValueOnce(null);

    const response = await POST(createMockRequest("http://localhost/api/blog", { method: "POST" }));

    expect(response.status).toBe(401);
  });

  it("returns 400 on invalid json", async () => {
    vi.mocked(getAuthAccount).mockResolvedValueOnce(createMockAccount());
    const request = createMockRequest("http://localhost/api/blog", { method: "POST" });
    vi.mocked(request.json).mockRejectedValueOnce(new Error("bad json"));

    const response = await POST(request);

    expect(response.status).toBe(400);
  });

  it("returns 400 on validation failure", async () => {
    vi.mocked(getAuthAccount).mockResolvedValueOnce(createMockAccount());

    const response = await POST(
      createMockRequest("http://localhost/api/blog", {
        method: "POST",
        body: JSON.stringify({ title: "", slug: "invalid slug!", content: "" }),
      }),
    );

    expect(response.status).toBe(400);
  });

  it("creates a blog post", async () => {
    vi.mocked(getAuthAccount).mockResolvedValueOnce(createMockAccount());
    vi.mocked(BlogService.create).mockResolvedValueOnce({ id: "p1", title: "Hello World" } as any);

    const response = await POST(
      createMockRequest("http://localhost/api/blog", {
        method: "POST",
        body: JSON.stringify({ title: "Hello World", slug: "hello-world", content: "Test content" }),
      }),
    );
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(BlogService.create).toHaveBeenCalledWith({
      accountId: "acc-123",
      title: "Hello World",
      slug: "hello-world",
      content: "Test content",
      publishedAt: undefined,
    });
    expect(data.data.id).toBe("p1");
  });
});
