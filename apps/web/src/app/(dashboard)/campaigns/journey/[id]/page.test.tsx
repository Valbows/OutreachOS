import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import JourneyBuilderPage from "./page";

const createTestQueryClient = () => new QueryClient({
  defaultOptions: {
    queries: { retry: false },
    mutations: { retry: false },
  },
});

const renderWithQueryClient = (ui: React.ReactElement) => {
  const testQueryClient = createTestQueryClient();
  return render(
    <QueryClientProvider client={testQueryClient}>{ui}</QueryClientProvider>
  );
};

const mockPush = vi.fn();
const mockUseJourney = vi.fn();
const mockDeleteMutateAsync = vi.fn();
const mockEnrollMutateAsync = vi.fn();
const mockUseDeleteJourney = vi.fn();
const mockUseEnrollContacts = vi.fn();
const mockUpdateMutateAsync = vi.fn();
const mockUseDeleteJourneyStep = vi.fn();
const mockUseAddJourneyStep = vi.fn();
const mockUseUpdateJourneyStep = vi.fn();

vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "journey1" }),
  useRouter: () => ({ push: mockPush }),
}));

vi.mock("@/lib/hooks/use-journeys", () => ({
  useJourney: () => mockUseJourney(),
  useDeleteJourney: () => mockUseDeleteJourney(),
  useEnrollContacts: () => mockUseEnrollContacts(),
  useDeleteJourneyStep: () => mockUseDeleteJourneyStep(),
  useAddJourneyStep: () => mockUseAddJourneyStep(),
  useUpdateJourneyStep: () => mockUseUpdateJourneyStep(),
}));

vi.mock("@/lib/hooks/use-campaigns", () => ({
  useUpdateCampaign: () => ({ mutateAsync: mockUpdateMutateAsync }),
}));

vi.mock("@/components/ui", () => ({
  Button: ({ children, onClick, disabled, variant, size }: { children: React.ReactNode; onClick?: () => void; disabled?: boolean; variant?: string; size?: string }) => (
    <button onClick={onClick} disabled={disabled} data-variant={variant} data-size={size}>{children}</button>
  ),
}));

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("confirm", vi.fn(() => true));
  mockUpdateMutateAsync.mockResolvedValue({});
  mockUseJourney.mockReturnValue({ data: null, isLoading: false, error: null });
  mockUseDeleteJourney.mockReturnValue({ mutateAsync: mockDeleteMutateAsync, isPending: false, isError: false, error: null });
  mockUseEnrollContacts.mockReturnValue({
    mutateAsync: mockEnrollMutateAsync,
    isPending: false,
    isSuccess: false,
    isError: false,
    error: null,
  });
  mockUseDeleteJourneyStep.mockReturnValue({ mutateAsync: vi.fn(), isPending: false, isError: false, error: null });
  mockUseAddJourneyStep.mockReturnValue({ mutateAsync: vi.fn(), isPending: false, isError: false, error: null });
  mockUseUpdateJourneyStep.mockReturnValue({ mutateAsync: vi.fn(), isPending: false, isError: false, error: null });
});

