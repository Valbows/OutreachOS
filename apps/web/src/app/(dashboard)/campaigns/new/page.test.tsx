import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import NewCampaignPage from "./page";

const mockPush = vi.fn();
const mockBack = vi.fn();
const mockMutateAsync = vi.fn();
const mockUseCreateCampaign = vi.fn();
const mockUseContactGroups = vi.fn();
const mockUseTemplates = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, back: mockBack }),
}));

vi.mock("@/lib/hooks/use-campaigns", () => ({
  useCreateCampaign: () => mockUseCreateCampaign(),
}));

vi.mock("@/lib/hooks/use-contacts", () => ({
  useContactGroups: () => mockUseContactGroups(),
}));

vi.mock("@/lib/hooks/use-templates", () => ({
  useTemplates: () => mockUseTemplates(),
}));

beforeEach(() => {
  vi.clearAllMocks();
  mockUseCreateCampaign.mockReturnValue({ mutateAsync: mockMutateAsync, isPending: false });
  mockUseContactGroups.mockReturnValue({ data: [{ id: "g1", name: "Customers" }] });
  mockUseTemplates.mockReturnValue({ data: [{ id: "t1", name: "Welcome Template" }] });
});

describe("NewCampaignPage", () => {
  it("renders step one and advances to campaign details", async () => {
    const user = userEvent.setup();
    render(<NewCampaignPage />);

    expect(screen.getByText(/select campaign type/i)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /one-time campaign/i }));

    expect(screen.getByText(/campaign details/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/contact group/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/template/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /^back$/i }));
    expect(screen.getByText(/select campaign type/i)).toBeInTheDocument();
  });

  it("creates a standard campaign with send-now and navigates to analytics", async () => {
    const user = userEvent.setup();
    mockMutateAsync.mockResolvedValueOnce({ data: { id: "cmp1" } });

    render(<NewCampaignPage />);

    await user.click(screen.getByRole("button", { name: /one-time campaign/i }));
    await user.type(screen.getByLabelText(/campaign name/i), "Q1 Blast");
    await user.selectOptions(screen.getByLabelText(/contact group/i), "g1");
    await user.selectOptions(screen.getByLabelText(/template/i), "t1");
    await user.click(screen.getByRole("button", { name: /next: schedule/i }));
    await user.click(screen.getByRole("button", { name: /create campaign/i }));

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith({
        name: "Q1 Blast",
        type: "one_time",
        groupId: "g1",
        templateId: "t1",
        scheduledAt: undefined,
      });
    });
    expect(mockPush).toHaveBeenCalledWith("/campaigns/cmp1/analytics");
  });

  it("schedules a campaign for later with a future datetime", async () => {
    const user = userEvent.setup();
    mockMutateAsync.mockResolvedValueOnce({ data: { id: "cmp-sched" } });

    render(<NewCampaignPage />);

    await user.click(screen.getByRole("button", { name: /one-time campaign/i }));
    await user.type(screen.getByLabelText(/campaign name/i), "Scheduled Blast");
    await user.click(screen.getByRole("button", { name: /next: schedule/i }));
    await user.click(screen.getByLabelText(/schedule for later/i));

    const futureDateIso = new Date(Date.now() + 60 * 60 * 1000).toISOString().slice(0, 16);
    const dateInput = screen.getByLabelText(/scheduled date and time/i);
    fireEvent.change(dateInput, { target: { value: futureDateIso } });

    await user.click(screen.getByRole("button", { name: /schedule campaign/i }));

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalled();
    });

    const call = mockMutateAsync.mock.calls[0][0];
    expect(call.name).toBe("Scheduled Blast");
    expect(call.scheduledAt).toMatch(/^\d{4}-\d{2}-\d{2}T/); // ISO format string
    expect(new Date(call.scheduledAt).getTime()).toBeGreaterThan(Date.now());
  });

  it("shows error if schedule time is in the past", async () => {
    const user = userEvent.setup();
    render(<NewCampaignPage />);

    await user.click(screen.getByRole("button", { name: /one-time campaign/i }));
    await user.type(screen.getByLabelText(/campaign name/i), "Past Schedule");
    await user.click(screen.getByRole("button", { name: /next: schedule/i }));
    await user.click(screen.getByLabelText(/schedule for later/i));

    // Build a datetime-local string in LOCAL time that is in the past.
    // datetime-local inputs are parsed as local time by `new Date()` in the handler.
    const past = new Date(Date.now() - 60 * 60 * 1000);
    const pad = (n: number) => String(n).padStart(2, "0");
    const pastLocal = `${past.getFullYear()}-${pad(past.getMonth() + 1)}-${pad(past.getDate())}T${pad(past.getHours())}:${pad(past.getMinutes())}`;
    const dateInput = screen.getByLabelText(/scheduled date and time/i);
    fireEvent.change(dateInput, { target: { value: pastLocal } });

    await user.click(screen.getByRole("button", { name: /schedule campaign/i }));

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(/must be in the future/i),
    );
    expect(mockMutateAsync).not.toHaveBeenCalled();
  });

  it("shows error if schedule is chosen but no date picked", async () => {
    const user = userEvent.setup();
    render(<NewCampaignPage />);

    await user.click(screen.getByRole("button", { name: /one-time campaign/i }));
    await user.type(screen.getByLabelText(/campaign name/i), "No Date");
    await user.click(screen.getByRole("button", { name: /next: schedule/i }));
    await user.click(screen.getByLabelText(/schedule for later/i));
    await user.click(screen.getByRole("button", { name: /schedule campaign/i }));

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(/pick a date/i),
    );
    expect(mockMutateAsync).not.toHaveBeenCalled();
  });

  it("routes ab tests to setup flow after scheduling step", async () => {
    const user = userEvent.setup();
    mockMutateAsync.mockResolvedValueOnce({ data: { id: "cmp2" } });

    render(<NewCampaignPage />);

    await user.click(screen.getByRole("button", { name: /a\/b test/i }));
    await user.type(screen.getByLabelText(/campaign name/i), "Subject Experiment");
    await user.click(screen.getByRole("button", { name: /next: schedule/i }));
    await user.click(screen.getByRole("button", { name: /create campaign/i }));

    await waitFor(() => expect(mockPush).toHaveBeenCalledWith("/campaigns/ab-test/setup?campaignId=cmp2"));
  });

  it("shows an error when the response is missing a campaign id", async () => {
    const user = userEvent.setup();
    mockMutateAsync.mockResolvedValueOnce({ data: {} });

    render(<NewCampaignPage />);

    await user.click(screen.getByRole("button", { name: /newsletter/i }));
    await user.type(screen.getByLabelText(/campaign name/i), "Newsletter");
    await user.click(screen.getByRole("button", { name: /next: schedule/i }));
    await user.click(screen.getByRole("button", { name: /create campaign/i }));

    await waitFor(() => expect(screen.getByText(/invalid response: missing campaign id/i)).toBeInTheDocument());
  });

  it("navigates back to campaigns from the header button", async () => {
    const user = userEvent.setup();
    render(<NewCampaignPage />);

    await user.click(screen.getByRole("button", { name: /back to campaigns/i }));

    expect(mockPush).toHaveBeenCalledWith("/campaigns");
  });
});
