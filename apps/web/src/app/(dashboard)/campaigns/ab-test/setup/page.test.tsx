import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ABTestSetupPage from "./page";

const mockPush = vi.fn();
const mockBack = vi.fn();
const mockGet = vi.fn();
const mockMutateAsync = vi.fn();
const mockUseContactGroups = vi.fn();
const mockUseUpdateCampaign = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, back: mockBack }),
  useSearchParams: () => ({ get: mockGet }),
}));

vi.mock("@/lib/hooks/use-contacts", () => ({
  useContactGroups: () => mockUseContactGroups(),
}));

vi.mock("@/lib/hooks/use-campaigns", () => ({
  useUpdateCampaign: () => mockUseUpdateCampaign(),
}));

beforeEach(() => {
  vi.clearAllMocks();
  mockGet.mockReturnValue("cmp1");
  mockUseContactGroups.mockReturnValue({
    data: [{ id: "g1", name: "Customers", description: "Paying customers" }],
    isLoading: false,
    error: null,
  });
  mockUseUpdateCampaign.mockReturnValue({ mutateAsync: mockMutateAsync, isPending: false });
});

describe("ABTestSetupPage", () => {
  it("renders missing campaign state", async () => {
    const user = userEvent.setup();
    mockGet.mockReturnValueOnce("");

    render(<ABTestSetupPage />);

    expect(screen.getByText(/missing campaign id/i)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /go to campaigns/i }));
    expect(mockPush).toHaveBeenCalledWith("/campaigns");
  });

  it("renders loading, error, and empty group states", () => {
    mockUseContactGroups.mockReturnValueOnce({ data: null, isLoading: true, error: null });
    const { rerender } = render(<ABTestSetupPage />);
    expect(document.querySelector(".animate-spin")).toBeInTheDocument();

    mockUseContactGroups.mockReturnValueOnce({ data: null, isLoading: false, error: new Error("boom") });
    rerender(<ABTestSetupPage />);
    expect(screen.getByText(/failed to load contact groups/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /retry/i })).toBeInTheDocument();

    mockUseContactGroups.mockReturnValueOnce({ data: [], isLoading: false, error: null });
    rerender(<ABTestSetupPage />);
    expect(screen.getByText(/no contact groups found/i)).toBeInTheDocument();
  });

  it("selects a group and continues to subject setup", async () => {
    const user = userEvent.setup();
    mockMutateAsync.mockResolvedValueOnce({});

    render(<ABTestSetupPage />);

    expect(screen.getByText(/a\/b test: choose group/i)).toBeInTheDocument();
    await user.click(screen.getByRole("radio", { name: /customers/i }));
    await user.click(screen.getByRole("button", { name: /continue to subject lines/i }));

    await waitFor(() => expect(mockMutateAsync).toHaveBeenCalledWith({ id: "cmp1", groupId: "g1" }));
    expect(mockPush).toHaveBeenCalledWith("/campaigns/ab-test/cmp1/subject");
  });

  it("shows update errors and supports keyboard selection", async () => {
    const user = userEvent.setup();
    mockMutateAsync.mockRejectedValueOnce(new Error("Update failed"));

    render(<ABTestSetupPage />);

    const radio = screen.getByRole("radio", { name: /customers/i });
    fireEvent.keyDown(radio, { key: "Enter" });
    await user.click(screen.getByRole("button", { name: /continue to subject lines/i }));

    await waitFor(() => expect(screen.getByText(/update failed/i)).toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: /back$/i }));
    expect(mockBack).toHaveBeenCalled();
  });
});
