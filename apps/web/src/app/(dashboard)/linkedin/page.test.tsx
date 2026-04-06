import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import LinkedInPlaybookPage from "./page";

const mockUseLinkedInPlaybook = vi.fn();
const mockGenerateMutateAsync = vi.fn();
const mockBatchGenerateMutateAsync = vi.fn();
const mockRegenerateMutateAsync = vi.fn();
const mockStatusMutateAsync = vi.fn();
const mockDeleteMutateAsync = vi.fn();
const writeText = vi.fn();

vi.mock("@/lib/hooks/use-linkedin", () => ({
  useLinkedInPlaybook: () => mockUseLinkedInPlaybook(),
  useGenerateLinkedInCopy: () => ({ mutateAsync: mockGenerateMutateAsync, isPending: false, isError: false, error: null }),
  useBatchGenerateLinkedInCopy: () => ({ mutateAsync: mockBatchGenerateMutateAsync, isPending: false }),
  useRegenerateLinkedInCopy: () => ({ mutateAsync: mockRegenerateMutateAsync, isPending: false }),
  useUpdatePlaybookStatus: () => ({ mutateAsync: mockStatusMutateAsync, isPending: false }),
  useDeletePlaybookEntry: () => ({ mutateAsync: mockDeleteMutateAsync, isPending: false }),
}));

vi.mock("@/lib/hooks/use-contacts", () => ({
  useContactGroups: () => ({ data: undefined, isLoading: false }),
  useContacts: () => ({ data: undefined, isLoading: false }),
}));

beforeEach(() => {
  vi.clearAllMocks();
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText },
  });
  mockUseLinkedInPlaybook.mockReturnValue({ data: { entries: [], total: 0 }, isLoading: false, error: null });
});

describe("LinkedInPlaybookPage", () => {
  it("renders loading, error, and empty states", () => {
    mockUseLinkedInPlaybook.mockReturnValueOnce({ data: null, isLoading: true, error: null });
    const { rerender } = render(<LinkedInPlaybookPage />);
    expect(document.querySelector(".animate-spin")).toBeInTheDocument();

    mockUseLinkedInPlaybook.mockReturnValueOnce({ data: null, isLoading: false, error: new Error("boom") });
    rerender(<LinkedInPlaybookPage />);
    expect(screen.getByText(/failed to load playbook entries/i)).toBeInTheDocument();

    mockUseLinkedInPlaybook.mockReturnValueOnce({ data: { entries: [], total: 0 }, isLoading: false, error: null });
    rerender(<LinkedInPlaybookPage />);
    expect(screen.getByText(/no linkedin copy generated yet/i)).toBeInTheDocument();
  });

  it("opens the generate panel and creates a new entry", async () => {
    const user = userEvent.setup();
    mockGenerateMutateAsync.mockResolvedValueOnce({
      id: "li1",
      status: "generated",
      generatedCopy: "Congrats on the launch.",
      prompt: "Mention launch",
      createdAt: "2024-01-01T00:00:00.000Z",
    });

    render(<LinkedInPlaybookPage />);

    await user.click(screen.getByRole("button", { name: /generate copy/i }));
    await user.type(screen.getByLabelText(/prompt instructions/i), "Mention launch");
    await user.type(screen.getByLabelText(/research notes/i), "Raised Series A");
    await user.click(screen.getByRole("button", { name: /^generate$/i }));

    await waitFor(() => {
      expect(mockGenerateMutateAsync).toHaveBeenCalledWith({
        prompt: "Mention launch",
        researchNotes: "Raised Series A",
      });
    });
    expect(screen.getByText(/copy preview/i)).toBeInTheDocument();
    expect(screen.getByText(/congrats on the launch/i)).toBeInTheDocument();
  });

  it("selects an entry and performs preview actions", async () => {
    const user = userEvent.setup();
    mockUseLinkedInPlaybook.mockReturnValue({
      data: {
        entries: [
          {
            id: "li1",
            status: "generated",
            generatedCopy: "Personalized intro message for a prospect.",
            prompt: "Personalized intro",
            createdAt: "2024-01-01T00:00:00.000Z",
          },
        ],
        total: 1,
      },
      isLoading: false,
      error: null,
    });
    mockRegenerateMutateAsync.mockResolvedValueOnce({
      id: "li1",
      status: "generated",
      generatedCopy: "Updated regenerated message.",
      prompt: "Personalized intro",
      createdAt: "2024-01-01T00:00:00.000Z",
    });
    mockStatusMutateAsync.mockResolvedValueOnce({
      id: "li1",
      status: "sent",
      generatedCopy: "Updated regenerated message.",
      prompt: "Personalized intro",
      createdAt: "2024-01-01T00:00:00.000Z",
    });
    mockDeleteMutateAsync.mockResolvedValueOnce(undefined);
    writeText.mockResolvedValueOnce(undefined);

    render(<LinkedInPlaybookPage />);

    await user.click(screen.getByRole("button", { name: /personalized intro message for a prospect/i }));
    expect(screen.getByText(/prompt used/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /copy to clipboard/i }));
    await waitFor(() => expect(screen.getByRole("button", { name: /copied!/i })).toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: /regenerate/i }));
    await waitFor(() => expect(screen.getByText(/updated regenerated message/i)).toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: /mark as sent/i }));
    await waitFor(() => expect(screen.queryByRole("button", { name: /mark as sent/i })).not.toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: /delete/i }));
    await waitFor(() => expect(screen.getByText(/select an entry to preview/i)).toBeInTheDocument());
  });

  it("logs when copy generation fails", async () => {
    const user = userEvent.setup();
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    mockGenerateMutateAsync.mockRejectedValueOnce(new Error("Generate failed"));

    render(<LinkedInPlaybookPage />);

    await user.click(screen.getByRole("button", { name: /generate copy/i }));
    await user.type(screen.getByLabelText(/prompt instructions/i), "Mention launch");
    await user.click(screen.getByRole("button", { name: /^generate$/i }));

    await waitFor(() => expect(consoleErrorSpy).toHaveBeenCalled());
    expect(screen.getByText(/generate linkedin copy/i)).toBeInTheDocument();
    consoleErrorSpy.mockRestore();
  });
});
