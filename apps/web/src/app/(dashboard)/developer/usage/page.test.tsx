import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import UsageAnalyticsPage from "./page";

const fetchMock = vi.fn<typeof fetch>();

function jsonResponse(body: unknown, init?: ResponseInit): Response {
  return {
    ok: (init?.status ?? 200) >= 200 && (init?.status ?? 200) < 300,
    status: init?.status ?? 200,
    statusText: init?.statusText ?? "OK",
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as Response;
}

describe("UsageAnalyticsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders fetched stats, endpoint usage, and intelligence trace", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        stats: {
          totalApiCalls: 1234,
          llmTokens: 50000,
          hunterCredits: 10,
          resendEmails: 25,
          periodStart: "2024-01-01",
          periodEnd: "2024-01-30",
        },
        endpoints: [
          { endpoint: "/api/contacts", method: "GET", calls: 200, avgLatency: 123, errorRate: 1.5 },
        ],
        daily: [
          { date: "2024-01-10", apiCalls: 40, llmTokens: 1000 },
          { date: "2024-01-11", apiCalls: 50, llmTokens: 2500 },
        ],
      }),
    );

    render(<UsageAnalyticsPage />);

    expect(screen.getByText(/system utilization/i)).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText("1,234")).toBeInTheDocument());

    expect(screen.getByText("50,000")).toBeInTheDocument();
    expect(screen.getByText("$0.63")).toBeInTheDocument();
    expect(screen.getByText("/api/contacts")).toBeInTheDocument();
    expect(screen.getByText("1.5%")).toBeInTheDocument();
    expect(screen.getByText(/2,500 tokens/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /back to developer/i })).toHaveAttribute("href", "/developer");
  });

  it("shows API error details and retries", async () => {
    const user = userEvent.setup();
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    fetchMock
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: "Server Error",
        text: async () => "failure body",
      } as Response)
      .mockResolvedValueOnce(
        jsonResponse({
          stats: {
            totalApiCalls: 10,
            llmTokens: 100,
            hunterCredits: 1,
            resendEmails: 2,
            periodStart: "2024-01-01",
            periodEnd: "2024-01-30",
          },
          endpoints: [],
          daily: [],
        }),
      );

    render(<UsageAnalyticsPage />);

    await waitFor(() => expect(screen.getByText(/failed to load usage data: 500 server error - failure body/i)).toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: /retry/i }));
    await waitFor(() => expect(screen.getByText("10")).toBeInTheDocument());

    consoleErrorSpy.mockRestore();
  });

  it("switches time ranges and refetches usage data", async () => {
    const user = userEvent.setup();
    fetchMock.mockImplementation(async (input) => {
      const url = String(input);
      if (url.endsWith("range=30d")) {
        return jsonResponse({
          stats: {
            totalApiCalls: 30,
            llmTokens: 300,
            hunterCredits: 3,
            resendEmails: 6,
            periodStart: "2024-01-01",
            periodEnd: "2024-01-30",
          },
          endpoints: [],
          daily: [],
        });
      }
      if (url.endsWith("range=7d")) {
        return jsonResponse({
          stats: {
            totalApiCalls: 7,
            llmTokens: 700,
            hunterCredits: 7,
            resendEmails: 7,
            periodStart: "2024-01-24",
            periodEnd: "2024-01-30",
          },
          endpoints: [],
          daily: [],
        });
      }
      throw new Error(`Unexpected URL: ${url}`);
    });

    render(<UsageAnalyticsPage />);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/developer/usage?range=30d"));
    await user.click(screen.getByRole("button", { name: /7 days/i }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/developer/usage?range=7d"));
    await waitFor(() => expect(screen.getByText("700")).toBeInTheDocument());
    await waitFor(() => expect(screen.getByText("$0.36")).toBeInTheDocument());
  });

  it("renders empty endpoint and daily usage states", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        stats: {
          totalApiCalls: 0,
          llmTokens: 0,
          hunterCredits: 0,
          resendEmails: 0,
          periodStart: "2024-01-01",
          periodEnd: "2024-01-30",
        },
        endpoints: [],
        daily: [],
      }),
    );

    render(<UsageAnalyticsPage />);

    await waitFor(() => expect(screen.getByText(/no api usage data yet/i)).toBeInTheDocument());
    expect(screen.getByText(/no llm usage data yet/i)).toBeInTheDocument();
  });
});
