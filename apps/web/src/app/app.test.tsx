import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/font/google", () => ({
  Inter: () => ({ variable: "font-sans-mock" }),
  JetBrains_Mono: () => ({ variable: "font-mono-mock" }),
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
}));

vi.mock("@/lib/query-provider", () => ({
  QueryProvider: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="query-provider">{children}</div>
  ),
}));

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

    rerender(<LoginPage />);
    expect(screen.getByText("Welcome back")).toBeInTheDocument();
    expect(screen.getByText("Sign in to your OutreachOS account")).toBeInTheDocument();

    rerender(<SignupPage />);
    expect(screen.getByText("Create your account")).toBeInTheDocument();
    expect(screen.getByText("Get started with OutreachOS")).toBeInTheDocument();
  });

  it("renders the dashboard layout with navigation links", () => {
    render(
      <DashboardLayout>
        <span>Dashboard child</span>
      </DashboardLayout>,
    );

    expect(screen.getByText("OutreachOS")).toBeInTheDocument();
    expect(screen.getByText("Dashboard child")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Dashboard" })).toHaveAttribute(
      "href",
      "/",
    );
    expect(screen.getByRole("link", { name: "Contacts" })).toHaveAttribute(
      "href",
      "/contacts",
    );
    expect(screen.getByRole("link", { name: "Campaigns" })).toHaveAttribute(
      "href",
      "/campaigns",
    );
    expect(screen.getByRole("link", { name: "Templates" })).toHaveAttribute(
      "href",
      "/templates",
    );
    expect(screen.getByRole("link", { name: "Forms" })).toHaveAttribute(
      "href",
      "/forms",
    );
    expect(screen.getByRole("link", { name: "Analytics" })).toHaveAttribute(
      "href",
      "/analytics",
    );
    expect(screen.getByRole("link", { name: "Settings" })).toHaveAttribute(
      "href",
      "/settings",
    );
  });

  it("renders the current dashboard placeholder pages", () => {
    const { rerender } = render(<DashboardPage />);
    expect(screen.getByText("Dashboard")).toBeInTheDocument();
    expect(screen.getByText("Recent Activity")).toBeInTheDocument();
    expect(screen.getByText("Total Contacts")).toBeInTheDocument();
    expect(screen.getByText("Active Campaigns")).toBeInTheDocument();
    expect(screen.getByText("Open Rate")).toBeInTheDocument();
    expect(screen.getByText("Response Rate")).toBeInTheDocument();
    expect(screen.getAllByText("—")).toHaveLength(4);

    rerender(<ContactsPage />);
    expect(screen.getByText("Contacts")).toBeInTheDocument();
    expect(screen.getByText("Contact management will be implemented in Phase 3.")).toBeInTheDocument();

    rerender(<CampaignsPage />);
    expect(screen.getByText("Campaigns")).toBeInTheDocument();
    expect(screen.getByText("Campaign management will be implemented in Phase 4.")).toBeInTheDocument();

    rerender(<SettingsPage />);
    expect(screen.getByText("Settings")).toBeInTheDocument();
    expect(screen.getByText("Account settings will be implemented in Phase 2.")).toBeInTheDocument();
  });
});
