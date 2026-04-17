import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { BlogPostEditor } from "./BlogPostEditor";

vi.mock("@/components/ui", () => ({
  Button: ({
    children,
    onClick,
    disabled,
    type,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    disabled?: boolean;
    type?: string;
  }) => (
    <button onClick={onClick} disabled={disabled} type={(type as "button" | "submit" | "reset") ?? "button"}>
      {children}
    </button>
  ),
}));

describe("BlogPostEditor", () => {
  const mockOnSubmit = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockOnSubmit.mockResolvedValue(undefined);
  });

  it("renders empty form fields", () => {
    render(<BlogPostEditor onSubmit={mockOnSubmit} />);

    expect(screen.getByLabelText(/title/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/slug/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/content/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/author/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/meta description/i)).toBeInTheDocument();
  });

  it("populates fields from initialValues", () => {
    render(
      <BlogPostEditor
        onSubmit={mockOnSubmit}
        initialValues={{
          title: "Existing Title",
          slug: "existing-title",
          content: "# Content",
          author: "Jane Doe",
          tags: "marketing, tips",
          metaDescription: "A great post",
          ogImage: "",
          publishedAt: null,
        }}
      />,
    );

    expect(screen.getByLabelText(/title/i)).toHaveValue("Existing Title");
    expect(screen.getByLabelText(/slug/i)).toHaveValue("existing-title");
    expect(screen.getByLabelText(/author/i)).toHaveValue("Jane Doe");
  });

  it("auto-generates slug from title when slug not touched", async () => {
    const user = userEvent.setup();
    render(<BlogPostEditor onSubmit={mockOnSubmit} />);

    await user.type(screen.getByLabelText(/title/i), "Hello World Post");

    expect(screen.getByLabelText(/slug/i)).toHaveValue("hello-world-post");
  });

  it("does not override manually-set slug when title changes", async () => {
    const user = userEvent.setup();
    render(<BlogPostEditor onSubmit={mockOnSubmit} />);

    const slugInput = screen.getByLabelText(/slug/i);
    await user.type(slugInput, "my-custom-slug");
    await user.type(screen.getByLabelText(/title/i), "Something Else");

    expect(slugInput).toHaveValue("my-custom-slug");
  });

  it("shows validation error when title is empty", async () => {
    const user = userEvent.setup();
    render(<BlogPostEditor onSubmit={mockOnSubmit} submitLabel="Save draft" />);

    await user.click(screen.getByRole("button", { name: /save draft/i }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument();
      expect(screen.getByText(/title is required/i)).toBeInTheDocument();
    });
    expect(mockOnSubmit).not.toHaveBeenCalled();
  });

  it("shows validation error when content is empty", async () => {
    const user = userEvent.setup();
    render(<BlogPostEditor onSubmit={mockOnSubmit} submitLabel="Save draft" />);

    await user.type(screen.getByLabelText(/title/i), "My Title");
    await user.click(screen.getByRole("button", { name: /save draft/i }));

    await waitFor(() => {
      expect(screen.getByText(/content is required/i)).toBeInTheDocument();
    });
  });

  it("shows validation error for invalid slug format", async () => {
    const user = userEvent.setup();
    render(<BlogPostEditor onSubmit={mockOnSubmit} submitLabel="Save draft" />);

    await user.type(screen.getByLabelText(/title/i), "My Title");
    const slugInput = screen.getByLabelText(/slug/i);
    await user.clear(slugInput);
    await user.type(slugInput, "Invalid Slug!");
    await user.type(screen.getByLabelText(/content/i), "Some content");
    await user.click(screen.getByRole("button", { name: /save draft/i }));

    await waitFor(() => {
      expect(screen.getByText(/slug must be lowercase/i)).toBeInTheDocument();
    });
  });

  it("calls onSubmit with correct values on save", async () => {
    const user = userEvent.setup();
    render(<BlogPostEditor onSubmit={mockOnSubmit} submitLabel="Save draft" />);

    await user.type(screen.getByLabelText(/title/i), "My Post");
    await user.type(screen.getByLabelText(/content/i), "Post body text");
    await user.type(screen.getByLabelText(/author/i), "Jane");
    await user.type(screen.getByLabelText(/tags/i), "a, b");

    await user.click(screen.getByRole("button", { name: /save draft/i }));

    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "My Post",
          content: "Post body text",
          author: "Jane",
          tags: ["a", "b"],
        }),
      );
    });
  });

  it("calls onSubmit with publishedAt set when Save & Publish clicked", async () => {
    const user = userEvent.setup();
    render(<BlogPostEditor onSubmit={mockOnSubmit} submitLabel="Save draft" />);

    await user.type(screen.getByLabelText(/title/i), "My Post");
    await user.type(screen.getByLabelText(/content/i), "Content here");

    await user.click(screen.getByRole("button", { name: /save & publish/i }));

    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          publishedAt: expect.stringMatching(/\d{4}-\d{2}-\d{2}T/),
        }),
      );
    });
  });

  it("switches to preview tab and renders html", async () => {
    const user = userEvent.setup();
    render(<BlogPostEditor onSubmit={mockOnSubmit} />);

    await user.type(screen.getByLabelText(/content/i), "# Preview Heading");
    await user.click(screen.getByRole("tab", { name: /preview/i }));

    const preview = screen.getByTestId("markdown-preview");
    expect(preview.innerHTML).toContain("<h1>");
    expect(preview.innerHTML).toContain("Preview Heading");
  });

  it("shows export links when postId is provided", () => {
    render(<BlogPostEditor onSubmit={mockOnSubmit} postId="abc123" />);

    expect(screen.getByText("Markdown")).toBeInTheDocument();
    expect(screen.getByText("HTML")).toBeInTheDocument();
    expect(screen.getByText("JSON")).toBeInTheDocument();

    const mdLink = screen.getByText("Markdown").closest("a");
    expect(mdLink).toHaveAttribute("href", "/api/blog/abc123/export?format=markdown");
  });

  it("does not show export section without postId", () => {
    render(<BlogPostEditor onSubmit={mockOnSubmit} />);
    expect(screen.queryByText("Markdown")).not.toBeInTheDocument();
  });

  it("shows published status when initialValues has publishedAt", () => {
    render(
      <BlogPostEditor
        onSubmit={mockOnSubmit}
        initialValues={{
          title: "Published",
          slug: "published",
          content: "Content",
          publishedAt: "2025-01-01T10:00:00.000Z",
        }}
      />,
    );

    expect(screen.getByTestId("publish-status")).toHaveTextContent("Published");
    expect(screen.getByRole("button", { name: /unpublish/i })).toBeInTheDocument();
  });

  it("shows draft status when initialValues has no publishedAt", () => {
    render(
      <BlogPostEditor
        onSubmit={mockOnSubmit}
        initialValues={{
          title: "Draft",
          slug: "draft",
          content: "Content",
          publishedAt: null,
        }}
      />,
    );

    expect(screen.getByTestId("publish-status")).toHaveTextContent("Draft");
    expect(screen.getByRole("button", { name: /save & publish/i })).toBeInTheDocument();
  });

  it("shows error from onSubmit rejection", async () => {
    mockOnSubmit.mockRejectedValueOnce(new Error("Server error"));
    const user = userEvent.setup();
    render(<BlogPostEditor onSubmit={mockOnSubmit} submitLabel="Save draft" />);

    await user.type(screen.getByLabelText(/title/i), "Title");
    await user.type(screen.getByLabelText(/content/i), "Body");
    await user.click(screen.getByRole("button", { name: /save draft/i }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument();
      expect(screen.getByText(/server error/i)).toBeInTheDocument();
    });
  });
});
