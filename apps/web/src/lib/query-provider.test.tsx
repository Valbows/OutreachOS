import { useQueryClient } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { QueryProvider } from "./query-provider";

function QueryClientProbe() {
  const client = useQueryClient();
  const defaultOptions = client.getDefaultOptions().queries;

  return (
    <div>
      <span data-testid="stale-time">{String(defaultOptions?.staleTime)}</span>
      <span data-testid="refetch-window-focus">
        {String(defaultOptions?.refetchOnWindowFocus)}
      </span>
    </div>
  );
}

describe("QueryProvider", () => {
  it("renders children inside a QueryClientProvider with the expected defaults", () => {
    render(
      <QueryProvider>
        <QueryClientProbe />
      </QueryProvider>,
    );

    expect(screen.getByTestId("stale-time")).toHaveTextContent("60000");
    expect(screen.getByTestId("refetch-window-focus")).toHaveTextContent(
      "false",
    );
  });

  it("renders children", () => {
    render(
      <QueryProvider>
        <div>nested</div>
      </QueryProvider>,
    );

    expect(screen.getByText("nested")).toBeInTheDocument();
  });
});
