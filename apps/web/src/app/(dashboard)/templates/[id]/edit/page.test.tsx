import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import TemplateEditorPage from "./page";

const { sanitizeMock } = vi.hoisted(() => ({
  sanitizeMock: vi.fn((html: string) => html),
}));

const mockBack = vi.fn();
const mockUseTemplate = vi.fn();

const updateMutation = {
  mutateAsync: vi.fn(),
  isPending: false,
  isError: false,
  error: null,
};

const rewriteMutation: {
  mutateAsync: ReturnType<typeof vi.fn>;
  isPending: boolean;
  isError: boolean;
  error: Error | null;
} = {
  mutateAsync: vi.fn(),
  isPending: false,
  isError: false,
  error: null,
};

const subjectsMutation = {
  mutateAsync: vi.fn(),
  isPending: false,
  isError: false,
  error: null,
};

vi.mock("next/navigation", () => ({
  useRouter: () => ({ back: mockBack }),
  useParams: () => ({ id: "tpl_1" }),
}));

vi.mock("dompurify", () => ({
  default: {
    sanitize: sanitizeMock,
  },
}));

vi.mock("@/lib/hooks/use-templates", () => ({
  useTemplate: () => mockUseTemplate(),
  useUpdateTemplate: () => updateMutation,
  useRewriteEmail: () => rewriteMutation,
  useGenerateSubjects: () => subjectsMutation,
}));

describe("TemplateEditorPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    updateMutation.isPending = false;
    updateMutation.isError = false;
    updateMutation.error = null;
    updateMutation.mutateAsync.mockReset();
    rewriteMutation.isPending = false;
    rewriteMutation.isError = false;
    rewriteMutation.error = null;
    rewriteMutation.mutateAsync.mockReset();
    subjectsMutation.isPending = false;
    subjectsMutation.isError = false;
    subjectsMutation.error = null;
    subjectsMutation.mutateAsync.mockReset();
    mockUseTemplate.mockReturnValue({
      data: {
        id: "tpl_1",
        name: "Welcome Template",
        subject: "Hello there",
        bodyHtml: "<p>Hello world</p>",
        version: 3,
      },
      isLoading: false,
      isError: false,
      error: null,
    });
  });

  it("renders a loading state", () => {
    mockUseTemplate.mockReturnValueOnce({ data: null, isLoading: true, isError: false, error: null });

    render(<TemplateEditorPage />);

    expect(document.querySelector(".animate-spin")).toBeInTheDocument();
  });

  it("renders an error state and navigates back", async () => {
    const user = userEvent.setup();
    mockUseTemplate.mockReturnValueOnce({
      data: null,
      isLoading: false,
      isError: true,
      error: new Error("Template lookup failed"),
    });

    render(<TemplateEditorPage />);

    expect(screen.getByText(/failed to load template/i)).toBeInTheDocument();
    expect(screen.getByText(/template lookup failed/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /go back/i }));

    expect(mockBack).toHaveBeenCalled();
  });

  it("initializes from template data and saves changes", async () => {
    const user = userEvent.setup();
    updateMutation.mutateAsync.mockResolvedValueOnce({});

    render(<TemplateEditorPage />);

    const nameInput = await screen.findByDisplayValue("Welcome Template");
    const subjectInput = screen.getByPlaceholderText(/enter subject line/i);
    const bodyTextarea = screen.getByPlaceholderText(/write your email body here/i);

    await user.clear(nameInput);
    await user.type(nameInput, "Updated Template");
    await user.clear(subjectInput);
    await user.type(subjectInput, "Updated subject");
    await user.clear(bodyTextarea);
    await user.type(bodyTextarea, "Updated body");
    await user.click(screen.getByRole("button", { name: /^save$/i }));

    await waitFor(() => {
      expect(updateMutation.mutateAsync).toHaveBeenCalledWith({
        id: "tpl_1",
        name: "Updated Template",
        subject: "Updated subject",
        bodyHtml: "Updated body",
      });
    });
    expect(screen.getByRole("button", { name: /saved!/i })).toBeInTheDocument();
  });

  it("generates subject suggestions from json and applies one", async () => {
    const user = userEvent.setup();
    subjectsMutation.mutateAsync.mockResolvedValueOnce({ text: '["Alpha subject","Beta subject","Gamma subject"]' });

    render(<TemplateEditorPage />);

    await user.click(screen.getByRole("button", { name: /^suggest$/i }));

    await waitFor(() => {
      expect(subjectsMutation.mutateAsync).toHaveBeenCalledWith({
        emailBody: "<p>Hello world</p>",
        tone: "professional",
        count: 3,
      });
    });

    await user.click(screen.getByRole("button", { name: "Alpha subject" }));

    expect(screen.getByPlaceholderText(/enter subject line/i)).toHaveValue("Alpha subject");
    expect(screen.queryByRole("button", { name: "Beta subject" })).not.toBeInTheDocument();
  });

  it("falls back to line parsing for subject suggestions", async () => {
    const user = userEvent.setup();
    subjectsMutation.mutateAsync.mockResolvedValueOnce({ text: '1. "First line"\n2. "Second line"' });

    render(<TemplateEditorPage />);

    await user.click(screen.getByRole("button", { name: /^suggest$/i }));

    expect(await screen.findByRole("button", { name: "First line" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Second line" })).toBeInTheDocument();
  });

  it("inserts tokens and rewrites body text successfully", async () => {
    const user = userEvent.setup();
    rewriteMutation.mutateAsync.mockResolvedValueOnce({ text: "Rewritten email body" });
    rewriteMutation.isError = false;

    render(<TemplateEditorPage />);

    const bodyTextarea = screen.getByPlaceholderText(/write your email body here/i);
    await user.click(screen.getByRole("button", { name: /^\{FirstName\}$/i }));
    expect(bodyTextarea).toHaveValue("<p>Hello world</p>{FirstName}");

    await user.click(screen.getByRole("button", { name: /ai workshop/i }));
    await user.type(screen.getByPlaceholderText(/make it more conversational/i), "Make it shorter");
    await user.click(screen.getByRole("button", { name: /apply ai rewrite/i }));

    await waitFor(() => {
      expect(rewriteMutation.mutateAsync).toHaveBeenCalledWith({
        currentBody: "<p>Hello world</p>{FirstName}",
        instruction: "Make it shorter",
      });
    });
    await waitFor(() => expect(bodyTextarea).toHaveValue("Rewritten email body"));
    expect(sanitizeMock).toHaveBeenCalled();
  });

  it("shows error when AI rewrite fails", async () => {
    const user = userEvent.setup();
    // Set up error state on the mutation mock (mutateAsync resolves to avoid unhandled rejection)
    rewriteMutation.isError = true;
    rewriteMutation.error = new Error("Gemini error");
    rewriteMutation.mutateAsync.mockResolvedValueOnce({ text: "" });

    render(<TemplateEditorPage />);

    const bodyTextarea = screen.getByPlaceholderText(/write your email body here/i);
    await user.click(screen.getByRole("button", { name: /^\{FirstName\}$/i }));

    await user.click(screen.getByRole("button", { name: /ai workshop/i }));
    await user.type(screen.getByPlaceholderText(/make it more conversational/i), "Make it shorter");
    await user.click(screen.getByRole("button", { name: /apply ai rewrite/i }));

    expect(screen.getByText(/failed to generate\. check your gemini api key\./i)).toBeInTheDocument();
  });
});
