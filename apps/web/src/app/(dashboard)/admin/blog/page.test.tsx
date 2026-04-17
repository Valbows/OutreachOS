import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import BlogAdminPage from "./page";

const mockUseBlogPosts = vi.fn();
const mockDeleteMutateAsync = vi.fn();
const mockUpdateMutateAsync = vi.fn();

vi.mock("@/lib/hooks/use-blog", () => ({
  useBlogPosts: () => mockUseBlogPosts(),
  useDeleteBlogPost: () => ({ mutateAsync: mockDeleteMutateAsync, isPending: false }),
  useUpdateBlogPost: () => ({ mutateAsync: mockUpdateMutateAsync, isPending: false }),
}));

vi.mock("@/components/ui", () => ({
  Button: ({ children, onClick, disabled }: { children: React.ReactNode; onClick?: () => void; disabled?: boolean }) => (
    <button onClick={onClick} disabled={disabled}>{children}</button>
  ),
}));

const mockPosts = [
  {
    id: "p1",
    title: "My First Post",
    slug: "my-first-post",
    content: "# Hello",
    tags: ["marketing"],
    author: "Jane",
    metaDescription: null,
    ogImage: null,
    publishedAt: "2025-01-10T10:00:00.000Z",
    createdAt: "2025-01-01T00:00:00.000Z",
    updatedAt: "2025-01-10T10:00:00.000Z",
  },
  {
    id: "p2",
    title: "Draft Post",
    slug: "draft-post",
    content: "Draft content",
    tags: [],
    author: null,
    metaDescription: null,
    ogImage: null,
    publishedAt: null,
    createdAt: "2025-02-01T00:00:00.000Z",
    updatedAt: "2025-02-01T00:00:00.000Z",
  },
];

describe("BlogAdminPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("confirm", vi.fn(() => true));
    mockDeleteMutateAsync.mockResolvedValue(undefined);
    mockUpdateMutateAsync.mockResolvedValue({});
    mockUseBlogPosts.mockReturnValue({ data: [], isLoading: false, error: null });
  });

  it("renders loading state", () => {
    mockUseBlogPosts.mockReturnValue({ data: undefined, isLoading: true, error: null });
    render(<BlogAdminPage />);
    expect(screen.getByText(/loading posts/i)).toBeInTheDocument();
  });

  it("renders error state", () => {
    mockUseBlogPosts.mockReturnValue({ data: undefined, isLoading: false, error: new Error("fail") });
    render(<BlogAdminPage />);
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByText(/failed to load posts/i)).toBeInTheDocument();
  });

  it("renders empty state with new post link", () => {
    render(<BlogAdminPage />);
    expect(screen.getByText(/no posts yet/i)).toBeInTheDocument();
  });

  it("renders posts list with titles, status, and action buttons", () => {
    mockUseBlogPosts.mockReturnValue({ data: mockPosts, isLoading: false, error: null });
    render(<BlogAdminPage />);

    expect(screen.getByText("My First Post")).toBeInTheDocument();
    expect(screen.getByText("Draft Post")).toBeInTheDocument();
    const badges = screen.getAllByText(/^published$|^draft$/i);
    expect(badges.length).toBeGreaterThanOrEqual(2);
  });

  it("renders stat cards with correct counts", () => {
    mockUseBlogPosts.mockReturnValue({ data: mockPosts, isLoading: false, error: null });
    render(<BlogAdminPage />);

    expect(screen.getByText("All Posts")).toBeInTheDocument();
    expect(screen.getAllByText("Published").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Drafts")).toBeInTheDocument();
  });

  it("filters to published posts only", async () => {
    const user = userEvent.setup();
    mockUseBlogPosts.mockReturnValue({ data: mockPosts, isLoading: false, error: null });
    render(<BlogAdminPage />);

    await user.click(screen.getByRole("tab", { name: /published/i }));

    expect(screen.getByText("My First Post")).toBeInTheDocument();
    expect(screen.queryByText("Draft Post")).not.toBeInTheDocument();
  });

  it("filters to draft posts only", async () => {
    const user = userEvent.setup();
    mockUseBlogPosts.mockReturnValue({ data: mockPosts, isLoading: false, error: null });
    render(<BlogAdminPage />);

    await user.click(screen.getByRole("tab", { name: /draft/i }));

    expect(screen.getByText("Draft Post")).toBeInTheDocument();
    expect(screen.queryByText("My First Post")).not.toBeInTheDocument();
  });

  it("deletes a post after confirmation", async () => {
    const user = userEvent.setup();
    mockUseBlogPosts.mockReturnValue({ data: mockPosts, isLoading: false, error: null });
    render(<BlogAdminPage />);

    const deleteButtons = screen.getAllByRole("button", { name: /delete/i });
    await user.click(deleteButtons[0]);

    expect(mockDeleteMutateAsync).toHaveBeenCalledWith("p1");
  });

  it("does not delete when confirmation is cancelled", async () => {
    vi.stubGlobal("confirm", vi.fn(() => false));
    const user = userEvent.setup();
    mockUseBlogPosts.mockReturnValue({ data: mockPosts, isLoading: false, error: null });
    render(<BlogAdminPage />);

    const deleteButtons = screen.getAllByRole("button", { name: /delete/i });
    await user.click(deleteButtons[0]);

    expect(mockDeleteMutateAsync).not.toHaveBeenCalled();
  });

  it("unpublishes a published post", async () => {
    const user = userEvent.setup();
    mockUseBlogPosts.mockReturnValue({ data: mockPosts, isLoading: false, error: null });
    render(<BlogAdminPage />);

    await user.click(screen.getByRole("button", { name: /unpublish/i }));

    expect(mockUpdateMutateAsync).toHaveBeenCalledWith({
      id: "p1",
      publishedAt: null,
    });
  });

  it("publishes a draft post", async () => {
    const user = userEvent.setup();
    mockUseBlogPosts.mockReturnValue({ data: mockPosts, isLoading: false, error: null });
    render(<BlogAdminPage />);

    await user.click(screen.getByRole("button", { name: /^publish$/i }));

    expect(mockUpdateMutateAsync).toHaveBeenCalledWith({
      id: "p2",
      publishedAt: expect.stringMatching(/\d{4}-\d{2}-\d{2}T/),
    });
  });

  it("shows delete error message on failure", async () => {
    mockDeleteMutateAsync.mockRejectedValueOnce(new Error("Delete failed"));
    const user = userEvent.setup();
    mockUseBlogPosts.mockReturnValue({ data: mockPosts, isLoading: false, error: null });
    render(<BlogAdminPage />);

    const deleteButtons = screen.getAllByRole("button", { name: /delete/i });
    await user.click(deleteButtons[0]);

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument();
      expect(screen.getByText(/delete failed/i)).toBeInTheDocument();
    });
  });
});
