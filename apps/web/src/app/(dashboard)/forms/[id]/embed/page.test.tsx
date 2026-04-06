import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import GetEmbedCodePage from "./page";

const mockUseFormEmbedCodes = vi.fn();
const writeText = vi.fn();

vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "form_1" }),
}));

vi.mock("@/lib/hooks/use-forms", () => ({
  useFormEmbedCodes: (id: string) => mockUseFormEmbedCodes(id),
}));

beforeEach(() => {
  vi.clearAllMocks();
  vi.useRealTimers();
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText },
  });
  mockUseFormEmbedCodes.mockReturnValue({
    data: {
      hosted: "https://example.com/form_1",
      iframe: "<iframe src=\"https://example.com/form_1\"></iframe>",
      widget: "<script src=\"https://example.com/widget.js\"></script>",
    },
    isLoading: false,
    error: null,
  });
});

describe("GetEmbedCodePage", () => {
  it("renders loading state", () => {
    mockUseFormEmbedCodes.mockReturnValue({ data: null, isLoading: true, error: null });

    render(<GetEmbedCodePage />);

    expect(document.querySelector(".animate-spin")).toBeInTheDocument();
  });

  it("renders error state when codes cannot be loaded", () => {
    mockUseFormEmbedCodes.mockReturnValue({ data: null, isLoading: false, error: new Error("boom") });

    render(<GetEmbedCodePage />);

    expect(screen.getByText(/failed to load embed codes/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /back to forms/i })).toHaveAttribute("href", "/forms");
  });

  it("renders embed methods and copies code to the clipboard", async () => {
    writeText.mockResolvedValueOnce(undefined);

    render(<GetEmbedCodePage />);

    expect(screen.getByText("Hosted Link")).toBeInTheDocument();
    expect(screen.getByText("iFrame Embed")).toBeInTheDocument();
    expect(screen.getByText("JavaScript Widget")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /copy hosted link code/i }));

    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith("https://example.com/form_1");
      expect(screen.getByRole("button", { name: /copy hosted link code/i })).toHaveTextContent("Copied!");
    });
  });

  it("handles clipboard write failures gracefully", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    writeText.mockRejectedValueOnce(new Error("clipboard denied"));

    render(<GetEmbedCodePage />);

    fireEvent.click(screen.getByRole("button", { name: /copy hosted link code/i }));

    await waitFor(() => {
      expect(consoleErrorSpy).toHaveBeenCalled();
    });
    consoleErrorSpy.mockRestore();
  });
});
