import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Modal,
  Select,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui";

describe("UI primitives", () => {
  beforeEach(() => {
    HTMLDialogElement.prototype.showModal = vi.fn();
    HTMLDialogElement.prototype.close = vi.fn();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("renders button variants, sizes, and disabled state", () => {
    render(
      <>
        <Button>Primary</Button>
        <Button variant="secondary" size="lg" disabled>
          Secondary
        </Button>
      </>,
    );

    expect(screen.getByRole("button", { name: "Primary" })).toHaveClass(
      "bg-gradient-primary",
      "px-4",
    );
    expect(screen.getByRole("button", { name: "Secondary" })).toHaveClass(
      "border-outline/20",
      "px-6",
    );
    expect(screen.getByRole("button", { name: "Secondary" })).toBeDisabled();
  });

  it("renders card primitives with both surface states", () => {
    const { rerender } = render(
      <Card>
        <CardHeader>
          <CardTitle>Title</CardTitle>
        </CardHeader>
        <CardContent>Content</CardContent>
      </Card>,
    );

    expect(screen.getByText("Title")).toHaveClass("text-lg");
    expect(screen.getByText("Content")).toBeInTheDocument();

    rerender(<Card elevated>Elevated</Card>);
    expect(screen.getByText("Elevated")).toHaveClass("shadow-ambient");
  });

  it("renders badges for default and outline variants", () => {
    const { rerender } = render(<Badge>Default</Badge>);
    expect(screen.getByText("Default")).toHaveClass("bg-primary/15");

    rerender(<Badge variant="outline">Outline</Badge>);
    expect(screen.getByText("Outline")).toHaveClass("border-outline-variant/30");
  });

  it("renders input labels, derived ids, explicit ids, and errors", () => {
    const { rerender } = render(
      <Input label="First Name" error="Required" placeholder="Name" />,
    );

    expect(screen.getByLabelText("First Name")).toHaveAttribute(
      "id",
      "first-name",
    );
    expect(screen.getByText("Required")).toBeInTheDocument();
    expect(screen.getByLabelText("First Name")).toHaveClass("border-b-error");

    rerender(<Input id="custom-id" label="Email" />);
    expect(screen.getByLabelText("Email")).toHaveAttribute("id", "custom-id");
  });

  it("renders select labels with generated and explicit ids", () => {
    const { rerender } = render(
      <Select label="Primary LLM Provider">
        <option value="gemini">Gemini</option>
      </Select>,
    );

    const generatedLabel = screen.getByText("Primary LLM Provider");
    const generatedSelect = screen.getByLabelText("Primary LLM Provider");

    expect(generatedSelect).toHaveAttribute("id");
    expect(generatedLabel).toHaveAttribute("for", generatedSelect.getAttribute("id"));

    rerender(
      <Select id="llm-provider" label="Provider">
        <option value="openrouter">OpenRouter</option>
      </Select>,
    );

    const explicitLabel = screen.getByText("Provider");
    const explicitSelect = screen.getByLabelText("Provider");

    expect(explicitSelect).toHaveAttribute("id", "llm-provider");
    expect(explicitLabel).toHaveAttribute("for", "llm-provider");
  });

  it("renders switch semantics with the current checked state", () => {
    const { rerender } = render(<Switch aria-label="Notifications" checked={true} onCheckedChange={vi.fn()} />);

    expect(screen.getByRole("switch", { name: "Notifications" })).toHaveAttribute(
      "aria-checked",
      "true",
    );

    rerender(<Switch aria-label="Notifications" checked={false} onCheckedChange={vi.fn()} />);

    expect(screen.getByRole("switch", { name: "Notifications" })).toHaveAttribute(
      "aria-checked",
      "false",
    );
  });

  it("applies switch className to the root label", () => {
    render(<Switch aria-label="Email alerts" checked={true} onCheckedChange={vi.fn()} className="mt-0.5 shrink-0" />);

    const switchInput = screen.getByRole("switch", { name: "Email alerts" });
    expect(switchInput.closest("label")).toHaveClass("mt-0.5", "shrink-0");
  });

  it("opens and closes the modal based on the open prop and forwards close events", () => {
    const onClose = vi.fn();
    const { container, rerender } = render(
      <Modal open onClose={onClose} title="Dialog title">
        Modal body
      </Modal>,
    );

    const dialog = container.querySelector("dialog");
    expect(dialog).toBeInstanceOf(HTMLDialogElement);
    expect(HTMLDialogElement.prototype.showModal).toHaveBeenCalled();
    expect(screen.getByText("Dialog title")).toBeInTheDocument();
    expect(screen.getByText("Modal body")).toBeInTheDocument();

    (dialog as HTMLDialogElement).dispatchEvent(new Event("close"));
    expect(onClose).toHaveBeenCalledTimes(1);

    rerender(
      <Modal open={false} onClose={onClose}>
        Closed body
      </Modal>,
    );
    expect(HTMLDialogElement.prototype.close).toHaveBeenCalled();
  });

  it("renders table primitives together", () => {
    render(
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow>
            <TableCell>Alice</TableCell>
          </TableRow>
        </TableBody>
      </Table>,
    );

    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(screen.getByText("Name")).toHaveClass("font-mono");
    expect(screen.getByText("Alice")).toHaveClass("px-4", "py-3");
  });
});
