import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const pushMock = vi.fn();
const useFormMock = vi.fn();
const mutateAsyncMock = vi.fn();
const deleteMutateAsyncMock = vi.fn();

vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "form_123" }),
  useRouter: () => ({ push: pushMock }),
}));

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode; [key: string]: unknown }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

vi.mock("@/lib/hooks/use-forms", () => ({
  useForm: (...args: unknown[]) => useFormMock(...args),
  useUpdateForm: () => ({
    mutateAsync: mutateAsyncMock,
    isPending: false,
    isSuccess: false,
    isError: false,
    error: null,
  }),
  useDeleteForm: () => ({
    mutateAsync: deleteMutateAsyncMock,
    isPending: false,
    isError: false,
    error: null,
  }),
}));

import FormEditorPage from "./page";

describe("FormEditorPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useFormMock.mockReturnValue({
      data: {
        id: "form_123",
        name: "Test Form",
        type: "minimal",
        fields: [
          { name: "first_name", type: "text", required: true, label: "First Name" },
          { name: "email", type: "email", required: true, label: "Email" },
        ],
        htmlContent: '<form class="outreachos-form preview"><div class="form-fields"></div><button type="submit">Submit</button></form>',
        cssContent: ".outreachos-form.preview { border: 1px solid red; }",
        successMessage: "Thanks!",
        redirectUrl: "https://example.com/thanks",
        submissionCount: 2,
      },
      isLoading: false,
      error: null,
    });
  });

  it("renders loaded fields without emitting the duplicate key warning", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    render(<FormEditorPage />);

    expect(screen.getByDisplayValue("First Name")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Email")).toBeInTheDocument();

    const keyWarnings = errorSpy.mock.calls.flat().filter((arg) =>
      typeof arg === "string" && arg.includes('Each child in a list should have a unique "key" prop.')
    );
    expect(keyWarnings).toHaveLength(0);

    errorSpy.mockRestore();
  });

  it("renders a live preview in the design tab", () => {
    render(<FormEditorPage />);

    fireEvent.click(screen.getByRole("button", { name: /design/i }));

    const iframe = screen.getByTitle("Form design preview");
    const srcDoc = iframe.getAttribute("srcdoc") ?? "";

    expect(srcDoc).toContain("First Name");
    expect(srcDoc).toContain("Email");
    expect(srcDoc).toContain("Thanks!");
    expect(srcDoc).toContain("https://example.com/thanks");
    expect(srcDoc).toContain(".outreachos-form.preview { border: 1px solid red; }");
  });
});
