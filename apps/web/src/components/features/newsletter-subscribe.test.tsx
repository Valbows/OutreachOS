import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NewsletterSubscribe } from "./newsletter-subscribe";

const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", fetchMock);
});

describe("NewsletterSubscribe", () => {
  it("renders custom copy and disables submit until email is entered", async () => {
    const user = userEvent.setup();
    render(
      <NewsletterSubscribe
        accountId="acc_1"
        heading="Join the list"
        description="Weekly product updates"
        className="custom-shell"
      />,
    );

    expect(screen.getByText("Join the list")).toBeInTheDocument();
    expect(screen.getByText("Weekly product updates")).toBeInTheDocument();

    const subscribeButton = screen.getByRole("button", { name: /subscribe/i });
    expect(subscribeButton).toBeDisabled();

    await user.type(screen.getByLabelText(/email address/i), "ada@example.com");
    expect(subscribeButton).toBeEnabled();
  });

  it("submits trimmed values and renders success state", async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    render(<NewsletterSubscribe accountId="acc_1" />);

    await user.type(screen.getByLabelText(/first name/i), "  Ada  ");
    await user.type(screen.getByLabelText(/email address/i), "  ada@example.com  ");
    await user.click(screen.getByRole("button", { name: /subscribe/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/api/newsletter/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "ada@example.com",
          firstName: "Ada",
          accountId: "acc_1",
        }),
      });
    });
    expect(screen.getByText(/you're subscribed!/i)).toBeInTheDocument();
    expect(screen.getByText(/check your inbox for updates/i)).toBeInTheDocument();
  });

  it("shows api error messages", async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: "Already subscribed" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      }),
    );

    render(<NewsletterSubscribe accountId="acc_1" />);

    await user.type(screen.getByLabelText(/email address/i), "ada@example.com");
    await user.click(screen.getByRole("button", { name: /subscribe/i }));

    await waitFor(() => expect(screen.getByText(/already subscribed/i)).toBeInTheDocument());
  });

  it("falls back to a generic error message when fetch rejects", async () => {
    const user = userEvent.setup();
    fetchMock.mockRejectedValueOnce("network down");

    render(<NewsletterSubscribe accountId="acc_1" />);

    await user.type(screen.getByLabelText(/email address/i), "ada@example.com");
    await user.click(screen.getByRole("button", { name: /subscribe/i }));

    await waitFor(() => expect(screen.getByText(/something went wrong/i)).toBeInTheDocument());
  });
});
