import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ABTestSubjectPage from "./page";

const mockPush = vi.fn();
const mockBack = vi.fn();
const mockUseCampaign = vi.fn();
const mockGenerateMutateAsync = vi.fn();
const fetchMock = vi.fn<typeof fetch>();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, back: mockBack }),
  useParams: () => ({ id: "cmp1" }),
}));

vi.mock("@/lib/hooks/use-campaigns", () => ({
  useCampaign: () => mockUseCampaign(),
}));

vi.mock("@/lib/hooks/use-templates", () => ({
  useGenerateSubjects: () => ({ mutateAsync: mockGenerateMutateAsync }),
}));

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", fetchMock);
  mockUseCampaign.mockReturnValue({ data: { name: "Q1 Blast" } });
});

describe("ABTestSubjectPage", () => {
  it("generates JSON suggestions and creates an experiment", async () => {
    const user = userEvent.setup();
    mockGenerateMutateAsync.mockResolvedValueOnce({ text: JSON.stringify(["Scale outreach faster", "Boost replies today"]) });
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ id: "exp1" }), {
        status: 201,
        headers: { "Content-Type": "application/json" },
      }),
    );

    render(<ABTestSubjectPage />);

    await user.click(screen.getByRole("button", { name: /^generate$/i }));

    await waitFor(() => {
      expect(screen.getByDisplayValue("Scale outreach faster")).toBeInTheDocument();
      expect(screen.getByDisplayValue("Boost replies today")).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /create experiment/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/api/experiments", expect.objectContaining({ method: "POST" }));
    });
    expect(mockPush).toHaveBeenCalledWith("/campaigns/cmp1/analytics");
  });

  it("falls back to line parsing when suggestion json is invalid", async () => {
    const user = userEvent.setup();
    mockGenerateMutateAsync.mockResolvedValueOnce({ text: '1. "First option"\n2. "Second option"' });

    render(<ABTestSubjectPage />);

    await user.click(screen.getByRole("button", { name: /^generate$/i }));

    await waitFor(() => {
      expect(screen.getByDisplayValue("First option")).toBeInTheDocument();
      expect(screen.getByDisplayValue("Second option")).toBeInTheDocument();
    });
    expect(screen.getByText(/preview/i)).toBeInTheDocument();
  });

  it("shows generation and create errors", async () => {
    const user = userEvent.setup();
    mockGenerateMutateAsync.mockRejectedValueOnce(new Error("Gemini unavailable"));

    render(<ABTestSubjectPage />);

    await user.click(screen.getByRole("button", { name: /^generate$/i }));
    await waitFor(() => expect(screen.getByText(/gemini unavailable/i)).toBeInTheDocument());

    await user.type(screen.getByPlaceholderText(/variant a/i), "Subject A");
    await user.type(screen.getByPlaceholderText(/variant b/i), "Subject B");
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: "Create failed" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await user.click(screen.getByRole("button", { name: /create experiment/i }));
    await waitFor(() => expect(screen.getByText(/create failed/i)).toBeInTheDocument());
  });

  it("navigates back", async () => {
    const user = userEvent.setup();
    render(<ABTestSubjectPage />);

    await user.click(screen.getByRole("button", { name: /^back$/i }));

    expect(mockBack).toHaveBeenCalled();
  });
});
