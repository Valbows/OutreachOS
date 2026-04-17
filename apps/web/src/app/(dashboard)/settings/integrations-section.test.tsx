import React from "react";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { IntegrationsSection } from "./integrations-section";

const mockUseMcpServers = vi.fn();
const mockCreateMutateAsync = vi.fn();
const mockUpdateMutateAsync = vi.fn();
const mockDeleteMutateAsync = vi.fn();
const mockTestMutateAsync = vi.fn();

vi.mock("@/lib/hooks/use-mcp-servers", () => ({
  useMcpServers: () => mockUseMcpServers(),
  useCreateMcpServer: () => ({ mutateAsync: mockCreateMutateAsync, isPending: false }),
  useUpdateMcpServer: () => ({ mutateAsync: mockUpdateMutateAsync, isPending: false }),
  useDeleteMcpServer: () => ({ mutateAsync: mockDeleteMutateAsync, isPending: false }),
  useTestMcpServer: () => ({ mutateAsync: mockTestMutateAsync }),
}));

vi.mock("@/components/ui", () => ({
  Button: ({
    children,
    type = "button",
    ...rest
  }: React.ButtonHTMLAttributes<HTMLButtonElement> & { type?: "button" | "submit" | "reset" }) => (
    <button type={type} {...rest}>
      {children}
    </button>
  ),
}));

