import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

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
  signInWithEmail: vi.fn(),
}));

describe("LoginPage", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const react = await import("react");
    vi.mocked(react.useActionState).mockReturnValue([null, vi.fn(), false]);
  });

  it("renders sign-in heading, email/password fields, OAuth buttons, and signup link", async () => {
    const { default: LoginPage } = await import("./page");
    render(<LoginPage />);

    expect(screen.getByRole("heading", { name: /welcome back/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /sign in$/i })).toBeInTheDocument();
    expect(screen.getByText(/continue with google/i)).toBeInTheDocument();
    expect(screen.getByText(/continue with github/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /create an account/i })).toHaveAttribute("href", "/signup");
    expect(screen.getByRole("link", { name: /forgot password/i })).toHaveAttribute("href", "/forgot-password");
  });

  it("displays error state when sign-in fails", async () => {
    const react = await import("react");
    vi.mocked(react.useActionState).mockReturnValue([
      { error: "Invalid credentials" },
      vi.fn(),
      false,
    ]);

    vi.resetModules();
    const { default: LoginPage } = await import("./page");
    render(<LoginPage />);

    expect(screen.getByText("Invalid credentials")).toBeInTheDocument();
  });

  it("disables submit button while pending", async () => {
    const react = await import("react");
    vi.mocked(react.useActionState).mockReturnValue([null, vi.fn(), true]);

    vi.resetModules();
    const { default: LoginPage } = await import("./page");
    render(<LoginPage />);

    expect(screen.getByRole("button", { name: /signing in/i })).toBeDisabled();
  });

  it("renders form with email and password inputs with correct names for FormData", async () => {
    const { default: LoginPage } = await import("./page");
    render(<LoginPage />);

    const emailInput = screen.getByLabelText(/email/i);
    const passwordInput = screen.getByLabelText(/password/i);

    expect(emailInput).toHaveAttribute("name", "email");
    expect(emailInput).toHaveAttribute("type", "email");
    expect(passwordInput).toHaveAttribute("name", "password");
    expect(passwordInput).toHaveAttribute("type", "password");
  });
});
