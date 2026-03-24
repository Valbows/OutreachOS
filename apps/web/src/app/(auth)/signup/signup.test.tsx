import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { authClient } from "@/lib/auth/client";

vi.mock("@/lib/auth/client", () => ({
  authClient: {
    signIn: { social: vi.fn() },
    signOut: vi.fn(),
  },
}));

vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return {
    ...actual,
    useActionState: vi.fn(() => [null, vi.fn(), false]),
  };
});

vi.mock("./actions", () => ({
  signUpWithEmail: vi.fn(),
}));

describe("SignupPage", () => {
  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();
    const react = await import("react");
    vi.mocked(react.useActionState).mockReturnValue([null, vi.fn(), false]);
  });

  it("renders sign-up heading, name/email/password fields, OAuth buttons, and login link", async () => {
    const { default: SignupPage } = await import("./page");
    render(<SignupPage />);

    expect(screen.getByRole("heading", { name: /create your account/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/full name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /create account$/i })).toBeInTheDocument();
    expect(screen.getByText(/continue with google/i)).toBeInTheDocument();
    expect(screen.getByText(/continue with github/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /sign in/i })).toHaveAttribute("href", "/login");
  });

  it("displays error state when sign-up fails", async () => {
    const react = await import("react");
    vi.mocked(react.useActionState).mockReturnValue([
      { error: "Email already in use" },
      vi.fn(),
      false,
    ]);

    vi.resetModules();
    const { default: SignupPage } = await import("./page");
    render(<SignupPage />);

    expect(screen.getByText("Email already in use")).toBeInTheDocument();
  });

  it("disables submit button while pending", async () => {
    const react = await import("react");
    vi.mocked(react.useActionState).mockReturnValue([null, vi.fn(), true]);

    vi.resetModules();
    const { default: SignupPage } = await import("./page");
    render(<SignupPage />);

    expect(screen.getByRole("button", { name: /creating account/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /continue with google/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /continue with github/i })).toBeDisabled();
  });

  it("clears oauth pending state and shows an error after Google sign-in fails", async () => {
    vi.mocked(authClient.signIn.social).mockRejectedValueOnce(new Error("OAuth failed"));

    const { default: SignupPage } = await import("./page");
    render(<SignupPage />);

    const googleButton = screen.getByRole("button", { name: /continue with google/i });
    fireEvent.click(googleButton);

    expect(screen.getByRole("button", { name: /signing in/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /create account/i })).toBeDisabled();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Failed to sign in with Google. Please try again."
    );

    expect(screen.getByRole("button", { name: /continue with google/i })).not.toBeDisabled();
    expect(screen.getByRole("button", { name: /create account/i })).not.toBeDisabled();
  });
});
