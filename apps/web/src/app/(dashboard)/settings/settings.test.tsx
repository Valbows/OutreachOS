import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const MOCK_USER = {
  id: "user-1",
  name: "Valery Rene",
  email: "valery@outreachos.com",
  image: null,
};

vi.mock("@/lib/auth/client", () => ({
  authClient: {
    useSession: vi.fn(() => ({
      data: {
        user: MOCK_USER,
        session: { id: "sess-1" },
      },
      isPending: false,
      error: null,
    })),
    updateUser: vi.fn(async () => ({ error: null })),
    changePassword: vi.fn(async () => ({ error: null })),
    deleteUser: vi.fn(async () => ({ error: null })),
    signIn: { social: vi.fn() },
    signOut: vi.fn(),
  },
}));

import SettingsPage from "./page";

describe("SettingsPage", () => {
  beforeEach(() => {
    HTMLDialogElement.prototype.showModal = vi.fn(function (this: HTMLDialogElement) {
      this.setAttribute("open", "");
    });
    HTMLDialogElement.prototype.close = vi.fn(function (this: HTMLDialogElement) {
      this.removeAttribute("open");
    });
  });

  it("renders the settings heading", () => {
    render(<SettingsPage />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(/settings/i);
  });

  it("renders all four tab buttons", () => {
    render(<SettingsPage />);
    expect(screen.getByRole("button", { name: /profile/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /inbox connection/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /notifications/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /danger zone/i })).toBeInTheDocument();
  });

  it("shows profile section by default with name and email from session", () => {
    render(<SettingsPage />);
    expect(screen.getByText("Account Profile")).toBeInTheDocument();
    expect(screen.getByDisplayValue(MOCK_USER.name)).toBeInTheDocument();
    expect(screen.getByDisplayValue(MOCK_USER.email)).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toBeDisabled();
  });

  it("switches to inbox tab showing IMAP/SMTP, OAuth, LLM, and BYOK sections", async () => {
    const user = userEvent.setup();
    render(<SettingsPage />);
    await user.click(screen.getByRole("button", { name: /inbox connection/i }));

    expect(screen.getByText("IMAP/SMTP Config")).toBeInTheDocument();
    expect(screen.getByText("One-Click Sync")).toBeInTheDocument();
    expect(screen.getByText("AI Model Preference")).toBeInTheDocument();
    expect(screen.getByText(/bring your own keys/i)).toBeInTheDocument();
  });

  it("switches to notifications tab showing toggle rows", async () => {
    const user = userEvent.setup();
    render(<SettingsPage />);
    await user.click(screen.getByRole("button", { name: /notifications/i }));

    expect(screen.getByText("Campaign Events")).toBeInTheDocument();
    expect(screen.getByText("Bounce Thresholds")).toBeInTheDocument();
    expect(screen.getByText("System Intelligence")).toBeInTheDocument();
  });

  it("switches to danger zone tab showing export and delete actions", async () => {
    const user = userEvent.setup();
    render(<SettingsPage />);
    await user.click(screen.getByRole("button", { name: /danger zone/i }));

    expect(screen.getByText("Export All Platform Data")).toBeInTheDocument();
    expect(screen.getByText("Terminate Account")).toBeInTheDocument();
  });

  it("opens delete confirmation modal on Delete Account click", async () => {
    const user = userEvent.setup();
    render(<SettingsPage />);
    await user.click(screen.getByRole("button", { name: /danger zone/i }));
    await user.click(screen.getByRole("button", { name: /delete account/i }));

    expect(screen.getByText("Confirm Account Deletion")).toBeInTheDocument();
    expect(screen.getByLabelText(/type.*DELETE.*to confirm/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /permanently delete account/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /cancel/i })).toBeInTheDocument();
  });

  it("enables confirm button only after typing DELETE", async () => {
    const user = userEvent.setup();
    render(<SettingsPage />);
    await user.click(screen.getByRole("button", { name: /danger zone/i }));
    await user.click(screen.getByRole("button", { name: /delete account/i }));

    const confirmInput = screen.getByLabelText(/type.*DELETE.*to confirm/i);
    const confirmBtn = screen.getByRole("button", { name: /permanently delete account/i });

    expect(confirmBtn).toBeDisabled();

    await user.clear(confirmInput);
    await user.type(confirmInput, "DELET");
    expect(confirmBtn).toBeDisabled();

    await user.clear(confirmInput);
    await user.type(confirmInput, "DELETE");
    expect(confirmBtn).toBeEnabled();
  });
});