const mockServers = [
  {
    id: "s1",
    accountId: "acc-1",
    name: "My MCP Server",
    url: "https://mcp.example.com",
    apiKey: null,
    description: "A test MCP server",
    enabled: 1,
    lastTestedAt: null,
    lastTestStatus: null,
    lastTestError: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

describe("IntegrationsSection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("confirm", vi.fn(() => true));
    mockCreateMutateAsync.mockResolvedValue({});
    mockUpdateMutateAsync.mockResolvedValue({});
    mockDeleteMutateAsync.mockResolvedValue(undefined);
    mockTestMutateAsync.mockResolvedValue({ ok: true, latencyMs: 50 });
    mockUseMcpServers.mockReturnValue({ data: [], isLoading: false, error: null });
  });

  it("renders OutreachOS MCP info card", () => {
    render(<IntegrationsSection />);
    expect(screen.getByText(/OutreachOS MCP Server/i)).toBeInTheDocument();
    expect(screen.getByText(/MCP Server URL/i)).toBeInTheDocument();
    expect(screen.getByText(/Claude Desktop config/i)).toBeInTheDocument();
    expect(screen.getByText(/Cursor config/i)).toBeInTheDocument();
  });

  it("renders loading state", () => {
    mockUseMcpServers.mockReturnValue({ data: undefined, isLoading: true, error: null });
    render(<IntegrationsSection />);
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it("renders error state", () => {
    mockUseMcpServers.mockReturnValue({ data: undefined, isLoading: false, error: new Error("fail") });
    render(<IntegrationsSection />);
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByText(/failed to load mcp servers/i)).toBeInTheDocument();
  });

  it("renders empty state when no servers", () => {
    render(<IntegrationsSection />);
    expect(screen.getByText(/no external mcp servers yet/i)).toBeInTheDocument();
  });

  it("renders server cards", () => {
    mockUseMcpServers.mockReturnValue({ data: mockServers, isLoading: false, error: null });
    render(<IntegrationsSection />);
    expect(screen.getByText("My MCP Server")).toBeInTheDocument();
    expect(screen.getByText("https://mcp.example.com")).toBeInTheDocument();
    expect(screen.getByText("A test MCP server")).toBeInTheDocument();
  });

  it("shows add form when button clicked", async () => {
    const user = userEvent.setup();
    render(<IntegrationsSection />);
    await user.click(screen.getByRole("button", { name: /\+ add server/i }));
    expect(screen.getByLabelText(/name \*/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/url \*/i)).toBeInTheDocument();
  });

  it("hides form on cancel", async () => {
    const user = userEvent.setup();
    render(<IntegrationsSection />);
    await user.click(screen.getByRole("button", { name: /\+ add server/i }));
    await user.click(screen.getByRole("button", { name: /cancel/i }));
    expect(screen.queryByLabelText(/name \*/i)).not.toBeInTheDocument();
  });

  it("submits add form and calls create", async () => {
    const user = userEvent.setup();
    render(<IntegrationsSection />);
    await user.click(screen.getByRole("button", { name: /\+ add server/i }));
    await user.type(screen.getByLabelText(/name \*/i), "New Server");
    await user.type(screen.getByLabelText(/url \*/i), "https://new.example.com");
    await user.click(screen.getByRole("button", { name: /^add server$/i }));

    await waitFor(() => {
      expect(mockCreateMutateAsync).toHaveBeenCalledWith({
        name: "New Server",
        url: "https://new.example.com",
      });
    });
  });

  it("shows validation error when name empty on submit", async () => {
    const user = userEvent.setup();
    const { container } = render(<IntegrationsSection />);
    await user.click(screen.getByRole("button", { name: /\+ add server/i }));

    // Submit the form directly
    const form = container.querySelector("form")!;
    fireEvent.submit(form);

    await waitFor(() => {
      expect(screen.getByText(/name is required/i)).toBeInTheDocument();
    });
    expect(mockCreateMutateAsync).not.toHaveBeenCalled();
  });

  it("tests a server and shows success result", async () => {
    const user = userEvent.setup();
    mockUseMcpServers.mockReturnValue({ data: mockServers, isLoading: false, error: null });
    render(<IntegrationsSection />);

    // Button text is "Test", aria-label is `Test ${server.name}`
    await user.click(screen.getByRole("button", { name: /^test my mcp server$/i }));

    await waitFor(() => {
      expect(mockTestMutateAsync).toHaveBeenCalledWith("s1");
      expect(screen.getByRole("status")).toBeInTheDocument();
      expect(screen.getByText(/connected successfully/i)).toBeInTheDocument();
    });
  });

  it("shows failed result when test fails", async () => {
    mockTestMutateAsync.mockResolvedValueOnce({ ok: false, error: "Connection refused" });
    const user = userEvent.setup();
    mockUseMcpServers.mockReturnValue({ data: mockServers, isLoading: false, error: null });
    render(<IntegrationsSection />);

    await user.click(screen.getByRole("button", { name: /^test my mcp server$/i }));

    await waitFor(() => {
      expect(screen.getByText(/connection failed/i)).toBeInTheDocument();
      expect(screen.getByText(/connection refused/i)).toBeInTheDocument();
    });
  });

  it("deletes a server after confirmation", async () => {
    const user = userEvent.setup();
    mockUseMcpServers.mockReturnValue({ data: mockServers, isLoading: false, error: null });
    render(<IntegrationsSection />);

    await user.click(screen.getByRole("button", { name: /^remove my mcp server$/i }));

    await waitFor(() => {
      expect(mockDeleteMutateAsync).toHaveBeenCalledWith("s1");
    });
  });

  it("does not delete when confirmation cancelled", async () => {
    vi.stubGlobal("confirm", vi.fn(() => false));
    const user = userEvent.setup();
    mockUseMcpServers.mockReturnValue({ data: mockServers, isLoading: false, error: null });
    render(<IntegrationsSection />);

    await user.click(screen.getByRole("button", { name: /^remove my mcp server$/i }));

    expect(mockDeleteMutateAsync).not.toHaveBeenCalled();
  });

  it("toggles server enabled state", async () => {
    const user = userEvent.setup();
    mockUseMcpServers.mockReturnValue({ data: mockServers, isLoading: false, error: null });
    render(<IntegrationsSection />);

    await user.click(screen.getByRole("button", { name: /disable/i }));

    await waitFor(() => {
      expect(mockUpdateMutateAsync).toHaveBeenCalledWith({ id: "s1", enabled: false });
    });
  });
});