describe("JourneyBuilderPage", () => {
  it("renders loading and not-found states", () => {
    mockUseJourney.mockReturnValueOnce({ data: null, isLoading: true, error: null });
    const { rerender } = renderWithQueryClient(<JourneyBuilderPage />);
    expect(document.querySelector(".animate-spin")).toBeInTheDocument();

    mockUseJourney.mockReturnValueOnce({ data: null, isLoading: false, error: new Error("missing") });
    rerender(<JourneyBuilderPage />);
    expect(screen.getByText(/journey not found/i)).toBeInTheDocument();
    expect(screen.getByText(/missing/i)).toBeInTheDocument();
  });

  it("renders journey details, steps, and status distribution", () => {
    mockUseJourney.mockReturnValue({
      data: {
        id: "journey1",
        name: "Sales Follow-up",
        status: "active",
        steps: [
          { id: "s1", stepNumber: 1, name: "Initial Sent", delayDays: 0, delayHour: null, templateId: "t1" },
          { id: "s2", stepNumber: 2, name: "First Followup", delayDays: 2, delayHour: 9, templateId: null },
        ],
        progress: {
          totalEnrolled: 10,
          active: 6,
          completed: 3,
          removed: 1,
          byStep: { initial_sent: 6, completed: 3, removed: 1 },
        },
      },
      isLoading: false,
      error: null,
    });

    renderWithQueryClient(<JourneyBuilderPage />);

    expect(screen.getByText("Sales Follow-up")).toBeInTheDocument();
    expect(screen.getByText("active")).toBeInTheDocument();
    expect(screen.getByText(/journey steps/i)).toBeInTheDocument();
    expect(screen.getByText(/edit template/i)).toHaveAttribute("href", "/templates/t1/edit");
    expect(screen.getByText(/not assigned/i)).toBeInTheDocument();
    expect(screen.getByText(/status distribution/i)).toBeInTheDocument();
    expect(screen.getByText(/completed: 3/i)).toBeInTheDocument();
  });

  it("deletes the journey after confirmation", async () => {
    const user = userEvent.setup();
    mockUseJourney.mockReturnValue({
      data: {
        id: "journey1",
        name: "Sales Follow-up",
        status: "draft",
        steps: [],
        progress: null,
      },
      isLoading: false,
      error: null,
    });

    renderWithQueryClient(<JourneyBuilderPage />);

    await user.click(screen.getByRole("button", { name: /delete journey/i }));

    expect(globalThis.confirm).toHaveBeenCalled();
    expect(mockDeleteMutateAsync).toHaveBeenCalledWith("journey1");
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith("/campaigns"));
  });

  it("enrolls contacts and surfaces enrollment errors", async () => {
    const user = userEvent.setup();
    mockUseJourney.mockReturnValue({
      data: {
        id: "journey1",
        name: "Sales Follow-up",
        status: "draft",
        steps: [],
        progress: { totalEnrolled: 0, active: 0, completed: 0, removed: 0, byStep: {} },
      },
      isLoading: false,
      error: null,
    });
    mockUseEnrollContacts.mockReturnValueOnce({
      mutateAsync: mockEnrollMutateAsync,
      isPending: false,
      isSuccess: false,
      isError: false,
      error: null,
    });
    mockEnrollMutateAsync.mockResolvedValueOnce({});

    const { rerender } = renderWithQueryClient(<JourneyBuilderPage />);

    await user.type(screen.getByPlaceholderText(/contact-id-1/i), "c1, c2");
    await user.click(screen.getByRole("button", { name: /^enroll$/i }));

    await waitFor(() => expect(mockEnrollMutateAsync).toHaveBeenCalledWith({ journeyId: "journey1", contactIds: ["c1", "c2"] }));

    mockUseEnrollContacts.mockReturnValueOnce({
      mutateAsync: mockEnrollMutateAsync,
      isPending: false,
      isSuccess: false,
      isError: true,
      error: new Error("Enrollment failed"),
    });
    rerender(<JourneyBuilderPage />);
    expect(screen.getByText(/enrollment failed/i)).toBeInTheDocument();
  });

  it("renders Schedule button when journey has no scheduledAt", () => {
    mockUseJourney.mockReturnValue({
      data: {
        id: "journey1",
        name: "Sales Follow-up",
        status: "draft",
        scheduledAt: null,
        steps: [],
        progress: null,
      },
      isLoading: false,
      error: null,
    });

    renderWithQueryClient(<JourneyBuilderPage />);
    expect(screen.getByRole("button", { name: /schedule$/i })).toBeInTheDocument();
  });

  it("renders Reschedule button and scheduled time when journey has scheduledAt", () => {
    mockUseJourney.mockReturnValue({
      data: {
        id: "journey1",
        name: "Sales Follow-up",
        status: "scheduled",
        scheduledAt: "2026-12-25T10:00:00.000Z",
        steps: [],
        progress: null,
      },
      isLoading: false,
      error: null,
    });

    renderWithQueryClient(<JourneyBuilderPage />);
    expect(screen.getByRole("button", { name: /reschedule/i })).toBeInTheDocument();
    expect(screen.getByText(/starts:/i)).toBeInTheDocument();
  });

  it("opens schedule modal and updates journey schedule", async () => {
    const user = userEvent.setup();
    mockUseJourney.mockReturnValue({
      data: {
        id: "journey1",
        name: "Sales Follow-up",
        status: "draft",
        scheduledAt: null,
        steps: [],
        progress: null,
      },
      isLoading: false,
      error: null,
    });

    renderWithQueryClient(<JourneyBuilderPage />);
    await user.click(screen.getByRole("button", { name: /schedule$/i }));

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText(/schedule journey/i)).toBeInTheDocument();

    // Click "Schedule for later" option
    await user.click(screen.getByText(/schedule for later/i));

    // Set date input
    const futureDate = new Date(Date.now() + 86400000 * 2);
    const pad = (n: number) => n.toString().padStart(2, "0");
    const dateStr = `${futureDate.getFullYear()}-${pad(futureDate.getMonth() + 1)}-${pad(futureDate.getDate())}T${pad(futureDate.getHours())}:${pad(futureDate.getMinutes())}`;

    const dateInput = screen.getByLabelText(/journey start date and time/i);
    await user.clear(dateInput);
    await user.type(dateInput, dateStr);

    await user.click(screen.getByRole("button", { name: /save schedule/i }));

    expect(mockUpdateMutateAsync).toHaveBeenCalledWith({
      id: "journey1",
      scheduledAt: expect.stringMatching(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/),
    });
  });

  it("clears schedule when switching to start immediately", async () => {
    const user = userEvent.setup();
    mockUseJourney.mockReturnValue({
      data: {
        id: "journey1",
        name: "Sales Follow-up",
        status: "scheduled",
        scheduledAt: "2026-12-25T10:00:00.000Z",
        steps: [],
        progress: null,
      },
      isLoading: false,
      error: null,
    });

    render(<JourneyBuilderPage />);
    await user.click(screen.getByRole("button", { name: /reschedule/i }));

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText(/reschedule journey/i)).toBeInTheDocument();

    // Click "Start immediately" option
    await user.click(screen.getByText(/start immediately/i));

    await user.click(screen.getByRole("button", { name: /save schedule/i }));

    expect(mockUpdateMutateAsync).toHaveBeenCalledWith({
      id: "journey1",
      scheduledAt: null,
    });
  });
});
