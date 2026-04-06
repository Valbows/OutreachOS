import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import AnalyticsPage from "./page";

describe("AnalyticsPage", () => {
  it("renders the analytics heading and placeholder copy", () => {
    render(<AnalyticsPage />);

    expect(screen.getByRole("heading", { name: /analytics/i })).toBeInTheDocument();
    expect(screen.getByText(/campaign performance and outreach insights/i)).toBeInTheDocument();
    expect(screen.getByText(/analytics data will appear here/i)).toBeInTheDocument();
  });

  it("renders all stat cards", () => {
    render(<AnalyticsPage />);

    expect(screen.getByText("Total Sent")).toBeInTheDocument();
    expect(screen.getByText("Open Rate")).toBeInTheDocument();
    expect(screen.getByText("Reply Rate")).toBeInTheDocument();
    expect(screen.getByText("Bounce Rate")).toBeInTheDocument();
  });
});
