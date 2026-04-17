import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockAccount, createMockRequest } from "@/test/api-helpers";

vi.mock("@/lib/auth/session", () => ({
  getAuthAccount: vi.fn(),
}));

vi.mock("@outreachos/services", () => ({
  BlogService: {
    list: vi.fn(),
  },
}));

import { getAuthAccount } from "@/lib/auth/session";
import { BlogService } from "@outreachos/services";
import { GET } from "./route";

describe("GET /api/blog/export", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    vi.mocked(getAuthAccount).mockResolvedValueOnce(null);

    const response = await GET(createMockRequest("http://localhost/api/blog/export"));

    expect(response.status).toBe(401);
  });

  it("returns JSON file with all posts", async () => {
    vi.mocked(getAuthAccount).mockResolvedValueOnce(createMockAccount());
    vi.mocked(BlogService.list).mockResolvedValueOnce([
      { id: "p1", title: "Post One", slug: "post-one" },
      { id: "p2", title: "Post Two", slug: "post-two" },
    ] as any);

    const response = await GET(createMockRequest("http://localhost/api/blog/export"));
    const text = await response.text();
    const parsed = JSON.parse(text);

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/json");
    expect(response.headers.get("content-disposition")).toContain("blog-export-");
    expect(response.headers.get("content-disposition")).toContain(".json");
    expect(parsed.posts).toHaveLength(2);
    expect(parsed.exportedAt).toBeDefined();
  });

  it("returns empty posts array when no posts exist", async () => {
    vi.mocked(getAuthAccount).mockResolvedValueOnce(createMockAccount());
    vi.mocked(BlogService.list).mockResolvedValueOnce([]);

    const response = await GET(createMockRequest("http://localhost/api/blog/export"));
    const text = await response.text();
    const parsed = JSON.parse(text);

    expect(response.status).toBe(200);
    expect(parsed.posts).toHaveLength(0);
  });

  it("calls BlogService.list with account id", async () => {
    vi.mocked(getAuthAccount).mockResolvedValueOnce(createMockAccount());
    vi.mocked(BlogService.list).mockResolvedValueOnce([]);

    await GET(createMockRequest("http://localhost/api/blog/export"));

    expect(BlogService.list).toHaveBeenCalledWith("acc-123");
  });
});
