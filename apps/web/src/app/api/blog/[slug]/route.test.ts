import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockAccount, createMockRequest } from "@/test/api-helpers";

vi.mock("@/lib/auth/session", () => ({
  getAuthAccount: vi.fn(),
}));

vi.mock("@outreachos/services", () => ({
  BlogService: {
    getBySlug: vi.fn(),
    getById: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

import { getAuthAccount } from "@/lib/auth/session";
import { BlogService } from "@outreachos/services";
import { GET, PATCH, DELETE } from "./route";

const params = Promise.resolve({ slug: "hello-world" });

describe("GET /api/blog/[slug]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns post by slug", async () => {
    vi.mocked(BlogService.getBySlug).mockResolvedValueOnce({ id: "p1", slug: "hello-world" } as any);

    const response = await GET(createMockRequest("http://localhost/api/blog/hello-world"), { params });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(BlogService.getBySlug).toHaveBeenCalledWith("hello-world");
    expect(data.data.slug).toBe("hello-world");
  });

  it("returns 404 when post not found", async () => {
    vi.mocked(BlogService.getBySlug).mockResolvedValueOnce(null as any);

    const response = await GET(createMockRequest("http://localhost/api/blog/not-found"), { params });

    expect(response.status).toBe(404);
  });

  it("returns 401 when ?admin=true and not authenticated", async () => {
    vi.mocked(getAuthAccount).mockResolvedValueOnce(null);

    const response = await GET(
      createMockRequest("http://localhost/api/blog/p1?admin=true"),
      { params: Promise.resolve({ slug: "p1" }) },
    );

    expect(response.status).toBe(401);
  });

  it("returns post by ID when ?admin=true", async () => {
    vi.mocked(getAuthAccount).mockResolvedValueOnce(createMockAccount());
    vi.mocked(BlogService.getById).mockResolvedValueOnce({ id: "p1", title: "Draft Post" } as any);

    const response = await GET(
      createMockRequest("http://localhost/api/blog/p1?admin=true"),
      { params: Promise.resolve({ slug: "p1" }) },
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(BlogService.getById).toHaveBeenCalledWith("acc-123", "p1");
    expect(data.data.title).toBe("Draft Post");
  });

  it("returns 404 when admin post not found", async () => {
    vi.mocked(getAuthAccount).mockResolvedValueOnce(createMockAccount());
    vi.mocked(BlogService.getById).mockResolvedValueOnce(null as any);

    const response = await GET(
      createMockRequest("http://localhost/api/blog/missing?admin=true"),
      { params: Promise.resolve({ slug: "missing" }) },
    );

    expect(response.status).toBe(404);
  });
});

describe("PATCH /api/blog/[slug]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    vi.mocked(getAuthAccount).mockResolvedValueOnce(null);

    const response = await PATCH(createMockRequest("http://localhost/api/blog/hello-world", { method: "PATCH" }), { params });

    expect(response.status).toBe(401);
  });

  it("returns 400 on invalid json", async () => {
    vi.mocked(getAuthAccount).mockResolvedValueOnce(createMockAccount());
    const request = createMockRequest("http://localhost/api/blog/hello-world", { method: "PATCH" });
    vi.mocked(request.json).mockRejectedValueOnce(new Error("bad json"));

    const response = await PATCH(request, { params });

    expect(response.status).toBe(400);
  });

  it("returns 400 on validation failure", async () => {
    vi.mocked(getAuthAccount).mockResolvedValueOnce(createMockAccount());

    const response = await PATCH(
      createMockRequest("http://localhost/api/blog/hello-world", {
        method: "PATCH",
        body: JSON.stringify({ slug: "invalid slug!" }),
      }),
      { params },
    );

    expect(response.status).toBe(400);
  });

  it("returns 404 when post not found", async () => {
    vi.mocked(getAuthAccount).mockResolvedValueOnce(createMockAccount());
    vi.mocked(BlogService.update).mockResolvedValueOnce(null as any);

    const response = await PATCH(
      createMockRequest("http://localhost/api/blog/hello-world", {
        method: "PATCH",
        body: JSON.stringify({ title: "Updated" }),
      }),
      { params },
    );

    expect(response.status).toBe(404);
  });

  it("updates a blog post", async () => {
    vi.mocked(getAuthAccount).mockResolvedValueOnce(createMockAccount());
    vi.mocked(BlogService.update).mockResolvedValueOnce({ id: "p1", title: "Updated" } as any);

    const response = await PATCH(
      createMockRequest("http://localhost/api/blog/hello-world", {
        method: "PATCH",
        body: JSON.stringify({ title: "Updated" }),
      }),
      { params },
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(BlogService.update).toHaveBeenCalledWith("acc-123", "hello-world", {
      title: "Updated",
      publishedAt: undefined,
    });
    expect(data.data.title).toBe("Updated");
  });
});

describe("DELETE /api/blog/[slug]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    vi.mocked(getAuthAccount).mockResolvedValueOnce(null);

    const response = await DELETE(createMockRequest("http://localhost/api/blog/hello-world", { method: "DELETE" }), { params });

    expect(response.status).toBe(401);
  });

  it("deletes a blog post", async () => {
    vi.mocked(getAuthAccount).mockResolvedValueOnce(createMockAccount());
    vi.mocked(BlogService.delete).mockResolvedValueOnce(undefined);

    const response = await DELETE(createMockRequest("http://localhost/api/blog/hello-world", { method: "DELETE" }), { params });

    expect(response.status).toBe(204);
    expect(BlogService.delete).toHaveBeenCalledWith("acc-123", "hello-world");
  });
});
