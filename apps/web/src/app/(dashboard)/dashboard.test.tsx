import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import DashboardPage from "./page";

describe("DashboardPage", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2024, 0, 1, 9, 0, 0));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders the greeting heading", () => {
    render(<DashboardPage />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(/good morning/i);
  });

  it("renders the four stat cards", () => {
    render(<DashboardPage />);
    expect(screen.getByText("Total Contacts")).toBeInTheDocument();
    // "Active Campaigns" appears as both a stat label and a section heading
    expect(screen.getAllByText("Active Campaigns").length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText("Avg Open Rate")).toBeInTheDocument();
    expect(screen.getByText("Avg Response Rate")).toBeInTheDocument();
  });

  it("renders active campaign rows", () => {
    render(<DashboardPage />);
    expect(screen.getByText("Q4 Enterprise Outreach")).toBeInTheDocument();
    expect(screen.getByText("Founder Direct [A/B]")).toBeInTheDocument();
    expect(screen.getByText("Lead Nurturing Loop")).toBeInTheDocument();
  });

  it("renders inbox health metrics", () => {
    render(<DashboardPage />);
    expect(screen.getByText("Bounce Rate")).toBeInTheDocument();
    expect(screen.getByText("Complaints")).toBeInTheDocument();
  });

  it("renders recent activity section", () => {
    render(<DashboardPage />);
    expect(screen.getByText(/scheduled a new send/i)).toBeInTheDocument();
    expect(screen.getByText(/enriched 284 new leads/i)).toBeInTheDocument();
  });

  it("renders experiment progress bar", () => {
    render(<DashboardPage />);
    expect(screen.getByText(/subject line test/i)).toBeInTheDocument();
    expect(screen.getByText(/65% complete/i)).toBeInTheDocument();
  });
});
