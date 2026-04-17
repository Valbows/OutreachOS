import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockAccount, createMockRequest } from "@/test/api-helpers";

vi.mock("@/lib/auth/session", () => ({
  getAuthAccount: vi.fn(),
}));

vi.mock("@outreachos/services", () => ({
  BlogService: {
    getById: vi.fn(),
  },
}));

import { getAuthAccount } from "@/lib/auth/session";
import { BlogService } from "@outreachos/services";
import { GET } from "./route";

const params = Promise.resolve({ slug: "p1" });

const mockPost = {
  id: "p1",
  accountId: "acc-123",
  title: "Hello World",
  slug: "hello-world",
  content: "# Hello\n\nThis is **bold** text.",
  tags: ["marketing"],
  author: "Jane Doe",
  metaDescription: "A test post",
  ogImage: null,
  publishedAt: new Date("2025-01-15T10:00:00Z"),
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe("GET /api/blog/[slug]/export", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    vi.mocked(getAuthAccount).mockResolvedValueOnce(null);

    const response = await GET(
      createMockRequest("http://localhost/api/blog/p1/export?format=markdown"),
      { params },
    );

    expect(response.status).toBe(401);
  });

  it("returns 400 for invalid format", async () => {
    vi.mocked(getAuthAccount).mockResolvedValueOnce(createMockAccount());

    const response = await GET(
      createMockRequest("http://localhost/api/blog/p1/export?format=pdf"),
      { params },
    );

    expect(response.status).toBe(400);
  });

  it("returns 404 when post not found", async () => {
    vi.mocked(getAuthAccount).mockResolvedValueOnce(createMockAccount());
    vi.mocked(BlogService.getById).mockResolvedValueOnce(null as any);

    const response = await GET(
      createMockRequest("http://localhost/api/blog/p1/export?format=markdown"),
      { params },
    );

    expect(response.status).toBe(404);
  });

  it("exports markdown with frontmatter and content", async () => {
    vi.mocked(getAuthAccount).mockResolvedValueOnce(createMockAccount());
    vi.mocked(BlogService.getById).mockResolvedValueOnce(mockPost as any);

    const response = await GET(
      createMockRequest("http://localhost/api/blog/p1/export?format=markdown"),
      { params },
    );
    const text = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/markdown");
    expect(response.headers.get("content-disposition")).toContain("hello-world.md");
    expect(text).toContain("---");
    expect(text).toContain('title: "Hello World"');
    expect(text).toContain("slug: hello-world");
    expect(text).toContain("# Hello");
  });

  it("exports html with full document structure", async () => {
    vi.mocked(getAuthAccount).mockResolvedValueOnce(createMockAccount());
    vi.mocked(BlogService.getById).mockResolvedValueOnce(mockPost as any);

    const response = await GET(
      createMockRequest("http://localhost/api/blog/p1/export?format=html"),
      { params },
    );
    const text = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/html");
    expect(response.headers.get("content-disposition")).toContain("hello-world.html");
    expect(text).toContain("<!DOCTYPE html>");
    expect(text).toContain("<h1>Hello World</h1>");
    expect(text).toContain("<h1>Hello</h1>");
  });

  it("exports json with full post data", async () => {
    vi.mocked(getAuthAccount).mockResolvedValueOnce(createMockAccount());
    vi.mocked(BlogService.getById).mockResolvedValueOnce(mockPost as any);

    const response = await GET(
      createMockRequest("http://localhost/api/blog/p1/export?format=json"),
      { params },
    );
    const text = await response.text();
    const parsed = JSON.parse(text);

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/json");
    expect(response.headers.get("content-disposition")).toContain("hello-world.json");
    expect(parsed.id).toBe("p1");
    expect(parsed.title).toBe("Hello World");
  });

  it("defaults to markdown when no format given", async () => {
    vi.mocked(getAuthAccount).mockResolvedValueOnce(createMockAccount());
    vi.mocked(BlogService.getById).mockResolvedValueOnce(mockPost as any);

    const response = await GET(
      createMockRequest("http://localhost/api/blog/p1/export"),
      { params },
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/markdown");
  });
});
