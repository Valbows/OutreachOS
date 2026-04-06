import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import TemplatesPage from "./page";

const mockPush = vi.fn();
const mockUseTemplates = vi.fn();
const mockMutate = vi.fn();
const mockMutateAsync = vi.fn();
const mockUseDeleteTemplate = vi.fn();
const mockUseCreateTemplate = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

vi.mock("@/lib/hooks/use-templates", () => ({
  useTemplates: () => mockUseTemplates(),
  useDeleteTemplate: () => mockUseDeleteTemplate(),
  useCreateTemplate: () => mockUseCreateTemplate(),
}));

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("confirm", vi.fn(() => true));
  mockUseTemplates.mockReturnValue({ data: [], isLoading: false });
  mockUseDeleteTemplate.mockReturnValue({ mutate: mockMutate });
  mockUseCreateTemplate.mockReturnValue({ mutateAsync: mockMutateAsync, isPending: false });
});

describe("TemplatesPage", () => {
  it("renders loading state", () => {
    mockUseTemplates.mockReturnValue({ data: undefined, isLoading: true });

    render(<TemplatesPage />);

    expect(document.querySelector(".animate-spin")).toBeInTheDocument();
  });

  it("renders empty state and opens the create dialog", async () => {
    const user = userEvent.setup();
    render(<TemplatesPage />);

    expect(screen.getByText(/no templates yet/i)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /create template/i }));

    expect(screen.getByPlaceholderText(/template name/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^create$/i })).toBeDisabled();
  });

  it("creates a template and navigates to edit", async () => {
    const user = userEvent.setup();
    mockMutateAsync.mockResolvedValueOnce({ data: { id: "t1" } });

    render(<TemplatesPage />);

    await user.click(screen.getByRole("button", { name: /new template/i }));
    await user.type(screen.getByPlaceholderText(/template name/i), "Welcome Sequence");
    fireEvent.keyDown(screen.getByPlaceholderText(/template name/i), { key: "Enter" });

    await waitFor(() => expect(mockMutateAsync).toHaveBeenCalledWith({ name: "Welcome Sequence" }));
    expect(mockPush).toHaveBeenCalledWith("/templates/t1/edit");
    expect(screen.queryByPlaceholderText(/template name/i)).not.toBeInTheDocument();
  });

  it("renders template cards and deletes after confirmation", async () => {
    const user = userEvent.setup();
    mockUseTemplates.mockReturnValue({
      data: [
        {
          id: "t1",
          name: "Welcome Sequence",
          subject: "Welcome aboard",
          version: 3,
          tokens: ["firstName", "company", "role", "cta", "city"],
          updatedAt: "2024-01-10T00:00:00.000Z",
        },
      ],
      isLoading: false,
    });

    render(<TemplatesPage />);

    expect(screen.getByText("Welcome Sequence")).toBeInTheDocument();
    expect(screen.getByText(/welcome aboard/i)).toBeInTheDocument();
    expect(screen.getByText("{firstName}")).toBeInTheDocument();
    expect(screen.getByText("+1 more")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /delete/i }));

    expect(globalThis.confirm).toHaveBeenCalledWith("Delete this template?");
    expect(mockMutate).toHaveBeenCalledWith("t1");
  });

  it("cancels create dialog without creating", async () => {
    const user = userEvent.setup();
    render(<TemplatesPage />);

    await user.click(screen.getByRole("button", { name: /new template/i }));
    await user.type(screen.getByPlaceholderText(/template name/i), "Draft");
    await user.click(screen.getByRole("button", { name: /cancel/i }));

    expect(mockMutateAsync).not.toHaveBeenCalled();
    expect(screen.queryByPlaceholderText(/template name/i)).not.toBeInTheDocument();
  });
});
