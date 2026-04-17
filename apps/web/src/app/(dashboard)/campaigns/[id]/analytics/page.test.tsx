import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import CampaignAnalyticsPage from "./page";

const mockPush = vi.fn();
const mockUseCampaign = vi.fn();
const mockUseCampaignAnalytics = vi.fn();
const mockMutateAsync = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
  useParams: () => ({ id: "cmp1" }),
}));

vi.mock("@/lib/hooks/use-campaigns", () => ({
  useCampaign: () => mockUseCampaign(),
  useCampaignAnalytics: () => mockUseCampaignAnalytics(),
  useUpdateCampaign: () => ({ mutateAsync: mockMutateAsync }),
}));

vi.mock("@/lib/hooks/use-experiments", () => ({
  useCampaignExperiments: () => ({ data: [], isLoading: false }),
  useExperimentBatches: () => ({ data: [], isLoading: false }),
}));

beforeEach(() => {
  vi.clearAllMocks();
  mockMutateAsync.mockResolvedValue({});
  mockUseCampaign.mockReturnValue({ data: null, isLoading: false });
  mockUseCampaignAnalytics.mockReturnValue({ data: null, isLoading: false });
});

describe("CampaignAnalyticsPage", () => {
  it("renders loading state when campaign or analytics are loading", () => {
    mockUseCampaign.mockReturnValue({ data: null, isLoading: true });
    render(<CampaignAnalyticsPage />);
    expect(document.querySelector(".animate-spin")).toBeInTheDocument();
  });

  it("renders not-found state and navigates back", async () => {
    const user = userEvent.setup();
    render(<CampaignAnalyticsPage />);

    expect(screen.getByText(/campaign not found/i)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /back to campaigns/i }));
    expect(mockPush).toHaveBeenCalledWith("/campaigns");
  });

  it("renders analytics metrics, heatmaps, and status badge", () => {
    mockUseCampaign.mockReturnValue({
      data: { id: "cmp1", name: "Q1 Blast", status: "active" },
      isLoading: false,
    });
    mockUseCampaignAnalytics.mockReturnValue({
      data: {
        metrics: {
          totalSent: 100,
          totalDelivered: 95,
          openRate: 0.42,
          uniqueOpens: 40,
          clickRate: 0.12,
          totalClicked: 12,
          bounceRate: 0.03,
          totalBounced: 3,
          totalFailed: 2,
          complaintRate: 0.01,
          totalComplained: 1,
          totalUnsubscribed: 4,
          unsubscribeRate: 0.04,
        },
        hourly: [
          { hour: 9, opens: 10 },
          { hour: 10, opens: 20 },
        ],
        daily: [
          { dayOfWeek: 1, opens: 15 },
          { dayOfWeek: 2, opens: 30 },
        ],
      },
      isLoading: false,
    });

    render(<CampaignAnalyticsPage />);

    expect(screen.getByText("Q1 Blast")).toBeInTheDocument();
    expect(screen.getByText("active")).toBeInTheDocument();
    expect(screen.getByText("100")).toBeInTheDocument();
    expect(screen.getByText("42.0%")).toBeInTheDocument();
    expect(screen.getByText("12.0%")).toBeInTheDocument();
    expect(screen.getByText(/opens by hour of day/i)).toBeInTheDocument();
    expect(screen.getByText("09:00")).toBeInTheDocument();
    expect(screen.getByText("Mon")).toBeInTheDocument();
  });

  it("renders Schedule button when campaign has no scheduledAt", () => {
    mockUseCampaign.mockReturnValue({
      data: { id: "cmp1", name: "Q1 Blast", status: "draft", scheduledAt: null },
      isLoading: false,
    });
    mockUseCampaignAnalytics.mockReturnValue({
      data: { metrics: {}, hourly: [], daily: [] },
      isLoading: false,
    });

    render(<CampaignAnalyticsPage />);
    expect(screen.getByRole("button", { name: /schedule$/i })).toBeInTheDocument();
  });

  it("renders Reschedule button and scheduled time when campaign has scheduledAt", () => {
    mockUseCampaign.mockReturnValue({
      data: {
        id: "cmp1",
        name: "Q1 Blast",
        status: "scheduled",
        scheduledAt: "2026-12-25T10:00:00.000Z",
      },
      isLoading: false,
    });
    mockUseCampaignAnalytics.mockReturnValue({
      data: { metrics: {}, hourly: [], daily: [] },
      isLoading: false,
    });

    render(<CampaignAnalyticsPage />);
    expect(screen.getByRole("button", { name: /reschedule/i })).toBeInTheDocument();
    expect(screen.getByText(/scheduled:/i)).toBeInTheDocument();
  });

  it("opens schedule modal and updates schedule", async () => {
    const user = userEvent.setup();
    mockUseCampaign.mockReturnValue({
      data: { id: "cmp1", name: "Q1 Blast", status: "draft", scheduledAt: null },
      isLoading: false,
    });
    mockUseCampaignAnalytics.mockReturnValue({
      data: { metrics: {}, hourly: [], daily: [] },
      isLoading: false,
    });

    render(<CampaignAnalyticsPage />);
    await user.click(screen.getByRole("button", { name: /schedule$/i }));

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText(/schedule campaign/i)).toBeInTheDocument();

    // Click "Schedule for later" option
    await user.click(screen.getByText(/schedule for later/i));

    // Set date input
    const futureDate = new Date(Date.now() + 86400000 * 2); // 2 days from now
    const pad = (n: number) => n.toString().padStart(2, "0");
    const dateStr = `${futureDate.getFullYear()}-${pad(futureDate.getMonth() + 1)}-${pad(futureDate.getDate())}T${pad(futureDate.getHours())}:${pad(futureDate.getMinutes())}`;

    const dateInput = screen.getByLabelText(/scheduled date and time/i);
    await user.clear(dateInput);
    await user.type(dateInput, dateStr);

    await user.click(screen.getByRole("button", { name: /save schedule/i }));

    expect(mockMutateAsync).toHaveBeenCalledWith({
      id: "cmp1",
      scheduledAt: expect.stringMatching(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/),
    });
  });

  it("clears schedule when switching to send immediately", async () => {
    const user = userEvent.setup();
    mockUseCampaign.mockReturnValue({
      data: {
        id: "cmp1",
        name: "Q1 Blast",
        status: "scheduled",
        scheduledAt: "2026-12-25T10:00:00.000Z",
      },
      isLoading: false,
    });
    mockUseCampaignAnalytics.mockReturnValue({
      data: { metrics: {}, hourly: [], daily: [] },
      isLoading: false,
    });

    render(<CampaignAnalyticsPage />);
    await user.click(screen.getByRole("button", { name: /reschedule/i }));

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText(/reschedule campaign/i)).toBeInTheDocument();

    // Click "Send immediately" option
    await user.click(screen.getByText(/send immediately/i));

    await user.click(screen.getByRole("button", { name: /save schedule/i }));

    expect(mockMutateAsync).toHaveBeenCalledWith({
      id: "cmp1",
      scheduledAt: null,
    });
  });

  it("closes modal on cancel click", async () => {
    const user = userEvent.setup();
    mockUseCampaign.mockReturnValue({
      data: { id: "cmp1", name: "Q1 Blast", status: "draft", scheduledAt: null },
      isLoading: false,
    });
    mockUseCampaignAnalytics.mockReturnValue({
      data: { metrics: {}, hourly: [], daily: [] },
      isLoading: false,
    });

    render(<CampaignAnalyticsPage />);
    await user.click(screen.getByRole("button", { name: /schedule$/i }));

    expect(screen.getByRole("dialog")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /cancel/i }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
