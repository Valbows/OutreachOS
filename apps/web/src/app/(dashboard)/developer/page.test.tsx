import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import DeveloperPage from "./page";

const fetchMock = vi.fn<typeof fetch>();
const writeText = vi.fn();

vi.mock("@/components/ui", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/components/ui")>();
  return {
    ...actual,
    Modal: ({ open, children }: { open: boolean; children: any }) => (open ? <div>{children}</div> : null),
  };
});

function jsonResponse(body: unknown, init?: ResponseInit): Response {
  return {
    ok: (init?.status ?? 200) >= 200 && (init?.status ?? 200) < 300,
    status: init?.status ?? 200,
    statusText: init?.statusText ?? "OK",
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as Response;
}

describe("DeveloperPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", fetchMock);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders API keys, stale warning, and BYOK provider statuses", async () => {
    fetchMock.mockImplementation(async (input) => {
      const url = String(input);
      if (url === "/api/developer/keys") {
        return jsonResponse({
          keys: [
            {
              id: "k1",
              name: "Primary Key",
              prefix: "sk_live_123",
              scopes: ["read", "write"],
              createdAt: "2023-01-01T00:00:00.000Z",
              lastUsedAt: "2024-01-01T00:00:00.000Z",
              expiresAt: null,
            },
          ],
        });
      }
      if (url === "/api/settings/byok") {
        return jsonResponse({ providers: { gemini: true, resend: true } });
      }
      throw new Error(`Unexpected URL: ${url}`);
    });

    render(<DeveloperPage />);

    expect(screen.getByText(/api keys management/i)).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText("Primary Key")).toBeInTheDocument());

    expect(screen.getByText(/security audit/i)).toBeInTheDocument();
    expect(screen.getByText(/1 key was created over 90 days ago/i)).toBeInTheDocument();
    expect(screen.getAllByText("Configured").length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText("Not Set").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/settings → inbox connection/i)).toHaveAttribute("href", "/settings");
  });

  it("switches between docs, webhooks, and usage tabs", async () => {
    const user = userEvent.setup();
    fetchMock.mockImplementation(async (input) => {
      const url = String(input);
      if (url === "/api/developer/keys") return jsonResponse({ keys: [] });
      if (url === "/api/settings/byok") return jsonResponse({ providers: {} });
      throw new Error(`Unexpected URL: ${url}`);
    });

    render(<DeveloperPage />);

    await waitFor(() => expect(screen.getByText(/no api keys yet/i)).toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: /api docs/i }));
    expect(screen.getByText(/complete api reference with interactive examples/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /view openapi docs/i })).toHaveAttribute("href", "/api/docs");

    await user.click(screen.getByRole("button", { name: /webhooks/i }));
    expect(screen.getByText(/webhook configuration coming soon/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /usage/i }));
    expect(screen.getByRole("link", { name: /usage dashboard/i })).toHaveAttribute("href", "/developer/usage");
  });

  it("shows API key load errors and retries", async () => {
    const user = userEvent.setup();
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    let keysAttempt = 0;

    fetchMock.mockImplementation(async (input) => {
      const url = String(input);
      if (url === "/api/settings/byok") return jsonResponse({ providers: {} });
      if (url === "/api/developer/keys") {
        keysAttempt += 1;
        if (keysAttempt === 1) {
          return jsonResponse({ error: "Keys unavailable" }, { status: 500, statusText: "Server Error" });
        }
        return jsonResponse({ keys: [] });
      }
      throw new Error(`Unexpected URL: ${url}`);
    });

    render(<DeveloperPage />);

    await waitFor(() => expect(screen.getByText(/failed to load api keys/i)).toBeInTheDocument());
    expect(screen.getByText("Keys unavailable")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /retry/i }));

    await waitFor(() => expect(screen.getByText(/no api keys yet/i)).toBeInTheDocument());
    expect(fetchMock).toHaveBeenCalledWith("/api/developer/keys");
    consoleErrorSpy.mockRestore();
  });

  it("creates a key and shows the one-time secret", async () => {
    const user = userEvent.setup();
    fetchMock.mockImplementation(async (input, init) => {
      const url = String(input);
      if (url === "/api/developer/keys" && !init?.method) return jsonResponse({ keys: [] });
      if (url === "/api/settings/byok") return jsonResponse({ providers: {} });
      if (url === "/api/developer/keys" && init?.method === "POST") {
        expect(init.body).toBe(JSON.stringify({ name: "Production", scopes: ["read", "write"] }));
        return jsonResponse({
          key: "sk_test_secret",
          apiKey: {
            id: "k2",
            name: "Production",
            prefix: "sk_test",
            scopes: ["read", "write"],
            createdAt: "2024-01-01T00:00:00.000Z",
            lastUsedAt: null,
            expiresAt: null,
          },
        });
      }
      throw new Error(`Unexpected URL: ${url}`);
    });

    render(<DeveloperPage />);

    await waitFor(() => expect(screen.getByText(/no api keys yet/i)).toBeInTheDocument());
    await user.click(screen.getAllByRole("button", { name: /create key/i })[0]);
    await user.type(screen.getByPlaceholderText(/production api key/i), "Production");
    await user.click(screen.getByRole("button", { name: "write" }));
    await user.click(screen.getAllByRole("button", { name: /^create key$/i })[1]);

    await waitFor(() => expect(screen.getByText(/your api key has been created/i)).toBeInTheDocument());
    expect(screen.getByText("sk_test_secret")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /done/i }));
    await waitFor(() => expect(screen.queryByText(/your api key has been created/i)).not.toBeInTheDocument());
    expect(screen.getByText("Production")).toBeInTheDocument();
  });

  it("revokes a key and removes it from the list", async () => {
    const user = userEvent.setup();
    let keys = [
      {
        id: "k1",
        name: "Primary Key",
        prefix: "sk_live_123",
        scopes: ["read"],
        createdAt: "2024-01-01T00:00:00.000Z",
        lastUsedAt: null,
        expiresAt: null,
      },
    ];

    fetchMock.mockImplementation(async (input, init) => {
      const url = String(input);
      if (url === "/api/developer/keys" && !init?.method) return jsonResponse({ keys });
      if (url === "/api/settings/byok") return jsonResponse({ providers: {} });
      if (url === "/api/developer/keys/k1" && init?.method === "DELETE") {
        keys = [];
        return jsonResponse({}, { status: 200 });
      }
      throw new Error(`Unexpected URL: ${url}`);
    });

    render(<DeveloperPage />);

    await waitFor(() => expect(screen.getByText("Primary Key")).toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: /revoke/i }));
    expect(screen.getByText(/revoke api key/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /^revoke key$/i }));

    await waitFor(() => expect(screen.queryByText("Primary Key")).not.toBeInTheDocument());
    expect(screen.getByText(/no api keys yet/i)).toBeInTheDocument();
  });
});
