import { render, screen, fireEvent } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { usePathname } from "next/navigation";
import { authClient } from "@/lib/auth/client";
import { useUIStore } from "@/lib/store";
import { Sidebar } from "./sidebar";

const pushMock = vi.fn();

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode; [key: string]: unknown }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

vi.mock("next/navigation", () => ({
  usePathname: vi.fn(() => "/"),
  useRouter: vi.fn(() => ({ push: pushMock })),
}));

vi.mock("@/lib/auth/client", () => ({
  authClient: {
    signIn: { social: vi.fn() },
    signOut: vi.fn(async () => {}),
  },
}));

describe("Sidebar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(usePathname).mockReturnValue("/");
    useUIStore.setState({ sidebarOpen: true, activeAccountId: null });
  });

  it("renders logo, main nav items, and settings link", () => {
    render(<Sidebar />);

    expect(screen.getByText("OutreachOS")).toBeInTheDocument();
    expect(screen.getByText("Dashboard")).toBeInTheDocument();
    expect(screen.getByText("Contacts")).toBeInTheDocument();
    expect(screen.getByText("Campaigns")).toBeInTheDocument();
    expect(screen.getByText("Templates")).toBeInTheDocument();
    expect(screen.getByText("Analytics")).toBeInTheDocument();
    expect(screen.getByText("Settings")).toBeInTheDocument();
    expect(screen.getByText("Log out")).toBeInTheDocument();
  });

  it("highlights the active nav item based on pathname", () => {
    vi.mocked(usePathname).mockReturnValue("/contacts");
    render(<Sidebar />);

    const contactsLink = screen.getByText("Contacts").closest("a");
    expect(contactsLink).toHaveAttribute("data-active", "true");

    const dashboardLink = screen.getByText("Dashboard").closest("a");
    expect(dashboardLink).toHaveAttribute("data-active", "false");
  });

  it("calls authClient.signOut when log out is clicked", () => {
    render(<Sidebar />);

    fireEvent.click(screen.getByText("Log out"));
    expect(authClient.signOut).toHaveBeenCalled();
  });

  it("shows an error message when sign out fails", async () => {
    vi.mocked(authClient.signOut).mockRejectedValueOnce(new Error("Sign out failed"));
    render(<Sidebar />);

    fireEvent.click(screen.getByText("Log out"));

    expect(authClient.signOut).toHaveBeenCalled();
    expect(await screen.findByRole("alert")).toHaveTextContent("Sign out failed");
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("shows collapsed loading feedback while signing out", () => {
    vi.mocked(authClient.signOut).mockImplementationOnce(() => new Promise(() => {}));
    useUIStore.setState({ sidebarOpen: false });

    const { container } = render(<Sidebar />);

    fireEvent.click(screen.getByRole("button", { name: /log out/i }));

    const button = screen.getByRole("button", { name: /signing out/i });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-busy", "true");
    expect(container.querySelector("svg.animate-spin")).not.toBeNull();
  });
});
