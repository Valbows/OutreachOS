import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/font/google", () => ({
  Inter: () => ({ variable: "font-sans-mock" }),
  JetBrains_Mono: () => ({ variable: "font-mono-mock" }),
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
  usePathname: vi.fn(() => "/"),
  useRouter: vi.fn(() => ({ push: vi.fn() })),
}));

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode; [key: string]: unknown }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

vi.mock("@/lib/query-provider", () => ({
  QueryProvider: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="query-provider">{children}</div>
  ),
}));

vi.mock("@neondatabase/auth/next/server", () => ({
  createNeonAuth: vi.fn(() => ({
    handler: vi.fn(() => ({ GET: vi.fn(), POST: vi.fn() })),
    middleware: vi.fn(),
    signIn: { email: vi.fn() },
    signUp: { email: vi.fn() },
    getSession: vi.fn(),
  })),
}));

vi.mock("@neondatabase/auth/next", () => ({
  createAuthClient: vi.fn(() => ({
    signIn: { social: vi.fn(), email: vi.fn() },
    signOut: vi.fn(),
  })),
}));

vi.mock("@/lib/auth/client", () => ({
  authClient: {
    useSession: vi.fn(() => ({
      data: {
        user: { id: "u1", name: "Test User", email: "test@example.com", image: null },
        session: { id: "s1" },
      },
      isPending: false,
      error: null,
    })),
    updateUser: vi.fn(async () => ({ error: null })),
    changePassword: vi.fn(async () => ({ error: null })),
    signIn: { social: vi.fn() },
    signOut: vi.fn(),
  },
}));

vi.mock("@/lib/auth/server", () => ({
  auth: {
    handler: vi.fn(() => ({ GET: vi.fn(), POST: vi.fn() })),
    middleware: vi.fn(),
    signIn: { email: vi.fn() },
    signUp: { email: vi.fn() },
    getSession: vi.fn(),
  },
}));

vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return {
    ...actual,
    useActionState: vi.fn(() => [null, vi.fn(), false]),
  };
});

vi.mock("./(auth)/login/actions", () => ({
  signInWithEmail: vi.fn(),
}));

vi.mock("./(auth)/signup/actions", () => ({
  signUpWithEmail: vi.fn(),
}));

vi.mock("@/lib/hooks/use-contacts", () => ({
  useContacts: vi.fn(() => ({ data: undefined, isLoading: false })),
  useContactGroups: vi.fn(() => ({ data: [] })),
  useDeleteContacts: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
  useContact: vi.fn(() => ({ data: null, isLoading: false })),
  contactKeys: {
    all: ["contacts"],
    lists: () => ["contacts", "list"],
    list: (p: unknown) => ["contacts", "list", p],
    details: () => ["contacts", "detail"],
    detail: (id: string) => ["contacts", "detail", id],
    groups: () => ["contacts", "groups"],
  },
}));

// Mock Modal component (HTML dialog not fully supported in jsdom)
vi.mock("@/components/ui", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/components/ui")>();
  return {
    ...actual,
    Modal: ({ open, onClose, title, children }: { open: boolean; onClose: () => void; title?: string; children: React.ReactNode }) => {
      if (!open) return null;
      return (
        <div role="dialog" aria-modal="true">
          {title && <h2>{title}</h2>}
          {children}
        </div>
      );
    },
  };
});

import AuthLayout from "./(auth)/layout";
import LoginPage from "./(auth)/login/page";
import SignupPage from "./(auth)/signup/page";
import DashboardLayout from "./(dashboard)/layout";
import DashboardPage from "./(dashboard)/page";
import CampaignsPage from "./(dashboard)/campaigns/page";
import ContactsPage from "./(dashboard)/contacts/page";
import SettingsPage from "./(dashboard)/settings/page";
import RootLayout, { metadata } from "./layout";
import Home from "./page";
import { redirect } from "next/navigation";

describe("app routes and layouts", () => {
  it("exports the expected root metadata", () => {
    expect(metadata.title).toBe("OutreachOS — Intelligent Outreach Platform");
    expect(metadata.description).toContain("AI-powered email outreach");
  });

  // RootLayout returns <html>/<body> which conflict with JSDOM's existing
  // document root, so we inspect the element tree directly instead of render().
  // Deep prop access is fragile — update if RootLayout wrappers change.
  it("renders the root layout with the mocked query provider", () => {
    const tree = RootLayout({ children: <span>Child</span> });

    expect(tree.type).toBe("html");
    expect(tree.props.lang).toBe("en");
    expect(tree.props.className).toContain("font-sans-mock");
    expect(tree.props.className).toContain("font-mono-mock");

    const body = tree.props.children;
    expect(body.type).toBe("body");
    expect(body.props.className).toContain("bg-background");
    expect(body.props.children.props.children.type).toBe("span");
    expect(body.props.children.props.children.props.children).toBe("Child");
  });

  it("redirects the home page to the dashboard group", () => {
    Home();
    expect(redirect).toHaveBeenCalledWith("/");
  });

  it("renders the auth layout and pages", () => {
    const { rerender } = render(
      <AuthLayout>
        <span>Auth child</span>
      </AuthLayout>,
    );
    expect(screen.getByText("Auth child")).toBeInTheDocument();
    expect(screen.getByText("Intelligent outreach.")).toBeInTheDocument();

    rerender(<LoginPage />);
    expect(screen.getByText("Welcome back")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /sign in$/i })).toBeInTheDocument();

    rerender(<SignupPage />);
    expect(screen.getByText("Create your account")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /create account$/i })).toBeInTheDocument();
  });

  it("renders the dashboard layout with sidebar navigation links", () => {
    render(
      <DashboardLayout>
        <span>Dashboard child</span>
      </DashboardLayout>,
    );

    expect(screen.getByText("OutreachOS")).toBeInTheDocument();
    expect(screen.getByText("Dashboard child")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /dashboard/i })).toHaveAttribute("href", "/");
    expect(screen.getByRole("link", { name: /contacts/i })).toHaveAttribute("href", "/contacts");
    expect(screen.getByRole("link", { name: /campaigns/i })).toHaveAttribute("href", "/campaigns");
    expect(screen.getByRole("link", { name: /templates/i })).toHaveAttribute("href", "/templates");
    expect(screen.getByRole("link", { name: /analytics/i })).toHaveAttribute("href", "/analytics");
    expect(screen.getByRole("link", { name: /settings/i })).toHaveAttribute("href", "/settings");
  });

  it("renders the dashboard page with stats and activity", () => {
    const { rerender } = render(<DashboardPage />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      /good (morning|afternoon|evening)/i
    );
    expect(screen.getByText("Total Contacts")).toBeInTheDocument();
    expect(screen.getByText("Recent Activity")).toBeInTheDocument();

    rerender(<ContactsPage />);
    expect(screen.getByText("Contacts")).toBeInTheDocument();
    expect(screen.getByText("No contacts yet")).toBeInTheDocument();

    rerender(<CampaignsPage />);
    expect(screen.getByText("Campaigns")).toBeInTheDocument();
    expect(screen.getByText("Campaign management will be implemented in Phase 4.")).toBeInTheDocument();

    rerender(<SettingsPage />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(/settings/i);
    expect(screen.getByText("Account Profile")).toBeInTheDocument();
  });
});
