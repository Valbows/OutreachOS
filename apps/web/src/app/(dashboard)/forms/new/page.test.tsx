import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ChooseFormTemplatePage from "./page";

const mockPush = vi.fn();
const mockMutateAsync = vi.fn();
const mockUseCreateForm = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

vi.mock("@/lib/hooks/use-forms", () => ({
  useCreateForm: () => mockUseCreateForm(),
}));

beforeEach(() => {
  vi.clearAllMocks();
  mockUseCreateForm.mockReturnValue({
    mutateAsync: mockMutateAsync,
    isPending: false,
    isError: false,
    error: null,
  });
});

describe("ChooseFormTemplatePage", () => {
  it("renders template options and keeps create disabled until complete", () => {
    render(<ChooseFormTemplatePage />);

    expect(screen.getByRole("heading", { name: /choose a template/i })).toBeInTheDocument();
    expect(screen.getByText("Minimal")).toBeInTheDocument();
    expect(screen.getByText("Modal Popup")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /create form/i })).toBeDisabled();
  });

  it("creates a form and navigates to the editor", async () => {
    const user = userEvent.setup();
    mockMutateAsync.mockResolvedValueOnce({ data: { id: "f1" } });

    render(<ChooseFormTemplatePage />);

    await user.type(screen.getByLabelText(/form name/i), "Newsletter Signup");
    await user.click(screen.getByRole("button", { name: /minimal/i }));
    await user.click(screen.getByRole("button", { name: /create form/i }));

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith({
        name: "Newsletter Signup",
        type: "minimal",
        fields: [
          { name: "email", type: "email", required: true, label: "Email Address" },
          { name: "firstName", type: "text", required: false, label: "First Name" },
        ],
      });
      expect(mockPush).toHaveBeenCalledWith("/forms/f1/edit");
    });
  });

  it("shows pending state", () => {
    mockUseCreateForm.mockReturnValue({
      mutateAsync: mockMutateAsync,
      isPending: true,
      isError: false,
      error: null,
    });

    render(<ChooseFormTemplatePage />);

    expect(screen.getByRole("button", { name: /creating/i })).toBeDisabled();
  });

  it("renders error message from mutation state", () => {
    mockUseCreateForm.mockReturnValue({
      mutateAsync: mockMutateAsync,
      isPending: false,
      isError: true,
      error: new Error("Creation failed"),
    });

    render(<ChooseFormTemplatePage />);

    expect(screen.getByText("Creation failed")).toBeInTheDocument();
  });
});
