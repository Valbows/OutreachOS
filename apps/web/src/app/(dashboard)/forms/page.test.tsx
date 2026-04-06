import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import FormsDashboardPage from "./page";

const mockPush = vi.fn();
const mockUseForms = vi.fn();
const mockMutate = vi.fn();
const mockUseDeleteForm = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

vi.mock("@/lib/hooks/use-forms", () => ({
  useForms: () => mockUseForms(),
  useDeleteForm: () => mockUseDeleteForm(),
}));

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("confirm", vi.fn(() => true));
  mockUseForms.mockReturnValue({ data: [], isLoading: false, error: null });
  mockUseDeleteForm.mockReturnValue({
    mutate: mockMutate,
    isPending: false,
    isError: false,
    error: null,
  });
});

describe("FormsDashboardPage", () => {
  it("renders the empty state and navigates to create page", async () => {
    const user = userEvent.setup();
    render(<FormsDashboardPage />);

    expect(screen.getByText("No forms yet")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /create your first form/i }));

    expect(mockPush).toHaveBeenCalledWith("/forms/new");
  });

  it("renders the loading state", () => {
    mockUseForms.mockReturnValue({ data: undefined, isLoading: true, error: null });

    render(<FormsDashboardPage />);

    expect(document.querySelector(".animate-spin")).toBeInTheDocument();
  });

  it("renders the error state", () => {
    mockUseForms.mockReturnValue({ data: undefined, isLoading: false, error: new Error("boom") });

    render(<FormsDashboardPage />);

    expect(screen.getByText(/failed to load forms/i)).toBeInTheDocument();
  });

  it("renders forms and deletes after confirmation", async () => {
    const user = userEvent.setup();
    mockUseForms.mockReturnValue({
      data: [
        { id: "f1", name: "Newsletter", type: "inline_banner", fields: [{ name: "email" }], submissionCount: 3 },
      ],
      isLoading: false,
      error: null,
    });

    render(<FormsDashboardPage />);

    expect(screen.getByText("Newsletter")).toBeInTheDocument();
    expect(screen.getByText("inline banner")).toBeInTheDocument();
    expect(screen.getByText(/1 fields · 3 submissions/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /delete form newsletter/i }));

    expect(globalThis.confirm).toHaveBeenCalledWith("Delete this form?");
    expect(mockMutate).toHaveBeenCalledWith("f1");
  });

  it("does not delete when confirmation is cancelled", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("confirm", vi.fn(() => false));
    mockUseForms.mockReturnValue({
      data: [{ id: "f1", name: "Newsletter", type: "minimal", fields: [], submissionCount: 0 }],
      isLoading: false,
      error: null,
    });

    render(<FormsDashboardPage />);

    await user.click(screen.getByRole("button", { name: /delete form newsletter/i }));

    expect(mockMutate).not.toHaveBeenCalled();
  });

  it("shows delete mutation error and pending state", () => {
    mockUseForms.mockReturnValue({
      data: [{ id: "f1", name: "Newsletter", type: "minimal", fields: [], submissionCount: 0 }],
      isLoading: false,
      error: null,
    });
    mockUseDeleteForm.mockReturnValue({
      mutate: mockMutate,
      isPending: true,
      isError: true,
      error: new Error("Nope"),
    });

    render(<FormsDashboardPage />);

    expect(screen.getByRole("button", { name: /delete form newsletter/i })).toBeDisabled();
    expect(screen.getByText(/delete failed: nope/i)).toBeInTheDocument();
    expect(screen.getByText("Deleting...")).toBeInTheDocument();
  });
});
